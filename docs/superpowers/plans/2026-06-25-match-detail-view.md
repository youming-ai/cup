# Match Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a finished/live match card opens a full-screen modal reproducing the Apple Sports layout — Stats, Play-By-Play, and Lineup tabs — fed by ESPN's `summary?event={id}` endpoint.

**Architecture:** A new Worker route proxies + caches ESPN summary per event. A lazy `useMatchDetail(eventId)` hook fetches it only when a card is opened. Pure parsers in `utils/espn.ts` turn the raw summary into a typed `MatchDetail`. A `MatchDetailModal` with three presentational tab components renders it; `FixturesView` owns the open/close state.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind, Vitest + Testing Library, Cloudflare Worker (KV cache).

## Global Constraints

- All four languages (`en`, `zh`, `ja`, `ko`) must define every i18n key — `messages.test.ts` asserts key parity. Add new keys to all four dicts.
- ESPN stat labels and play text pass through in English (no translation table). Only structural UI strings are translated.
- No new npm dependencies.
- Match `WCMatch.id` is the ESPN event id (a numeric string) — already true from `useWorldCup`.
- Follow existing code style: flat dotted i18n keys, Tailwind classes already in the palette (`night`, `panel`, `line`, `chalk`, `chalkdim`, `pitch`, `live`).

---

### Task 1: Worker `/api/wc/summary` route

**Files:**
- Modify: `worker/index.ts`
- Test: `worker/index.test.ts`

**Interfaces:**
- Consumes: existing `json()`, `Env`, KV `CACHE`, the `Entry` interface.
- Produces: `export async function serveSummary(eventId: string, env: Env, ctx: ExecutionContext): Promise<Response>` and a refactored internal `cached(cacheKey, url, fresh, keep, env, ctx)` that `serve()` also uses. Route `GET /api/wc/summary?event={id}` → validated numeric id → ESPN summary, KV key `summary:{id}`.

- [ ] **Step 1: Write failing tests**

Add to `worker/index.test.ts` (after the existing `serve` describe block):

```ts
describe('serveSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for a non-numeric event id', async () => {
    const env = mockEnv(null);
    const res = await serveSummary('abc; DROP', env as unknown as Env, mockCtx());
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty event id', async () => {
    const env = mockEnv(null);
    const res = await serveSummary('', env as unknown as Env, mockCtx());
    expect(res.status).toBe(400);
  });

  it('fetches and caches the ESPN summary for a numeric id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{"boxscore":{}}' });
    const env = mockEnv(null);
    const ctx = mockCtx();
    const res = await serveSummary('760420', env as unknown as Env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache')).toBe('MISS');
    expect(await res.text()).toBe('{"boxscore":{}}');
    // cached under the per-event key
    expect((env.CACHE as ReturnType<typeof mockEnv>['CACHE']).put).toHaveBeenCalledWith(
      'summary:760420',
      expect.any(String),
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
  });
});
```

Update `mockEnv` so it can seed a summary key too — change its body to accept a key:

```ts
function mockEnv(kvData?: { body: string; at: number } | null, key = 'standings') {
  const store = new Map<string, string>();
  if (kvData) {
    store.set(key, JSON.stringify(kvData));
  }
  return {
    CACHE: {
      get: vi.fn(async (k: string) => {
        const v = store.get(k);
        return v ? JSON.parse(v) : null;
      }),
      put: vi.fn(async (k: string, value: string) => {
        store.set(k, value);
      }),
    },
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run worker/index.test.ts`
Expected: FAIL — `serveSummary` is not exported.

- [ ] **Step 3: Refactor `serve` and add `serveSummary`**

In `worker/index.ts`, replace the `serve` function with a shared `cached` core plus two callers:

```ts
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
```

Wire the route in the default export's `fetch` handler, before the `ROUTES` lookup fallback:

```ts
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
    return env.ASSETS.fetch(request);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run worker/index.test.ts`
Expected: PASS (all `json`, `serve`, and new `serveSummary` tests).

- [ ] **Step 5: Commit**

```bash
git add worker/index.ts worker/index.test.ts
git commit -m "feat(worker): proxy + cache ESPN match summary at /api/wc/summary"
```

---

### Task 2: `MatchDetail` types + `parseSummary`

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/utils/espn.ts`
- Test: `src/utils/espn.test.ts`

**Interfaces:**
- Produces:
  - Types `TeamStatRow`, `PlayEvent`, `LineupPlayer`, `TeamLineup`, `MatchDetail` (see code).
  - `export function parseSummary(json: unknown): MatchDetail`.

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts`:

```ts
export interface TeamStatRow {
  label: string;
  home: string; // ESPN displayValue, e.g. "54%", "21"
  away: string;
}
export interface PlayEvent {
  clock: string; // e.g. "45'+3'" or "" for pre-match notes
  text: string;
  teamId: string | null; // set for key plays, null for general commentary
  type: string; // e.g. "Goal", "Yellow Card", "" for commentary
}
export interface LineupPlayer {
  jersey: string;
  name: string;
  pos: string; // position.abbreviation, e.g. "CD-R", "G"
  starter: boolean;
  subbedInAt?: string; // minute the player came on
  subbedOutAt?: string; // minute the player went off
  card?: 'yellow' | 'red';
}
export interface TeamLineup {
  teamId: string;
  teamName: string;
  formation: string; // e.g. "4-3-3"
  players: LineupPlayer[];
}
export interface MatchDetail {
  homeId: string;
  awayId: string;
  stats: TeamStatRow[];
  allPlays: PlayEvent[];
  keyPlays: PlayEvent[];
  lineups: TeamLineup[]; // [home, away]
  venue: string;
  attendance: number | null;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/utils/espn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSummary } from './espn';

const summary = {
  header: {
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { id: '203' } },
          { homeAway: 'away', team: { id: '467' } },
        ],
      },
    ],
  },
  boxscore: {
    teams: [
      {
        team: { id: '203' },
        statistics: [
          { label: 'Possession', displayValue: '54%' },
          { label: 'Shots', displayValue: '21' },
        ],
      },
      {
        team: { id: '467' },
        statistics: [
          { label: 'Possession', displayValue: '46%' },
          { label: 'Shots', displayValue: '14' },
        ],
      },
    ],
  },
  commentary: [
    { time: { displayValue: '' }, text: 'First Half begins.' },
    { time: { displayValue: "3'" }, text: 'Foul by Aubrey Modiba.' },
  ],
  keyEvents: [
    {
      clock: { displayValue: "9'" },
      type: { text: 'Goal' },
      team: { id: '203' },
      text: 'Goal! Mexico 1, South Africa 0.',
    },
  ],
  rosters: [
    {
      team: { id: '203', displayName: 'Mexico' },
      formation: '4-1-4-1',
      roster: [
        {
          starter: true,
          jersey: '1',
          position: { abbreviation: 'G' },
          athlete: { displayName: 'Raúl Rangel' },
          plays: [],
        },
        {
          starter: true,
          jersey: '6',
          position: { abbreviation: 'DM' },
          athlete: { displayName: 'Érik Lira' },
          subbedOut: true,
          plays: [
            { clock: { displayValue: "76'" }, substitution: true },
            { clock: { displayValue: "40'" }, yellowCard: true },
          ],
        },
      ],
    },
    {
      team: { id: '467', displayName: 'South Africa' },
      formation: '4-3-3',
      roster: [],
    },
  ],
  gameInfo: {
    venue: { fullName: 'Estadio Banorte', address: { city: 'Mexico City' } },
    attendance: 80824,
  },
};

describe('parseSummary', () => {
  const d = parseSummary(summary);

  it('pairs team stats by label (home/away from competitor sides)', () => {
    expect(d.homeId).toBe('203');
    expect(d.awayId).toBe('467');
    expect(d.stats).toEqual([
      { label: 'Possession', home: '54%', away: '46%' },
      { label: 'Shots', home: '21', away: '14' },
    ]);
  });

  it('reads commentary as allPlays and keyEvents as keyPlays', () => {
    expect(d.allPlays).toHaveLength(2);
    expect(d.allPlays[1]).toEqual({ clock: "3'", text: 'Foul by Aubrey Modiba.', teamId: null, type: '' });
    expect(d.keyPlays[0]).toEqual({
      clock: "9'",
      text: 'Goal! Mexico 1, South Africa 0.',
      teamId: '203',
      type: 'Goal',
    });
  });

  it('parses lineups with sub minute and card from player.plays', () => {
    const mex = d.lineups[0];
    expect(mex.formation).toBe('4-1-4-1');
    expect(mex.players[0]).toMatchObject({ jersey: '1', name: 'Raúl Rangel', pos: 'G', starter: true });
    expect(mex.players[1]).toMatchObject({ subbedOutAt: "76'", card: 'yellow' });
  });

  it('reads venue and attendance', () => {
    expect(d.venue).toBe('Estadio Banorte · Mexico City');
    expect(d.attendance).toBe(80824);
  });

  it('tolerates an empty object without throwing', () => {
    const empty = parseSummary({});
    expect(empty.stats).toEqual([]);
    expect(empty.lineups).toEqual([]);
    expect(empty.attendance).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/espn.test.ts`
Expected: FAIL — `./espn` has no `parseSummary`.

- [ ] **Step 4: Implement `parseSummary`**

Create `src/utils/espn.ts`:

```ts
import type {
  MatchDetail,
  PlayEvent,
  TeamLineup,
  LineupPlayer,
  TeamStatRow,
} from '../types';

// local json guards (kept here so this module is self-contained)
type Obj = Record<string, unknown>;
function obj(v: unknown): Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {};
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function cardOf(plays: unknown[]): 'yellow' | 'red' | undefined {
  let card: 'yellow' | undefined;
  for (const raw of plays) {
    const p = obj(raw);
    if (p.redCard) return 'red';
    if (p.yellowCard) card = 'yellow';
  }
  return card;
}
function subClock(plays: unknown[]): string | undefined {
  const s = plays.map(obj).find((p) => p.substitution);
  return s ? str(obj(s.clock).displayValue) : undefined;
}

export function parseSummary(json: unknown): MatchDetail {
  const d = obj(json);

  // home/away ids from the header competitors
  const competitors = arr(obj(arr(obj(d.header).competitions)[0]).competitors).map(obj);
  const homeId = str(obj(competitors.find((c) => c.homeAway === 'home')?.team).id);
  const awayId = str(obj(competitors.find((c) => c.homeAway === 'away')?.team).id);

  // stats: map each boxscore team's label→displayValue, pair by home team's order
  const byTeam = new Map<string, Map<string, string>>();
  for (const rawTeam of arr(obj(d.boxscore).teams)) {
    const t = obj(rawTeam);
    const id = str(obj(t.team).id);
    const m = new Map<string, string>();
    for (const rawStat of arr(t.statistics)) {
      const s = obj(rawStat);
      m.set(str(s.label), str(s.displayValue));
    }
    byTeam.set(id, m);
  }
  const homeStats = byTeam.get(homeId) ?? new Map();
  const awayStats = byTeam.get(awayId) ?? new Map();
  const stats: TeamStatRow[] = [...homeStats.entries()].map(([label, home]) => ({
    label,
    home,
    away: awayStats.get(label) ?? '',
  }));

  const allPlays: PlayEvent[] = arr(d.commentary).map((raw) => {
    const c = obj(raw);
    return { clock: str(obj(c.time).displayValue), text: str(c.text), teamId: null, type: '' };
  });
  const keyPlays: PlayEvent[] = arr(d.keyEvents).map((raw) => {
    const k = obj(raw);
    return {
      clock: str(obj(k.clock).displayValue),
      text: str(k.text),
      teamId: str(obj(k.team).id) || null,
      type: str(obj(k.type).text),
    };
  });

  const lineups: TeamLineup[] = arr(d.rosters).map((raw): TeamLineup => {
    const r = obj(raw);
    const team = obj(r.team);
    const players: LineupPlayer[] = arr(r.roster).map((rawP): LineupPlayer => {
      const p = obj(rawP);
      const plays = arr(p.plays);
      const sub = subClock(plays);
      return {
        jersey: str(p.jersey),
        name: str(obj(p.athlete).displayName),
        pos: str(obj(p.position).abbreviation),
        starter: Boolean(p.starter),
        ...(p.subbedIn && sub ? { subbedInAt: sub } : {}),
        ...(p.subbedOut && sub ? { subbedOutAt: sub } : {}),
        ...(cardOf(plays) ? { card: cardOf(plays) } : {}),
      };
    });
    return { teamId: str(team.id), teamName: str(team.displayName), formation: str(r.formation), players };
  });

  const venueObj = obj(obj(d.gameInfo).venue);
  const city = str(obj(venueObj.address).city);
  const venueName = str(venueObj.fullName);
  const att = obj(d.gameInfo).attendance;

  return {
    homeId,
    awayId,
    stats,
    allPlays,
    keyPlays,
    lineups,
    venue: venueName && city ? `${venueName} · ${city}` : venueName,
    attendance: typeof att === 'number' ? att : null,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/espn.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/espn.ts src/utils/espn.test.ts
git commit -m "feat: parse ESPN summary into MatchDetail"
```

---

### Task 3: Pitch positioner `layoutStarters`

**Files:**
- Modify: `src/utils/espn.ts`
- Test: `src/utils/espn.test.ts`

**Interfaces:**
- Consumes: `LineupPlayer` from Task 2.
- Produces: `export type PositionedPlayer = LineupPlayer & { x: number; y: number }` and `export function layoutStarters(starters: LineupPlayer[]): PositionedPlayer[]` — `x`/`y` are 0..1 on a vertical pitch (`y=0` top/attack, `y≈0.93` GK at bottom).

- [ ] **Step 1: Write the failing test**

Append to `src/utils/espn.test.ts`:

```ts
import { layoutStarters } from './espn';
import type { LineupPlayer } from '../types';

function mk(pos: string, jersey: string): LineupPlayer {
  return { jersey, name: pos, pos, starter: true };
}

describe('layoutStarters', () => {
  const xi: LineupPlayer[] = [
    mk('G', '1'),
    mk('RB', '2'),
    mk('CD-R', '3'),
    mk('CD-L', '5'),
    mk('LB', '23'),
    mk('DM', '6'),
    mk('RM', '25'),
    mk('CM-R', '26'),
    mk('CM-L', '8'),
    mk('LM', '16'),
    mk('F', '9'),
  ];
  const out = layoutStarters(xi);

  it('returns one position per starter', () => {
    expect(out).toHaveLength(11);
  });

  it('puts the keeper at the bottom and the forward near the top', () => {
    const gk = out.find((p) => p.pos === 'G')!;
    const fw = out.find((p) => p.pos === 'F')!;
    expect(gk.y).toBeGreaterThan(0.85);
    expect(fw.y).toBeLessThan(0.25);
  });

  it('orders a back four left-to-right by side', () => {
    const lb = out.find((p) => p.pos === 'LB')!;
    const rb = out.find((p) => p.pos === 'RB')!;
    expect(lb.x).toBeLessThan(rb.x);
    expect(lb.x).toBeGreaterThanOrEqual(0);
    expect(rb.x).toBeLessThanOrEqual(1);
  });

  it('does not throw on an unknown position (defaults to midfield row)', () => {
    expect(() => layoutStarters([mk('???', '99')])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/espn.test.ts`
Expected: FAIL — no `layoutStarters` export.

- [ ] **Step 3: Implement `layoutStarters`**

Append to `src/utils/espn.ts`:

```ts
import type { LineupPlayer } from '../types';

export type PositionedPlayer = LineupPlayer & { x: number; y: number };

// 5 rows back-to-front; y grows downward (GK at the bottom of a vertical pitch).
const ROW_Y = [0.93, 0.72, 0.56, 0.4, 0.16];

function rowGroup(pos: string): number {
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK') return 0;
  if (p.includes('DM')) return 2;
  if (p.startsWith('CD') || p.startsWith('D') || p.endsWith('B')) return 1; // CB/RB/LB/WB/CD
  if (p.startsWith('F') || p.startsWith('S') || p.startsWith('CF') || p.endsWith('W')) return 4; // F/ST/RW/LW
  return 3; // CM/RM/LM/AM/M and unknowns → midfield
}
function sideScore(pos: string): number {
  const p = pos.toUpperCase();
  if (p.endsWith('-L')) return -1;
  if (p.endsWith('-R')) return 1;
  if (p.startsWith('L')) return -1;
  if (p.startsWith('R')) return 1;
  return 0;
}

// ponytail: position-code positioner; unknown codes fall to the midfield row
export function layoutStarters(starters: LineupPlayer[]): PositionedPlayer[] {
  const rows = new Map<number, LineupPlayer[]>();
  for (const pl of starters) {
    const g = rowGroup(pl.pos);
    (rows.get(g) ?? rows.set(g, []).get(g)!).push(pl);
  }
  const out: PositionedPlayer[] = [];
  for (const [g, list] of rows) {
    list.sort((a, b) => sideScore(a.pos) - sideScore(b.pos) || (Number(a.jersey) || 0) - (Number(b.jersey) || 0));
    const n = list.length;
    list.forEach((pl, i) => {
      const x = n === 1 ? 0.5 : 0.15 + (i * 0.7) / (n - 1);
      out.push({ ...pl, x, y: ROW_Y[g] });
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/espn.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/espn.ts src/utils/espn.test.ts
git commit -m "feat: vertical-pitch positioner for starting lineups"
```

---

### Task 4: `useMatchDetail` hook

**Files:**
- Create: `src/hooks/useMatchDetail.ts`
- Test: `src/hooks/useMatchDetail.test.ts`

**Interfaces:**
- Consumes: `parseSummary` (Task 2), `MatchDetail` type.
- Produces: `export function useMatchDetail(eventId: string | null): { detail: MatchDetail | null; loading: boolean; error: string | null }`. No fetch when `eventId` is null. Aborts in-flight request on change/unmount.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useMatchDetail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMatchDetail } from './useMatchDetail';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

beforeEach(() => vi.clearAllMocks());

it('does not fetch when eventId is null', () => {
  renderHook(() => useMatchDetail(null));
  expect(fetchMock).not.toHaveBeenCalled();
});

it('fetches and parses the summary for an event id', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      header: { competitions: [{ competitors: [{ homeAway: 'home', team: { id: '1' } }] }] },
      boxscore: { teams: [] },
      gameInfo: { attendance: 100 },
    }),
  });
  const { result } = renderHook(() => useMatchDetail('760420'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(fetchMock).toHaveBeenCalledWith('/api/wc/summary?event=760420', expect.any(Object));
  expect(result.current.detail?.homeId).toBe('1');
  expect(result.current.error).toBeNull();
});

