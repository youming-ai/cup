/// <reference types="@cloudflare/workers-types" />
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { json, serve, type Env } from './index';

// ---- json helper ----

describe('json helper', () => {
  it('creates a Response with JSON content-type', () => {
    const res = json('{"ok":true}', 200, 'MISS');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('x-cache')).toBe('MISS');
  });

  it('does not set cache-control headers (handled by downstream)', () => {
    const res = json('{"ok":true}', 200, 'HIT');
    expect(res.headers.get('cache-control')).toBeNull();
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('x-cache')).toBe('HIT');
  });

  it('handles error status codes', () => {
    const res = json('{"error":"upstream unavailable"}', 502, 'MISS');
    expect(res.status).toBe(502);
  });
});

// ---- serve function ----

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

function mockEnv(kvData?: { body: string; at: number } | null) {
  const store = new Map<string, string>();
  if (kvData) {
    store.set('standings', JSON.stringify(kvData));
  }
  return {
    CACHE: {
      get: vi.fn(async (key: string) => {
        const v = store.get(key);
        return v ? JSON.parse(v) : null;
      }),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    },
  };
}

function mockCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(async () => {}),
    passThroughOnException: vi.fn(),
    props: {},
    tracing: {},
  } as unknown as ExecutionContext;
}

describe('serve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HIT when stored body is fresh', async () => {
    const now = Date.now();
    const storedAt = now - 30_000; // 30s ago — fresh is 300s
    const env = mockEnv({ body: '{"data":"cached"}', at: storedAt });
    const ctx = mockCtx();

    const res = await serve('standings', env as unknown as Env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache')).toBe('HIT');
    const body = await res.text();
    expect(body).toBe('{"data":"cached"}');
  });

  it('returns MISS on first fetch with no stored data', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{"data":"fresh"}' });

    const env = mockEnv(null);
    const ctx = mockCtx();

    const res = await serve('standings', env as unknown as Env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache')).toBe('MISS');
    const body = await res.text();
    expect(body).toBe('{"data":"fresh"}');
  });

  it('returns REVALIDATED when stored data is stale but fetch succeeds', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{"data":"updated"}' });

    const now = Date.now();
    const storedAt = now - 600_000; // 10min ago — stale (fresh is 300s)
    const env = mockEnv({ body: '{"data":"old"}', at: storedAt });
    const ctx = mockCtx();

    const res = await serve('standings', env as unknown as Env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache')).toBe('REVALIDATED');
    const body = await res.text();
    expect(body).toBe('{"data":"updated"}');
  });

  it('returns STALE when upstream fails but a stored copy exists', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const now = Date.now();
    const storedAt = now - 600_000; // stale
    const env = mockEnv({ body: '{"data":"stale"}', at: storedAt });
    const ctx = mockCtx();

    const res = await serve('standings', env as unknown as Env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache')).toBe('STALE');
    const body = await res.text();
    expect(body).toBe('{"data":"stale"}');
  });

  it('returns 502 when upstream fails and no stored copy exists', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const env = mockEnv(null);
    const ctx = mockCtx();

    const res = await serve('standings', env as unknown as Env, ctx);
    expect(res.status).toBe(502);
    expect(res.headers.get('x-cache')).toBe('MISS');
    const body = await res.text();
    expect(body).toBe('{"error":"upstream unavailable"}');
  });

  it('returns 502 when upstream responds with non-ok and no stored copy', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Internal Error' });

    const env = mockEnv(null);
    const ctx = mockCtx();

    const res = await serve('standings', env as unknown as Env, ctx);
    expect(res.status).toBe(502);
    expect(res.headers.get('x-cache')).toBe('MISS');
  });

  it('caches the fresh upstream body in KV after a MISS', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{"data":"to-cache"}' });

    const env = mockEnv(null);
    const ctx = mockCtx();

    await serve('standings', env as unknown as Env, ctx);
    expect(ctx.waitUntil).toHaveBeenCalled();
    expect((env.CACHE as ReturnType<typeof mockEnv>['CACHE']).put).toHaveBeenCalled();
  });
});
