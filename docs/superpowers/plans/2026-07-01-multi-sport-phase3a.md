# 多体育 Phase 3a 实现计划（第二个足球联赛 + 切换器 + capabilities 门控）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 注册表加入赛季制英超 `eng.1`，落地 CompetitionSwitcher 下拉、按 capabilities 过滤 section tabs、standings 的 season 单表模式。World Cup 体验不变。

**Architecture:** 一切由注册表 `COMPETITIONS[comp]` 的 `shape` + `capabilities` 驱动（单一事实源）：Header 过滤 tabs、FixturesView 决定积分榜呈现与 section 兜底、StandingsView 选 group/league 渲染。数据转换（`useWorldCup`）复用——实测 eng.1 standings 是 `children[1]`，现有解析器直接产出联赛表。

**Tech Stack:** React, TypeScript, Vitest + @testing-library/react (jsdom), 自研路由，i18n（4 语言），Biome。

## Global Constraints

- Biome：2 空格缩进、单引号、分号、尾逗号、行宽 100。`npm run typecheck`（app + worker）+ `npx vitest run` + `npm run lint` 全绿。
- 颜色只走 token（`--c-*` / Tailwind 语义色），不硬编码 hex/rgba。
- i18n：任何新 key 必须四语（`en/zh/ja/ko`）齐全，`messages.test.ts` 强制对齐。
- 单一事实源：能力/形态一律读 `COMPETITIONS[comp]`，不在多处各判 shape。
- 测试与源码 colocated（`*.test.ts(x)`）；vitest `fileParallelism: false`。
- 现有 `Competition` 类型（Phase 1）：`shape: 'tournament' | 'season'`；`capabilities: { bracket, scorers, leaders, lineups, boxscore: boolean }`。`fifa.world` 的 capabilities 已是 `{ bracket:true, scorers:true, leaders:false, lineups:true, boxscore:false }`。
- Header 已在 Phase 2 引入 `useRouter()`，组件内已有 `const { route } = useRouter()` 提供 `route.comp`。

---

### Task 1: 注册表加 eng.1 + i18n 赛事名

**Files:**
- Modify: `src/competitions.ts`
- Modify: `src/i18n/messages.ts`
- Test: `src/competitions.test.ts`

**Interfaces:**
- Produces: `COMPETITIONS['eng.1']`（`shape:'season'`, `capabilities.bracket=false`, `capabilities.scorers=false`）；i18n key `comp.fifa.world`、`comp.eng1`。

- [ ] **Step 1: 写失败测试** — 在 `src/competitions.test.ts` 追加：

```ts
describe('eng.1 (season-shape league)', () => {
  const pl = COMPETITIONS['eng.1'];

  it('is registered as a season-shape soccer league', () => {
    expect(pl).toBeDefined();
    expect(pl.sport).toBe('soccer');
    expect(pl.shape).toBe('season');
  });

  it('hides bracket and scorers via capabilities', () => {
    expect(pl.capabilities.bracket).toBe(false);
    expect(pl.capabilities.scorers).toBe(false);
  });

  it('builds a standings URL with no level and a scoreboard URL with no dates', () => {
    expect(buildUrl(pl, 'standings')).toBe(
      'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2025',
    );
    expect(buildUrl(pl, 'scoreboard')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=300',
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/competitions.test.ts`
Expected: FAIL（`COMPETITIONS['eng.1']` undefined）

- [ ] **Step 3: 加 eng.1 条目** — 在 `src/competitions.ts` 的 `COMPETITIONS` 里，`'fifa.world'` 条目之后加：

```ts
  'eng.1': {
    key: 'eng.1',
    sport: 'soccer',
    league: 'eng.1',
    label: 'comp.eng1',
    // 赛季交替期（2026 年中）：2025 = 2025-26 赛季，standings 返回满员联赛表；
    // scoreboard 无 dates → ESPN 返回当前窗口（2026-27 upcoming）。见 spec §7。
    season: 2025,
    shape: 'season',
    capabilities: { bracket: false, scorers: false, leaders: false, lineups: true, boxscore: false },
  },
```

- [ ] **Step 4: 加 i18n 赛事名** — 在 `src/i18n/messages.ts` 每种语言对象里各加两条 key（放在合适位置，值如下）：

