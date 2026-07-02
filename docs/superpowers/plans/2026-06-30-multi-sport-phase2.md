# 多体育扩展 Phase 2 实现计划（路由地基：URL 首段带赛事）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前赛事编码进 URL 首段（`/<key>/...`），让每个视图在多赛事下仍可深链分享；旧无前缀链接重定向到默认赛事。World Cup 用户体验零变化。

**Architecture:** `Route` 每个变体带 `comp: string`；`parseRoute` 把首段识别为已知赛事 key（否则按默认赛事的「旧式」路径解析）；`pathFor` 前缀 `/<comp>`；纯函数 `canonicalPath` 计算规范 URL，由 `App` 一个 effect 做旧链接重定向。所有导航点从 `useRouter().route.comp` 取当前赛事并经 `pathFor` 生成带前缀路径。数据 hook（`useWorldCup`/`useMatchDetail`）接收 comp 参数打 `/api/<comp>/*`。

**Tech Stack:** TypeScript, React, Vitest (jsdom), 自研 History API 路由（`src/utils/router.ts`），Biome。

**Scope（已与用户确认）：** 只做路由地基。**不做**可见的切换器 UI、**不做** capabilities 门控——两者缓到 Phase 3（注册表有第二个赛事、切换器才有意义时）。但所有导航点必须携带当前 comp（否则 Phase 3 上第二个赛事时跨赛事导航会静默串味）。

## Global Constraints

- Biome：2 空格缩进、单引号、分号、尾逗号、行宽 100。
- `npm run typecheck`（app + worker）+ `npx vitest run` + `npm run lint` 全绿。
- 路由「每个视图可深链分享」不可破：competition 必须进 URL（不可只存 localStorage）。
- 路径段不可信：沿用 `safeDecode` 防御性解码，永不 throw，坏段回落默认赛事首页。
- 默认赛事来自 `src/competitions.ts` 的 `DEFAULT_COMPETITION`（= `'fifa.world'`）；已知赛事 key 来自 `COMPETITIONS`。
- `parseRoute` 输出的 `Route` 始终带 `comp`（消费者拿到的是确定的 string）。
- 规范 URL 不变式：`parseRoute(pathFor(r))` 对任意合法 `r` 等于 `r`（往返一致）。

---

### Task 1: Comp-aware 路由核心 + 已类型化的 pathFor 消费者