it('surfaces an error when the request fails', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false });
  const { result } = renderHook(() => useMatchDetail('1'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeTruthy();
  expect(result.current.detail).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useMatchDetail.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useMatchDetail.ts`:

```ts
import { useState, useEffect } from 'react';
import type { MatchDetail } from '../types';
import { parseSummary } from '../utils/espn';

export function useMatchDetail(eventId: string | null) {
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/wc/summary?event=${eventId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load match detail');
        return res.json();
      })
      .then((json) => {
        if (controller.signal.aborted) return;
        setDetail(parseSummary(json));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Failed to load match detail');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [eventId]);

  return { detail, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useMatchDetail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMatchDetail.ts src/hooks/useMatchDetail.test.ts
git commit -m "feat: useMatchDetail hook (lazy per-event summary fetch)"
```

---

### Task 5: Tab components (Stats / Play-By-Play / Lineup)

**Files:**
- Create: `src/components/matchdetail/TeamStatsTab.tsx`
- Create: `src/components/matchdetail/PlayByPlayTab.tsx`
- Create: `src/components/matchdetail/LineupTab.tsx`
- Test: `src/components/matchdetail/MatchDetailTabs.test.tsx`

**Interfaces:**
- Consumes: `MatchDetail`, `TeamStatRow`, `PlayEvent`, `TeamLineup` types; `layoutStarters`, `PositionedPlayer` from Task 3; `useT` from `../../i18n`.
- Produces (all default exports):
  - `TeamStatsTab({ stats }: { stats: TeamStatRow[] })`
  - `PlayByPlayTab({ allPlays, keyPlays, homeId }: { allPlays: PlayEvent[]; keyPlays: PlayEvent[]; homeId: string })`
  - `LineupTab({ lineups, homeId }: { lineups: TeamLineup[]; homeId: string })`
- i18n keys these consume (added in Task 6): `detail.noData`, `detail.allPlays`, `detail.keyPlays`, `detail.startingLineup`, `detail.bench`.

- [ ] **Step 1: Write the failing test**

Create `src/components/matchdetail/MatchDetailTabs.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../../i18n';
import TeamStatsTab from './TeamStatsTab';
import PlayByPlayTab from './PlayByPlayTab';
import LineupTab from './LineupTab';
import type { TeamStatRow, PlayEvent, TeamLineup } from '../../types';

const wrap = (ui: React.ReactNode) => render(<LanguageProvider>{ui}</LanguageProvider>);

describe('TeamStatsTab', () => {
  it('renders a row per stat with both values', () => {
    const stats: TeamStatRow[] = [{ label: 'Shots', home: '21', away: '14' }];
    wrap(<TeamStatsTab stats={stats} />);
    expect(screen.getByText('Shots')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('shows empty state when there are no stats', () => {
    wrap(<TeamStatsTab stats={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });
});

describe('PlayByPlayTab', () => {
  const allPlays: PlayEvent[] = [{ clock: "3'", text: 'Foul.', teamId: null, type: '' }];
  const keyPlays: PlayEvent[] = [{ clock: "9'", text: 'Goal!', teamId: '203', type: 'Goal' }];

  it('shows all plays by default and switches to key plays', () => {
    wrap(<PlayByPlayTab allPlays={allPlays} keyPlays={keyPlays} homeId="203" />);
    expect(screen.getByText('Foul.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Key Plays'));
    expect(screen.getByText('Goal!')).toBeInTheDocument();
  });
});

describe('LineupTab', () => {
  const lineups: TeamLineup[] = [
    {
      teamId: '203',
      teamName: 'Mexico',
      formation: '4-3-3',
      players: [
        { jersey: '1', name: 'Rangel', pos: 'G', starter: true },
        { jersey: '9', name: 'Jiménez', pos: 'F', starter: true },
        { jersey: '14', name: 'Bench Guy', pos: 'M', starter: false, subbedInAt: "82'" },
      ],
    },
    { teamId: '467', teamName: 'South Africa', formation: '4-2-3-1', players: [] },
  ];

  it('renders the home formation, a starter, and a bench player', () => {
    wrap(<LineupTab lineups={lineups} homeId="203" />);
    expect(screen.getByText('4-3-3')).toBeInTheDocument();
    expect(screen.getByText('Jiménez')).toBeInTheDocument();
    expect(screen.getByText('Bench Guy')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/matchdetail/MatchDetailTabs.test.tsx`
Expected: FAIL — components not found.

- [ ] **Step 3: Implement `TeamStatsTab`**

Create `src/components/matchdetail/TeamStatsTab.tsx`:

```tsx
import { useT } from '../../i18n';
import type { TeamStatRow } from '../../types';

// Width of the home side's bar, 0..100, when both values are numeric.
function homePct(home: string, away: string): number | null {
  const h = parseFloat(home);
  const a = parseFloat(away);
  if (!Number.isFinite(h) || !Number.isFinite(a) || h + a === 0) return null;
  return (h / (h + a)) * 100;
}

export default function TeamStatsTab({ stats }: { stats: TeamStatRow[] }) {
  const t = useT();
  if (stats.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim p-4">{t('detail.noData')}</p>;
  }
  return (
    <div className="space-y-4 p-4">
      {stats.map((s) => {
        const pct = homePct(s.home, s.away);
        return (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between font-mono text-sm text-chalk tabular-nums">
              <span className="font-bold">{s.home}</span>
              <span className="text-chalkdim text-xs uppercase tracking-wider">{s.label}</span>
              <span className="font-bold">{s.away}</span>
            </div>
            {pct !== null && (
              <div className="flex h-1.5 gap-0.5">
                <span className="bg-pitch" style={{ width: `${pct}%` }} />
                <span className="bg-chalkdim/50 flex-1" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement `PlayByPlayTab`**

Create `src/components/matchdetail/PlayByPlayTab.tsx`:

```tsx
import { useState } from 'react';
import { useT } from '../../i18n';
import type { PlayEvent } from '../../types';

export default function PlayByPlayTab({
  allPlays,
  keyPlays,
  homeId,
}: {
  allPlays: PlayEvent[];
  keyPlays: PlayEvent[];
  homeId: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<'all' | 'key'>('all');
  const plays = tab === 'all' ? allPlays : keyPlays;

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-1 p-1 border border-line bg-panel w-fit">
        {(['all', 'key'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`px-3 py-1.5 font-display text-sm transition-colors ${
              tab === k ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
            }`}
          >
            {t(k === 'all' ? 'detail.allPlays' : 'detail.keyPlays')}
          </button>
        ))}
      </div>
      {plays.length === 0 ? (
        <p className="font-mono text-xs tracking-wider text-chalkdim">{t('detail.noData')}</p>
      ) : (
        <ul className="space-y-2">
          {plays.map((p, i) => (
            <li
              key={i}
              className={`border border-line bg-panel px-3 py-2 ${
                p.teamId ? `border-l-2 ${p.teamId === homeId ? 'border-l-pitch' : 'border-l-live'}` : ''
              }`}
            >
              <div className="font-body text-sm text-chalk">{p.text}</div>
              {p.clock && <div className="font-mono text-[10px] text-chalkdim tabular-nums mt-1">{p.clock}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement `LineupTab` (pitch + bench)**

Create `src/components/matchdetail/LineupTab.tsx`:

```tsx
import { useState } from 'react';
import { useT } from '../../i18n';
import { layoutStarters } from '../../utils/espn';
import type { TeamLineup, LineupPlayer } from '../../types';

function Pitch({ starters }: { starters: LineupPlayer[] }) {
  const placed = layoutStarters(starters);
  return (
    <div className="relative w-full aspect-[3/4] bg-pitch/15 border border-line overflow-hidden">
      <div className="absolute inset-x-0 top-1/2 h-px bg-chalkdim/30" />
      {placed.map((p) => (
        <div
          key={p.jersey + p.name}
          className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 w-16 text-center"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-panel border border-chalkdim font-mono text-xs text-chalk">
            {p.jersey}
          </span>
          <span className="font-display text-[10px] text-chalk truncate w-full mt-0.5">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function Bench({ players }: { players: LineupPlayer[] }) {
  const t = useT();
  const subs = players.filter((p) => !p.starter);
  if (subs.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim mb-2">{t('detail.bench')}</h4>
      <ul className="space-y-1">
        {subs.map((p) => (
          <li key={p.jersey + p.name} className="flex items-center gap-2 font-body text-sm text-chalkdim">
            <span className="font-mono text-xs w-6 text-right">{p.jersey}</span>
            <span className="text-chalk">{p.name}</span>
            {p.card && <span className={`w-2.5 h-3.5 ${p.card === 'red' ? 'bg-live' : 'bg-yellow-400'}`} />}
            {p.subbedInAt && <span className="font-mono text-[10px] text-pitch">↑ {p.subbedInAt}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LineupTab({ lineups, homeId }: { lineups: TeamLineup[]; homeId: string }) {
  const t = useT();
  const [side, setSide] = useState<'home' | 'away'>('home');
  if (lineups.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim p-4">{t('detail.noData')}</p>;
  }
  const home = lineups.find((l) => l.teamId === homeId) ?? lineups[0];
  const away = lineups.find((l) => l.teamId !== homeId) ?? lineups[1] ?? home;
  const team = side === 'home' ? home : away;

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-1 p-1 border border-line bg-panel">
        {(['home', 'away'] as const).map((s) => {
          const lineup = s === 'home' ? home : away;
          return (
            <button
              key={s}
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={`flex-1 px-3 py-1.5 font-display text-sm transition-colors ${
                side === s ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
              }`}
            >
              {lineup.teamName} · {lineup.formation}
            </button>
          );
        })}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim">
        {t('detail.startingLineup')} · {team.formation}
      </div>
      <Pitch starters={team.players.filter((p) => p.starter)} />
      <Bench players={team.players} />
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/matchdetail/MatchDetailTabs.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/matchdetail/
git commit -m "feat: match-detail tab components (stats, play-by-play, lineup)"
```

---

### Task 6: `MatchDetailModal` + wire into `FixturesView` / `MatchCard` + i18n

**Files:**
- Create: `src/components/MatchDetailModal.tsx`
- Modify: `src/components/MatchCard.tsx`
- Modify: `src/components/FixturesView.tsx`
- Modify: `src/i18n/messages.ts`
- Test: `src/components/MatchDetailModal.test.tsx`

**Interfaces:**
- Consumes: `useMatchDetail` (Task 4); the three tab components (Task 5); `MatchDetail` type; `useT`.
- Produces: `MatchDetailModal({ match, onClose }: { match: WCMatch; onClose: () => void })`. `MatchCard` gains optional `onOpen?: () => void`; when set the card is a focusable button. `FixturesView` owns `openMatch: WCMatch | null`.

- [ ] **Step 1: Add i18n keys to all four languages**

In `src/i18n/messages.ts`, add these keys to each of the `en`, `zh`, `ja`, `ko` dicts (use the matching translations):

```ts
// en
'detail.stats': 'Stats',
'detail.playByPlay': 'Play-By-Play',
'detail.lineup': 'Lineup',
'detail.allPlays': 'All Plays',
'detail.keyPlays': 'Key Plays',
'detail.startingLineup': 'Starting Lineup',
'detail.bench': 'Bench',
'detail.attendance': 'Attendance',
'detail.noData': 'No data yet',
'detail.close': 'Close',
// zh
'detail.stats': '数据',
'detail.playByPlay': '进程',
'detail.lineup': '阵容',
'detail.allPlays': '全部',
'detail.keyPlays': '关键',
'detail.startingLineup': '首发阵容',
'detail.bench': '替补',
'detail.attendance': '上座',
'detail.noData': '暂无数据',
'detail.close': '关闭',
// ja
'detail.stats': 'スタッツ',
'detail.playByPlay': '実況',
'detail.lineup': 'スタメン',
'detail.allPlays': 'すべて',
'detail.keyPlays': '重要',
'detail.startingLineup': 'スターティング',
'detail.bench': '控え',
'detail.attendance': '観客数',
'detail.noData': 'データなし',
'detail.close': '閉じる',
// ko
'detail.stats': '통계',
'detail.playByPlay': '경기 진행',
'detail.lineup': '라인업',
'detail.allPlays': '전체',
'detail.keyPlays': '주요',
'detail.startingLineup': '선발 라인업',
'detail.bench': '교체',
'detail.attendance': '관중',
'detail.noData': '데이터 없음',
'detail.close': '닫기',
```

- [ ] **Step 2: Write the failing test**

Create `src/components/MatchDetailModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../i18n';
import MatchDetailModal from './MatchDetailModal';
import type { WCMatch } from '../types';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
beforeEach(() => vi.clearAllMocks());

const match: WCMatch = {
  id: '760420',
  homeName: 'Mexico',
  awayName: 'South Africa',
  homeFlag: '',
  awayFlag: '',
  homeScore: 2,
  awayScore: 0,
  group: 'A',
  kickoff: new Date('2026-06-13T19:00Z'),
  status: 'finished',
  stage: 'group',
  homeScorers: [],
  awayScorers: [],
  venue: '',
};

function summaryJson() {
  return {
    header: { competitions: [{ competitors: [{ homeAway: 'home', team: { id: '203' } }] }] },
    boxscore: { teams: [{ team: { id: '203' }, statistics: [{ label: 'Shots', displayValue: '21' }] }] },
    commentary: [],
    keyEvents: [],
    rosters: [],
    gameInfo: {},
  };
}

it('loads the summary and shows the stats tab, closes on the close button', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <MatchDetailModal match={match} onClose={onClose} />
    </LanguageProvider>,
  );
  await waitFor(() => expect(screen.getByText('Shots')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Close'));
  expect(onClose).toHaveBeenCalled();
});

it('closes on Escape', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => summaryJson() });
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <MatchDetailModal match={match} onClose={onClose} />
    </LanguageProvider>,
  );
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/MatchDetailModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `MatchDetailModal`**

Create `src/components/MatchDetailModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useMatchDetail } from '../hooks/useMatchDetail';
import TeamStatsTab from './matchdetail/TeamStatsTab';
import PlayByPlayTab from './matchdetail/PlayByPlayTab';
import LineupTab from './matchdetail/LineupTab';
import type { WCMatch } from '../types';

type Tab = 'stats' | 'play' | 'lineup';

export default function MatchDetailModal({ match, onClose }: { match: WCMatch; onClose: () => void }) {
  const t = useT();
  const { detail, loading, error } = useMatchDetail(match.id);
  const [tab, setTab] = useState<Tab>('stats');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const homeId = detail?.homeId ?? '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-night/80 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-night border border-line my-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-display text-sm text-chalk truncate">
            {match.homeName} {match.homeScore ?? ''} : {match.awayScore ?? ''} {match.awayName}
          </span>
          <button
            onClick={onClose}
            aria-label={t('detail.close')}
            className="text-chalkdim hover:text-chalk px-2 font-mono"
          >
            ✕
          </button>
        </div>

        {/* tabs */}
        <div className="flex border-b border-line">
          {(['stats', 'play', 'lineup'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`flex-1 py-2.5 font-display text-sm transition-colors ${
                tab === k ? 'text-chalk border-b-2 border-pitch' : 'text-chalkdim hover:text-chalk'
              }`}
            >
              {t(k === 'stats' ? 'detail.stats' : k === 'play' ? 'detail.playByPlay' : 'detail.lineup')}
            </button>
          ))}
        </div>

        {/* body */}
        {loading ? (
          <p className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse p-6 text-center">
            {t('common.loading')}
          </p>
        ) : error ? (
          <p className="font-mono text-xs text-live p-6 text-center">{error}</p>
        ) : detail ? (
          <>
            {tab === 'stats' && <TeamStatsTab stats={detail.stats} />}
            {tab === 'play' && (
              <PlayByPlayTab allPlays={detail.allPlays} keyPlays={detail.keyPlays} homeId={homeId} />
            )}
            {tab === 'lineup' && <LineupTab lineups={detail.lineups} homeId={homeId} />}
            {(detail.venue || detail.attendance) && (
              <div className="px-4 py-3 border-t border-line font-mono text-[10px] text-chalkdim space-y-1">
                {detail.venue && <div>{detail.venue}</div>}
                {detail.attendance && (
                  <div>
                    {t('detail.attendance')}: {detail.attendance.toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the modal test to verify it passes**

Run: `npx vitest run src/components/MatchDetailModal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Make `MatchCard` openable**

In `src/components/MatchCard.tsx`, add `onOpen?: () => void` to `MatchCardProps`, destructure it, and make the root element a button when set. Change the outer `<div className="border border-line bg-panel ...">` to:

```tsx
const clickable = Boolean(onOpen);
const Root = clickable ? 'button' : 'div';
return (
  <Root
    {...(clickable ? { onClick: onOpen, type: 'button' as const } : {})}
    className={`block w-full text-left border border-line bg-panel overflow-hidden transition-colors ${
      clickable ? 'hover:border-pitch cursor-pointer' : 'hover:border-chalkdim'
    }`}
  >
    {/* ...existing inner markup unchanged... */}
  </Root>
);
```

(Leave all inner markup exactly as-is; only the wrapper element and props change.)

- [ ] **Step 7: Wire `FixturesView` to open the modal**

In `src/components/FixturesView.tsx`:

1. Add the import and state:

```tsx
import MatchDetailModal from './MatchDetailModal';
// ...inside the component, with the other useState calls:
const [openMatch, setOpenMatch] = useState<WCMatch | null>(null);
```

2. In `renderDay`, pass `onOpen` for finished/live matches only:

```tsx
<MatchCard
  key={m.id}
  homeName={m.homeName}
  awayName={m.awayName}
  homeFlag={m.homeFlag}
  awayFlag={m.awayFlag}
  homeScore={m.homeScore}
  awayScore={m.awayScore}
  status={m.status}
  kickoff={m.kickoff}
  stage={m.stage}
  group={m.group}
  homeScorers={m.homeScorers}
  awayScorers={m.awayScorers}
  venue={m.venue}
  onOpen={m.status === 'upcoming' ? undefined : () => setOpenMatch(m)}
/>
```

3. Render the modal at the end of the component's returned tree (just before the closing `</div>` of the outer wrapper):

```tsx
{openMatch && <MatchDetailModal match={openMatch} onClose={() => setOpenMatch(null)} />}
```

- [ ] **Step 8: Run the full suite + build + lint**

Run: `npx vitest run && npm run build && npm run lint`
Expected: all tests PASS, build succeeds, lint clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/MatchDetailModal.tsx src/components/MatchCard.tsx src/components/FixturesView.tsx src/i18n/messages.ts src/components/MatchDetailModal.test.tsx
git commit -m "feat: open match detail modal from finished/live cards"
```

---

## Self-Review Notes

- **Spec coverage:** Worker summary route (Task 1) ✓; lazy hook (Task 4) ✓; `MatchDetail` parse incl. stat pairing / all+key plays / lineup sub-minute + card / venue + attendance (Task 2) ✓; pitch positioner via position codes (Task 3) ✓; three tabs (Task 5) ✓; modal + card trigger restricted to finished/live + i18n in 4 langs (Task 6) ✓. Tournament tab is intentionally out of scope per the spec.
- **Deviation from spec:** `layoutStarters` drops the `formation`-string fallback param — real ESPN data always carries `position.abbreviation`; unknown codes default to the midfield row (commented). Simpler, still safe.
- **Sub minute / cards** come from `player.plays[]` (verified on live data), not name-matching against keyEvents.
- **Type consistency:** `parseSummary` → `MatchDetail` fields match exactly what Tasks 4–6 consume (`homeId`, `stats`, `allPlays`, `keyPlays`, `lineups`, `venue`, `attendance`). `layoutStarters`/`PositionedPlayer` consumed only inside `LineupTab`.
