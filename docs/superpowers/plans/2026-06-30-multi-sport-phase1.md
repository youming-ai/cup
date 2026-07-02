# 多体育扩展 Phase 1 实现计划（配置 + 接入参数化）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把数据接入层按 competition key 参数化，引入静态赛事注册表 + 共享 `buildUrl`，World Cup 行为零变化。

**Architecture:** 新增 `src/competitions.ts`（注册表 + 纯函数 `buildUrl`），Worker 和 dev proxy 都从它拼上游 ESPN URL（杜绝两边漂移）。Worker 同源路由从写死的 `/api/wc/{scoreboard,standings,summary}` 泛化为正则匹配的 `/api/<key>/<resource>`。前端调用点改用默认 key（`fifa.world`），路由层的 key 传递留给 Phase 2。

**Tech Stack:** TypeScript, Vitest (jsdom + node env), Cloudflare Workers, Vite dev proxy, Biome。

## Global Constraints

- Biome：2 空格缩进、单引号、分号、尾逗号、行宽 100（`*.css` / `worker-configuration.d.ts` 排除）。
- `npm run typecheck` 必须同时通过 app 与 worker 两套 tsconfig。
- 测试与源码 colocated（`*.test.ts`）；vitest `fileParallelism: false`，串行运行。
- **Worker 路由与 vite dev proxy 必须保持同步**——本计划用同一个 `buildUrl` 纯函数保证。
- ESPN 接口约定见 `docs/espn-api.md`：standings 路径在 `/apis/v2/`（无 `site/`），scoreboard/summary 在 `/apis/site/v2/`；足球 scoreboard 必须显式 `limit`。
- `src/competitions.ts` 必须无 DOM/React 依赖、纯数据 + 纯函数，以便 app 与 worker 两套 tsconfig 都能编译它。

---

### Task 1: Competition 注册表 + buildUrl（纯模块，先行单测）

**Files:**
- Create: `src/competitions.ts`
- Test: `src/competitions.test.ts`

**Interfaces:**
- Produces:
  - `type Sport = 'soccer' | 'basketball' | 'football' | 'baseball' | 'hockey'`
  - `type Resource = 'scoreboard' | 'standings' | 'summary'`
  - `interface Competition { key, sport, league, label, season, dates?, standingsLevel?, shape, capabilities }`
  - `const COMPETITIONS: Record<string, Competition>`
  - `const DEFAULT_COMPETITION: string` （值为 `'fifa.world'`）
  - `function buildUrl(c: Competition, resource: Resource, event?: string): string`

- [ ] **Step 1: 写失败测试** `src/competitions.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildUrl, COMPETITIONS, DEFAULT_COMPETITION } from './competitions';

describe('buildUrl', () => {
  const wc = COMPETITIONS[DEFAULT_COMPETITION];

  it('builds the World Cup scoreboard URL with the date window and limit', () => {
    expect(buildUrl(wc, 'scoreboard')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300',
    );
  });

  it('builds the standings URL WITHOUT the site/ path segment', () => {
    expect(buildUrl(wc, 'standings')).toBe(
      'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026&level=3',
    );
  });

  it('builds the summary URL with the event id', () => {
    expect(buildUrl(wc, 'summary', '760420')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760420',
    );
  });
});

describe('registry', () => {
  it('exposes the default competition', () => {
    expect(COMPETITIONS[DEFAULT_COMPETITION]).toBeDefined();
    expect(COMPETITIONS[DEFAULT_COMPETITION].sport).toBe('soccer');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/competitions.test.ts`
Expected: FAIL（`Cannot find module './competitions'`）

- [ ] **Step 3: 写最小实现** `src/competitions.ts`

