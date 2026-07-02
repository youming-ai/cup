# 多体育 Phase 3b 实现计划（NBA + SportAdapter 契约）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加入第一个非足球赛事 NBA（`basketball/nba`，赛季制），并借此从 soccer + basketball 两个真实样本提取 `SportAdapter` 契约（配对 `transform` + 独立 `transformSummary`），三个既有赛事（世界杯、英超）行为不变。

**Architecture:** 每个运动一个适配器（`src/adapters/{soccer,basketball}.ts`）实现 `src/adapters/types.ts` 的 `SportAdapter` 契约；`useCompetition(comp)`（原 `useWorldCup`）保留 SWR/轮询/abort/缓存机器，转换体换成 `ADAPTERS[COMPETITIONS[comp].sport]`。列表外壳（`FixturesView`/`MatchCard`/`MatchDetailPage`）共享；积分表与详情 tab 按 `StandingsData.kind`/`MatchDetail.kind` 判别联合分叉——soccer 走现有组件（零改动），basketball 走新写的 `ConferenceStandings` / `BoxscoreTable` 组件。

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react（jsdom, `globals: true`, `fileParallelism: false`），自研 History API 路由，自研 i18n（4 语言），Biome，Cloudflare Worker（本 phase 零改动）。

## Global Constraints

- **Biome**（`biome.json`）：2 空格缩进、单引号、分号、尾逗号、行宽 100。`style` 规则组关闭；`*.css` 与 `worker-configuration.d.ts` 排除。
- **i18n 四语并行**：任何新 key 必须在 `en/zh/ja/ko` 四种语言里都加，`src/i18n/messages.test.ts` 强制键对齐（en 为 fallback）。
- **颜色只走 token**：调色板是 `src/index.css` `:root` 的 `--c-*` 通道值，映射到 Tailwind 语义色（`night`/`panel`/`panel2`/`line`/`chalk`/`chalkdim`/`pitch`/`live`/`amber` 等）。不硬编码 hex/`rgba()`，不用 Tailwind 命名调色板做复现性语义色；`bg-white/5` 式半透明叠层是既有的高度提升惯用法，不需要 token。
- **视觉风格**：圆角「Apple Sports」外观（rounded-*、软阴影、叠层）。不重新引入 `borderRadius: 0`。
- **typecheck 覆盖 app + worker**：`npm run typecheck` 同时跑 app tsconfig 与 `tsconfig.worker.json`。
- **测试**：与源码 colocated（`*.test.ts(x)`）；vitest `fileParallelism: false`（串行，别假设并行隔离加速）；测试用**手工内联的最小 ESPN JSON 形状**（沿 `useWorldCup.test.ts` 模式），绝不打网络。
- **单一事实源**：运动/形态/能力一律读 `COMPETITIONS[comp]`，不在多处各判 shape/sport。
- **迁移纪律（spec §6 硬指标）**：迁移提交**只搬不改**（测试跟着一起搬，断言语义不变）；行为改动一律**独立提交**。`useWorldCup.test`（~320 行）在迁移全程保持绿是硬指标。
- **spec §4.1 契约名绑定**：`SportAdapter.transform(scoreboardJson, standingsJson)` 配对签名、`StandingsData`/`MatchDetail` 判别联合、`ConferenceTable`/`BoxscoreTable` 形状用 spec 里的**确切名字**，不得自造别名。
- **spec §2 非目标（不做）**：NBA leaders 榜、NBA 季后赛 bracket、NBA 的 Team/Player 页、通用列描述符渲染器；basketball 积分榜行**不可点击**。

---

### Task 1: `seasonForDate(sport, d)` + nba 注册表条目 + i18n `comp.nba`

**Files:**
- Modify: `src/competitions.ts`
- Modify: `src/i18n/messages.ts`
- Test: `src/competitions.test.ts`

**Interfaces:**
- Consumes: 现有 `Competition`/`Sport`/`buildUrl`/`COMPETITIONS`（`src/competitions.ts`）。
- Produces:
  - `seasonForDate(sport: Sport, d: Date): number`（签名从单参 `(d)` 改为双参）。
  - `COMPETITIONS['nba']`（`sport:'basketball'`, `league:'nba'`, `shape:'season'`, `capabilities.boxscore=true`, 其余 false, `season` 省略）。
  - i18n key `comp.nba`（四语）。

- [ ] **Step 1: 写失败测试** — 用你的编辑器把 `src/competitions.test.ts` 的 `seasonForDate` describe 块**整体替换**为下面的版本（现有块只测单参 soccer 语义，新块加 sport 参数与 basketball 边界），并在文件末尾追加 `nba` describe 块。

先替换现有 `describe('seasonForDate', …)`（当前在文件末尾，第 58–64 行）为：

```ts
describe('seasonForDate', () => {
  it('soccer rolls over in August (ESPN keys cross-year seasons by starting year)', () => {
    expect(seasonForDate('soccer', new Date(2026, 7, 1))).toBe(2026); // Aug 1 → new season
    expect(seasonForDate('soccer', new Date(2026, 6, 31))).toBe(2025); // Jul 31 → still 2025-26
    expect(seasonForDate('soccer', new Date(2027, 0, 15))).toBe(2026); // mid-season January
  });

  it('basketball rolls over in October and keys by the ENDING year', () => {
    expect(seasonForDate('basketball', new Date(2026, 9, 1))).toBe(2027); // Oct 1 2026 → 2026-27 → 2027
    expect(seasonForDate('basketball', new Date(2026, 8, 30))).toBe(2026); // Sep 30 → off-season → just-ended 2025-26 → 2026
    expect(seasonForDate('basketball', new Date(2027, 0, 15))).toBe(2027); // mid-season January → 2027
    expect(seasonForDate('basketball', new Date(2027, 5, 20))).toBe(2027); // June (finals) → 2027
  });
});
```

再改现有 `eng.1` describe 块里的 buildUrl 断言（第 49–51 行），把裸 `seasonForDate(new Date())` 改为带 sport 参数（否则 Step 3 改签名后编译失败）：

```ts
    expect(buildUrl(pl, 'standings')).toBe(
      `https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=${seasonForDate('soccer', new Date())}`,
    );
```

最后在文件末尾追加 nba describe 块：

```ts
describe('nba (season-shape basketball)', () => {
  const nba = COMPETITIONS.nba;

  it('is registered as a season-shape basketball league', () => {
    expect(nba).toBeDefined();
    expect(nba.sport).toBe('basketball');
    expect(nba.shape).toBe('season');
    expect(nba.league).toBe('nba');
    expect(nba.label).toBe('comp.nba');
  });

  it('exposes only the boxscore capability', () => {
    expect(nba.capabilities).toEqual({
      bracket: false,
      scorers: false,
      leaders: false,
      lineups: false,
      boxscore: true,
    });
  });

  it('builds NBA URLs: basketball path, derived season, no level, no dates', () => {
    expect(buildUrl(nba, 'standings')).toBe(
      `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${seasonForDate('basketball', new Date())}`,
    );
    expect(buildUrl(nba, 'scoreboard')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=300',
    );
    expect(buildUrl(nba, 'summary', '401585')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401585',
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/competitions.test.ts`
Expected: FAIL —— `seasonForDate('soccer', …)` 传了 2 个参数但当前签名只收 1 个（TS/运行时红），且 `COMPETITIONS.nba` 为 `undefined`。

- [ ] **Step 3: 改 `seasonForDate` 签名 + 加 nba 条目** — 在 `src/competitions.ts`：

3a. 把 `seasonForDate`（当前第 62–67 行）整体替换为：

```ts
// ESPN keys a cross-year season by different endpoints per sport:
// - Soccer (European clubs): by STARTING year, rolls over in August
//   (Jan–Jul still belongs to the season that kicked off the previous year).
// - Basketball (NBA): by ENDING year, rolls over in October
//   (2025-26 season = 2026). Jul–Sep is off-season → the just-ended season's
//   ending year (still the current calendar year).
export function seasonForDate(sport: Sport, d: Date): number {
  if (sport === 'basketball') {
    // Oct–Dec → next calendar year is the ending year; Jan–Sep → current year.
    return d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  }
  // soccer (and any other cross-year league defaulting to soccer semantics)
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}
```

3b. 更新 `buildUrl` 里对 `seasonForDate` 的唯一调用（当前第 74 行），把 `seasonForDate(new Date())` 改为传 `c.sport`：

```ts
    const q = new URLSearchParams({ season: String(c.season ?? seasonForDate(c.sport, new Date())) });
```

3c. 在 `COMPETITIONS` 里 `'eng.1'` 条目之后（第 55 行的 `},` 之后）加 `nba` 条目：

```ts
  nba: {
    key: 'nba',
    sport: 'basketball',
    league: 'nba',
    label: 'comp.nba',
    // season 省略 → buildUrl 用 seasonForDate('basketball', …) 按请求时刻推导
    // （赛季制 10 月翻转，键为结束年）。scoreboard 无 dates → ESPN 返回当日窗口，
    // off-season（7–9 月）当日为空由现有空态处理。见 spec §3。
    shape: 'season',
    capabilities: {
      bracket: false,
      scorers: false,
      leaders: false,
      lineups: false,
      boxscore: true,
    },
  },
```

- [ ] **Step 4: 加 i18n `comp.nba`（四语）** — 在 `src/i18n/messages.ts` 每种语言对象里，紧跟现有 `'comp.eng1'` 那行之后各加一条：

```
en: 'comp.nba': 'NBA',
zh: 'comp.nba': 'NBA',
ja: 'comp.nba': 'NBA',
ko: 'comp.nba': 'NBA',
```

（NBA 是全球通用缩写，四语同值；仍必须四语都加，否则 `messages.test.ts` 键对齐失败。）

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/competitions.test.ts src/i18n/messages.test.ts`
Expected: PASS（含四语键对齐、nba buildUrl / seasonForDate 边界全绿）。

- [ ] **Step 6: typecheck 确认 worker 也编译**

Run: `npm run typecheck`
Expected: 无错误（`competitions.ts` 被 worker tsconfig 编译，`seasonForDate` 签名改动不影响 worker 侧——worker 走 `buildUrl` 内部调用）。

- [ ] **Step 7: 提交**

```bash
git add src/competitions.ts src/i18n/messages.ts src/competitions.test.ts
git commit -m "$(cat <<'EOF'
feat(competitions): sport-aware seasonForDate + register nba

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ChocVWiknZXDoEx8ZcZHe3
EOF
)"
```

---

### Task 2: 机械更名 `WCMatch` → `CompMatch`（+ stage/group 可选 + statusText 字段）

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useWorldCup.ts`
- Modify: `src/hooks/useBracket.ts`
- Modify: `src/utils/streamMatch.ts`
- Modify: `src/components/MatchCard.tsx`
- Modify: `src/components/FixturesView.tsx`
- Modify: `src/components/BracketView.tsx`
- Modify: `src/components/TeamPage.tsx`
- Modify: `src/components/PlayerPage.tsx`
- Modify: `src/components/MatchDetailPage.tsx`
- Modify: `src/components/Player.tsx`（仅注释里的 `WCMatch` 字样，可选但一致性起见改掉）
- Modify: `src/data/bracketSeeding.ts`（仅注释）
- Test: `src/utils/streamMatch.test.ts`, `src/components/FixturesView.test.tsx`, `src/components/MatchDetailPage.test.tsx`, `src/components/TeamPage.test.tsx`, `src/components/PlayerPage.test.tsx`, `src/hooks/useBracket.test.ts`, `src/components/BracketView.test.tsx`, `src/hooks/useWorldCup.test.ts`

**Interfaces:**
- Produces: `CompMatch`（原 `WCMatch`，全字段保留，外加两处松绑与一个新字段）。**这是后续所有任务引用的确切形状**：

```ts
export interface CompMatch {
  id: string;
  homeName: string;
  awayName: string;
  homeFlag: string;
  awayFlag: string;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  group?: string;              // was required; NBA 不提供 → 可选
  kickoff: Date | null;
  status: MatchStatus;
  stage?: Stage;               // was required; NBA 不提供 → 可选
  homeScorers: ScorerEntry[];
  awayScorers: ScorerEntry[];
  venue: string;
  slug: string;
  // NBA 用 ESPN status.type.shortDetail（"Final" / "Q4 2:14" / "OT"）；
  // soccer 不设，走既有 progress/finishType 逻辑。UI 有它优先显示，不自造节次文案。
  statusText?: string;
  progress?: MatchProgress;
  winner?: 'home' | 'away';
  finishType?: 'aet' | 'pens';
  homeShootoutScore?: number;
  awayShootoutScore?: number;
}
```

> 纪律：本任务是**纯机械更名 + 松绑 + 加字段**，不改任何行为。TS 全量兜底：改完 `npm run typecheck` 必须绿，`npx vitest run` 必须绿（无断言改动）。

- [ ] **Step 1: 先跑一次全量测试确立绿基线**

Run: `npx vitest run && npm run typecheck`
Expected: 全绿（这是更名前的基线；更名后必须仍全绿）。

- [ ] **Step 2: 改类型定义** — 在 `src/types/index.ts`，把 `WCMatch` interface（第 54–92 行）整体替换为上面 Interfaces 里的 `CompMatch` 定义（改名 + `group?`/`stage?` 加 `?` + 新增 `statusText?`）。同时把该 interface 上方注释的首行 `export interface WCMatch {` 前的文档注释保留，仅将块内引用 `WCMatch` 的文字（无）不需要改。`WCStanding`/`WCGroup`/`TopScorer`/`MatchDetail` 等其它类型**保持原名不动**（它们仍是 soccer 领域类型）。

- [ ] **Step 3: 全仓库替换标识符 `WCMatch` → `CompMatch`** — 只替换标识符（类型名），不碰其它内容。用 `sed` 在下列文件里做整词替换（`\b` 词边界防止误伤，实际这些文件里 `WCMatch` 均为独立标识符或注释词）：

```bash
grep -rl 'WCMatch' src | while read f; do
  sed -i '' 's/\bWCMatch\b/CompMatch/g' "$f"
done
```

