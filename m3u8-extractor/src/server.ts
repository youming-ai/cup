import { Hono } from "hono";
import { cors } from "hono/cors";
import { chromium } from "playwright-core";

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

async function getBrowser() {
  if (browser?.isConnected()) return browser;
  browser = await chromium.launch({
    headless: true,
  });
  browser.on("disconnected", () => {
    browser = null;
  });
  return browser;
}

async function extract(embedUrl: string) {
  const b = await getBrowser();
  const page = await b.newPage();

  const m3u8Urls: string[] = [];
  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes(".m3u8")) {
      m3u8Urls.push(url);
      console.log(`[extract] m3u8: ${url}`);
    }
  });

  console.log(`[extract] navigating to ${embedUrl}`);
  try {
    await page.goto(embedUrl, { waitUntil: "networkidle", timeout: 30000 });
  } catch (err: any) {
    console.log(`[extract] nav: ${err.message}`);
  }

  await page.waitForTimeout(8000);

  // jwplayer DOM
  let result: { m3u8: string; type?: string; audio?: string } | null = null;
  try {
    const data = await page.evaluate(() => {
      const jp = (window as any).jwplayer;
      if (!jp) return null;
      const p = jp();
      if (!p) return null;
      const it = p.getPlaylistItem?.();
      if (!it?.file) return null;
      const audio = (it.allSources || []).find(
        (s: any) =>
          s.file?.includes("tracks-v1a1") || s.file?.includes("/audio/")
      );
      return { m3u8: it.file, type: it.type, audio: audio?.file };
    });
    if (data) {
      result = data;
      console.log(`[extract] jwplayer OK`);
    }
  } catch (err: any) {
    console.log(`[extract] jwplayer err: ${err.message}`);
  }

  // fallback: intercepted m3u8
  if (!result?.m3u8 && m3u8Urls.length > 0) {
    const main =
      m3u8Urls.find((u) => u.includes("index.m3u8")) || m3u8Urls[0];
    const audio = m3u8Urls.find(
      (u) => u.includes("tracks-v1a1") || u.includes("/audio/")
    );
    result = { m3u8: main, audio };
    console.log(`[extract] network OK`);
  }

  console.log(`[extract] result: ${JSON.stringify(result).slice(0, 300)}`);
  await page.close();
  return result;
}

// ── App ─────────────────────────────────────────────────────────────
const app = new Hono();
app.use("*", cors()); // allow the browser SPA (any origin) to call /extract

app.get("/", (c) =>
  c.json({ service: "m3u8-extractor", usage: "/extract?url=<embed_url>" })
);

app.get("/extract", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ ok: false, error: "missing url parameter" }, 400);
  }

  try {
    const result = await extract(url);
    if (!result?.m3u8) {
      return c.json({ ok: false, error: "failed to extract m3u8" }, 500);
    }
    return c.json({
      ok: true,
      m3u8: result.m3u8,
      ...(result.type ? { type: result.type } : {}),
      ...(result.audio ? { audio: result.audio } : {}),
    });
  } catch (err: any) {
    return c.json({ ok: false, error: err?.message || "unknown error" }, 500);
  }
});

// ── Start ──────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;
console.log(`m3u8-extractor listening on :${port}`);

export default {
  port,
  idleTimeout: 0,
  fetch: app.fetch,
};

process.on("SIGTERM", async () => {
  await browser?.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await browser?.close();
  process.exit(0);
});