```ts
// Single source of truth for which competitions the app serves. The Worker
// (worker/index.ts) and the dev proxy (vite.config.ts) both build their
// upstream ESPN URLs from here via buildUrl(), so the two never drift.
// Pure data + a pure function — no DOM/React deps — so both build targets
// (app tsconfig + tsconfig.worker.json) compile it.

export type Sport = 'soccer' | 'basketball' | 'football' | 'baseball' | 'hockey';
export type Resource = 'scoreboard' | 'standings' | 'summary';

export interface Competition {
  key: string; // URL first segment, e.g. 'fifa.world'
  sport: Sport;
  league: string; // ESPN league slug
  label: string; // i18n key (wired into the switcher in Phase 2)
  season: number;
  dates?: string; // scoreboard date window — tournaments need it, season comps omit it
  standingsLevel?: number; // soccer standings depth (World Cup = 3 → the group tables)
  shape: 'tournament' | 'season';
  capabilities: {
    bracket: boolean;
    scorers: boolean;
    leaders: boolean;
    lineups: boolean;
    boxscore: boolean;
  };
}

export const COMPETITIONS: Record<string, Competition> = {
  'fifa.world': {
    key: 'fifa.world',
    sport: 'soccer',
    league: 'fifa.world',
    label: 'comp.fifa.world',
    season: 2026,
    dates: '20260611-20260719',
    standingsLevel: 3,
    shape: 'tournament',
    capabilities: { bracket: true, scorers: true, leaders: false, lineups: true, boxscore: false },
  },
};

export const DEFAULT_COMPETITION = 'fifa.world';

const ESPN = 'https://site.api.espn.com/apis';

// ESPN quirk: standings lives under /apis/v2/ (NO `site/`); scoreboard and
// summary live under /apis/site/v2/. See docs/espn-api.md §2 & §9.
export function buildUrl(c: Competition, resource: Resource, event?: string): string {
  const path = `sports/${c.sport}/${c.league}`;
  if (resource === 'standings') {
    const q = new URLSearchParams({ season: String(c.season) });
    if (c.standingsLevel) q.set('level', String(c.standingsLevel));
    return `${ESPN}/v2/${path}/standings?${q}`;
  }
  if (resource === 'summary') {
    return `${ESPN}/site/v2/${path}/summary?event=${event}`;
  }
  // scoreboard
  const q = new URLSearchParams();
  if (c.dates) q.set('dates', c.dates);
  q.set('limit', '300'); // ponytail: hardcoded cap; make it a Competition field when a comp needs a different one
  return `${ESPN}/site/v2/${path}/scoreboard?${q}`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/competitions.test.ts`
Expected: PASS（4 个用例全绿）

- [ ] **Step 5: 提交**

```bash
git add src/competitions.ts src/competitions.test.ts
git commit -m "feat: add competition registry and shared buildUrl"
```

---

### Task 2: Worker 按 competition key 路由

**Files:**
- Modify: `worker/index.ts`
- Test: `worker/index.test.ts`

**Interfaces:**
- Consumes（来自 Task 1）：`COMPETITIONS`, `buildUrl`, `Competition`, `Resource`。
- Produces（供测试与运行时）：
  - `serve(comp: Competition, resource: 'scoreboard' | 'standings', env: Env, ctx: ExecutionContext): Promise<Response>`
  - `serveSummary(comp: Competition, eventId: string, env: Env, ctx: ExecutionContext): Promise<Response>`
  - `default.fetch` 匹配 `/api/<key>/<resource>`，未知 key 返回 404。
  - KV 缓存键：scoreboard/standings 用 `${comp.key}:${resource}`，summary 用 `summary:${comp.key}:${eventId}`。

- [ ] **Step 1: 改测试到新签名 + 新增路由测试** `worker/index.test.ts`

把第 5 行的 import 改为同时引入默认导出与注册表：

```ts
import worker, { type Env, json, serve, serveSummary } from './index';
import { COMPETITIONS } from '../src/competitions';

const WC = COMPETITIONS['fifa.world'];
```

把 `mockEnv` 的默认 key 改成新缓存键：