（`src/types/index.ts` 已在 Step 2 手改，`sed` 再跑对它是幂等的——已无 `WCMatch` 残留。）替换覆盖：`useWorldCup.ts`、`useBracket.ts`、`streamMatch.ts`、`MatchCard.tsx`(仅无——它用 `string` prop，但导入注释可能有)、`FixturesView.tsx`、`BracketView.tsx`、`TeamPage.tsx`、`PlayerPage.tsx`、`MatchDetailPage.tsx`、`Player.tsx`、`bracketSeeding.ts`、以及所有对应 `*.test.ts(x)` 与 `useWorldCup.test.ts`。

- [ ] **Step 4: 修 stage/group 变可选后的编译点** — 松绑后有两处消费端会因 `Stage | undefined` / `string | undefined` 类型收窄失败，逐点处理（这是 spec §6「StandingsData 消费端 tsc 逐点暴露」的同类）：

4a. `src/components/FixturesView.tsx` —— `stages` 的 `useMemo`（原第 62–65 行）里 `matches.map((m) => m.stage)` 现在产 `(Stage | undefined)[]`，塞进 `new Set<Stage>` 报错。改为过滤掉 undefined：

```ts
  const stages: (Stage | 'all')[] = useMemo(() => {
    const present = new Set<Stage>(
      matches.map((m) => m.stage).filter((s): s is Stage => s !== undefined),
    );
    return ['all', ...KNOWN_STAGES.filter((s) => present.has(s))] as (Stage | 'all')[];
  }, [matches]);
```

4b. `src/components/MatchCard.tsx` —— prop `stage: string`（第 16 行）与调用点 `stageLabel`（第 133 行）。MatchCard 的 prop 类型是 `string`（非 `Stage`），而 `CompMatch.stage` 现在是 `Stage | undefined`，所以调用点（FixturesView/TeamPage 里 `stage={m.stage}`）会因 `undefined` 不能赋给 `string` 报错。把 MatchCard 的 `stage`/`group` prop 改为可选并在读取处兜底：

- prop 声明（第 16–17 行）改为：

```ts
  stage?: string;
  group?: string;
```

- `stageLabel` 计算（第 133 行）改为空值安全（无 stage → 空串，不渲染 chip；这正是 spec §4.3「无 group/stage 时不渲染对应 chip」）：

```ts
  const stageLabel = !stage ? '' : stage === 'group' ? `${t('common.group')} ${group ?? ''}` : t(`stage.${stage}`);
```

- 顶部信息条里渲染 `stageLabel` 的 `<span>`（第 174–176 行）包一层条件，空串不渲染：

```tsx
            {stageLabel && (
              <span className="ds-caption uppercase tracking-[0.18em] text-chalkdim truncate">
                {stageLabel}
              </span>
            )}
```

4c. `src/hooks/useBracket.ts` —— `m.stage !== 'r32'`（第 119 行）与 `m.stage !== stage`（第 144 行）在 `stage` 可选后仍类型安全（`undefined !== 'r32'` 为 true，行为不变：非 r32 continue）。无需改。

4d. `src/components/MatchDetailPage.tsx` —— hero 里 `match.stage === 'group' ? … : t(`stage.${match.stage}`)`（第 126–129 行）。`match.stage` 可能是 `undefined`，`t(`stage.undefined`)` 会返回 key 本身。这是行为改动风险，但**本任务只搬不改**——soccer 比赛始终有 stage，此路径对 soccer 不变；NBA 详情 tab 在 Task 6 才接入，届时会走 basketball 分支不进此代码。此处**保持原样**，靠 Task 6 分叉时处理。仅确保类型编译：`t(`stage.${match.stage}`)` 里 `match.stage` 为 `undefined` 时模板串变 `stage.undefined`（string），编译通过。无需改。

- [ ] **Step 5: 跑全量测试 + typecheck 确认更名后仍全绿**

Run: `npx vitest run && npm run typecheck`
Expected: 全绿。测试文件里的 `WCMatch` 已被 sed 改名为 `CompMatch`，断言语义未变；`stage?`/`group?` 松绑不影响任何现有断言（现有测试的 match 工厂都显式给了 `stage`/`group`）。

- [ ] **Step 6: lint**

Run: `npm run lint`
Expected: 无错误（若 Biome 报未用导入或格式，运行 `npm run format` 后再跑 lint）。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(types): rename WCMatch to CompMatch, loosen stage/group, add statusText

Pure mechanical rename + optional stage/group (NBA has neither) + optional
statusText field. No behavior change; all tests/typecheck stay green.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ChocVWiknZXDoEx8ZcZHe3
EOF
)"
```

---

### Task 3: 定义 `SportAdapter` 契约 + 抽取 soccer 适配器（迁移 useWorldCup 转换 + parseSummary）

**Files:**
- Create: `src/adapters/types.ts`
- Create: `src/adapters/soccer.ts`
- Create: `src/adapters/soccer.test.ts`
- Create: `src/adapters/index.ts`
- Modify: `src/hooks/useWorldCup.ts` → 重命名文件为 `src/hooks/useCompetition.ts`（`git mv`），转换体换成 `adapter.transform`
- Modify: `src/hooks/useWorldCup.test.ts` → 重命名为 `src/hooks/useCompetition.test.ts`（`git mv`）
- Modify: `src/utils/espn.ts`（`parseSummary` 迁出到 soccer 适配器；`layoutStarters` 留在 `espn.ts`）
- Modify: `src/utils/espn.test.ts`（`parseSummary` 相关用例迁到 `soccer.test.ts`；`layoutStarters` 用例留下）
- Modify: `src/hooks/useMatchDetail.ts`（改用 `adapter.transformSummary`）
- Modify: `src/App.tsx`（`useWorldCup` → `useCompetition`；`wc.groups` → `wc.standings.kind === 'soccer' ? wc.standings.groups : []`）
- Modify: `src/components/MatchDetailPage.tsx`（`MatchDetail` 变判别联合后，读字段前先按 `detail.kind === 'soccer'` 收窄）
- Test: `src/hooks/useMatchDetail.test.ts`（更新导入路径断言不变）, `src/components/MatchDetailPage.test.tsx`（summary JSON 需带 soccer 形状——已带；断言不变）

**Interfaces:**
- Consumes: `CompMatch`（Task 2）、`WCGroup`/`WCStanding`/`TopScorer`/`TeamStatRow`/`PlayEvent`/`TeamLineup`/`LineupPlayer`（`src/types`）、`COMPETITIONS`/`Sport`（Task 1）、`src/utils/wc.ts` 里的纯函数（`matchSlug`/`parseScore`/`progressFromStatus`/`sortStandings`/`stageFromSlug`/`statusFromState`）。
- Produces（spec §4.1 契约，绑定命名）：

```ts
// src/adapters/types.ts —— 契约唯一定义点
import type {
  CompMatch,
  LineupPlayer,
  PlayEvent,
  TeamLineup,
  TeamStatRow,
  TopScorer,
  WCGroup,
} from '../types';

export interface ConferenceTable {
  name: string; // 'Eastern Conference' | 'Western Conference'
  rows: {
    teamId: string;
    name: string;
    logo: string;
    w: number;
    l: number;
    pct: string;
    gb: string;
  }[];
}

export type StandingsData =
  | { kind: 'soccer'; groups: WCGroup[] }
  | { kind: 'basketball'; conferences: ConferenceTable[] };

export interface BoxscoreTable {
  teamId: string;
  teamName: string;
  labels: string[]; // ESPN 原样：MIN PTS FG 3PT FT REB AST TO …
  players: { name: string; starter: boolean; dnp: boolean; stats: string[] }[];
}

export type MatchDetail =
  | {
      kind: 'soccer';
      homeId: string;
      awayId: string;
      stats: TeamStatRow[];
      allPlays: PlayEvent[];
      keyPlays: PlayEvent[];
      lineups: TeamLineup[];
      venue: string;
      attendance: number | null;
    }
  | {
      kind: 'basketball';
      homeId: string;
      awayId: string;
      teamStats: TeamStatRow[];
      playerTables: BoxscoreTable[];
      venue: string;
      attendance: number | null;
    };

export interface SportAdapter {
  transform(
    scoreboardJson: unknown,
    standingsJson: unknown,
  ): { matches: CompMatch[]; standings: StandingsData; scorers: TopScorer[] };
  transformSummary(json: unknown): MatchDetail;
}

// re-export LineupPlayer so soccer.ts can import from one place if desired
export type { LineupPlayer };
```

> 关键：`MatchDetail` 从 `src/types/index.ts` **迁到 `src/adapters/types.ts`** 并变为判别联合。`src/types/index.ts` 里删除旧的 `MatchDetail` interface（其字段被 soccer variant 吸收）。`useMatchDetail`/`MatchDetailPage` 改从 `../adapters/types` 导入 `MatchDetail`。

- [ ] **Step 1: 创建契约文件 `src/adapters/types.ts`** — 内容即上面 Interfaces 里的完整代码块（从 `import type` 到 `export type { LineupPlayer };`）。

- [ ] **Step 2: 从 `src/types/index.ts` 删除旧 `MatchDetail`** — 删掉当前第 145–154 行的整个 `export interface MatchDetail { … }`（其字段已迁入 `adapters/types.ts` 的 soccer variant）。`TeamStatRow`/`PlayEvent`/`LineupPlayer`/`TeamLineup` 保留在 `types/index.ts`（被适配器与 tab 组件共用）。

- [ ] **Step 3: 写 soccer 适配器测试（迁移 useWorldCup.test 的转换断言 + parseSummary 的断言）** —— 新建 `src/adapters/soccer.test.ts`。这是**搬家**：把 `useWorldCup.test.ts` 里纯转换的断言（normalizes / pens / aet 三个用例）改写为直接调 `soccerAdapter.transform(sbJson, stJson)`（去掉 renderHook/fetch/abort 那套 hook 机器——那些留在 `useCompetition.test.ts`），并把 `espn.test.ts` 的 `parseSummary` 用例改写为调 `soccerAdapter.transformSummary`（断言值不变，只是结果多了 `kind:'soccer'`）。完整内容：

```ts
import { describe, expect, it } from 'vitest';
import { soccerAdapter } from './soccer';

// --- minimal ESPN scoreboard + standings shapes (lifted from useWorldCup.test) ---
const scoreboard = {
  events: [
    {
      id: '760420',
      date: '2026-06-13T19:00Z',
      season: { slug: 'group-stage' },
      competitions: [
        {
          status: { type: { state: 'post' } },
          venue: { fullName: "Levi's Stadium", address: { city: 'Santa Clara, California' } },
          competitors: [
            { homeAway: 'home', score: '2', team: { id: '1', displayName: 'Mexico', logo: 'mex.png' } },
            { homeAway: 'away', score: '0', team: { id: '2', displayName: 'South Africa', logo: 'rsa.png' } },
          ],
          details: [
            {
              scoringPlay: true,
              clock: { displayValue: "22'" },
              type: { text: 'Goal' },
              team: { id: '1' },
              athletesInvolved: [{ id: '4577', displayName: 'H. Lozano' }],
            },
            {
              scoringPlay: true,
              clock: { displayValue: "80'" },
              type: { text: 'Penalty - Scored' },
              team: { id: '1' },
              athletesInvolved: [{ id: '4579', displayName: 'R. Jiménez' }],
            },
            { scoringPlay: false, type: { text: 'Yellow Card' }, team: { id: '2' } },
          ],
        },
      ],
    },
    {
      id: '760900',
      date: '2026-07-04T16:00Z',
      season: { slug: 'round-of-16' },
      competitions: [
        {
          status: { type: { state: 'pre' } },
          venue: { fullName: 'MetLife Stadium', address: { city: 'East Rutherford' } },
          competitors: [
            { homeAway: 'home', score: '0', team: { id: '9', displayName: 'Brazil', logos: [{ href: 'bra.png' }] } },
            { homeAway: 'away', score: '0', team: { id: '12', displayName: 'Scotland', logos: [{ href: 'sco.png' }] } },
          ],
          details: [],
        },
      ],
    },
  ],
};

const standings = {
  children: [
    {
      name: 'Group A',
      standings: {
        entries: [
          {
            team: { id: '1', displayName: 'Mexico', logos: [{ href: 'mex.png' }] },
            stats: [
              { name: 'gamesPlayed', value: 1 },
              { name: 'wins', value: 1 },
              { name: 'ties', value: 0 },
              { name: 'losses', value: 0 },
              { name: 'pointsFor', value: 2 },
              { name: 'pointsAgainst', value: 0 },
              { name: 'pointDifferential', value: 2 },
              { name: 'points', value: 3 },
            ],
          },
          {
            team: { id: '2', displayName: 'South Africa', logos: [{ href: 'rsa.png' }] },
            stats: [
              { name: 'gamesPlayed', value: 1 },
              { name: 'wins', value: 0 },
              { name: 'ties', value: 0 },
              { name: 'losses', value: 1 },
              { name: 'pointsFor', value: 0 },
              { name: 'pointsAgainst', value: 2 },
              { name: 'pointDifferential', value: -2 },
              { name: 'points', value: 0 },
            ],
          },
        ],
      },
    },
  ],
};

