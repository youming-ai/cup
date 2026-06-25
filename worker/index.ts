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

// Only worldcup26.ir is proxied: it has no anti-bot gate and its data changes
// slowly, so KV caching is a clear win. ppv.to fingerprint-blocks datacenter
// requests ("IP blocked"), so the SPA keeps fetching it directly from the browser.
const SOURCES: Record<string, { url: string; fresh: number; keep: number }> = {
  games: { url: 'https://worldcup26.ir/get/games', fresh: 300, keep: 86400 },
  groups: { url: 'https://worldcup26.ir/get/groups', fresh: 300, keep: 86400 },
  teams: { url: 'https://worldcup26.ir/get/teams', fresh: 3600, keep: 604800 },
};

const ROUTES: Record<string, string> = {
  '/api/wc/games': 'games',
  '/api/wc/groups': 'groups',
  '/api/wc/teams': 'teams',
};

export function json(body: string, status: number, cache: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-cache': cache },
  });
}

export async function serve(name: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  const src = SOURCES[name];
  const stored = await env.CACHE.get<Entry>(name, 'json');
  const now = Date.now();

  if (stored && now - stored.at < src.fresh * 1000) {
    return json(stored.body, 200, 'HIT');
  }

  try {
    const res = await fetch(src.url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const body = await res.text();
    ctx.waitUntil(env.CACHE.put(name, JSON.stringify({ body, at: now } satisfies Entry), { expirationTtl: src.keep }));
    return json(body, 200, stored ? 'REVALIDATED' : 'MISS');
  } catch {
    if (stored) return json(stored.body, 200, 'STALE'); // upstream down → serve last good copy
    return json('{"error":"upstream unavailable"}', 502, 'MISS');
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    const name = ROUTES[pathname];
    if (name) return serve(name, env, ctx);
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request); // static assets + SPA fallback
  },
};