```ts
function mockEnv(kvData?: { body: string; at: number } | null, key = 'fifa.world:standings') {
```

把 `describe('serve')` 里 5 处 `serve('standings', env as unknown as Env, ctx)` 全部改为：

```ts
const res = await serve(WC, 'standings', env as unknown as Env, ctx);
```

（涉及行：'returns HIT…' / 'returns MISS…' / 'returns REVALIDATED…' / 'returns STALE…' / 'returns 502 when upstream fails…' / 'returns 502 when upstream responds non-ok…' / 'caches the fresh upstream body…' / coalescing 用例里的 `serve('standings', …)`——全部加上 `WC, ` 前缀。）

coalescing 用例的数组也改：

```ts
const responses = Array.from({ length: N }, () =>
  serve(WC, 'standings', env as unknown as Env, ctx),
);
```

把 `describe('serveSummary')` 三处改为带 `WC`，并把缓存键断言改成带 key 的命名空间：

```ts
it('returns 400 for a non-numeric event id', async () => {
  const env = mockEnv(null);
  const res = await serveSummary(WC, 'abc; DROP', env as unknown as Env, mockCtx());
  expect(res.status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('returns 400 for an empty event id', async () => {
  const env = mockEnv(null);
  const res = await serveSummary(WC, '', env as unknown as Env, mockCtx());
  expect(res.status).toBe(400);
});

it('fetches and caches the ESPN summary for a numeric id', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{"boxscore":{}}' });
  const env = mockEnv(null);
  const ctx = mockCtx();
  const res = await serveSummary(WC, '760420', env as unknown as Env, ctx);
  expect(res.status).toBe(200);
  expect(res.headers.get('x-cache')).toBe('MISS');
  expect(await res.text()).toBe('{"boxscore":{}}');
  expect((env.CACHE as ReturnType<typeof mockEnv>['CACHE']).put).toHaveBeenCalledWith(
    'summary:fifa.world:760420',
    expect.any(String),
    expect.objectContaining({ expirationTtl: expect.any(Number) }),
  );
});
```

在文件末尾新增路由 describe：

```ts
describe('fetch routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('404s on an unknown competition key', async () => {
    const env = mockEnv(null);
    const res = await worker.fetch(
      new Request('https://x/api/nope/scoreboard'),
      env as unknown as Env,
      mockCtx(),
    );
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes a known competition scoreboard through serve', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{"events":[]}' });
    const env = mockEnv(null);
    const res = await worker.fetch(
      new Request('https://x/api/fifa.world/scoreboard'),
      env as unknown as Env,
      mockCtx(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache')).toBe('MISS');
    expect(await res.text()).toBe('{"events":[]}');
  });

  it('404s on an unknown /api/ path', async () => {
    const env = mockEnv(null);
    const res = await worker.fetch(
      new Request('https://x/api/fifa.world/nonsense'),
      env as unknown as Env,
      mockCtx(),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run worker/index.test.ts`
Expected: FAIL（`serve`/`serveSummary` 旧签名不匹配；`worker` 默认导出路由尚未支持 `/api/<key>/<resource>`）

- [ ] **Step 3: 改实现** `worker/index.ts`

3a. 在文件顶部 `fetchWithRetry` 之上、`/// <reference …>` 之下加 import：

```ts
import { type Competition, COMPETITIONS, type Resource, buildUrl } from '../src/competitions';
```

3b. 删除旧的 `ESPN` / `SOURCES` / `ROUTES`（第 49–71 行那整块注释 + 两个 const），替换为按 resource 的 TTL 表：

```ts
// Per-resource cache TTLs (seconds). `fresh` = served without revalidating;
// `keep` = how long KV retains a copy so a stale one can cover an outage.
// Scoreboard refreshes often (live scores), standings change slowly, summary
// is per-event. ppv.to streams are still fetched browser-side (datacenter-IP
// blocked), so they never touch this Worker.
const TTL: Record<Resource, { fresh: number; keep: number }> = {
  scoreboard: { fresh: 60, keep: 86400 },
  standings: { fresh: 300, keep: 86400 },
  summary: { fresh: 30, keep: 86400 },
};
```

