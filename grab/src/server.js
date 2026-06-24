const puppeteer = require("puppeteer-core");
const http = require("http");

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS) || 20000;
const M3U8_WAIT = Number(process.env.M3U8_WAIT_MS) || 12000; // max wait for an m3u8 after nav
const CACHE_TTL = Number(process.env.CACHE_TTL_MS) || 60000; // per-embed cache lifetime

let browser = null;

async function getBrowser() {
  if (browser?.connected) return browser;
  browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--ignore-certificate-errors",
      "--disable-blink-features=AutomationControlled",
      "--mute-audio",
    ],
  });
  browser.on("disconnected", () => {
    browser = null;
  });
  return browser;
}

// in-memory TTL cache. ponytail: unbounded Map, fine for the few dozen distinct
// embed URLs in play; add an LRU cap only if distinct embeds ever exceed ~1k.
const cache = new Map();
function cacheGet(url) {
  const e = cache.get(url);
  if (e && e.expires > Date.now()) return e.result;
  if (e) cache.delete(url);
  return null;
}
function cacheSet(url, result) {
  cache.set(url, { result, expires: Date.now() + CACHE_TTL });
}

// Only fetch what's needed to reach the m3u8. The playlist itself is an
// xhr/fetch request (allowed); we drop heavy/irrelevant resource types to cut
// RAM/bandwidth and speed things up. Host-based ad-blocking is intentionally
// avoided — some embeds gate the stream behind an ad call.
const BLOCK_TYPES = new Set(["image", "media", "font", "stylesheet"]);

async function extract(embedUrl) {
  const cached = cacheGet(embedUrl);
  if (cached) {
    console.log(`[extract] cache hit ${embedUrl}`);
    return cached;
  }

  const b = await getBrowser();
  const page = await b.newPage();

  const m3u8Urls = [];
  let resolveFirst;
  const firstM3u8 = new Promise((res) => {
    resolveFirst = res;
  });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (BLOCK_TYPES.has(req.resourceType())) {
      req.abort().catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });
  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes(".m3u8")) {
      m3u8Urls.push(url);
      resolveFirst(url); // early-resolve as soon as the first playlist appears
      console.log(`[extract] m3u8: ${url}`);
    }
  });

  console.log(`[extract] navigating to ${embedUrl}`);
  try {
    await page.goto(embedUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  } catch (err) {
    console.log(`[extract] nav: ${err.message}`);
  }

  // resolve as soon as a playlist is seen, or give up after M3U8_WAIT
  await Promise.race([firstM3u8, new Promise((r) => setTimeout(r, M3U8_WAIT))]);

  let result = null;
  // jwplayer exposes the main file directly (cleaner than guessing from network)
  try {
    const item = await page.evaluate(() => {
      const p = window.jwplayer?.();
      if (!p) return null;
      const it = p.getPlaylistItem?.();
      if (!it?.file) return null;
      return { m3u8: it.file, type: it.type };
    });
    if (item) {
      result = item;
      console.log(`[extract] jwplayer OK`);
    }
  } catch (err) {
    console.log(`[extract] jwplayer err: ${err.message}`);
  }

  if (!result?.m3u8 && m3u8Urls.length > 0) {
    const main = m3u8Urls.find((u) => u.includes("index.m3u8")) || m3u8Urls[0];
    result = { m3u8: main };
    console.log(`[extract] network OK`);
  }

  await page.close().catch(() => {});
  if (result?.m3u8) cacheSet(embedUrl, result);
  return result;
}

const port = Number(process.env.PORT) || 8081;

const server = http.createServer(async (req, res) => {
  // CORS: allow the browser SPA (any origin) to call /extract
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ service: "grab", usage: "/extract?url=<embed_url>" }));
    return;
  }

  if (url.pathname === "/extract") {
    const target = url.searchParams.get("url");
    if (!target) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "missing url parameter" }));
      return;
    }
    try {
      const result = await extract(target);
      if (!result?.m3u8) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "failed to extract m3u8" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        m3u8: result.m3u8,
        ...(result.type ? { type: result.type } : {}),
      }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err?.message || "unknown error" }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => console.log(`grab listening on :${port}`));

process.on("SIGTERM", async () => { await browser?.close(); process.exit(0); });
process.on("SIGINT", async () => { await browser?.close(); process.exit(0); });
