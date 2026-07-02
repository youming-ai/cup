# 多体育 Phase 3b 设计：NBA 跨运动 + SportAdapter 契约提取

> 状态：设计已获批（方向 A）
> 日期：2026-07-02
> 前置：Phases 1–3a 已合入 main（PR #30）。分支：`feat/multi-sport-phase3b`（自 main 916f15b）。
> 模型分工（用户指定）：实现计划由 opus 编写；实现代码由 sonnet 编写。

## 1. 目标与范围

加入第一个非足球赛事 **NBA**（`basketball/nba`，赛季制），并借此从 soccer + basketball 两个真实样本提取 `SportAdapter` 契约——这是整个多体育改造刻意延迟到现在的核心抽象。

NBA 深度 =「标准」（用户已选）：
- **赛程**：比赛卡（节次/OT 状态、最终比分）。
- **积分榜**：东西部两会表（W / L / PCT / GB 列）。
- **比赛详情**：球员 boxscore 表（MIN/PTS/FG/3PT/FT/REB/AST/TO…）+ 球队统计对比。

三个既有赛事（世界杯、英超）行为不变。

## 2. 非目标（YAGNI，全部有明确理由）

- **NBA 赛季 leaders 榜**：与英超射手榜同一个 core-API 聚合成本问题，同批 backlog（2026-07-02 用户决定）。`capabilities.leaders=false`。
- **NBA 季后赛 bracket**：赛季性内容，`capabilities.bracket=false`。
- **NBA 的 Team/Player 页**：现有 TeamPage/PlayerPage 是足球形状（小组积分、进球记录）。3b 中 basketball 积分榜行**不可点击**进队页；比赛卡可点进详情。后续需要再做。
- **通用列描述符渲染器**：设计口头稿曾提「StandingsView 变通用表格渲染器」，落笔时修正（见 §4.3 的偏差说明）——两个运动 = 两个具体表格组件，第三个运动出现再抽描述符。
- **直播流架构**：ppv 流按 slug 匹配，NBA 大概率匹配不到，自然为空，不改。

## 3. 侦察事实（2026-07-02 实测 ESPN）

| 维度 | 足球 | NBA |
|---|---|---|
| scoreboard 信封 | events→competitions→competitors（homeAway/score/team/winner） | **相同** |
| 比赛状态 | halftime、45'+ | `status.period`（4=Q4，>4=OT）、`displayClock`、`status.type.shortDetail`（"Final"）；competitor 有 `linescores`、内嵌 `leaders`（points/rebounds/assists） |
| standings 信封 | `children[]`（12 组或 1 联赛表）→ `standings.entries[]` → `stats[{name,value}]` | **相同**：`children` = Eastern/Western Conference（各 15 队） |
| standings 行 stats | gamesPlayed/wins/ties/losses/pointsFor/pointsAgainst/pointDifferential/points | **wins/losses/leagueWinPercent/gamesBehind**（无 ties/points） |
| summary | rosters（阵容）+ commentary + keyEvents + boxscore.teams | **无 rosters/commentary/keyEvents**；`boxscore.players` = 每队球员统计表（`labels[]` + `athletes[{athlete,starter,didNotPlay,stats[]}]`，15 人）+ `boxscore.teams`（与足球同构）+ `plays` |
| 赛季键 | **起始年**（2025-26=2025），8 月翻转 | **结束年**（2025-26=2026），10 月翻转 |
| Worker/dev proxy | — | **零改动**：`/api/nba/<resource>` 注册即通（Phase 1 红利）。scoreboard 无 dates → ESPN 返回当日窗口，off-season 为空由现有空态处理 |

## 4. 架构（方向 A：适配器 = 转换；列表视图共享外壳、详情/积分表按运动分叉）

### 4.1 SportAdapter 契约（从两样本提取的真实形状）

关键认识：足球的三个数据面**互相交叉引用**（matches 的组号来自 standings；standings 的 form 来自 scoreboard；scorers 需要两者的 team map）——所以契约不是三个独立 transform，而是「配对转换 + 独立 summary 转换」：

```ts
// src/adapters/types.ts（契约唯一定义点）
interface SportAdapter {
  // scoreboard + standings 一次配对转换（保留跨引用能力）
  transform(scoreboardJson: unknown, standingsJson: unknown): {
    matches: CompMatch[];
    standings: StandingsData;
    scorers: TopScorer[];   // 非足球运动返回 []
  };
  transformSummary(json: unknown): MatchDetail;
}

type StandingsData =
  | { kind: 'soccer'; groups: WCGroup[] }        // 供现有 StandingsView / useBracket / Team、Player 页
  | { kind: 'basketball'; conferences: ConferenceTable[] };

interface ConferenceTable {
  name: string; // 'Eastern Conference' | ...
  rows: { teamId: string; name: string; logo: string; w: number; l: number; pct: string; gb: string }[];
}

type MatchDetail =
  | ({ kind: 'soccer' } & 现有 MatchDetail 字段)   // stats/allPlays/keyPlays/lineups/venue/attendance
  | { kind: 'basketball'; teamStats: TeamStatRow[]; playerTables: BoxscoreTable[]; venue: string; attendance: number | null };

interface BoxscoreTable {
  teamId: string;
  teamName: string;
  labels: string[];       // ESPN 原样：MIN PTS FG 3PT FT REB AST TO …
  players: { name: string; starter: boolean; dnp: boolean; stats: string[] }[];
}
```