**Files:**
- Modify: `src/utils/router.ts`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/FixturesView.tsx`
- Test: `src/utils/router.test.tsx`
- Test: `src/components/Header.test.tsx`

**Interfaces:**
- Consumes: `COMPETITIONS`, `DEFAULT_COMPETITION`（来自 `src/competitions.ts`，Phase 1 已存在）。
- Produces:
  - `type Route` 每个变体新增 `comp: string`。
  - `parseRoute(pathname: string): Route`（首段识别赛事 key；否则默认赛事 + 旧式路径）。
  - `pathFor(route: Route): string`（前缀 `/<comp>`）。
  - `canonicalPath(pathname: string): string | null`（与规范 URL 不同则返回规范 URL，否则 null）。
  - `useRouter()` 签名不变（**不**在此做重定向；重定向在 Task 2 由 App 接 `canonicalPath`）。

- [ ] **Step 1: 改 `router.test.tsx`（先红）**

应用以下改动（其余结构不动）：

1. 顶部 import 增加 `canonicalPath`：
   ```ts
   import { canonicalPath, navigate, parseRoute, pathFor, useRouter } from './router';
   ```
2. 把 `MATCHES` 常量改为带 comp：
   ```ts
   const MATCHES = { kind: 'section', comp: 'fifa.world', section: 'matches' } as const;
   ```
3. 给 `describe('parseRoute')` 里**每一个**期望的 route 对象加 `comp: 'fifa.world'`。逐条新值：
   ```ts
   expect(parseRoute('/scorers')).toEqual({ kind: 'section', comp: 'fifa.world', section: 'scorers' });
   expect(parseRoute('/bracket')).toEqual({ kind: 'section', comp: 'fifa.world', section: 'bracket' });
   expect(parseRoute('/match/foo/')).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'foo' });
   expect(parseRoute('/match/foo')).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'foo' });
   expect(parseRoute('/match/foo?tab=stats')).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'foo' });
   expect(parseRoute('/team/464')).toEqual({ kind: 'team', comp: 'fifa.world', teamId: '464' });
   expect(parseRoute('/player/12345')).toEqual({ kind: 'player', comp: 'fifa.world', athleteId: '12345' });
   expect(parseRoute('/match/argentina-vs-france')).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'argentina-vs-france' });
   ```
   （`/`、`''`、`/?foo=bar`、`/standings`、`/live`、`/live/echo-1`、`/something/random`、坏编码用例都 `toEqual(MATCHES)`，已含 comp，无需逐个改。）
4. 在 `describe('parseRoute')` 末尾追加「带赛事前缀」与「旧式回退」用例：
   ```ts
   it('parses a competition-prefixed path', () => {
     expect(parseRoute('/fifa.world')).toEqual(MATCHES);
     expect(parseRoute('/fifa.world/scorers')).toEqual({ kind: 'section', comp: 'fifa.world', section: 'scorers' });
     expect(parseRoute('/fifa.world/bracket')).toEqual({ kind: 'section', comp: 'fifa.world', section: 'bracket' });
     expect(parseRoute('/fifa.world/match/foo')).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'foo' });
     expect(parseRoute('/fifa.world/team/464')).toEqual({ kind: 'team', comp: 'fifa.world', teamId: '464' });
   });

   it('treats an unknown first segment as a legacy path under the default competition', () => {
     // 'nba' is not in COMPETITIONS yet → whole path parsed under default comp
     expect(parseRoute('/nba/scorers')).toEqual(MATCHES);
   });
   ```
5. `describe('pathFor')`：往返用例的输入加 comp，特殊字符用例改前缀后的期望：
   ```ts
   it('round-trips parseRoute → pathFor → parseRoute', () => {
     const cases: Array<ReturnType<typeof parseRoute>> = [
       { kind: 'section', comp: 'fifa.world', section: 'matches' },
       { kind: 'section', comp: 'fifa.world', section: 'scorers' },
       { kind: 'section', comp: 'fifa.world', section: 'bracket' },
       { kind: 'match', comp: 'fifa.world', slug: 'argentina-vs-france' },
       { kind: 'team', comp: 'fifa.world', teamId: '464' },
       { kind: 'player', comp: 'fifa.world', athleteId: '12345' },
     ];
     for (const r of cases) {
       expect(parseRoute(pathFor(r))).toEqual(r);
     }
   });

   it('prefixes the competition and URI-encodes special characters in slugs', () => {
     expect(pathFor({ kind: 'section', comp: 'fifa.world', section: 'matches' })).toBe('/fifa.world');
     expect(pathFor({ kind: 'match', comp: 'fifa.world', slug: 'foo bar' })).toBe('/fifa.world/match/foo%20bar');
     expect(pathFor({ kind: 'team', comp: 'fifa.world', teamId: 'a/b' })).toBe('/fifa.world/team/a%2Fb');
   });
   ```
6. 新增 `describe('canonicalPath')`：
   ```ts
   describe('canonicalPath', () => {
     it('returns the prefixed path for a legacy (unprefixed) URL', () => {
       expect(canonicalPath('/scorers')).toBe('/fifa.world/scorers');
       expect(canonicalPath('/match/foo')).toBe('/fifa.world/match/foo');
       expect(canonicalPath('/')).toBe('/fifa.world');
     });
     it('returns null when the path is already canonical', () => {
       expect(canonicalPath('/fifa.world')).toBeNull();
       expect(canonicalPath('/fifa.world/scorers')).toBeNull();
       expect(canonicalPath('/fifa.world/match/foo')).toBeNull();
     });
   });
   ```
7. `describe('useRouter')` 的三处期望 route 加 comp（`{ kind:'match', comp:'fifa.world', slug:'foo' }`、两处 `MATCHES`、`{ kind:'match', comp:'fifa.world', slug:'abc' }`）。具体：
   ```ts
   // returns the parsed route on mount
   expect(captured.route).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'foo' });
   // reacts to popstate / route-change — 起始用 MATCHES，跳转后:
   expect(captured.route).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'foo' });
   // go() 用例:
   expect(captured.route).toEqual({ kind: 'match', comp: 'fifa.world', slug: 'abc' });
   ```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/utils/router.test.tsx`
