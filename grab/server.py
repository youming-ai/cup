"""grab — World Cup stream resolver.

/extract?url=<embed>  → run the embed page in headless Chromium, capture the
                        real (JS-generated) .m3u8, and return a same-origin
                        /proxy URL the browser can play.
/proxy?url=&ref=      → fetch the playlist/segment with curl_cffi impersonating
                        Chrome (defeats the CDN's TLS-fingerprint block + 403),
                        rewrite child URLs back through /proxy, add CORS.
"""

import asyncio
import re
import urllib.parse
from urllib.parse import urljoin, urlparse

from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from playwright.async_api import async_playwright
from curl_cffi import requests as cffi

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
NAV_TIMEOUT_MS = 20000
M3U8_WAIT_S = 25.0
# only fetch what's needed to reach the playlist; drop heavy/irrelevant types
BLOCK_TYPES = {"image", "media", "font", "stylesheet"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}

app = FastAPI()

_pw = None
_browser = None


async def get_browser():
    global _pw, _browser
    if _browser and _browser.is_connected():
        return _browser
    if _pw is None:
        _pw = await async_playwright().start()
    _browser = await _pw.chromium.launch(
        headless=False,  # full headed Chromium under Xvfb — the player needs it
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--mute-audio",
            "--disable-blink-features=AutomationControlled",
            "--ignore-certificate-errors",
        ],
    )
    return _browser


def origin_of(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}/"


def proxify(abs_url: str, ref: str) -> str:
    return (
        "/proxy?url="
        + urllib.parse.quote(abs_url, safe="")
        + "&ref="
        + urllib.parse.quote(ref, safe="")
    )


async def extract(embed_url: str):
    browser = await get_browser()
    page = await browser.new_page(user_agent=UA, ignore_https_errors=True)
    found = {"url": None}

    def on_response(resp):
        if ".m3u8" in resp.url and found["url"] is None and resp.status == 200:
            found["url"] = resp.url

    page.on("response", on_response)

    print(f"[extract] navigating to {embed_url}", flush=True)
    try:
        await page.goto(embed_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    except Exception as e:
        print(f"[extract] nav: {e}", flush=True)

    # The player rarely fires the .m3u8 network request under headless autoplay,
    # but jwplayer holds the (JS-built) source URL — read it from the DOM. Poll
    # both: whichever appears first wins.
    # try to start playback (the source URL is often only resolved on play) and
    # read it from any of jwplayer's source accessors
    JW = (
        "() => { try {"
        " const p = window.jwplayer && window.jwplayer(); if (!p) return null;"
        " if (p.play) { try { p.play(); } catch(e){} }"
        " const it = p.getPlaylistItem && p.getPlaylistItem(); if (it && it.file) return it.file;"
        " const pl = (p.getPlaylist && p.getPlaylist()) || []; if (pl[0] && pl[0].file) return pl[0].file;"
        " const cfg = (p.getConfig && p.getConfig()) || {}; if (cfg.file) return cfg.file;"
        " const c0 = cfg.playlist && cfg.playlist[0]; if (c0 && c0.file) return c0.file;"
        " const s0 = c0 && c0.sources && c0.sources[0]; if (s0 && s0.file) return s0.file;"
        " } catch (e) {} return null; }"
    )
    m3u8 = None
    waited = 0.0
    while waited < M3U8_WAIT_S:
        if found["url"]:
            m3u8 = found["url"]
            break
        try:
            f = await page.evaluate(JW)
        except Exception:
            f = None
        if f:
            m3u8 = f
            break
        await asyncio.sleep(0.4)
        waited += 0.4

    print(f"[extract] m3u8={m3u8}", flush=True)
    await page.close()
    return m3u8


def rewrite_manifest(text: str, base: str, ref: str) -> str:
    out = []
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            out.append(raw)
            continue
        if s.startswith("#"):
            m = re.search(r'URI="([^"]+)"', s)  # EXT-X-KEY / EXT-X-MAP
            if m:
                abs_u = urljoin(base, m.group(1))
                raw = raw.replace(m.group(1), proxify(abs_u, ref))
            out.append(raw)
            continue
        out.append(proxify(urljoin(base, s), ref))  # segment / sub-playlist line
    return "\n".join(out)


@app.options("/extract")
@app.options("/proxy")
async def _options():
    return Response(status_code=204, headers=CORS)


@app.get("/")
async def root():
    return JSONResponse({"service": "grab", "usage": "/extract?url=<embed_url>"}, headers=CORS)


@app.get("/extract")
async def extract_ep(url: str):
    try:
        m3u8 = await extract(url)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500, headers=CORS)
    if not m3u8:
        return JSONResponse(
            {"ok": False, "error": "failed to extract m3u8"}, status_code=500, headers=CORS
        )
    return JSONResponse({"ok": True, "m3u8": proxify(m3u8, origin_of(url))}, headers=CORS)


# sync (runs in FastAPI's threadpool) — curl_cffi is blocking
@app.get("/proxy")
def proxy_ep(url: str, ref: str = "https://embedindia.st/"):
    headers = {"Referer": ref, "Origin": ref.rstrip("/"), "User-Agent": UA}
    try:
        r = cffi.get(url, headers=headers, impersonate="chrome", verify=False, timeout=25)
    except Exception as e:  # noqa: BLE001
        return Response(f"proxy error: {e}", status_code=502, headers=CORS)

    ctype = r.headers.get("content-type", "")
    is_manifest = urlparse(url).path.lower().endswith(".m3u8") or "mpegurl" in ctype.lower()
    if is_manifest:
        body = rewrite_manifest(r.text, url, ref)
        return Response(
            body,
            status_code=r.status_code,
            headers={**CORS, "Content-Type": "application/vnd.apple.mpegurl"},
        )
    return Response(
        r.content,
        status_code=r.status_code,
        headers={**CORS, "Content-Type": ctype or "application/octet-stream"},
    )