3c. 替换 `serve` 与 `serveSummary`：

```ts
export async function serve(
  comp: Competition,
  resource: 'scoreboard' | 'standings',
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const { fresh, keep } = TTL[resource];
  return cached(`${comp.key}:${resource}`, buildUrl(comp, resource), fresh, keep, env, ctx);
}

export async function serveSummary(
  comp: Competition,
  eventId: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!/^\d+$/.test(eventId)) return json('{"error":"bad event id"}', 400, 'MISS');
  const { fresh, keep } = TTL.summary;
  return cached(
    `summary:${comp.key}:${eventId}`,
    buildUrl(comp, 'summary', eventId),
    fresh,
    keep,
    env,
    ctx,
  );
}
```

3d. 替换默认导出的 `fetch`：

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/([^/]+)\/(scoreboard|standings|summary)$/);
    if (m) {
      const comp = COMPETITIONS[m[1]];
      if (!comp) return new Response('Not found', { status: 404 });
      const resource = m[2] as Resource;
      if (resource === 'summary') {
        return serveSummary(comp, url.searchParams.get('event') ?? '', env, ctx);
      }
      return serve(comp, resource, env, ctx);
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request); // static assets + SPA fallback
  },
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run worker/index.test.ts`
Expected: PASS（原有用例 + 3 个新路由用例全绿）

- [ ] **Step 5: 类型检查（含 worker tsconfig）**

Run: `npm run typecheck`
Expected: 无错误（验证 worker 能 import `../src/competitions`，`URLSearchParams` 在 worker lib 下可用）

- [ ] **Step 6: 提交**

```bash
git add worker/index.ts worker/index.test.ts
git commit -m "refactor(worker): route by competition key via registry"
```

---

### Task 3: dev proxy + 前端调用点改用 key

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/hooks/useWorldCup.ts:13`
- Modify: `src/hooks/useMatchDetail.ts:26`
- Test: `src/hooks/useMatchDetail.test.ts:28`（更新 URL 断言）

**Interfaces:**
- Consumes（来自 Task 1）：`COMPETITIONS`, `buildUrl`, `DEFAULT_COMPETITION`。
- 行为不变：前端仍只打同源 `/api/<key>/{scoreboard,standings,summary}`，key 此期固定为 `DEFAULT_COMPETITION`（Phase 2 改为路由提供）。

- [ ] **Step 1: 改 `useMatchDetail.test.ts` 的 URL 断言（先红）**

把第 28 行：

```ts
expect(fetchMock).toHaveBeenCalledWith('/api/wc/summary?event=760420', expect.any(Object));
```

改为：

```ts
expect(fetchMock).toHaveBeenCalledWith('/api/fifa.world/summary?event=760420', expect.any(Object));
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/hooks/useMatchDetail.test.ts`
Expected: FAIL（断言新 URL，但实现仍发 `/api/wc/summary`）

- [ ] **Step 3: 改实现**

3a. `src/hooks/useMatchDetail.ts` —— 顶部加 import，并改 fetch URL（第 26 行）：

```ts
import { DEFAULT_COMPETITION } from '../competitions';
```

```ts
fetch(`/api/${DEFAULT_COMPETITION}/summary?event=${eventId}`, { signal: controller.signal })
```

3b. `src/hooks/useWorldCup.ts` —— 把第 13 行 `const BASE = '/api/wc';` 改为：

```ts
import { DEFAULT_COMPETITION } from '../competitions';
```

```ts
const BASE = `/api/${DEFAULT_COMPETITION}`;
```

（`${BASE}/scoreboard`、`${BASE}/standings` 两处调用不变。）