describe('soccerAdapter.transform', () => {
  it('normalizes ESPN scoreboard + standings into matches/standings/scorers', () => {
    const { matches, standings: sd, scorers } = soccerAdapter.transform(scoreboard, standings);
    expect(matches).toHaveLength(2);

    const finished = matches[0];
    expect(finished.status).toBe('finished');
    expect(finished.homeScore).toBe(2);
    expect(finished.homeFlag).toBe('mex.png');
    expect(finished.stage).toBe('group');
    expect(finished.group).toBe('A');
    expect(finished.homeScorers).toEqual([
      { playerId: '4577', name: 'H. Lozano', minute: "22'", tag: '' },
      { playerId: '4579', name: 'R. Jiménez', minute: "80'", tag: ' (p)' },
    ]);
    expect(finished.awayScorers).toEqual([]);
    expect(finished.venue).toBe("Levi's Stadium · Santa Clara, California");
    expect(finished.kickoff?.toISOString()).toBe('2026-06-13T19:00:00.000Z');

    const upcoming = matches[1];
    expect(upcoming.status).toBe('upcoming');
    expect(upcoming.homeScore).toBeNull();
    expect(upcoming.stage).toBe('r16');
    expect(upcoming.homeFlag).toBe('bra.png');

    expect(sd.kind).toBe('soccer');
    if (sd.kind !== 'soccer') throw new Error('expected soccer');
    const groupA = sd.groups[0];
    expect(groupA.name).toBe('A');
    expect(groupA.standings[0].name).toBe('Mexico');
    expect(groupA.standings[0].pts).toBe(3);
    expect(groupA.standings[0].gd).toBe(2);

    expect(scorers).toEqual([]); // no leaders[] in this fixture
  });

  it('captures penalty-shootout score and finishType for a pens match', () => {
    const pens = {
      events: [
        {
          id: '760489',
          date: '2026-07-05T16:00Z',
          season: { slug: 'round-of-16' },
          competitions: [
            {
              status: { period: 5, displayClock: "120'", type: { state: 'post', name: 'STATUS_FINAL_PEN' } },
              venue: { fullName: 'X', address: { city: 'Y' } },
              competitors: [
                { homeAway: 'home', score: '1', winner: false, shootoutScore: 3, team: { id: '1', displayName: 'Germany', logo: 'ger.png' } },
                { homeAway: 'away', score: '1', winner: true, shootoutScore: 4, team: { id: '2', displayName: 'Paraguay', logo: 'par.png' } },
              ],
              details: [],
            },
          ],
        },
      ],
    };
    const { matches } = soccerAdapter.transform(pens, {});
    const m = matches[0];
    expect(m.finishType).toBe('pens');
    expect(m.homeShootoutScore).toBe(3);
    expect(m.awayShootoutScore).toBe(4);
    expect(m.winner).toBe('away');
  });

  it('marks an extra-time decider as aet with no shootout score', () => {
    const aet = {
      events: [
        {
          id: '760490',
          date: '2026-07-05T20:00Z',
          season: { slug: 'quarterfinals' },
          competitions: [
            {
              status: { period: 4, displayClock: "120'", type: { state: 'post', name: 'STATUS_FINAL_AET' } },
              venue: { fullName: 'X', address: { city: 'Y' } },
              competitors: [
                { homeAway: 'home', score: '2', winner: true, team: { id: '1', displayName: 'Spain', logo: 's.png' } },
                { homeAway: 'away', score: '1', winner: false, team: { id: '2', displayName: 'Italy', logo: 'i.png' } },
              ],
              details: [],
            },
          ],
        },
      ],
    };
    const { matches } = soccerAdapter.transform(aet, {});
    const m = matches[0];
    expect(m.finishType).toBe('aet');
    expect(m.homeShootoutScore).toBeUndefined();
    expect(m.awayShootoutScore).toBeUndefined();
  });

  it('tolerates empty payloads without throwing', () => {
    const { matches, standings: sd, scorers } = soccerAdapter.transform({}, {});
    expect(matches).toEqual([]);
    expect(sd).toEqual({ kind: 'soccer', groups: [] });
    expect(scorers).toEqual([]);
  });
});

