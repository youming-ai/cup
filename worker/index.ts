/// <reference types="@cloudflare/workers-types" />

// Edge cache for the upstream data APIs. The SPA calls same-origin /api/*; this
// Worker fetches the third-party source and caches the body in KV, so the page
// is faster, doesn't depend on the upstream's CORS, and survives brief outages.
//
// `fresh` = seconds a cached copy is served without revalidating.
// `keep`  = how long KV retains it (≥ fresh) so a stale copy can cover an outage.
// KV TTL minimum is 60s.

interface Env {
  ASSETS: Fetcher;
  CACHE: KVNamespace;
}

interface Entry {
  body: string;
  at: number;
}

// ESPN's public site API (no key, CORS-open) carries the full 2026 World Cup:
// scoreboard = all 104 matches (scores, status, venue, scorers); standings =
// the 12 group tables. KV-cache both: scoreboard refreshes often (live scores),
// standings change slowly. ppv.to is still fetched browser-side (it IP-blocks
// datacenter requests).
const ESPN = 'https://site.api.espn.com/apis';
const SOURCES: Record<string, { url: string; fresh: number; keep: number }> = {
  scoreboard: {
    url: `${ESPN}/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300`,
    fresh: 60,
    keep: 86400,
  },
  standings: {
    url: `${ESPN}/v2/sports/soccer/fifa.world/standings?season=2026&level=3`,
    fresh: 300,
    keep: 86400,
  },
};

const ROUTES: Record<string, string> = {
  '/api/wc/scoreboard': 'scoreboard',
  '/api/wc/standings': 'standings',
};

export function json(body: string, status: number, cache: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-cache': cache },
  });
}

async function cached(
  cacheKey: string,
  url: string,
  fresh: number,
  keep: number,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const stored = await env.CACHE.get<Entry>(cacheKey, 'json');
  const now = Date.now();

  if (stored && now - stored.at < fresh * 1000) {
    return json(stored.body, 200, 'HIT');
  }

  try {
    const res = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const body = await res.text();
    ctx.waitUntil(
      env.CACHE.put(cacheKey, JSON.stringify({ body, at: now } satisfies Entry), { expirationTtl: keep }),
    );
    return json(body, 200, stored ? 'REVALIDATED' : 'MISS');
  } catch {
    if (stored) return json(stored.body, 200, 'STALE');
    return json('{"error":"upstream unavailable"}', 502, 'MISS');
  }
}

export async function serve(name: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  const src = SOURCES[name];
  return cached(name, src.url, src.fresh, src.keep, env, ctx);
}

export async function serveSummary(eventId: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!/^\d+$/.test(eventId)) return json('{"error":"bad event id"}', 400, 'MISS');
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`;
  return cached(`summary:${eventId}`, url, 30, 86400, env, ctx);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/api/wc/summary') {
      return serveSummary(url.searchParams.get('event') ?? '', env, ctx);
    }
    const name = ROUTES[pathname];
    if (name) return serve(name, env, ctx);
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request); // static assets + SPA fallback
  },
};