3c. `vite.config.ts` —— 顶部加 import：

```ts
import { buildUrl, COMPETITIONS } from './src/competitions';
```

把 `proxy` 块整体替换为基于 `buildUrl` 的版本：

```ts
    proxy: {
      '/api': {
        target: 'https://site.api.espn.com',
        changeOrigin: true,
        rewrite: (p) => {
          const [path, query = ''] = p.split('?');
          const m = path.match(/^\/api\/([^/]+)\/(scoreboard|standings|summary)$/);
          if (!m) return p;
          const comp = COMPETITIONS[m[1]];
          if (!comp) return p;
          const event = new URLSearchParams(query).get('event') ?? undefined;
          const full = buildUrl(comp, m[2] as 'scoreboard' | 'standings' | 'summary', event);
          const u = new URL(full);
          return u.pathname + u.search; // target host is fixed (site.api.espn.com)
        },
      },
    },
```

注意 proxy 前缀从 `/api/wc` 收紧匹配逻辑放进 rewrite，前缀用 `/api`（dev 下本就没有其它 `/api/*` 路由）。

- [ ] **Step 4: 跑测试 + 类型检查确认通过**

Run: `npx vitest run src/hooks/useMatchDetail.test.ts src/hooks/useWorldCup.test.ts`
Expected: PASS（useWorldCup 用例按调用顺序 mock、不校验 URL，不受影响）

Run: `npm run typecheck`
Expected: 无错误（vite.config 能 import `./src/competitions`）

- [ ] **Step 5: dev 手测（行为零变化验证）**

Run: `npm run dev`，浏览器开 `http://localhost:5173/`
Expected: 赛程/积分榜/射手榜与改造前一致；DevTools Network 里请求路径为 `/api/fifa.world/scoreboard`、`/api/fifa.world/standings`，点进任意比赛详情发 `/api/fifa.world/summary?event=…`，均 200。

- [ ] **Step 6: 全量测试 + lint**

Run: `npx vitest run && npm run lint`
Expected: 全绿、无 lint 报错

- [ ] **Step 7: 提交**

```bash
git add vite.config.ts src/hooks/useWorldCup.ts src/hooks/useMatchDetail.ts src/hooks/useMatchDetail.test.ts
git commit -m "refactor: point dev proxy and data hooks at /api/<key> routes"
```

---

## 后续 Phase（不在本计划内）

- **Phase 2**（独立计划）：router 加 competition 首段 `/<key>/...` + 旧链接重定向 `/fifa.world/*`、`useWorldCup`→`useCompetition(key)`、切换器组件、视图按 `capabilities` 门控。Phase 1 落地后再写，届时路由集成细节是确定的。
- **Phase 3**（独立计划）：加 `eng.1`（验证 season 形态）再加 NBA（引入跨运动），**在写第二个 transform 时**才提取 `SportAdapter` 契约——按 spec 这是故意延迟的，现在写具体代码只会是占位符虚构。

## Self-Review

- **Spec 覆盖**：本计划对应 spec §3.1（注册表）、§3.3（Worker/dev proxy 参数化）、§5 Phase 1。spec §3.2 路由首段、§3.4 capabilities 视图、§3.5 适配器契约属 Phase 2/3，已在「后续 Phase」标注，非本计划缺口。
- **占位符扫描**：无 TBD/TODO；所有改动给出完整代码与确切命令。
- **类型一致性**：`serve(comp, resource, …)` / `serveSummary(comp, eventId, …)` 签名在 Task 2 定义并在测试中一致使用；`buildUrl(c, resource, event?)` 在 Task 1 定义，Task 2（worker）、Task 3（vite.config）调用签名一致；缓存键 `${comp.key}:${resource}` 与 `summary:${comp.key}:${eventId}` 在实现与测试断言中一致；`DEFAULT_COMPETITION` 在 Task 1 导出、Task 3 两个 hook 消费。