// --- transformSummary (lifted from espn.test.ts parseSummary cases) ---
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
      { team: { id: '203' }, statistics: [{ label: 'Possession', displayValue: '54%' }, { label: 'Shots', displayValue: '21' }] },
      { team: { id: '467' }, statistics: [{ label: 'Possession', displayValue: '46%' }, { label: 'Shots', displayValue: '14' }] },
    ],
  },
  commentary: [
    { time: { displayValue: '' }, text: 'First Half begins.' },
    { time: { displayValue: "3'" }, text: 'Foul by Aubrey Modiba.' },
  ],
  keyEvents: [
    { clock: { displayValue: "9'" }, type: { text: 'Goal' }, team: { id: '203' }, text: 'Goal! Mexico 1, South Africa 0.' },
  ],
  rosters: [
    {
      team: { id: '203', displayName: 'Mexico' },
      formation: '4-1-4-1',
      roster: [
        { starter: true, jersey: '1', position: { abbreviation: 'G' }, athlete: { displayName: 'Raúl Rangel' }, plays: [] },
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
    { team: { id: '467', displayName: 'South Africa' }, formation: '4-3-3', roster: [] },
  ],
  gameInfo: { venue: { fullName: 'Estadio Banorte', address: { city: 'Mexico City' } }, attendance: 80824 },
};

describe('soccerAdapter.transformSummary', () => {
  const d = soccerAdapter.transformSummary(summary);

  it('tags the detail as soccer', () => {
    expect(d.kind).toBe('soccer');
  });

  it('pairs team stats by label (home/away from competitor sides)', () => {
    if (d.kind !== 'soccer') throw new Error('expected soccer');
    expect(d.homeId).toBe('203');
    expect(d.awayId).toBe('467');
    expect(d.stats).toEqual([
      { label: 'Possession', home: '54%', away: '46%' },
      { label: 'Shots', home: '21', away: '14' },
    ]);
  });

  it('reads commentary as allPlays and keyEvents as keyPlays', () => {
    if (d.kind !== 'soccer') throw new Error('expected soccer');
    expect(d.allPlays).toHaveLength(2);
    expect(d.allPlays[1]).toEqual({ clock: "3'", text: 'Foul by Aubrey Modiba.', teamId: null, type: '' });
    expect(d.keyPlays[0]).toEqual({ clock: "9'", text: 'Goal! Mexico 1, South Africa 0.', teamId: '203', type: 'Goal' });
  });

  it('parses lineups with sub minute and card from player.plays', () => {
    if (d.kind !== 'soccer') throw new Error('expected soccer');
    const mex = d.lineups[0];
    expect(mex.formation).toBe('4-1-4-1');
    expect(mex.players[0]).toMatchObject({ jersey: '1', name: 'Raúl Rangel', pos: 'G', starter: true });
    expect(mex.players[1]).toMatchObject({ subbedOutAt: "76'", card: 'yellow' });
  });

  it('reads venue and attendance', () => {
    if (d.kind !== 'soccer') throw new Error('expected soccer');
    expect(d.venue).toBe('Estadio Banorte · Mexico City');
    expect(d.attendance).toBe(80824);
  });

  it('tolerates an empty object without throwing', () => {
    const empty = soccerAdapter.transformSummary({});
    if (empty.kind !== 'soccer') throw new Error('expected soccer');
    expect(empty.stats).toEqual([]);
    expect(empty.lineups).toEqual([]);
    expect(empty.attendance).toBeNull();
  });

  it('orders lineups [home, away] even when rosters arrive away-first', () => {
    const awayFirst = { ...summary, rosters: [...summary.rosters].reverse() };
    const parsed = soccerAdapter.transformSummary(awayFirst);
    if (parsed.kind !== 'soccer') throw new Error('expected soccer');
    expect(parsed.lineups[0].teamId).toBe(parsed.homeId);
    expect(parsed.lineups[1].teamId).toBe(parsed.awayId);
  });

  it('drops keyEvents without text (admin entries)', () => {
    const withAdmin = {
      ...summary,
      keyEvents: [
        { clock: { displayValue: "0'" }, type: { text: 'Kickoff' }, team: { id: '203' }, text: '' },
        { clock: { displayValue: "9'" }, type: { text: 'Goal' }, team: { id: '203' }, text: 'Goal!' },
      ],
    };
    const parsed = soccerAdapter.transformSummary(withAdmin);
    if (parsed.kind !== 'soccer') throw new Error('expected soccer');
    expect(parsed.keyPlays).toHaveLength(1);
    expect(parsed.keyPlays[0].text).toBe('Goal!');
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

Run: `npx vitest run src/adapters/soccer.test.ts`
Expected: FAIL —— `./soccer` 模块不存在。

- [ ] **Step 5: 写 soccer 适配器 `src/adapters/soccer.ts`** —— **纯搬家**：`transform` 的函数体是 `useWorldCup.ts` 里 `fetchAll` 内从 `// --- standings → groups` 到构造 `sc`（top scorers）为止的转换逻辑，去掉 fetch/abort/setState/cache，改成接收 `(scoreboardJson, standingsJson)` 两参、返回 `{ matches, standings, scorers }`；`transformSummary` 的函数体是 `espn.ts` 里 `parseSummary` 的逻辑，末尾返回对象加 `kind: 'soccer'`。防御性 `obj/arr/str/stat/teamLogo` 辅助搬进本文件。完整代码：

```ts
import type {
  CompMatch,
  LineupPlayer,
  PlayEvent,
  ScorerEntry,
  TeamLineup,
  TeamStatRow,
  TopScorer,
  WCGroup,
  WCStanding,
} from '../types';
import {
  matchSlug,
  parseScore,
  progressFromStatus,
  sortStandings,
  stageFromSlug,
  statusFromState,
} from '../utils/wc';
import type { MatchDetail, SportAdapter, StandingsData } from './types';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: unknown): Record<string, unknown> {
  return isPlainObject(v) ? v : {};
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ESPN standings stats are [{name, value}]; pull one by name.
function stat(entry: Record<string, unknown>, name: string): number {
  const s = arr(entry.stats).find((x) => obj(x).name === name);
  return s ? Number(obj(s).value) || 0 : 0;
}

// A competitor/team's crest URL: scoreboard uses `team.logo` (string),
// standings uses `team.logos: [{href}]`.
function teamLogo(team: Record<string, unknown>): string {
  if (str(team.logo)) return str(team.logo);
  const logos = arr(team.logos);
  return logos.length ? str(obj(logos[0]).href) : '';
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

function transform(
  scoreboardJson: unknown,
  standingsJson: unknown,
): { matches: CompMatch[]; standings: StandingsData; scorers: TopScorer[] } {
  const sbJson = scoreboardJson;
  const stJson = standingsJson;

  // --- standings → groups (+ a teamId → group-letter map for the matches) ---
  const teamGroup = new Map<string, string>();
  const gr: WCGroup[] = arr(obj(stJson).children)
    .map((raw): WCGroup => {
      const g = obj(raw);
      const letter = str(g.name).replace(/^Group\s+/i, '') || str(g.abbreviation);
      const entries = arr(obj(g.standings).entries);
      const standings = entries.map((rawEntry): WCStanding => {
        const e = obj(rawEntry);
        const team = obj(e.team);
        const id = str(team.id);
        if (id) teamGroup.set(id, letter);
        return {
          teamId: id,
          name: str(team.displayName),
          flag: teamLogo(team),
          mp: stat(e, 'gamesPlayed'),
          w: stat(e, 'wins'),
          d: stat(e, 'ties'),
          l: stat(e, 'losses'),
          gf: stat(e, 'pointsFor'),
          ga: stat(e, 'pointsAgainst'),
          gd: stat(e, 'pointDifferential'),
          pts: stat(e, 'points'),
        };
      });
      return { name: letter, standings: sortStandings(standings) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- scoreboard → matches ---
  const teamForm = new Map<string, string>();
  const ms: CompMatch[] = arr(obj(sbJson).events).map((rawEvent): CompMatch => {
    const ev = obj(rawEvent);
    const comp = obj(arr(ev.competitions)[0]);
    const competitors = arr(comp.competitors).map(obj);
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
    const homeTeam = obj(home.team);
    const awayTeam = obj(away.team);
    const statusObj = obj(comp.status);
    const status = statusFromState(str(obj(statusObj.type).state));

    for (const rawC of competitors) {
      const c = obj(rawC);
      const tid = str(obj(c.team).id);
      const form = str(c.form);
      if (tid && form && !teamForm.has(tid)) teamForm.set(tid, form);
    }

    const homeId = str(homeTeam.id);
    const homeScorers: ScorerEntry[] = [];
    const awayScorers: ScorerEntry[] = [];
    for (const rawDetail of arr(comp.details)) {
      const d = obj(rawDetail);
      if (!d.scoringPlay) continue;
      const athlete = obj(arr(d.athletesInvolved)[0]);
      const id = str(athlete.id);
      const name = str(athlete.displayName) || str(athlete.shortName);
      if (!id || !name) continue;
      const typeText = str(obj(d.type).text);
      const minute = str(obj(d.clock).displayValue);
      const tag = typeText.toLowerCase().includes('own')
        ? ' (OG)'
        : typeText.toLowerCase().includes('penalty')
          ? ' (p)'
          : '';
      const entry: ScorerEntry = { playerId: id, name, minute, tag };
      (str(obj(d.team).id) === homeId ? homeScorers : awayScorers).push(entry);
    }

    const venue = obj(comp.venue);
    const city = str(obj(venue.address).city);
    const venueName = str(venue.fullName);
    const date = str(ev.date);
    const kickoff = date ? new Date(date) : null;

    const winner =
      status === 'finished'
        ? home.winner === true
          ? 'home'
          : away.winner === true
            ? 'away'
            : undefined
        : undefined;

    const homeShootout = typeof home.shootoutScore === 'number' ? home.shootoutScore : null;
    const awayShootout = typeof away.shootoutScore === 'number' ? away.shootoutScore : null;
    const typeName = str(obj(statusObj.type).name).toUpperCase();
    const finishType: 'aet' | 'pens' | undefined =
      status !== 'finished'
        ? undefined
        : homeShootout != null && awayShootout != null
          ? 'pens'
          : typeName.includes('AET')
            ? 'aet'
            : undefined;

    const progress =
      status === 'upcoming'
        ? undefined
        : progressFromStatus({
            clock: Number(statusObj.clock) || 0,
            displayClock: str(statusObj.displayClock),
            type: {
              state: str(obj(statusObj.type).state),
              period: Number(obj(statusObj.type).period) || 0,
            },
            period: Number(statusObj.period) || 0,
          });

    return {
      id: str(ev.id),
      homeName: str(homeTeam.displayName),
      awayName: str(awayTeam.displayName),
      homeFlag: teamLogo(homeTeam),
      awayFlag: teamLogo(awayTeam),
      homeId: homeId,
      awayId: str(awayTeam.id),
      homeScore: status === 'upcoming' ? null : parseScore(str(home.score)),
      awayScore: status === 'upcoming' ? null : parseScore(str(away.score)),
      group: teamGroup.get(homeId) || teamGroup.get(str(awayTeam.id)) || '',
      kickoff: kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff : null,
      status,
      stage: stageFromSlug(str(obj(ev.season).slug)),
      homeScorers: status === 'upcoming' ? [] : homeScorers,
      awayScorers: status === 'upcoming' ? [] : awayScorers,
      venue: venueName && city ? `${venueName} · ${city}` : venueName,
      slug: matchSlug(str(homeTeam.displayName), str(awayTeam.displayName), str(ev.id)),
      ...(progress ? { progress } : {}),
      ...(winner ? { winner } : {}),
      ...(finishType ? { finishType } : {}),
      ...(finishType === 'pens' && homeShootout != null && awayShootout != null
        ? { homeShootoutScore: homeShootout, awayShootoutScore: awayShootout }
        : {}),
    };
  });

  for (const g of gr) {
    for (const s of g.standings) {
      const form = teamForm.get(s.teamId);
      if (form) s.form = form;
    }
  }

  // --- top scorers (tournament-level) ---
  const teamMap = new Map<string, string>();
  const teamFlagMap = new Map<string, string>();
  for (const g of gr) {
    for (const s of g.standings) {
      teamMap.set(s.teamId, s.name);
      teamFlagMap.set(s.teamId, s.flag);
    }
  }
  const scorerMap = new Map<string, TopScorer>();
  for (const rawEvent of arr(obj(sbJson).events)) {
    const comp = obj(arr(obj(rawEvent).competitions)[0]);
    for (const rawComp of arr(comp.competitors)) {
      const c = obj(rawComp);
      for (const cat of arr(c.leaders)) {
        const catObj = obj(cat);
        if (str(catObj.name) !== 'goals') continue;
        for (const rawLeader of arr(catObj.leaders)) {
          const l = obj(rawLeader);
          const a = obj(l.athlete);
          const id = str(a.id);
          if (!id) continue;
          const goals = Number(l.value) || 0;
          const teamId = str(obj(a.team).id);
          const existing = scorerMap.get(id);
          if (!existing || goals > existing.goals) {
            scorerMap.set(id, {
              athleteId: id,
              name: str(a.displayName) || str(a.shortName),
              teamId,
              teamName: teamMap.get(teamId) || '',
              teamFlag: teamFlagMap.get(teamId) || str(obj(a.team).logo),
              goals,
            });
          }
        }
        break;
      }
    }
  }
  const sc: TopScorer[] = [...scorerMap.values()]
    .filter((s) => s.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, 50);

  return { matches: ms, standings: { kind: 'soccer', groups: gr }, scorers: sc };
}

function transformSummary(json: unknown): MatchDetail {
  const d = obj(json);

  const competitors = arr(obj(arr(obj(d.header).competitions)[0]).competitors).map(obj);
  const homeId = str(obj(competitors.find((c) => c.homeAway === 'home')?.team).id);
  const awayId = str(obj(competitors.find((c) => c.homeAway === 'away')?.team).id);

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
  const keyPlays: PlayEvent[] = arr(d.keyEvents)
    .filter((k) => str(obj(k).text))
    .map((raw) => {
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
    return {
      teamId: str(team.id),
      teamName: str(team.displayName),
      formation: str(r.formation),
      players,
    };
  });
  const rank = (l: TeamLineup) => (l.teamId === homeId ? 0 : l.teamId === awayId ? 1 : 2);
  lineups.sort((a, b) => rank(a) - rank(b));

  const venueObj = obj(obj(d.gameInfo).venue);
  const city = str(obj(venueObj.address).city);
  const venueName = str(venueObj.fullName);
  const att = obj(d.gameInfo).attendance;

  return {
    kind: 'soccer',
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

export const soccerAdapter: SportAdapter = { transform, transformSummary };
```

- [ ] **Step 6: 从 `espn.ts` 删除 `parseSummary` 与其私有辅助，保留 `layoutStarters`** —— 在 `src/utils/espn.ts` 删掉第 1–116 行（`import type` 那行、`obj/arr/str/cardOf/subClock` 辅助、整个 `parseSummary`），只留 `PositionedPlayer` 起（第 118 行）到文件尾的 `layoutStarters` 及其私有辅助（`ROW_Y`/`rowGroup`/`sideScore`）。`layoutStarters` 用到 `LineupPlayer`，所以文件顶部保留一行导入：

```ts
import type { LineupPlayer } from '../types';
```

（`layoutStarters` 不引用被删的 `obj/arr/str`，删除后无悬空引用。）

- [ ] **Step 7: 从 `espn.test.ts` 删除 `parseSummary` 用例，保留 `layoutStarters` 用例** —— 在 `src/utils/espn.test.ts`：
  - 顶部导入改为只导 `layoutStarters`：`import { layoutStarters } from './espn';`（去掉 `parseSummary`）。
  - 删掉 `const summary = {…}`（第 5–81 行）和整个 `describe('parseSummary', …)`（第 83–162 行）——这些已迁到 `soccer.test.ts`。
  - 保留 `mk()` 与 `describe('layoutStarters', …)`（第 164 行起到文件尾）不动。

- [ ] **Step 8: 改 `useMatchDetail` 用 `soccerAdapter`... 不——改用 comp 对应的 adapter** —— 在 `src/hooks/useMatchDetail.ts`：
  - 顶部导入换成：

```ts
import { useEffect, useState } from 'react';
import { ADAPTERS } from '../adapters';
import type { MatchDetail } from '../adapters/types';
import { COMPETITIONS } from '../competitions';
```

  - `parseSummary(json)` 调用（第 33 行）换成按 comp 的 sport 选适配器：

```ts
      .then((json) => {
        if (controller.signal.aborted) return;
        const adapter = ADAPTERS[COMPETITIONS[comp].sport];
        setDetail(adapter.transformSummary(json));
      })
```

- [ ] **Step 9: 创建适配器注册表 `src/adapters/index.ts`** —— 本 Task 只挂 soccer（basketball 在 Task 4 加入本文件）：

```ts
import type { Sport } from '../competitions';
import { soccerAdapter } from './soccer';
import type { SportAdapter } from './types';

// One adapter per sport we serve. Keyed by Competition.sport so
// useCompetition / useMatchDetail resolve the transform from the registry
// (single source of truth, same as buildUrl).
export const ADAPTERS: Partial<Record<Sport, SportAdapter>> & {
  soccer: SportAdapter;
} = {
  soccer: soccerAdapter,
};
```

> 说明：`Sport` 联合有 5 个成员，但我们只实现 soccer（本 Task）+ basketball（Task 4）。用 `Partial<Record<…>> & { soccer: SportAdapter }` 让类型允许缺席其它运动，同时保证 soccer 一定在。`useMatchDetail`/`useCompetition` 里 `ADAPTERS[sport]` 因此是 `SportAdapter | undefined`——见 Step 10/11 对 `!` 断言的处理。

- [ ] **Step 10: `git mv` useWorldCup → useCompetition，改用 adapter.transform** —— 先重命名文件再改内容：

```bash
git mv src/hooks/useWorldCup.ts src/hooks/useCompetition.ts
git mv src/hooks/useWorldCup.test.ts src/hooks/useCompetition.test.ts
```

然后在 `src/hooks/useCompetition.ts`：

10a. 顶部导入整体替换为：

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { ADAPTERS } from '../adapters';
import type { StandingsData } from '../adapters/types';
import { COMPETITIONS } from '../competitions';
import type { CompMatch, TopScorer } from '../types';
```

（删掉对 `WCGroup`/`WCStanding`/`ScorerEntry` 及 `../utils/wc` 的导入——转换逻辑已迁走；`obj/arr/str/stat/teamLogo` 辅助与整段转换代码从本文件删除。）

10b. 函数改名并调整 state 形状（`groups: WCGroup[]` → `standings: StandingsData`），转换体换成 adapter 调用。把 `export function useWorldCup(comp: string) {` 到 `}` 之间**整体替换**为：

```ts
export function useCompetition(comp: string) {
  const BASE = `/api/${comp}`;
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [standings, setStandings] = useState<StandingsData>({ kind: 'soccer', groups: [] });
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<{
    matches: CompMatch[];
    standings: StandingsData;
    scorers: TopScorer[];
    ts: number;
  } | null>(null);
  const initialRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (cacheRef.current && !initialRef.current) {
      setMatches(cacheRef.current.matches);
      setStandings(cacheRef.current.standings);
      setScorers(cacheRef.current.scorers);
      setLoading(false);
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    if (initialRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const [sbRes, stRes] = await Promise.all([
        fetch(`${BASE}/scoreboard`, { signal }),
        fetch(`${BASE}/standings`, { signal }),
      ]);
      if (signal.aborted) return;
      if (!sbRes.ok || !stRes.ok) throw new Error('Failed to load World Cup data');
      const [sbJson, stJson] = await Promise.all([sbRes.json(), stRes.json()]);

      const sport = COMPETITIONS[comp].sport;
      const adapter = ADAPTERS[sport];
      if (!adapter) throw new Error(`No adapter for sport: ${sport}`);
      const {
        matches: ms,
        standings: sd,
        scorers: sc,
      } = adapter.transform(sbJson, stJson);

      if (signal.aborted) return;
      cacheRef.current = { matches: ms, standings: sd, scorers: sc, ts: Date.now() };
      setMatches(ms);
      setStandings(sd);
      setScorers(sc);
      setError(null);
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
      console.error('useCompetition fetch failed:', err);
      if (!cacheRef.current)
        setError(err instanceof Error ? err.message : 'Failed to load World Cup data');
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        initialRef.current = false;
      }
    }
  }, [BASE, comp]);

  useEffect(() => {
    fetchAll();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchAll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll();
    }, 30_000);
    return () => {
      abortRef.current?.abort();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAll]);

  return { matches, standings, scorers, loading, error, refetch: fetchAll };
}
```

> 注：错误串保留原文案 `'Failed to load World Cup data'`——`useCompetition.test.ts` 有断言钉死它（`expect(...).toBe('Failed to load World Cup data')`），本 Task 不改测试断言语义，故文案不动。

- [ ] **Step 11: 更新 `useCompetition.test.ts`（原 useWorldCup.test）** —— 迁移纪律：只搬不改语义。此文件里纯转换的三个断言（normalizes / pens / aet）已在 `soccer.test.ts` 覆盖 transform 本身，**但** hook 层测试仍需验证 hook 把 adapter 结果正确铺进 state。改动：
  - 顶部导入 `import { useWorldCup } from './useWorldCup';` → `import { useCompetition } from './useCompetition';`
  - 全文件把 `useWorldCup(` → `useCompetition(`（renderHook 调用处）。
  - `result.current.groups` 的读取改为 `result.current.standings`。具体：`'normalizes ESPN scoreboard + standings'` 用例里第 154–158 行：

```ts
    const sd = result.current.standings;
    expect(sd.kind).toBe('soccer');
    if (sd.kind !== 'soccer') throw new Error('expected soccer');
    const groupA = sd.groups[0];
    expect(groupA.name).toBe('A');
    expect(groupA.standings[0].name).toBe('Mexico');
    expect(groupA.standings[0].pts).toBe(3);
    expect(groupA.standings[0].gd).toBe(2);
```

  - `'tolerates missing/empty payloads without throwing'` 用例（第 268–275 行）里 `expect(result.current.groups).toEqual([])` 改为：

```ts
    expect(result.current.matches).toEqual([]);
    expect(result.current.standings).toEqual({ kind: 'soccer', groups: [] });
```

  - 其它用例（error / network / abort / unmount）不涉及 `groups`，仅 hook 名替换。

- [ ] **Step 12: 更新 `App.tsx`** —— `useWorldCup` → `useCompetition`；`wc.groups` → 从判别联合取 soccer groups（basketball 页不吃 groups，见 spec §4.4）：

12a. 导入（第 8 行）：`import { useWorldCup } from './hooks/useWorldCup';` → `import { useCompetition } from './hooks/useCompetition';`

12b. 调用（第 69 行）：`const wc = useWorldCup(route.comp);` → `const wc = useCompetition(route.comp);`

12c. 在 `wc` 之后加一行派生 groups（soccer-only 页消费）：

```ts
  const groups = wc.standings.kind === 'soccer' ? wc.standings.groups : [];
```

12d. 把后续三处 `groups={wc.groups}`（FixturesView 第 119 行、TeamPage 第 150 行、PlayerPage 第 163 行）改为 `groups={groups}`。FixturesView 在 Task 5 会改吃 `standings` 联合；本 Task 先让它继续吃 `groups`（保持编译，最小改动）。

- [ ] **Step 13: 更新 `MatchDetailPage.tsx` 收窄 `MatchDetail` 联合** —— `detail` 现在是 `MatchDetail | null`（判别联合）。soccer tab 面板读 `detail.stats` 等字段前必须先 `detail.kind === 'soccer'` 收窄，否则 TS 报「属性不在联合上」。本 Task 只保证 soccer 编译（basketball tab 在 Task 6 加）：

13a. 导入 `MatchDetail` 的来源改为 `../adapters/types`（原从 `../types`）。若 `MatchDetailPage.tsx` 未直接导入 `MatchDetail` 类型（它只用 `useMatchDetail` 返回值），则无需改导入——检查文件顶部 import；当前它导入的是 `Match, WCMatch`（Task 2 已改为 `Match, CompMatch`），不含 `MatchDetail`。故 13a 无操作。

13b. `homeId` 派生（第 76 行）`const homeId = detail?.homeId ?? '';` —— `homeId` 在两个 variant 上都有，联合可直接读，编译通过，不改。

13c. 详情面板（第 276–298 行 `detail ? (…) : null`）里读 `detail.stats`/`detail.allPlays`/`detail.keyPlays`/`detail.lineups` 需要先按 `detail.kind === 'soccer'` 收窄，否则 TS 报「属性不在联合上」。本 Task 只处理 soccer 分支（basketball 详情 tab 在 Task 6 接入；soccer 赛事永远走 soccer 分支，NBA 详情此时不会被打开）：把 tab 面板条件整段用 `detail && detail.kind === 'soccer'` 守卫，basketball 落到末尾 `: null`。替换第 276–298 行为：

```tsx
          ) : detail && detail.kind === 'soccer' ? (
            <>
              {tab === 'stats' && <TeamStatsTab stats={detail.stats} />}
              {tab === 'play' && (
                <PlayByPlayTab
                  allPlays={detail.allPlays}
                  keyPlays={detail.keyPlays}
                  homeId={homeId}
                />
              )}
              {tab === 'lineup' && <LineupTab lineups={detail.lineups} homeId={homeId} />}
              {(detail.venue || detail.attendance) && (
                <div className="pt-card mt-card border-t border-overlay/5 ds-caption text-chalkdim space-y-1.5">
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
```

（basketball detail 此时落到 `: null`——不会发生，因为 NBA 详情 tab 在 Task 6 才接入 MatchDetailPage 分叉；soccer 赛事永远走 soccer 分支。Task 6 会把此结构重构成 per-kind。）

- [ ] **Step 14: 跑全量测试 + typecheck + lint 确认迁移后全绿**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 全绿。`useCompetition.test.ts`（原 320 行）保持绿是本 Task 硬指标；`soccer.test.ts` 新增全绿；`espn.test.ts` 只剩 layoutStarters 全绿；`MatchDetailPage.test.tsx` 断言不变（其 summaryJson 是 soccer 形状，走 soccer 分支）。

- [ ] **Step 15: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(adapters): extract SportAdapter contract + soccer adapter

Define src/adapters/types.ts (SportAdapter, StandingsData, MatchDetail unions).
Move useWorldCup's transform and espn.parseSummary into src/adapters/soccer.ts
verbatim; rename useWorldCup -> useCompetition; useMatchDetail resolves the
adapter from COMPETITIONS[comp].sport. Tests migrated with the code; no
behavior change.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ChocVWiknZXDoEx8ZcZHe3
EOF
)"
```

---

### Task 4: basketball 适配器（transform + transformSummary）

**Files:**
- Create: `src/adapters/basketball.ts`
- Create: `src/adapters/basketball.test.ts`
- Modify: `src/adapters/index.ts`（注册 basketball）

**Interfaces:**
- Consumes: `SportAdapter`/`StandingsData`/`ConferenceTable`/`MatchDetail`/`BoxscoreTable`（Task 3 的 `src/adapters/types.ts`）、`CompMatch`/`TeamStatRow`（`src/types`）、`src/utils/wc.ts` 的 `parseScore`/`statusFromState`/`matchSlug`。
- Produces: `basketballAdapter: SportAdapter`。`transform` 产 `matches`（`stage`/`group` 省略、`statusText` = ESPN `status.type.shortDetail`）、`standings: { kind:'basketball'; conferences: ConferenceTable[] }`、`scorers: []`。`transformSummary` 产 `{ kind:'basketball'; homeId; awayId; teamStats; playerTables; venue; attendance }`。

- [ ] **Step 1: 写失败测试 `src/adapters/basketball.test.ts`** —— 手工内联最小 NBA ESPN 形状（scoreboard 信封与 soccer 同构；standings children = Eastern/Western，行 stats = wins/losses/leagueWinPercent/gamesBehind；summary 无 rosters/commentary，有 `boxscore.players`）：

```ts
import { describe, expect, it } from 'vitest';
import { basketballAdapter } from './basketball';

const scoreboard = {
  events: [
    {
      id: '401585',
      date: '2026-01-15T00:30Z',
      competitions: [
        {
          status: {
            period: 4,
            displayClock: '0.0',
            type: { state: 'post', shortDetail: 'Final' },
          },
          venue: { fullName: 'Crypto.com Arena', address: { city: 'Los Angeles' } },
          competitors: [
            { homeAway: 'home', score: '112', winner: true, team: { id: '13', displayName: 'Los Angeles Lakers', logo: 'lal.png' } },
            { homeAway: 'away', score: '108', winner: false, team: { id: '2', displayName: 'Boston Celtics', logo: 'bos.png' } },
          ],
        },
      ],
    },
    {
      id: '401586',
      date: '2026-01-16T00:00Z',
      competitions: [
        {
          status: { period: 0, type: { state: 'pre', shortDetail: '7:00 PM ET' } },
          venue: { fullName: 'Chase Center', address: { city: 'San Francisco' } },
          competitors: [
            { homeAway: 'home', score: '0', team: { id: '9', displayName: 'Golden State Warriors', logo: 'gsw.png' } },
            { homeAway: 'away', score: '0', team: { id: '25', displayName: 'Phoenix Suns', logo: 'phx.png' } },
          ],
        },
      ],
    },
  ],
};

const standings = {
  children: [
    {
      name: 'Eastern Conference',
      standings: {
        entries: [
          {
            team: { id: '2', displayName: 'Boston Celtics', logos: [{ href: 'bos.png' }] },
            stats: [
              { name: 'wins', value: 30, displayValue: '30' },
              { name: 'losses', value: 12, displayValue: '12' },
              { name: 'leagueWinPercent', value: 0.714, displayValue: '.714' },
              { name: 'gamesBehind', value: 0, displayValue: '-' },
            ],
          },
          {
            team: { id: '20', displayName: 'New York Knicks', logos: [{ href: 'nyk.png' }] },
            stats: [
              { name: 'wins', value: 27, displayValue: '27' },
              { name: 'losses', value: 15, displayValue: '15' },
              { name: 'leagueWinPercent', value: 0.643, displayValue: '.643' },
              { name: 'gamesBehind', value: 3, displayValue: '3' },
            ],
          },
        ],
      },
    },
    {
      name: 'Western Conference',
      standings: {
        entries: [
          {
            team: { id: '13', displayName: 'Los Angeles Lakers', logos: [{ href: 'lal.png' }] },
            stats: [
              { name: 'wins', value: 28, displayValue: '28' },
              { name: 'losses', value: 14, displayValue: '14' },
              { name: 'leagueWinPercent', value: 0.667, displayValue: '.667' },
              { name: 'gamesBehind', value: 0, displayValue: '-' },
            ],
          },
        ],
      },
    },
  ],
};

describe('basketballAdapter.transform', () => {
  it('normalizes scoreboard into matches with statusText and no stage/group', () => {
    const { matches } = basketballAdapter.transform(scoreboard, standings);
    expect(matches).toHaveLength(2);

    const finished = matches[0];
    expect(finished.status).toBe('finished');
    expect(finished.homeName).toBe('Los Angeles Lakers');
    expect(finished.homeScore).toBe(112);
    expect(finished.awayScore).toBe(108);
    expect(finished.homeFlag).toBe('lal.png');
    expect(finished.statusText).toBe('Final');
    expect(finished.winner).toBe('home');
    expect(finished.stage).toBeUndefined();
    expect(finished.group).toBeUndefined();
    expect(finished.venue).toBe('Crypto.com Arena · Los Angeles');
    expect(finished.slug).toBe('los-angeles-lakers-vs-boston-celtics-401585');

    const upcoming = matches[1];
    expect(upcoming.status).toBe('upcoming');
    expect(upcoming.homeScore).toBeNull();
    expect(upcoming.statusText).toBe('7:00 PM ET');
  });

  it('builds Eastern/Western conference tables (W/L/PCT/GB), no scorers', () => {
    const { standings: sd, scorers } = basketballAdapter.transform(scoreboard, standings);
    expect(scorers).toEqual([]);
    expect(sd.kind).toBe('basketball');
    if (sd.kind !== 'basketball') throw new Error('expected basketball');
    expect(sd.conferences).toHaveLength(2);

    const east = sd.conferences[0];
    expect(east.name).toBe('Eastern Conference');
    expect(east.rows[0]).toEqual({
      teamId: '2',
      name: 'Boston Celtics',
      logo: 'bos.png',
      w: 30,
      l: 12,
      pct: '.714',
      gb: '-',
    });
    expect(east.rows[1].gb).toBe('3');

    const west = sd.conferences[1];
    expect(west.name).toBe('Western Conference');
    expect(west.rows[0].name).toBe('Los Angeles Lakers');
  });

  it('tolerates empty payloads without throwing', () => {
    const { matches, standings: sd, scorers } = basketballAdapter.transform({}, {});
    expect(matches).toEqual([]);
    expect(sd).toEqual({ kind: 'basketball', conferences: [] });
    expect(scorers).toEqual([]);
  });
});

const summary = {
  header: {
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { id: '13' } },
          { homeAway: 'away', team: { id: '2' } },
        ],
      },
    ],
  },
  boxscore: {
    teams: [
      {
        team: { id: '13' },
        statistics: [
          { label: 'FG', displayValue: '42-88' },
          { label: 'REB', displayValue: '45' },
        ],
      },
      {
        team: { id: '2' },
        statistics: [
          { label: 'FG', displayValue: '40-90' },
          { label: 'REB', displayValue: '41' },
        ],
      },
    ],
    players: [
      {
        team: { id: '13', displayName: 'Los Angeles Lakers' },
        statistics: [
          {
            labels: ['MIN', 'PTS', 'REB', 'AST'],
            athletes: [
              { starter: true, didNotPlay: false, athlete: { displayName: 'L. James' }, stats: ['38', '30', '8', '11'] },
              { starter: false, didNotPlay: true, athlete: { displayName: 'B. Reserve' }, stats: [] },
            ],
          },
        ],
      },
      {
        team: { id: '2', displayName: 'Boston Celtics' },
        statistics: [
          {
            labels: ['MIN', 'PTS', 'REB', 'AST'],
            athletes: [
              { starter: true, didNotPlay: false, athlete: { displayName: 'J. Tatum' }, stats: ['40', '28', '9', '5'] },
            ],
          },
        ],
      },
    ],
  },
  gameInfo: { venue: { fullName: 'Crypto.com Arena', address: { city: 'Los Angeles' } }, attendance: 18997 },
};

describe('basketballAdapter.transformSummary', () => {
  const d = basketballAdapter.transformSummary(summary);

  it('tags the detail as basketball', () => {
    expect(d.kind).toBe('basketball');
  });

  it('pairs team stats by label (home/away from competitor sides)', () => {
    if (d.kind !== 'basketball') throw new Error('expected basketball');
    expect(d.homeId).toBe('13');
    expect(d.awayId).toBe('2');
    expect(d.teamStats).toEqual([
      { label: 'FG', home: '42-88', away: '40-90' },
      { label: 'REB', home: '45', away: '41' },
    ]);
  });

  it('builds one boxscore table per team with labels + player rows (home first)', () => {
    if (d.kind !== 'basketball') throw new Error('expected basketball');
    expect(d.playerTables).toHaveLength(2);
    const home = d.playerTables[0];
    expect(home.teamId).toBe('13');
    expect(home.teamName).toBe('Los Angeles Lakers');
    expect(home.labels).toEqual(['MIN', 'PTS', 'REB', 'AST']);
    expect(home.players[0]).toEqual({
      name: 'L. James',
      starter: true,
      dnp: false,
      stats: ['38', '30', '8', '11'],
    });
    expect(home.players[1]).toEqual({ name: 'B. Reserve', starter: false, dnp: true, stats: [] });
    expect(d.playerTables[1].teamId).toBe('2');
  });

  it('reads venue and attendance', () => {
    if (d.kind !== 'basketball') throw new Error('expected basketball');
    expect(d.venue).toBe('Crypto.com Arena · Los Angeles');
    expect(d.attendance).toBe(18997);
  });

  it('orders boxscore tables [home, away] even when players arrive away-first', () => {
    const awayFirst = {
      ...summary,
      boxscore: { ...summary.boxscore, players: [...summary.boxscore.players].reverse() },
    };
    const parsed = basketballAdapter.transformSummary(awayFirst);
    if (parsed.kind !== 'basketball') throw new Error('expected basketball');
    expect(parsed.playerTables[0].teamId).toBe(parsed.homeId);
    expect(parsed.playerTables[1].teamId).toBe(parsed.awayId);
  });

  it('tolerates an empty object without throwing', () => {
    const empty = basketballAdapter.transformSummary({});
    if (empty.kind !== 'basketball') throw new Error('expected basketball');
    expect(empty.teamStats).toEqual([]);
    expect(empty.playerTables).toEqual([]);
    expect(empty.attendance).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/adapters/basketball.test.ts`
Expected: FAIL —— `./basketball` 模块不存在。

- [ ] **Step 3: 写 basketball 适配器 `src/adapters/basketball.ts`** —— 防御性风格与 soccer 一致。完整代码：

```ts
import type { CompMatch, TeamStatRow, TopScorer } from '../types';
import { matchSlug, parseScore, statusFromState } from '../utils/wc';
import type {
  BoxscoreTable,
  ConferenceTable,
  MatchDetail,
  SportAdapter,
  StandingsData,
} from './types';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: unknown): Record<string, unknown> {
  return isPlainObject(v) ? v : {};
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ESPN standings stats are [{name, value, displayValue}]; pull the display
// string by name (PCT/GB want the pre-formatted ".714" / "-" / "3").
function statDisplay(entry: Record<string, unknown>, name: string): string {
  const s = arr(entry.stats).find((x) => obj(x).name === name);
  return s ? str(obj(s).displayValue) : '';
}
function statNum(entry: Record<string, unknown>, name: string): number {
  const s = arr(entry.stats).find((x) => obj(x).name === name);
  return s ? Number(obj(s).value) || 0 : 0;
}

function teamLogo(team: Record<string, unknown>): string {
  if (str(team.logo)) return str(team.logo);
  const logos = arr(team.logos);
  return logos.length ? str(obj(logos[0]).href) : '';
}

function transform(
  scoreboardJson: unknown,
  standingsJson: unknown,
): { matches: CompMatch[]; standings: StandingsData; scorers: TopScorer[] } {
  const sbJson = scoreboardJson;
  const stJson = standingsJson;

  // --- standings → conference tables (Eastern / Western) ---
  const conferences: ConferenceTable[] = arr(obj(stJson).children).map((raw): ConferenceTable => {
    const c = obj(raw);
    const entries = arr(obj(c.standings).entries);
    const rows = entries.map((rawEntry) => {
      const e = obj(rawEntry);
      const team = obj(e.team);
      return {
        teamId: str(team.id),
        name: str(team.displayName),
        logo: teamLogo(team),
        w: statNum(e, 'wins'),
        l: statNum(e, 'losses'),
        pct: statDisplay(e, 'leagueWinPercent'),
        gb: statDisplay(e, 'gamesBehind'),
      };
    });
    return { name: str(c.name), rows };
  });

  // --- scoreboard → matches (no stage/group; statusText from shortDetail) ---
  const matches: CompMatch[] = arr(obj(sbJson).events).map((rawEvent): CompMatch => {
    const ev = obj(rawEvent);
    const comp = obj(arr(ev.competitions)[0]);
    const competitors = arr(comp.competitors).map(obj);
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
    const homeTeam = obj(home.team);
    const awayTeam = obj(away.team);
    const statusObj = obj(comp.status);
    const status = statusFromState(str(obj(statusObj.type).state));

    const venue = obj(comp.venue);
    const city = str(obj(venue.address).city);
    const venueName = str(venue.fullName);
    const date = str(ev.date);
    const kickoff = date ? new Date(date) : null;

    const winner =
      status === 'finished'
        ? home.winner === true
          ? 'home'
          : away.winner === true
            ? 'away'
            : undefined
        : undefined;

    const statusText = str(obj(statusObj.type).shortDetail);

    return {
      id: str(ev.id),
      homeName: str(homeTeam.displayName),
      awayName: str(awayTeam.displayName),
      homeFlag: teamLogo(homeTeam),
      awayFlag: teamLogo(awayTeam),
      homeId: str(homeTeam.id),
      awayId: str(awayTeam.id),
      homeScore: status === 'upcoming' ? null : parseScore(str(home.score)),
      awayScore: status === 'upcoming' ? null : parseScore(str(away.score)),
      kickoff: kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff : null,
      status,
      homeScorers: [],
      awayScorers: [],
      venue: venueName && city ? `${venueName} · ${city}` : venueName,
      slug: matchSlug(str(homeTeam.displayName), str(awayTeam.displayName), str(ev.id)),
      ...(statusText ? { statusText } : {}),
      ...(winner ? { winner } : {}),
    };
  });

  return { matches, standings: { kind: 'basketball', conferences }, scorers: [] };
}

function transformSummary(json: unknown): MatchDetail {
  const d = obj(json);

  const competitors = arr(obj(arr(obj(d.header).competitions)[0]).competitors).map(obj);
  const homeId = str(obj(competitors.find((c) => c.homeAway === 'home')?.team).id);
  const awayId = str(obj(competitors.find((c) => c.homeAway === 'away')?.team).id);

  // team stats: map each boxscore team's label→displayValue, pair by home order
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
  const teamStats: TeamStatRow[] = [...homeStats.entries()].map(([label, home]) => ({
    label,
    home,
    away: awayStats.get(label) ?? '',
  }));

  // player boxscore tables: one per team. ESPN nests labels + athletes under
  // boxscore.players[].statistics[0].
  const playerTables: BoxscoreTable[] = arr(obj(d.boxscore).players).map((raw): BoxscoreTable => {
    const p = obj(raw);
    const team = obj(p.team);
    const block = obj(arr(p.statistics)[0]);
    const labels = arr(block.labels).map((x) => str(x));
    const players = arr(block.athletes).map((rawA) => {
      const a = obj(rawA);
      return {
        name: str(obj(a.athlete).displayName),
        starter: Boolean(a.starter),
        dnp: Boolean(a.didNotPlay),
        stats: arr(a.stats).map((x) => str(x)),
      };
    });
    return { teamId: str(team.id), teamName: str(team.displayName), labels, players };
  });
  // Enforce [home, away] regardless of ESPN order.
  const rank = (b: BoxscoreTable) => (b.teamId === homeId ? 0 : b.teamId === awayId ? 1 : 2);
  playerTables.sort((a, b) => rank(a) - rank(b));

  const venueObj = obj(obj(d.gameInfo).venue);
  const city = str(obj(venueObj.address).city);
  const venueName = str(venueObj.fullName);
  const att = obj(d.gameInfo).attendance;

  return {
    kind: 'basketball',
    homeId,
    awayId,
    teamStats,
    playerTables,
    venue: venueName && city ? `${venueName} · ${city}` : venueName,
    attendance: typeof att === 'number' ? att : null,
  };
}

export const basketballAdapter: SportAdapter = { transform, transformSummary };
```

- [ ] **Step 4: 注册 basketball 到 `src/adapters/index.ts`** —— 改为：

```ts
import type { Sport } from '../competitions';
import { basketballAdapter } from './basketball';
import { soccerAdapter } from './soccer';
import type { SportAdapter } from './types';

// One adapter per sport we serve. Keyed by Competition.sport so
// useCompetition / useMatchDetail resolve the transform from the registry
// (single source of truth, same as buildUrl).
export const ADAPTERS: Partial<Record<Sport, SportAdapter>> & {
  soccer: SportAdapter;
  basketball: SportAdapter;
} = {
  soccer: soccerAdapter,
  basketball: basketballAdapter,
};
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/adapters/basketball.test.ts`
Expected: PASS（transform matches/conferences/空态 + transformSummary teamStats/playerTables/排序/空态全绿）。

- [ ] **Step 6: 全量 typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: 无错误。

- [ ] **Step 7: 提交**

```bash
git add src/adapters/basketball.ts src/adapters/basketball.test.ts src/adapters/index.ts
git commit -m "$(cat <<'EOF'
feat(adapters): basketball adapter (NBA transform + boxscore summary)

Conference standings (W/L/PCT/GB), season-shape matches with statusText from
ESPN shortDetail, and per-team boxscore player tables. Inline-JSON tests, no
network. Registered in ADAPTERS.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ChocVWiknZXDoEx8ZcZHe3
EOF
)"
```

---

### Task 5: 视图 — `ConferenceStandings` 组件 + `FixturesView` 按 `standings.kind` 分叉 + `MatchCard` statusText

**Files:**
- Create: `src/components/ConferenceStandings.tsx`
- Create: `src/components/ConferenceStandings.test.tsx`
- Modify: `src/components/FixturesView.tsx`（prop `groups: WCGroup[]` → `standings: StandingsData`；积分榜区按 kind 分叉；season 形态隐藏 stage chips）
- Modify: `src/components/FixturesView.test.tsx`（更新 prop 名 + 断言）
- Modify: `src/App.tsx`（给 FixturesView 传 `standings={wc.standings}`）
- Modify: `src/components/MatchCard.tsx`（新增 `statusText?` prop，live/finished 时优先显示）
- Modify: `src/components/MatchCard.test.tsx`（已存在，追加 statusText describe 块）
- Modify: `src/i18n/messages.ts`（新增 `st.pct`、`st.gb`；四语）

**Interfaces:**
- Consumes: `StandingsData`/`ConferenceTable`（Task 3）、`CompMatch`（Task 2）、`COMPETITIONS`（Task 1）。
- Produces:
  - `ConferenceStandings`（default export）：props `{ conferences: ConferenceTable[] }`，渲染每会一张表（列 Team/W/L/PCT/GB），**行不可点击**（spec §2）。
  - `FixturesView` 新 prop 形状：`standings: StandingsData`（替换旧 `groups: WCGroup[]`）。内部：soccer → 旧 `StandingsView`；basketball → `ConferenceStandings`。
  - `MatchCard` 新 prop `statusText?: string`。

- [ ] **Step 1: 写 `ConferenceStandings` 失败测试 `src/components/ConferenceStandings.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n';
import type { ConferenceTable } from '../adapters/types';
import ConferenceStandings from './ConferenceStandings';

const conferences: ConferenceTable[] = [
  {
    name: 'Eastern Conference',
    rows: [
      { teamId: '2', name: 'Boston Celtics', logo: '', w: 30, l: 12, pct: '.714', gb: '-' },
      { teamId: '20', name: 'New York Knicks', logo: '', w: 27, l: 15, pct: '.643', gb: '3' },
    ],
  },
  {
    name: 'Western Conference',
    rows: [{ teamId: '13', name: 'Los Angeles Lakers', logo: '', w: 28, l: 14, pct: '.667', gb: '-' }],
  },
];

describe('ConferenceStandings', () => {
  it('renders one table per conference with team rows', () => {
    render(
      <LanguageProvider>
        <ConferenceStandings conferences={conferences} />
      </LanguageProvider>,
    );
    expect(screen.getByText('Eastern Conference')).toBeInTheDocument();
    expect(screen.getByText('Western Conference')).toBeInTheDocument();
    expect(screen.getByText('Boston Celtics')).toBeInTheDocument();
    expect(screen.getByText('Los Angeles Lakers')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });

  it('renders W/L/PCT/GB values', () => {
    render(
      <LanguageProvider>
        <ConferenceStandings conferences={conferences} />
      </LanguageProvider>,
    );
    expect(screen.getByText('.714')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Knicks GB
  });

  it('does not make rows clickable (no buttons/links in the tables)', () => {
    render(
      <LanguageProvider>
        <ConferenceStandings conferences={conferences} />
      </LanguageProvider>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the empty message when there are no conferences', () => {
    render(
      <LanguageProvider>
        <ConferenceStandings conferences={[]} />
      </LanguageProvider>,
    );
    expect(screen.getByText('Standings appear once the group stage kicks off')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/ConferenceStandings.test.tsx`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 写 `ConferenceStandings` 组件** —— 复用现有表行 class（`ds-glass`/`ds-caption` 等，与 `StandingsView` 一致）；行是纯 `<tr>`，无 onClick。`st.pct`/`st.gb` 是 Step 8 新增 i18n key；`st.team`/`st.w`/`st.l` 已有。empty 复用 `standings.empty`。

```tsx
import { useT } from '../i18n';
import type { ConferenceTable } from '../adapters/types';

export default function ConferenceStandings({ conferences }: { conferences: ConferenceTable[] }) {
  const t = useT();

  if (conferences.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim">{t('standings.empty')}</p>;
  }

  return (
    <div className="space-y-section">
      <div className="grid grid-cols-1 gap-3 sm:gap-card sm:grid-cols-2">
        {conferences.map((c) => (
          <div key={c.name} className="ds-glass overflow-hidden">
            <div className="px-4 py-3 border-b border-overlay/5 bg-overlay/[0.02]">
              <span className="font-display font-bold text-lg text-chalk">{c.name}</span>
            </div>
            <table className="w-full text-sm">
              <caption className="sr-only">{c.name}</caption>
              <thead>
                <tr className="text-chalkdim ds-caption uppercase">
                  <th scope="col" className="text-left font-medium px-4 py-2">
                    {t('st.team')}
                  </th>
                  <th scope="col" className="px-1 font-medium">
                    <abbr title="Wins">{t('st.w')}</abbr>
                  </th>
                  <th scope="col" className="px-1 font-medium">
                    <abbr title="Losses">{t('st.l')}</abbr>
                  </th>
                  <th scope="col" className="px-2 font-medium">
                    <abbr title="Win percentage">{t('st.pct')}</abbr>
                  </th>
                  <th scope="col" className="px-2 font-medium hidden sm:table-cell">
                    <abbr title="Games behind">{t('st.gb')}</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.teamId} className="border-t border-overlay/5">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.logo ? (
                          <img
                            src={r.logo}
                            alt={r.name}
                            className="w-5 h-5 object-contain rounded-micro"
                          />
                        ) : (
                          <span className="w-5" />
                        )}
                        <span className="font-display font-semibold text-chalk truncate">
                          {r.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-center text-chalkdim tabular-nums">{r.w}</td>
                    <td className="text-center text-chalkdim tabular-nums">{r.l}</td>
                    <td className="text-center text-chalkdim tabular-nums">{r.pct}</td>
                    <td className="text-center text-chalkdim tabular-nums hidden sm:table-cell">
                      {r.gb}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 加 i18n `st.pct` / `st.gb`（四语）** —— 在 `src/i18n/messages.ts` 每语言的 `'st.form'` 那行附近各加两条：

```
en: 'st.pct': 'PCT',   'st.gb': 'GB',
zh: 'st.pct': '胜率',   'st.gb': '胜差',
ja: 'st.pct': '勝率',   'st.gb': 'GB',
ko: 'st.pct': '승률',   'st.gb': 'GB',
```

- [ ] **Step 5: 跑 ConferenceStandings + i18n 测试确认通过**

Run: `npx vitest run src/components/ConferenceStandings.test.tsx src/i18n/messages.test.ts`
Expected: PASS。

- [ ] **Step 6: 写 MatchCard statusText 失败测试** —— `src/components/MatchCard.test.tsx` 已存在（顶部已有 `render`/`screen`/`LanguageProvider`/`MatchCard` 导入及 `renderCard` 辅助）。在文件末尾（最后一个 `describe` 之后）追加下面这个 describe 块，直接用 `renderCard`：

```tsx
describe('MatchCard statusText', () => {
  it('shows ESPN statusText for a finished match instead of a stage chip', () => {
    renderCard({
      homeName: 'Los Angeles Lakers',
      awayName: 'Boston Celtics',
      homeScore: 112,
      awayScore: 108,
      status: 'finished',
      kickoff: new Date('2026-01-15T00:30:00Z'),
      statusText: 'Final',
    });
    // statusText surfaces on the card
    expect(screen.getByText('Final')).toBeInTheDocument();
    // no stage/group chip when neither is provided (season sport)
    expect(screen.queryByText(/^Group /)).not.toBeInTheDocument();
  });

  it('shows statusText for a live match', () => {
    renderCard({
      homeName: 'Warriors',
      awayName: 'Suns',
      homeScore: 54,
      awayScore: 50,
      status: 'live',
      kickoff: new Date('2026-01-16T00:00:00Z'),
      statusText: 'Q3 4:12',
    });
    expect(screen.getByText('Q3 4:12')).toBeInTheDocument();
  });
});
```

> 注：`renderCard(props)` 的 `props` 类型是 `Parameters<typeof MatchCard>[0]`——`stage`/`group` 在 Task 2 后已可选，上面不传即可（不渲染 chip）。

- [ ] **Step 7: 跑测试确认失败**

Run: `npx vitest run src/components/MatchCard.test.tsx`
Expected: FAIL —— MatchCard 无 `statusText` prop（TS/运行时不渲染 "Final"）。

- [ ] **Step 8: 改 `MatchCard.tsx` 支持 statusText** —— 有 `statusText` 且 status 为 live/finished 时，优先用它做状态显示，替代派生的 `StatusPill`/`ClockLabel`。

8a. 在 `MatchCardProps`（Task 2 已加 `stage?`/`group?`）里加：

```ts
  // ESPN-provided status line for non-soccer sports (e.g. "Final", "Q4 2:14",
  // "OT"). When present on a live/finished card it replaces the derived
  // StatusPill/ClockLabel — we don't synthesize period text for other sports.
  statusText?: string;
```

8b. 在 `memo(function MatchCard({ … })` 的解构参数里加 `statusText,`（放在 `winner,` 之后、`watchable,` 之前，与 props 顺序一致）。

8c. 在 JSX 里，找到分数下方的状态区（第 234–235 行）：

```tsx
            <StatusPill status={status} progress={progress} finishType={finishType} t={t} />
            <ClockLabel progress={progress} />
```

替换为：有 `statusText` 且非 upcoming 时显示它，否则走既有 pill/clock：

```tsx
            {statusText && status !== 'upcoming' ? (
              <span
                className={`ds-caption tracking-widest ${
                  status === 'live' ? 'text-live' : 'text-chalkdim'
                }`}
              >
                {statusText}
              </span>
            ) : (
              <>
                <StatusPill status={status} progress={progress} finishType={finishType} t={t} />
                <ClockLabel progress={progress} />
              </>
            )}
```

- [ ] **Step 9: 跑 MatchCard 测试确认通过**

Run: `npx vitest run src/components/MatchCard.test.tsx`
Expected: PASS（"Final" / "Q3 4:12" 渲染，无 Group chip）。

- [ ] **Step 10: 改 `FixturesView` — prop 换 standings 联合 + 按 kind 分叉 + season 隐藏 stage chips + 传 statusText** —— 在 `src/components/FixturesView.tsx`：

10a. 导入加 `StandingsData`/`ConferenceStandings`：

```ts
import type { StandingsData } from '../adapters/types';
import ConferenceStandings from './ConferenceStandings';
```

10b. props 签名：把 `groups: WCGroup[]` 替换为 `standings: StandingsData`（第 21–33 行的解构与类型都改）。派生一个 soccer-groups 便捷变量供旧 StandingsView / BracketView 用：

- 解构参数里 `groups,` → `standings,`
- 类型里 `groups: WCGroup[];` → `standings: StandingsData;`
- 在组件体内（`const comp = route.comp;` 附近）加：

```ts
  const groups = standings.kind === 'soccer' ? standings.groups : [];
```

（`BracketView` 只在 soccer/tournament 出现，吃 `groups` 不变；basketball 无 bracket。）

10c. season 隐藏 stage chips：stage 筛选 chip 行（第 201–213 行）在 `shape === 'season'` 时不渲染。把该 `<div className="flex gap-2 …">…stages.map…</div>` 整体包一层条件（顺手修掉 eng.1 孤零零的 Group stage chip，spec §4.3）：

```tsx
            {shape !== 'season' && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {stages.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStage(s)}
                    aria-pressed={stage === s}
                    className={`ds-chip ${stage === s ? 'ds-chip-active' : 'ds-chip-inactive'}`}
                  >
                    {s === 'all' ? t('filter.all') : t(`stage.${s}`)}
                  </button>
                ))}
              </div>
            )}
```

10d. 积分榜区（第 220–237 行）按 `standings.kind` 分叉。当前逻辑：season → league 表，tournament+group filter → group 表。改为先判 sport 再判形态。替换整块为：

```tsx
            {standings.kind === 'basketball'
              ? standings.conferences.length > 0 && (
                  <section className="space-y-stack">
                    <h3 className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase">
                      {t('fixtures.standings')}
                    </h3>
                    <ConferenceStandings conferences={standings.conferences} />
                  </section>
                )
              : shape === 'season' && groups.length > 0 ? (
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

10e. 给 `MatchCard` 传 `statusText`（`renderDay` 里的 `<MatchCard … />`，第 126–150 行）加一行 prop：在 `group={m.group}` 之后加 `statusText={m.statusText}`。

- [ ] **Step 11: 更新 `App.tsx` 给 FixturesView 传 standings** —— FixturesView 现在吃 `standings` 联合，不再吃 `groups`。在 `src/App.tsx` 的 `<FixturesView … />`（第 116–123 行）：把 `groups={groups}` 改为 `standings={wc.standings}`。（TeamPage/PlayerPage 仍吃派生的 `groups` 变量不变——它们是 soccer-only 页。）

- [ ] **Step 12: 更新 `FixturesView.test.tsx`** —— 现有测试用 `groups={...}` prop 且传 `WCGroup[]`。改为 `standings` 联合：

12a. `renderView` 辅助（第 8–14 行）把 `groups` 参数包成 soccer 联合：

```tsx
function renderView(matches: CompMatch[], groups: WCGroup[] = [], scorers: never[] = []) {
  return render(
    <LanguageProvider>
      <FixturesView
        section="matches"
        matches={matches}
        standings={{ kind: 'soccer', groups }}
        scorers={scorers}
      />
    </LanguageProvider>,
  );
}
```

12b. 文件底部三个 season/bracket 用例（第 188–222 行）里的 `groups={league}` 都改为 `standings={{ kind: 'soccer', groups: league }}`；`scorers={[]}` 不变，`matches={[]}` 不变。

12c. 追加一个 basketball 用例（验证 conference 表 + 无 stage chips）：

```tsx
import type { ConferenceTable } from '../adapters/types';

const conferences: ConferenceTable[] = [
  {
    name: 'Eastern Conference',
    rows: [{ teamId: '2', name: 'Boston Celtics', logo: '', w: 30, l: 12, pct: '.714', gb: '-' }],
  },
];

it('renders conference standings and hides stage chips for a basketball season comp', () => {
  setPath('/nba');
  render(
    <LanguageProvider>
      <FixturesView
        section="matches"
        matches={[]}
        standings={{ kind: 'basketball', conferences }}
        scorers={[]}
      />
    </LanguageProvider>,
  );
  expect(screen.getByText('Boston Celtics')).toBeInTheDocument();
  // season shape → no stage filter chips (no lone "Group stage")
  expect(screen.queryByRole('button', { name: 'Group stage' })).not.toBeInTheDocument();
});
```

（`CompMatch` 需在 test 顶部导入：确认第 4 行 `import type { WCGroup, WCMatch }` 已被 Task 2 sed 改为 `CompMatch`；`match()` 工厂返回 `CompMatch` 无变化。）

- [ ] **Step 13: 跑全量测试 + typecheck + lint 确认通过**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 全绿。注意 `FixturesView.test.tsx` 里 `'shows the group standings table only when the Group stage filter is active'` 用例——它对 tournament 赛事（默认 `/fifa.world` 或未 setPath）点 Group stage chip 后显示表；basketball 无此路径，soccer 路径不变，断言仍绿。

- [ ] **Step 14: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(views): ConferenceStandings + FixturesView standings-kind branching

FixturesView now takes StandingsData (soccer groups / basketball conferences),
renders ConferenceStandings for NBA (rows not clickable), hides stage chips for
season-shape comps, and passes CompMatch.statusText to MatchCard, which shows
ESPN's status line for non-soccer live/finished cards.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ChocVWiknZXDoEx8ZcZHe3
EOF
)"
```

---

### Task 6: `BoxscoreTable` 组件 + `MatchDetailPage` 按 `detail.kind` 分叉 tab 集

**Files:**
- Create: `src/components/matchdetail/BoxscoreTab.tsx`
- Create: `src/components/matchdetail/BoxscoreTab.test.tsx`
- Modify: `src/components/MatchDetailPage.tsx`（tab 集由 `detail.kind` 决定；basketball = Boxscore + Stats；hero 的 stage/group 标签对无 stage 的赛事隐藏）
- Modify: `src/components/MatchDetailPage.test.tsx`（追加 basketball tab 集用例）
- Modify: `src/i18n/messages.ts`（新增 `detail.boxscore`；四语）

**Interfaces:**
- Consumes: `BoxscoreTable`（Task 3）、`MatchDetail` 联合（Task 3）、`TeamStatsTab`（复用现有，吃 `TeamStatRow[]`）。
- Produces: `BoxscoreTab`（default export）：props `{ tables: BoxscoreTable[] }`，每队一张横向可滚表（列 = `labels`，行 = 每球员 `name` + `stats`；DNP 行灰显）。

- [ ] **Step 1: 写 `BoxscoreTab` 失败测试 `src/components/matchdetail/BoxscoreTab.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoxscoreTable } from '../../adapters/types';
import BoxscoreTab from './BoxscoreTab';

const tables: BoxscoreTable[] = [
  {
    teamId: '13',
    teamName: 'Los Angeles Lakers',
    labels: ['MIN', 'PTS', 'REB', 'AST'],
    players: [
      { name: 'L. James', starter: true, dnp: false, stats: ['38', '30', '8', '11'] },
      { name: 'B. Reserve', starter: false, dnp: true, stats: [] },
    ],
  },
  {
    teamId: '2',
    teamName: 'Boston Celtics',
    labels: ['MIN', 'PTS', 'REB', 'AST'],
    players: [{ name: 'J. Tatum', starter: true, dnp: false, stats: ['40', '28', '9', '5'] }],
  },
];

describe('BoxscoreTab', () => {
  it('renders one table per team with the team name and column labels', () => {
    render(<BoxscoreTab tables={tables} />);
    expect(screen.getByText('Los Angeles Lakers')).toBeInTheDocument();
    expect(screen.getByText('Boston Celtics')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getAllByText('PTS').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a player row with its stats', () => {
    render(<BoxscoreTab tables={tables} />);
    expect(screen.getByText('L. James')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('J. Tatum')).toBeInTheDocument();
  });

  it('renders a DNP player without crashing on empty stats', () => {
    render(<BoxscoreTab tables={tables} />);
    const row = screen.getByText('B. Reserve').closest('tr');
    expect(row).not.toBeNull();
    // DNP marker text is present in the row
    expect(within(row as HTMLElement).getByText('DNP')).toBeInTheDocument();
  });

  it('shows an empty message when there are no tables', () => {
    render(<BoxscoreTab tables={[]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });
});
```

（`BoxscoreTab` 不用 i18n Provider 也能渲染 team/labels，但 empty 文案 "No data yet" 走 `t('detail.noData')`——它在无 Provider 时 `useT` 会 fallback 到 en？检查：`useT` 需要 `LanguageProvider`。为稳妥，empty 用例包 Provider。改 empty 用例为带 Provider：见下 Step 3 组件用 `useT`，故所有渲染都要 Provider。**修正上面测试**：给每个 `render(<BoxscoreTab … />)` 包 `LanguageProvider`。）

修正后的测试文件顶部加 `import { LanguageProvider } from '../../i18n';`，每处 `render(<BoxscoreTab tables={x} />)` 改为：

```tsx
    render(
      <LanguageProvider>
        <BoxscoreTab tables={x} />
      </LanguageProvider>,
    );
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/matchdetail/BoxscoreTab.test.tsx`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 写 `BoxscoreTab` 组件** —— 横向可滚（`overflow-x-auto`，遵守 CLAUDE.md「宽内容自己滚，body 不横滚」）；DNP 行灰显并在首列后标 "DNP"。

```tsx
import { useT } from '../../i18n';
import type { BoxscoreTable } from '../../adapters/types';

export default function BoxscoreTab({ tables }: { tables: BoxscoreTable[] }) {
  const t = useT();
  if (tables.length === 0) {
    return (
      <p className="font-mono text-xs tracking-wider text-chalkdim p-card">{t('detail.noData')}</p>
    );
  }
  return (
    <div className="space-y-card p-card">
      {tables.map((tbl) => (
        <div key={tbl.teamId} className="space-y-2">
          <h4 className="font-display font-bold text-sm text-chalk">{tbl.teamName}</h4>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="text-chalkdim ds-caption uppercase">
                  <th scope="col" className="text-left font-medium px-2 py-1.5">
                    {t('scorers.player')}
                  </th>
                  {tbl.labels.map((label) => (
                    <th key={label} scope="col" className="px-2 py-1.5 font-medium text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tbl.players.map((p) => (
                  <tr key={p.name} className="border-t border-overlay/5">
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span
                        className={`font-display ${p.dnp ? 'text-chalkdim/60' : 'text-chalk'} ${
                          p.starter ? 'font-semibold' : 'font-normal'
                        }`}
                      >
                        {p.name}
                      </span>
                    </td>
                    {p.dnp ? (
                      <td
                        colSpan={tbl.labels.length}
                        className="px-2 py-1.5 text-chalkdim/60 ds-caption uppercase tracking-wider"
                      >
                        DNP
                      </td>
                    ) : (
                      tbl.labels.map((label, i) => (
                        <td
                          key={label}
                          className="px-2 py-1.5 text-right text-chalkdim tabular-nums"
                        >
                          {p.stats[i] ?? ''}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 加 i18n `detail.boxscore`（四语）** —— 在 `src/i18n/messages.ts` 每语言 `'detail.lineup'` 那行附近加：

```
en: 'detail.boxscore': 'Box Score',
zh: 'detail.boxscore': '数据统计',
ja: 'detail.boxscore': 'ボックススコア',
ko: 'detail.boxscore': '박스 스코어',
```

- [ ] **Step 5: 跑 BoxscoreTab + i18n 测试确认通过**

Run: `npx vitest run src/components/matchdetail/BoxscoreTab.test.tsx src/i18n/messages.test.ts`
Expected: PASS。

- [ ] **Step 6: 改 `MatchDetailPage` 按 `detail.kind` 决定 tab 集** —— 当前 tab 类型 `Tab = 'stats' | 'play' | 'lineup'` 与 tab 集写死。改为按 detail kind：soccer = stats/play/lineup（不变）；basketball = boxscore + stats。

6a. 顶部导入加 `BoxscoreTab`：

```ts
import BoxscoreTab from './matchdetail/BoxscoreTab';
```

6b. 把 `type Tab = 'stats' | 'play' | 'lineup';`（第 11 行）替换为覆盖两运动的联合：

```ts
type Tab = 'stats' | 'play' | 'lineup' | 'boxscore';
```

6c. tab 集与初始 tab 由 `detail?.kind` 决定。当前 `const [tab, setTab] = useState<Tab>('stats');`（第 71 行）保留（'stats' 对两运动都合法）。在其后加派生 tab 列表（detail 未加载时给 soccer 默认，避免闪烁）：

```ts
  const tabs: Tab[] =
    detail?.kind === 'basketball' ? ['boxscore', 'stats'] : ['stats', 'play', 'lineup'];
```

6d. basketball 首次加载时默认 tab 应是 boxscore（其 tab 集不含 'play'/'lineup'，但初始 'stats' 也在其集里，合法——保留 'stats' 初始即可，boxscore 与 stats 都在集内）。为让 basketball 落地即显 boxscore，加一个 effect 在 kind 变化时把 tab 收敛进当前 tab 集：

```ts
  // Keep the active tab valid for the current sport's tab set (e.g. switching
  // from a soccer 'lineup' tab to a basketball detail that has no lineup).
  // biome-ignore lint/correctness/useExhaustiveDependencies: tabs is derived from detail
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0]!);
  }, [detail?.kind]);
```

（`useEffect` 需在顶部 import 里已有——当前 `MatchDetailPage.tsx` 第 1 行只导 `useState`；加 `useEffect`：`import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from 'react';`。）

6e. `onTabKey`（第 80–89 行）里写死的 `const order: Tab[] = ['stats', 'play', 'lineup'];` 改为用 `tabs`：

```ts
  const onTabKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = tabs.indexOf(tab);
    const next =
      e.key === 'ArrowRight'
        ? tabs[(i + 1) % tabs.length]
        : tabs[(i + tabs.length - 1) % tabs.length];
    if (next) setTab(next);
  };
```

6f. hero 里的 stage/group 标签（第 123–130 行）对无 stage 的赛事隐藏（NBA 无 stage/group）。把该 `<div className="text-center mb-4 shrink-0">…</div>` 替换为条件渲染：

```tsx
          {match.stage && (
            <div className="text-center mb-4 shrink-0">
              <span className="ds-caption uppercase tracking-[0.2em] text-chalkdim">
                {match.stage === 'group'
                  ? `${t('common.group')} ${match.group ?? ''}`
                  : t(`stage.${match.stage}`)}
              </span>
            </div>
          )}
```

6g. tab 条渲染（第 237–257 行的 `(['stats', 'play', 'lineup'] as const).map(...)`）改用 `tabs`，label 映射加 boxscore：

```tsx
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              onClick={() => setTab(k)}
              aria-selected={tab === k}
              className={`flex-1 ds-seg-tab ${
                tab === k ? 'ds-seg-tab-active' : 'ds-seg-tab-inactive'
              }`}
            >
              {t(
                k === 'stats'
                  ? 'detail.stats'
                  : k === 'play'
                    ? 'detail.playByPlay'
                    : k === 'lineup'
                      ? 'detail.lineup'
                      : 'detail.boxscore',
              )}
            </button>
          ))}
```

6h. 详情面板（Task 3 里改成的 `detail && detail.kind === 'soccer' ? (…) : null`）扩成两分支。把该块替换为：

```tsx
          ) : detail && detail.kind === 'soccer' ? (
            <>
              {tab === 'stats' && <TeamStatsTab stats={detail.stats} />}
              {tab === 'play' && (
                <PlayByPlayTab
                  allPlays={detail.allPlays}
                  keyPlays={detail.keyPlays}
                  homeId={homeId}
                />
              )}
              {tab === 'lineup' && <LineupTab lineups={detail.lineups} homeId={homeId} />}
              {(detail.venue || detail.attendance) && (
                <div className="pt-card mt-card border-t border-overlay/5 ds-caption text-chalkdim space-y-1.5">
                  {detail.venue && <div>{detail.venue}</div>}
                  {detail.attendance && (
                    <div>
                      {t('detail.attendance')}: {detail.attendance.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : detail && detail.kind === 'basketball' ? (
            <>
              {tab === 'boxscore' && <BoxscoreTab tables={detail.playerTables} />}
              {tab === 'stats' && <TeamStatsTab stats={detail.teamStats} />}
              {(detail.venue || detail.attendance) && (
                <div className="pt-card mt-card border-t border-overlay/5 ds-caption text-chalkdim space-y-1.5">
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
```

- [ ] **Step 7: 写 MatchDetailPage basketball tab 集失败测试** —— 在 `src/components/MatchDetailPage.test.tsx` 追加。NBA 比赛：`match` 无 stage/group，`statusText='Final'`；summary 走 basketball 形状。**注意** `useMatchDetail` 按 `COMPETITIONS[route.comp].sport` 选 adapter——测试里 `useRouter()` 读 `window.location.pathname`，故需 `setPath('/nba')` 让 comp=nba→basketball adapter。

先在文件顶部（`import` 之后）加 `setPath` 辅助与 basketball summary/ match：

```tsx
function setPath(pathname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname },
    writable: true,
    configurable: true,
  });
}

const nbaMatch: CompMatch = {
  id: '401585',
  homeName: 'Los Angeles Lakers',
  awayName: 'Boston Celtics',
  homeFlag: '',
  awayFlag: '',
  homeId: '13',
  awayId: '2',
  homeScore: 112,
  awayScore: 108,
  kickoff: new Date('2026-01-15T00:30Z'),
  status: 'finished',
  statusText: 'Final',
  homeScorers: [],
  awayScorers: [],
  venue: '',
  slug: 'los-angeles-lakers-vs-boston-celtics-401585',
};

function nbaSummaryJson() {
  return {
    header: {
      competitions: [
        {
          competitors: [
            { homeAway: 'home', team: { id: '13' } },
            { homeAway: 'away', team: { id: '2' } },
          ],
        },
      ],
    },
    boxscore: {
      teams: [{ team: { id: '13' }, statistics: [{ label: 'REB', displayValue: '45' }] }],
      players: [
        {
          team: { id: '13', displayName: 'Los Angeles Lakers' },
          statistics: [
            {
              labels: ['MIN', 'PTS'],
              athletes: [
                { starter: true, didNotPlay: false, athlete: { displayName: 'L. James' }, stats: ['38', '30'] },
              ],
            },
          ],
        },
      ],
    },
    gameInfo: {},
  };
}
```

（`CompMatch` 已在文件顶部导入——确认 Task 2 sed 把 `import type { Match, WCMatch }` 改成了 `import type { Match, CompMatch }`。）

再追加两个用例：

```tsx
it('shows Boxscore + Stats tabs for an NBA match (no Lineup / Play-By-Play)', async () => {
  setPath('/nba');
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => nbaSummaryJson() });
  render(
    <LanguageProvider>
      <MatchDetailPage match={nbaMatch} onBack={vi.fn()} />
    </LanguageProvider>,
  );
  // Boxscore tab renders the player once the summary resolves
  expect(await screen.findByText('L. James')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Box Score' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Stats' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Lineup' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Play-By-Play' })).not.toBeInTheDocument();
});

it('shows the NBA statusText and no stage label in the hero', async () => {
  setPath('/nba');
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => nbaSummaryJson() });
  render(
    <LanguageProvider>
      <MatchDetailPage match={nbaMatch} onBack={vi.fn()} />
    </LanguageProvider>,
  );
  await screen.findByText('L. James');
  // no soccer stage/group chip in the hero (nbaMatch has no stage)
  expect(screen.queryByText(/^Group /)).not.toBeInTheDocument();
});
```

> 重要：追加这两个用例后，文件里**既有的 soccer 用例**依赖 comp=fifa.world（默认路径）。因 `setPath('/nba')` 修改了全局 `window.location.pathname` 且不自动复原，NBA 用例放在文件末尾、且在它们之后无 soccer 用例即可。若测试执行顺序导致污染，在文件顶部 `beforeEach` 里复位路径：把现有 `beforeEach(() => { fetchMock.mockReset(); });` 改为：

```tsx
beforeEach(() => {
  fetchMock.mockReset();
  setPath('/fifa.world');
});
```

（`setPath` 需在 `beforeEach` 之前定义——把 `setPath` 定义移到文件顶部 import 之后、`beforeEach` 之前。）

- [ ] **Step 8: 跑测试确认失败**

Run: `npx vitest run src/components/MatchDetailPage.test.tsx`
Expected: FAIL —— 新 NBA 用例找不到 'Box Score' tab（旧 MatchDetailPage 只有 soccer 三 tab；Step 6 未生效前）。若 Step 6 已实现，此步应观察到测试**通过**——那说明顺序错了；本 plan 要求先 Step 7 写测试再 Step 6 实现。**执行顺序修正**：先做 Step 7（写测试），跑 Step 8 看失败，再回到 Step 6 实现，然后 Step 9 看通过。（若按文档线性执行已先做 Step 6，则 Step 8 直接绿，可跳过失败观察——但推荐严格 TDD：把 Step 6 的编辑推迟到 Step 8 观察失败之后。）

- [ ] **Step 9: 跑全量测试 + typecheck + lint 确认通过**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 全绿。soccer 的 MatchDetailPage 用例（`beforeEach` 复位到 `/fifa.world`）不受影响；NBA 用例显示 Boxscore/Stats、无 Lineup/Play、无 stage 标签。

- [ ] **Step 10: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(match-detail): BoxscoreTab + per-kind tab set in MatchDetailPage

Basketball match detail shows Box Score (per-team player tables, horizontally
scrollable) + Stats (reused TeamStatsTab); soccer keeps Stats/Play/Lineup. Tab
set and keyboard nav derive from detail.kind; the hero hides the stage/group
label for sports without stages. Adds i18n detail.boxscore x4.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ChocVWiknZXDoEx8ZcZHe3
EOF
)"
```

---

## 手动验证（控制器在全部任务后执行）

`npm run dev` 后浏览器（NBA 开发期为 off-season，scoreboard 当日可能空——用 `?dates=` 手测历史日期或直接看积分榜/详情）：

1. Header 切换器出现 `NBA`（World Cup / Premier League / NBA 三项）。
2. `/nba` → 只有 Matches tab（无 Bracket/Scorers）；无 stage 筛选 chips；积分榜显示东西部两会表（W/L/PCT/GB），行不可点击。
3. `/nba` 某场比赛卡点进 → `/nba/match/<slug>`：hero 无 stage 标签、显示比分与 statusText（如 "Final"）；tab 只有 Box Score + Stats；Box Score 每队一张横向可滚球员表（含 DNP 灰显行）。
4. `/fifa.world`、`/eng.1` 一切如旧（分组/淘汰赛/射手榜/阵容/进程 tab 均不变）。
5. 直接访问 `/nba/bracket` 或 `/nba/scorers` → 回落到 matches（Task 3a 的 effectiveSection 兜底 + URL 重写仍生效）。

## Self-Review

- **Spec 覆盖**：
  - §4.5（注册表 + seasonForDate(sport,d)）= Task 1；
  - §4.2（WCMatch→CompMatch + stage/group 可选 + statusText）= Task 2；
  - §4.1（SportAdapter 契约 + 判别联合）+ §4.4（useWorldCup→useCompetition，App 传 standings.kind）= Task 3；soccer 迁移「只搬不改」= Task 3 Step 5/7/11 明确保留断言语义。
  - basketball 适配器（§3 侦察形状）= Task 4；
  - §4.3 视图分叉（ConferenceStandings、MatchCard statusText、FixturesView season 隐藏 stage chips + standings.kind 分叉、顺手修 eng.1 孤 chip）= Task 5；
  - §4.3 MatchDetailPage per-kind tabs（Boxscore + 复用 Stats）+ §4.6 i18n（comp.nba/detail.boxscore/st.pct/st.gb）= Task 1/5/6 分别加。
- **非目标遵守（§2）**：无 NBA leaders（scorers 恒 `[]`，capabilities.scorers/leaders=false）；无 NBA bracket（capabilities.bracket=false，Task 3a 兜底回落 matches）；无 NBA Team/Player 页（App 只把 soccer groups 喂给 TeamPage/PlayerPage，basketball 得空数组）；basketball 积分榜行不可点击（ConferenceStandings 无 onClick/button/link，Task 5 Step 1 有专门断言）；无通用列描述符（两个具体组件 StandingsView + ConferenceStandings、TeamStatsTab + BoxscoreTab）。
- **类型名一致性**：`CompMatch` 字段列表在 Task 2 Interfaces 定义，Task 3（soccer transform 构造）、Task 4（basketball transform 构造，省略 stage/group、设 statusText）、Task 5（MatchCard statusText prop）用法一致；`StandingsData`/`ConferenceTable`/`MatchDetail`/`BoxscoreTable`/`SportAdapter` 全部只在 Task 3 的 `src/adapters/types.ts` 定义，后续 Task 4/5/6 从 `../adapters/types` 导入同名，无别名。`MatchDetail` 从 `types/index.ts` 迁出（Task 3 Step 2 删旧、Step 1 定义新联合），消费端（useMatchDetail/MatchDetailPage）导入路径在 Task 3 更新。
- **中间态编译绿**：Task 2 一次性完成全仓库 WCMatch→CompMatch（sed 覆盖源码+测试），松绑点（FixturesView stages Set、MatchCard prop）同任务修掉；Task 3 迁移中 App 先继续吃派生 `groups`（Step 12），FixturesView 到 Task 5 才换 `standings` prop——每个 commit 后 `npx vitest run && npm run typecheck && npm run lint` 全绿。
- **占位符扫描**：无 TBD/TODO/「类似 Task N」；每个组件/适配器给完整代码，改动给精确 before→after 引用当前行号；测试全用手工内联 ESPN JSON，无网络。
- **迁移纪律**：Task 2（更名）、Task 3（搬家）均为独立提交且断言语义不变；行为新增（basketball adapter、ConferenceStandings、statusText、BoxscoreTab、per-kind tabs）各自独立提交（Task 4/5/6）。
- **已解决的 spec 歧义**（见报告）：MatchDetail 联合迁移位置、ADAPTERS 类型形状、MatchDetailPage 初始 tab 收敛、测试路径污染复位。