```
en: 'comp.fifa.world': 'World Cup',      'comp.eng1': 'Premier League',
zh: 'comp.fifa.world': '世界杯',          'comp.eng1': '英超',
ja: 'comp.fifa.world': 'ワールドカップ',   'comp.eng1': 'プレミアリーグ',
ko: 'comp.fifa.world': '월드컵',          'comp.eng1': '프리미어리그',
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/competitions.test.ts src/i18n/messages.test.ts`
Expected: PASS（含四语键对齐）

- [ ] **Step 6: 提交**

```bash
git add src/competitions.ts src/i18n/messages.ts src/competitions.test.ts
git commit -m "feat(competitions): register eng.1 (season-shape) + competition labels"
```
（提交信息末尾加两行 trailer：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 与 `Claude-Session: https://claude.ai/code/session_01XUYXGwJi76ZS8wAQi5EsJd`，前空一行。）

---

### Task 2: CompetitionSwitcher 组件

**Files:**
- Create: `src/components/CompetitionSwitcher.tsx`
- Test: `src/components/CompetitionSwitcher.test.tsx`

**Interfaces:**
- Consumes: `COMPETITIONS`（Task 1）、`useRouter`/`pathFor`/`navigate`（router）、`useT`（i18n）。
- Produces: `default` 导出 `<CompetitionSwitcher />`——读当前 `route.comp`，列出所有赛事，选中 → `navigate(pathFor({ kind:'section', comp:key, section:'matches' }))`。

- [ ] **Step 1: 写失败测试** `src/components/CompetitionSwitcher.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n';
import * as router from '../utils/router';
import CompetitionSwitcher from './CompetitionSwitcher';

describe('CompetitionSwitcher', () => {
  it('opens and lists competition labels', () => {
    render(
      <LanguageProvider>
        <CompetitionSwitcher />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('World Cup')).toBeInTheDocument();
    expect(screen.getByText('Premier League')).toBeInTheDocument();
  });

  it('navigates to the selected competition root', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockImplementation(() => {});
    render(
      <LanguageProvider>
        <CompetitionSwitcher />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Premier League'));
    expect(navSpy).toHaveBeenCalledWith('/eng.1');
    navSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/CompetitionSwitcher.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写组件** `src/components/CompetitionSwitcher.tsx`（仿 `LanguageSwitcher` 的可访问下拉）：

```tsx
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COMPETITIONS } from '../competitions';
import { useT } from '../i18n';
import { navigate, pathFor, useRouter } from '../utils/router';

