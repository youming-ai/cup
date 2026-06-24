const puppeteer = require("puppeteer-core");
const http = require("http");

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/usr/bin/chromium";

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
    ],
  });
  browser.on("disconnected", () => {
    browser = null;
  });
  return browser;
}

async function extract(embedUrl) {
  const b = await getBrowser();
  const page = await b.newPage();

  const m3u8Urls = [];
  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes(".m3u8")) {
      m3u8Urls.push(url);
      console.log(`[extract] m3u8: ${url}`);
    }
  });

  console.log(`[extract] navigating to ${embedUrl}`);
  try {
    await page.goto(embedUrl, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (err) {
    console.log(`[extract] nav: ${err.message}`);
  }

  await new Promise((r) => setTimeout(r, 8000));

  let result = null;
  try {
    const item = await page.evaluate(() => {
      const p = window.jwplayer?.();
      if (!p) return null;
      const it = p.getPlaylistItem?.();
      if (!it?.file) return null;
      const audio = (it.allSources || []).find(
        (s) => s.file?.includes("tracks-v1a1") || s.file?.includes("/audio/")
      );
      return { m3u8: it.file, type: it.type, audio: audio?.file };
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

const port = Number(process.env.PORT) || 3000;

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
    res.end(JSON.stringify({ service: "m3u8-extractor", usage: "/extract?url=<embed_url>" }));
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
        ...(result.audio ? { audio: result.audio } : {}),
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

server.listen(port, () => console.log(`m3u8-extractor listening on :${port}`));

process.on("SIGTERM", async () => { await browser?.close(); process.exit(0); });
process.on("SIGINT", async () => { await browser?.close(); process.exit(0); });