Expected: FAIL（`canonicalPath` 未导出；route 对象缺 comp；pathFor 未加前缀）

- [ ] **Step 3: 改 `src/utils/router.ts`**

替换第 17–84 行（`Section` 类型定义到 `pathFor` 结束）为：

```ts
import { COMPETITIONS, DEFAULT_COMPETITION } from '../competitions';

// The schedule sections (group standings are folded into the matches view).
export type Section = 'matches' | 'scorers' | 'bracket';

// Every route carries the competition it belongs to (URL first segment).
export type Route =
  | { kind: 'section'; comp: string; section: Section }
  | { kind: 'match'; comp: string; slug: string }
  | { kind: 'team'; comp: string; teamId: string }
  | { kind: 'player'; comp: string; athleteId: string };

// section → path suffix under /<comp> (matches is the competition root).
const SECTION_SUFFIX: Record<Section, string> = {
  matches: '',
  scorers: '/scorers',
  bracket: '/bracket',
};

// decodeURIComponent throws URIError on malformed input (e.g. "/match/%").
// Path segments are untrusted, so decode defensively and treat a bad segment
// as no match → home fallback, never a thrown error that crashes the tree.
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

// Parse the view segments (everything AFTER the competition prefix) into a
// Route body for the resolved competition. Unknown shapes fall back to the
// matches section, never throw.
function parseView(comp: string, seg: string[]): Route {
  if (seg.length === 0) return { kind: 'section', comp, section: 'matches' };
  if (seg.length === 1 && seg[0] === 'scorers') return { kind: 'section', comp, section: 'scorers' };
  if (seg.length === 1 && seg[0] === 'bracket') return { kind: 'section', comp, section: 'bracket' };
  if (seg.length === 2 && seg[0] === 'match') {
    const slug = safeDecode(seg[1]!);
    if (slug !== null) return { kind: 'match', comp, slug };
  }
  if (seg.length === 2 && seg[0] === 'team') {
    const teamId = safeDecode(seg[1]!);
    if (teamId !== null) return { kind: 'team', comp, teamId };
  }
  if (seg.length === 2 && seg[0] === 'player') {
    const athleteId = safeDecode(seg[1]!);
    if (athleteId !== null) return { kind: 'player', comp, athleteId };
  }
  return { kind: 'section', comp, section: 'matches' };
}

export function parseRoute(pathname: string): Route {
  // Normalise: strip query and trailing slash, split into non-empty segments.
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';
  const seg = path.split('/').filter(Boolean);
  // First segment is the competition when it's a known key; otherwise the
  // whole path is a legacy (pre-multi-comp) link under the default competition.
  if (seg.length > 0 && COMPETITIONS[seg[0]!]) {
    return parseView(seg[0]!, seg.slice(1));
  }
  return parseView(DEFAULT_COMPETITION, seg);
}

export function pathFor(route: Route): string {
  const prefix = `/${route.comp}`;
  switch (route.kind) {
    case 'section':
      return `${prefix}${SECTION_SUFFIX[route.section]}`;
    case 'match':
      return `${prefix}/match/${encodeURIComponent(route.slug)}`;
    case 'team':
      return `${prefix}/team/${encodeURIComponent(route.teamId)}`;
    case 'player':
      return `${prefix}/player/${encodeURIComponent(route.athleteId)}`;
  }
}

// The canonical (competition-prefixed) URL for a pathname, or null if it's
// already canonical. Legacy unprefixed links resolve to a real route via
// parseRoute; this is what lets App redirect them to their prefixed form so
// shared deep links stay consistent once multiple competitions exist.
export function canonicalPath(pathname: string): string | null {
  const normalized = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';
  const canonical = pathFor(parseRoute(pathname));
  return canonical === normalized ? null : canonical;
}
```

（`ROUTE_CHANGE`、`navigate`、`useRouter` 第 86 行起保持不变。删除原来的 `SECTION_PATH` 常量——已被 `SECTION_SUFFIX` + `pathFor` 前缀取代。）

- [ ] **Step 4: 改两个 pathFor 消费者**

4a. `src/components/Header.tsx`：导入 `useRouter`，组件内取 comp，导航用带 comp 的 pathFor。