- `src/adapters/soccer.ts`：现 `useWorldCup` 的大转换 + `espn.ts` 的 `parseSummary` 迁入（逻辑不变，纯搬家）。
- `src/adapters/basketball.ts`：新写，防御性 `obj()/arr()/str()` 风格与 soccer 一致。
- `ADAPTERS: Record<Sport, SportAdapter>`（当前 soccer + basketball 两键；其它 Sport 值待有赛事时再加）。

### 4.2 类型更名 + 松绑（一次纯机械提交）

- `WCMatch` → **`CompMatch`**（`Match` 已被流类型占用）。`stage`、`group` 变可选（NBA 不提供）；新增可选 `statusText?: string`（NBA 用 ESPN `status.type.shortDetail`，不自造节次文案）。
- `WCGroup`/`WCStanding`/`TopScorer` 保名（仍是 soccer 领域类型，被 bracket/team/player 页消费）。
- tsc 全量兜底更名安全。

### 4.3 视图

- **StandingsView（偏差说明）**：不做通用列描述符。`StandingsData.kind` 分叉——`soccer` 走现有 group/league 两模式（零改动）；`basketball` 走新的 `ConferenceStandings` 组件（两张会表：W/L/PCT/GB，样式复用现有表行 class，行不可点击）。第三个运动出现时再抽公共描述符。
- **MatchCard**：有 `statusText` 时（live/finished）优先显示它；无 group/stage 时不渲染对应 chip（现有条件渲染已兼容，验证即可）。
- **MatchDetailPage**：外壳共享（比分头/流播放器/tab 条）；tab 集由 `detail.kind` 决定——soccer = 现有 Stats/Lineups/Plays；basketball = **Boxscore**（新 `BoxscoreTable` 组件，横向可滚表格）+ Stats（复用现有 TeamStatRow 对比表）。
- **FixturesView**：`shape==='season'` 时隐藏 stage 筛选 chips（顺手修掉 eng.1 现在孤零零的「Group stage」chip）；积分榜区按 `standings.kind` 渲染（soccer league 表 / basketball 会表）。

### 4.4 数据 hook

`useWorldCup` → **`useCompetition(comp)`**（更名此时才名副其实）：SWR/轮询/abort/缓存机器保留，转换体换成 `ADAPTERS[COMPETITIONS[comp].sport].transform(sbJson, stJson)`。返回 `{ matches, standings: StandingsData, scorers, loading, error, refetch }`。App 向 soccer-only 页（BracketView/TeamPage/PlayerPage）传 `standings.kind==='soccer' ? standings.groups : []`。`useMatchDetail` 的解析换成 `adapter.transformSummary`。

### 4.5 注册表 + 赛季键

- 加 `nba`：`{ key:'nba', sport:'basketball', league:'nba', label:'comp.nba', shape:'season', capabilities:{ bracket:false, scorers:false, leaders:false, lineups:false, boxscore:true } }`，`season` 省略。
- `seasonForDate(d)` → **`seasonForDate(sport, d)`**：soccer = 8 月翻转取起始年（现逻辑）；basketball = 10 月翻转取**结束年**（2026-10 起 → 2027；1–6 月 → 当年；7–9 月 off-season → 当年，即刚结束赛季）。`buildUrl` 传 `c.sport`。

### 4.6 i18n

新 key ×4 语言：`comp.nba`、`detail.boxscore`（tab 名）、`st.w/l` 已有则复用、新增 `st.pct`、`st.gb`。`messages.test.ts` 把关。

## 5. 测试

- 适配器：两运动各用**手工内联的最小 ESPN JSON 形状**（沿现有 useWorldCup.test 模式，测试不打网络）钉死 transform / transformSummary；soccer 适配器迁移后现有 useWorldCup 测试语义全数保留（改名/搬家不改断言本质）。
- `seasonForDate(sport, d)` 边界：足球 7/31 vs 8/1；篮球 9/30 vs 10/1、1 月、6 月。
- ConferenceStandings / BoxscoreTable 组件测试；MatchDetailPage 按 kind 分叉的 tab 集测试；FixturesView season 形态无 stage chips。
- 全量：typecheck（app+worker）+ lint + `npx vitest run`。

## 6. 风险

- **搬家型重构的回归面**：useWorldCup→adapter 迁移是 3b 最大风险。纪律：迁移提交只搬不改（测试跟着搬），行为改动一律独立提交。
- **StandingsData 联合的消费端**：App/FixturesView/TeamPage 等处从 `groups: WCGroup[]` 变为联合，tsc 会逐点暴露，逐点处理。
- **NBA off-season 空数据**（开发期 7 月）：scoreboard 当日为空是常态，空态已有；开发验证用 `?dates=` 手测历史日期。
- **`useWorldCup.test` 体量**（~320 行）迁移时保持绿是硬指标。