export default function CompetitionSwitcher() {
  const t = useT();
  const { route } = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const comps = Object.values(COMPETITIONS);
  const current = COMPETITIONS[route.comp];

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const select = useCallback(
    (key: string) => {
      navigate(pathFor({ kind: 'section', comp: key, section: 'matches' }));
      close();
    },
    [close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
      const idx = items.indexOf(document.activeElement as HTMLElement);
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          items[(idx + 1) % items.length]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length]?.focus();
          break;
      }
    },
    [isOpen, close],
  );

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('common.changeCompetition')}
        className="flex items-center gap-1 px-2 py-1.5 rounded-pill hover:bg-overlay/10 text-chalk transition-all duration-200"
      >
        <span className="font-display font-semibold text-sm whitespace-nowrap">
          {current ? t(current.label) : ''}
        </span>
        <ChevronDown className="w-4 h-4 text-chalkdim" aria-hidden />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={t('common.changeCompetition')}
          className="absolute left-0 mt-2 min-w-[10rem] border border-line bg-panel shadow-float rounded-card overflow-hidden py-1 z-50 focus:outline-none"
          onKeyDown={handleKeyDown}
        >
          {comps.map((c) => (
            <div
              key={c.key}
              role="option"
              aria-selected={route.comp === c.key}
              tabIndex={0}
              onClick={() => select(c.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select(c.key);
                }
              }}
              className={`px-4 py-2 text-sm font-display transition-colors cursor-pointer ${
                route.comp === c.key
                  ? 'bg-overlay/10 text-chalk font-bold'
                  : 'text-chalkdim hover:text-chalk hover:bg-overlay/5'
              }`}
            >
              {t(c.label)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 加 i18n key** — 在 `src/i18n/messages.ts` 每语言加 `common.changeCompetition`：
```
en: 'Change competition'   zh: '切换赛事'   ja: '大会を変更'   ko: '대회 변경'
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/components/CompetitionSwitcher.test.tsx src/i18n/messages.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/CompetitionSwitcher.tsx src/components/CompetitionSwitcher.test.tsx src/i18n/messages.ts
git commit -m "feat: add CompetitionSwitcher dropdown"
```
（同样加 trailer 两行。）

---

### Task 3: Header — 插入切换器 + 按 capabilities 过滤 tabs

**Files:**
- Modify: `src/components/Header.tsx`
- Test: `src/components/Header.test.tsx`

**Interfaces:**
- Consumes: `CompetitionSwitcher`（Task 2）、`COMPETITIONS`（Task 1）、`useRouter().route.comp`（已有）。
- 行为：Header 顶部（logo 右侧）渲染 `<CompetitionSwitcher />`；section tabs 过滤为 `matches` 恒显、`scorers`/`bracket` 仅当对应 capability 为真。

- [ ] **Step 1: 写失败测试** — 在 `src/components/Header.test.tsx` 追加（设置当前 comp 经 `window.location`）：

```tsx
function setPath(pathname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname },
    writable: true,
    configurable: true,
  });
}

it('shows bracket and scorers tabs for the World Cup', () => {
  setPath('/fifa.world');
  render(
    <LanguageProvider>
      <Header section="matches" />
    </LanguageProvider>,
  );
  expect(screen.getByText('Bracket')).toBeInTheDocument();
  expect(screen.getByText('Scorers')).toBeInTheDocument();
});

it('hides bracket and scorers tabs for a season league (eng.1)', () => {
  setPath('/eng.1');
  render(
    <LanguageProvider>
      <Header section="matches" />
    </LanguageProvider>,
  );
  expect(screen.queryByText('Bracket')).not.toBeInTheDocument();
  expect(screen.queryByText('Scorers')).not.toBeInTheDocument();
});
```

（`Header.test.tsx` 顶部若无 `screen`/`LanguageProvider` 导入需补上：`import { render, screen } from '@testing-library/react'` 与 `import { LanguageProvider } from '../i18n'`。tab 文案 'Bracket'/'Scorers' 来自 en 默认 `fixtures.bracket`/`fixtures.scorers`；若与现有实际文案不同，用现有文案值。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/Header.test.tsx`
Expected: FAIL（eng.1 仍显示 Bracket/Scorers）

- [ ] **Step 3: 改 Header.tsx**

3a. 顶部 import 增加：
```ts
import { COMPETITIONS } from '../competitions';
import CompetitionSwitcher from './CompetitionSwitcher';
```

3b. 组件体内（已有 `const { route } = useRouter()` / `const comp = route.comp`）加能力过滤：
```ts
const caps = COMPETITIONS[comp]?.capabilities;
const visibleTabs = SECTION_TABS.filter(
  ({ section }) => section === 'matches' || (caps ? caps[section] : true),
);
```

3c. tab 渲染从 `SECTION_TABS.map(...)` 改为 `visibleTabs.map(...)`（其余不变）。

3d. 在 logo 的 `<h1>…</h1>` 之后、tabs 容器之前，插入切换器（放进 order-1 组，logo 右侧）：
```tsx
<div className="order-1 shrink-0">
  <CompetitionSwitcher />
</div>
```
（若 Header 用 flex order 布局，确保切换器 order 紧邻 logo；tabs 保持 order-3/order-2 不变。实现者按现有 order 类协调，使视觉上 logo | 切换器 | tabs | 语言。）

- [ ] **Step 4: 跑测试 + 类型检查确认通过**

Run: `npx vitest run src/components/Header.test.tsx && npm run typecheck`
Expected: PASS / 无错误

- [ ] **Step 5: 提交**

```bash
git add src/components/Header.tsx src/components/Header.test.tsx
git commit -m "feat(header): competition switcher + capability-gated section tabs"
```
（加 trailer 两行。）

---

### Task 4: StandingsView — season 单表模式

**Files:**
- Modify: `src/components/StandingsView.tsx`
- Test: `src/components/StandingsView.test.tsx`

**Interfaces:**
- Produces: `StandingsView` 新增可选 prop `mode?: 'group' | 'league'`（默认 `'group'`）。`'league'`：单张全宽表，无出线 legend、无 direct/third 高亮与色条、无「Group X」表头。`'group'`：完全保持现状。

- [ ] **Step 1: 写失败测试** — 在 `src/components/StandingsView.test.tsx` 追加（若文件不存在则创建，含下方两个用例；用一个含单组 20 队之外的小样本即可）：

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { WCGroup } from '../types';
import StandingsView from './StandingsView';

const row = (teamId: string, name: string, pts: number) => ({
  teamId, name, flag: '', mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts,
});
const league: WCGroup[] = [
  { name: 'English Premier League', standings: [row('1', 'Arsenal', 9), row('2', 'Chelsea', 6)] },
];

describe('StandingsView league mode', () => {
  it('renders teams without the qualification legend', () => {
    render(
      <LanguageProvider>
        <StandingsView groups={league} mode="league" />
      </LanguageProvider>,
    );
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    // WC-only "advance (top 2)" legend must not render in league mode
    expect(screen.queryByText('Advance (top 2)')).not.toBeInTheDocument();
  });
});
```
（`'Advance (top 2)'` 是 `standings.advanceTop2` 的 en 值；若实际文案不同，改成实际值。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/StandingsView.test.tsx`
Expected: FAIL（`mode` prop 未支持 / legend 仍渲染）

- [ ] **Step 3: 改 StandingsView.tsx**

3a. 签名加 mode：
```ts
export default function StandingsView({
  groups,
  mode = 'group',
}: {
  groups: WCGroup[];
  mode?: 'group' | 'league';
}) {
```

3b. league 模式跳过 WC 出线计算——把 `bestThirdIds` 的 useMemo 保留但仅 group 用；在 league 模式下 `qual` 恒为 `'none'`。最小改法：在每行的 `qual` 计算处改为：
```ts
const qual =
  mode === 'league'
    ? 'none'
    : i < 2
      ? 'direct'
      : i === 2 && bestThirdIds.has(s.teamId)
        ? 'third'
        : 'none';
```

3c. legend（`{/* 出线图例 */}` 那个 flex 块）只在 group 模式渲染：包一层 `{mode === 'group' && ( …legend… )}`。

3d. 卡片表头「`{t('common.group')} {g.name}`」在 league 模式改为不显示「Group」前缀——最小改法：
```tsx
<span className="font-display font-bold text-lg text-chalk">
  {mode === 'group' ? `${t('common.group')} ${g.name}` : g.name}
</span>
```

3e.（可选、若布局需要）league 模式下外层 grid 强制单列：把 `grid grid-cols-1 sm:grid-cols-2 …` 在 league 模式改为 `grid grid-cols-1 …`。最小改法：
```tsx
<div className={`grid grid-cols-1 gap-3 sm:gap-card ${mode === 'group' ? 'sm:grid-cols-2' : ''}`}>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/StandingsView.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/StandingsView.tsx src/components/StandingsView.test.tsx
git commit -m "feat(standings): add season (league) single-table mode"
```
（加 trailer 两行。）

---

### Task 5: FixturesView — season 积分榜常显 + 禁用 section 兜底

**Files:**
- Modify: `src/components/FixturesView.tsx`
- Test: `src/components/FixturesView.test.tsx`

**Interfaces:**
- Consumes: `COMPETITIONS`（Task 1）、`StandingsView` 的 `mode` prop（Task 4）、`useRouter().route.comp`（已有 `comp`）。
- 行为：
  - `shape==='season'`：积分榜作为常显区（在赛程上方）以 `mode="league"` 渲染；`shape==='tournament'`：保持现状（`stage==='group'` 时以 group 模式显示）。
  - 若 `section` 需要的能力当前赛事没有（`bracket`/`scorers`），回落渲染 matches。

- [ ] **Step 1: 写失败测试** — 在 `src/components/FixturesView.test.tsx`（若无则创建）追加：

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { WCGroup } from '../types';
import FixturesView from './FixturesView';

function setPath(p: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname: p },
    writable: true,
    configurable: true,
  });
}
const row = (teamId: string, name: string, pts: number) => ({
  teamId, name, flag: '', mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts,
});
const league: WCGroup[] = [{ name: 'Premier League', standings: [row('1', 'Arsenal', 9)] }];

it('shows the league table above fixtures for a season competition', () => {
  setPath('/eng.1');
  render(
    <LanguageProvider>
      <FixturesView section="matches" matches={[]} groups={league} scorers={[]} />
    </LanguageProvider>,
  );
  // league standings surface without needing a group-stage filter
  expect(screen.getByText('Arsenal')).toBeInTheDocument();
});

it('falls back to matches when a disabled section is requested (eng.1 bracket)', () => {
  setPath('/eng.1');
  render(
    <LanguageProvider>
      <FixturesView section="bracket" matches={[]} groups={league} scorers={[]} />
    </LanguageProvider>,
  );
  // Should NOT render the bracket TBD grid; league table is shown instead
  expect(screen.queryByText('TBD')).not.toBeInTheDocument();
  expect(screen.getByText('Arsenal')).toBeInTheDocument();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/FixturesView.test.tsx`
Expected: FAIL

- [ ] **Step 3: 改 FixturesView.tsx**

3a. 顶部 import 加：
```ts
import { COMPETITIONS } from '../competitions';
```

3b. 组件体内（已有 `const comp = route.comp`）计算形态/能力与有效 section：
```ts
const competition = COMPETITIONS[comp];
const shape = competition?.shape ?? 'tournament';
const caps = competition?.capabilities;
const effectiveSection: Section =
  (section === 'bracket' && caps && !caps.bracket) ||
  (section === 'scorers' && caps && !caps.scorers)
    ? 'matches'
    : section;
```
把后续所有 `section === 'scorers'` / `section === 'bracket'` 的分支判断改用 `effectiveSection`。

3c. 积分榜呈现：把现有「`{stage === 'group' && groups.length > 0 && (…StandingsView…)}`」块替换为按形态分支：
```tsx
{shape === 'season' && groups.length > 0 ? (
  <section className="space-y-stack">
    <h3 className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase">
      {t('fixtures.standings')}
    </h3>
    <StandingsView groups={groups} mode="league" />
  </section>
) : (
  stage === 'group' &&
  groups.length > 0 && (
    <section className="space-y-stack">
      <h3 className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase">
        {t('fixtures.standings')}
      </h3>
      <StandingsView groups={groups} mode="group" />
    </section>
  )
)}
```
（tournament 分支等价现状，仅显式传 `mode="group"`。）

- [ ] **Step 4: 跑全量测试 + 类型检查 + lint 确认通过**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 全绿、无错误

- [ ] **Step 5: 提交**

```bash
git add src/components/FixturesView.tsx src/components/FixturesView.test.tsx
git commit -m "feat(fixtures): season league table + capability section fallback"
```
（加 trailer 两行。）

---

## 手动验证（控制器在全部任务后执行）

`npm run dev` 后浏览器：
1. `/fifa.world` → 切换器显示「World Cup」，tabs 有 Bracket/Scorers；分组/淘汰赛照旧。
2. 用切换器选「Premier League」→ URL 变 `/eng.1`，tabs 只剩 Matches（无 Bracket/Scorers），积分榜显示单张英超表（无出线高亮），赛程为当前窗口。
3. 直接访问 `/eng.1/bracket` → 回落到 matches（不显示淘汰赛）。
4. 切回 World Cup 一切如旧。

## 后续（不在本计划）

- **Phase 3b**：加篮球（NBA）等非足球赛事，届时从 soccer + basketball 两个 transform 提取 `SportAdapter` 契约，并加 leaders/boxscore 视图变体。
- 联赛真实射手榜（`site.web.api` leaders 端点）——英超届时可开 `capabilities.scorers`。

## Self-Review

- **Spec 覆盖**：Task 1=§4.1+§4.8；Task 2=§4.2；Task 3=§4.3；Task 4=§4.4；Task 5=§4.5+§4.6。§4.7（不改名 useWorldCup）为非目标，无任务，符合 spec。
- **占位符扫描**：无 TBD/TODO；组件给完整代码，改动给精确 before→after，测试给完整用例。文案值处标注「若实际不同用实际值」以防 i18n 文案与假设不符。
- **类型一致性**：`shape: 'tournament' | 'season'`、`capabilities` 五字段与 Phase 1 类型一致；`StandingsView` 的 `mode?: 'group' | 'league'` 在 Task 4 定义、Task 5 调用一致；`Section` 类型沿用 router 定义；`COMPETITIONS[comp]` 访问处用 `?.` 防未知 key。
- **单一事实源**：shape/capabilities 一律读 `COMPETITIONS[comp]`（Header、FixturesView），无重复判定。
- **eng.1 season=2025**：Task 1 测试钉死 buildUrl 产出 `?season=2025`；手动验证核对实际数据（spec §7 已记风险）。