- 第 2 行 import 改为：
  ```ts
  import { navigate, pathFor, type Section, useRouter } from '../utils/router';
  ```
- 组件体（第 15 行 `const t = useT();` 下一行）加：
  ```ts
  const { route } = useRouter();
  const comp = route.comp;
  ```
- 第 44 行 onClick 改为：
  ```ts
  onClick={() => navigate(pathFor({ kind: 'section', comp, section: s }))}
  ```

4b. `src/components/FixturesView.tsx`：

- 第 4 行 import 增加 `useRouter`：
  ```ts
  import { navigate, pathFor, type Section, useRouter } from '../utils/router';
  ```
- 组件体顶部取 comp：
  ```ts
  const { route } = useRouter();
  const comp = route.comp;
  ```
- 第 37 行改为：
  ```ts
  navigate(pathFor({ kind: 'match', comp, slug: m.slug }));
  ```

- [ ] **Step 5: 改 `Header.test.tsx` 的路径断言**

第 42 行（点击 bracket tab 的断言）改为：
```ts
expect(navSpy).toHaveBeenCalledWith('/fifa.world/bracket');
```
（测试中 `window.location.pathname` 为默认 `'/'` → `useRouter` 得 `comp='fifa.world'`。）

- [ ] **Step 6: 跑测试 + 类型检查确认通过**

Run: `npx vitest run src/utils/router.test.tsx src/components/Header.test.tsx`
Expected: PASS
Run: `npm run typecheck`
Expected: 无错误（`pathFor(route: Route)` 的所有调用点都带 comp；其余 raw-string `navigate(...)` 调用点仍是字符串、不受类型影响）

- [ ] **Step 7: 全量测试确认未破坏其它用例**

Run: `npx vitest run`
Expected: 全绿。（BracketView/TeamPage/PlayerPage 的 raw-string 导航此时产出旧式无前缀路径，仍能被 parseRoute 正确解析；它们的测试不断言导航路径，故不受影响。Task 2 会把它们改成带 comp。）

- [ ] **Step 8: 提交**

```bash
git add src/utils/router.ts src/utils/router.test.tsx src/components/Header.tsx src/components/FixturesView.tsx src/components/Header.test.tsx
git commit -m "feat(router): competition-prefixed routes (/<key>/...) + canonicalPath"
```
（提交信息末尾追加两行 trailer：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 与 `Claude-Session: https://claude.ai/code/session_01XUYXGwJi76ZS8wAQi5EsJd`，前留一空行。）

---

### Task 2: 其余导航点携带 comp + App 接入旧链接重定向

**Files:**
- Modify: `src/components/BracketView.tsx`
- Modify: `src/components/TeamPage.tsx`
- Modify: `src/components/PlayerPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes（来自 Task 1）：`pathFor(route: Route)`、`canonicalPath(pathname)`、`useRouter().route.comp`。
- 行为产出：应用内所有导航直接生成 `/<comp>/...`；冷加载的旧式无前缀深链被 `App` 重定向到规范 URL。

- [ ] **Step 1: `src/components/BracketView.tsx`**

- 第 5 行 import 改为：
  ```ts
  import { navigate, pathFor, useRouter } from '../utils/router';
  ```
- 组件体顶部取 comp：
  ```ts
  const { route } = useRouter();
  const comp = route.comp;
  ```
- 第 118 行改为：
  ```ts
  navigate(pathFor({ kind: 'match', comp, slug: match.match.slug }));
  ```

- [ ] **Step 2: `src/components/TeamPage.tsx`**

- 第 3 行 import 改为：
  ```ts
  import { navigate, pathFor, useRouter } from '../utils/router';
  ```
- 组件体顶部取 comp：
  ```ts
  const { route } = useRouter();
  const comp = route.comp;
  ```
- 第 144、166 行（两处 `navigate(\`/match/${encodeURIComponent(m.slug)}\`)`）各改为：
  ```ts
  onOpen={() => navigate(pathFor({ kind: 'match', comp, slug: m.slug }))}
  ```

- [ ] **Step 3: `src/components/PlayerPage.tsx`**

- 第 3 行 import 改为：
  ```ts
  import { navigate, pathFor, useRouter } from '../utils/router';
  ```
- 组件体顶部取 comp：
  ```ts
  const { route } = useRouter();
  const comp = route.comp;
  ```
- 第 117 行（team 跳转）改为：
  ```ts
  onClick={() => navigate(pathFor({ kind: 'team', comp, teamId }))}
  ```
- 第 161 行（match 跳转）改为：
  ```ts
  onClick={() => navigate(pathFor({ kind: 'match', comp, slug: g.match.slug }))}
  ```

- [ ] **Step 4: `src/App.tsx` — backHome 用 comp + 加规范化重定向**

- 第 10 行 import 增加 `canonicalPath`、`pathFor`：
  ```ts
  import { canonicalPath, navigate, pathFor, useRouter } from './utils/router';
  ```
- 第 75 行 `backHome` 改为（用当前 comp）：
  ```ts
  const backHome = useCallback(
    () => navigate(pathFor({ kind: 'section', comp: route.comp, section: 'matches' }), { replace: true }),
    [route.comp],
  );
  ```
- 在 `backHome` 之后新增规范化 effect（旧式无前缀深链 → 带前缀）：
  ```ts
  // Legacy (pre-multi-comp) links like /scorers or /match/<slug> still resolve
  // (parseRoute maps them under the default competition); rewrite the URL to
  // its canonical /<comp>/... form so shared deep links stay consistent.
  useEffect(() => {
    const c = canonicalPath(window.location.pathname);
    if (c) navigate(c, { replace: true });
  }, [route]);
  ```

- [ ] **Step 5: 跑全量测试 + 类型检查 + lint**

Run: `npx vitest run`
Expected: 全绿（BracketView.test、PlayerPage.test 不断言导航路径，仍通过）
Run: `npm run typecheck && npm run lint`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/components/BracketView.tsx src/components/TeamPage.tsx src/components/PlayerPage.tsx src/App.tsx
git commit -m "feat(router): thread current competition through all navigation + canonicalize legacy links"
```
（同样追加 trailer 两行。）

---

### Task 3: 把 comp 串进数据 hook（useWorldCup / useMatchDetail）

**Files:**
- Modify: `src/hooks/useWorldCup.ts`
- Modify: `src/hooks/useMatchDetail.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/MatchDetailPage.tsx`
- Test: `src/hooks/useWorldCup.test.ts`
- Test: `src/hooks/useMatchDetail.test.ts`

**Interfaces:**
- `useWorldCup(comp: string)` — 打 `/api/<comp>/{scoreboard,standings}`。
- `useMatchDetail(eventId: string | null, comp: string)` — 打 `/api/<comp>/summary?event=<id>`。
- App 传 `route.comp`；MatchDetailPage 经 `useRouter()` 取 comp。

- [ ] **Step 1: 改 hook 测试（先红）**

1a. `src/hooks/useMatchDetail.test.ts`：所有 `useMatchDetail(...)` 调用补第二参 `'fifa.world'`。例如「fetches and parses the summary for an event id」用例里 renderHook 调用改为 `useMatchDetail('760420', 'fifa.world')`；其余调用点（null 用例、reload 用例）同样补 `'fifa.world'`。URL 断言（第 28 行）已是 `/api/fifa.world/summary?event=760420`，保持不变。

1b. `src/hooks/useWorldCup.test.ts`：所有 `renderHook(() => useWorldCup())` 改为 `renderHook(() => useWorldCup('fifa.world'))`（fetch mock 按调用顺序、不校验 URL，行为不变）。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/hooks/useMatchDetail.test.ts src/hooks/useWorldCup.test.ts`
Expected: FAIL（hook 仍是旧签名/旧默认 BASE，类型或调用不匹配）

- [ ] **Step 3: 改 `src/hooks/useWorldCup.ts`**

- 删除第 13 行模块级 `const BASE = ...` 及其上方对 `DEFAULT_COMPETITION` 的 import（不再需要默认值）。
- `export function useWorldCup() {` 改为 `export function useWorldCup(comp: string) {`，并在函数体顶部加：
  ```ts
  const BASE = `/api/${comp}`;
  ```
- `fetchAll` 的 `useCallback(..., [])` 依赖数组改为 `[comp]`（comp 变化时重建 fetch，供 Phase 3 切换赛事用）。

- [ ] **Step 4: 改 `src/hooks/useMatchDetail.ts`**

- 删除对 `DEFAULT_COMPETITION` 的 import。
- 签名改为 `export function useMatchDetail(eventId: string | null, comp: string) {`。
- 第 26 行 fetch 改为：
  ```ts
  fetch(`/api/${comp}/summary?event=${eventId}`, { signal: controller.signal })
  ```
- effect 依赖数组加入 `comp`：`[eventId, attempt, comp]`（保留原有 biome-ignore 注释行）。

- [ ] **Step 5: 改调用点**

5a. `src/App.tsx`：第 68 行 `const wc = useWorldCup();` 改为 `const wc = useWorldCup(route.comp);`。

5b. `src/components/MatchDetailPage.tsx`：
- 顶部 import 加 `useRouter`：
  ```ts
  import { useRouter } from '../utils/router';
  ```
- 组件体取 comp 并传入：
  ```ts
  const { route } = useRouter();
  ```
  第 68 行 `useMatchDetail(match.id)` 改为：
  ```ts
  const { detail, loading, error, reload } = useMatchDetail(match.id, route.comp);
  ```

- [ ] **Step 6: 跑全量测试 + 类型检查 + lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 全绿、无错误

- [ ] **Step 7: 提交**

```bash
git add src/hooks/useWorldCup.ts src/hooks/useMatchDetail.ts src/App.tsx src/components/MatchDetailPage.tsx src/hooks/useWorldCup.test.ts src/hooks/useMatchDetail.test.ts
git commit -m "feat(data): thread competition key through useWorldCup and useMatchDetail"
```
（同样追加 trailer 两行。）

---

## 手动验证（控制器在全部任务后执行）

`npm run dev` 后在浏览器验证：
1. 打开 `/` → 地址栏被重写为 `/fifa.world`，赛程正常。
2. 点击 bracket/scorers tab → URL 为 `/fifa.world/bracket`、`/fifa.world/scorers`。
3. 点开任意比赛 → `/fifa.world/match/<slug>`，详情页数据正常（Network 里 `/api/fifa.world/summary?event=…` 200）。
4. 直接访问旧链接 `/scorers`、`/match/<slug>` → 被重定向到 `/fifa.world/...`，不 404。
5. 浏览器前进/后退在带前缀 URL 间正常工作。

## 后续 Phase（不在本计划内）

- **Phase 3**：注册表加第二个赛事（先 `eng.1` 验赛季制、再 NBA 验跨运动）；此时才做**可见的切换器 UI** 与 **capabilities 门控**（bracket 仅锦标赛显示、scorers vs leaders、阵容图 vs box score），并从 soccer + NBA 两个 transform 的共性提取 `SportAdapter` 契约。

## Self-Review

- **Spec 覆盖**：对应 spec §3.2（URL 首段 + 旧链接重定向）。spec §3.4 capabilities 门控、switcher UI 已按用户决定显式延迟到 Phase 3，非缺口。
- **占位符扫描**：无 TBD/TODO；router.ts 核心给出完整代码，组件/hook 改动给出精确 before→after 行，测试给出新断言值与新增用例全文。
- **类型一致性**：`Route` 全变体带 `comp: string`；`pathFor(route: Route)` 在 Task 1 定义，Header/FixturesView（T1）、BracketView/TeamPage/PlayerPage/App（T2）调用均传 comp；`canonicalPath` 在 T1 定义、T2 在 App 消费；`useWorldCup(comp)` / `useMatchDetail(eventId, comp)` 在 T3 定义并由 App / MatchDetailPage 一致调用。
- **每任务 build 绿**：T1 后 raw-string 导航仍经 parseRoute 正确解析（单赛事下回落默认 comp）；T2 把它们改成带 comp 的 pathFor；T3 改 hook 签名同时改全部调用点。
- **风险**：App 的规范化 effect 与 `navigate` 的「同路径 no-op」守卫共同保证不会重定向死循环（重定向后 location 即等于规范 URL，effect 再跑得到 null）。canonicalPath 为纯函数、已单测；App effect 仅 3 行、无既有 App 测试装置，靠手动 dev 冒烟覆盖。
