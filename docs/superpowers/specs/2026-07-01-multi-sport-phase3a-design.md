# 多体育 Phase 3a 设计：第二个足球联赛 + 切换器 + capabilities 门控

> 状态：设计待评审
> 日期：2026-07-01
> 前置：Phase 1（注册表 + Worker 按 key 路由）、Phase 2（URL 首段带赛事 + 数据 hook 串 comp）均已在 `feat/multi-sport-phase1`（PR #30）。
> 分支：沿用 `feat/multi-sport-phase1`。

## 1. 目标与范围

让「赛事切换器」首次落地：在注册表加入一个**赛季制足球联赛** `eng.1`（英超），据此逼出并实现：
- 一个 **CompetitionSwitcher** 下拉（Header 内，logo 旁）。
- **capabilities 门控**：按当前赛事的能力过滤 section tabs（英超无淘汰赛 → 隐藏 bracket；英超射手榜数据源为空 → 隐藏 scorers）。
- **season 形态渲染**：单张联赛表（20 队），而非世界杯的 12 组卡片 + 出线高亮。

World Cup（`fifa.world`）体验保持不变。

## 2. 非目标（YAGNI）

- **不做跨运动**（NBA 等）与 `SportAdapter` 契约——留到 Phase 3b。两个赛事都是足球，共用现有 soccer 转换，用不上跨运动适配器。
- **不做联赛射手榜**：ESPN 的 `eng.1` scoreboard 不带每队 `leaders`，现有射手榜路径对它为空。英超先隐藏射手榜；真正的联赛射手榜（需 `site.web.api` 的 leaders 端点 + 新解析 + 缓存）留作后续增强。
- **不改** Worker / dev proxy / `buildUrl`：Phase 1 已参数化，`eng.1` 直接复用（standings 省略 `level`、scoreboard 省略 `dates`）。

## 3. 关键数据事实（实测 ESPN）

- `eng.1` standings（`/apis/v2/sports/soccer/eng.1/standings?season=<y>`）：`children` 长度 = **1**（一张联赛表，20 队），stat 名与世界杯**完全相同**（`gamesPlayed/wins/ties/losses/pointsFor/pointsAgainst/pointDifferential/points`）。→ 现有 `useWorldCup` 的 children 解析器直接产出「1 个组 = 联赛表」。
- `eng.1` scoreboard competitor **不带 `leaders`** → 现有 top-scorers 派生对英超为空 → 隐藏射手榜（见 §2）。
- `eng.1` 无淘汰赛；`season.slug` 形如 `2026-27-english-premier-league` → `stageFromSlug` 落默认，league 无有意义 stage。

## 4. 架构与组件

### 4.1 Competition 注册表（`src/competitions.ts`）
新增 `eng.1` 条目：
```ts
'eng.1': {
  key: 'eng.1', sport: 'soccer', league: 'eng.1', label: 'comp.eng1',
  season: <当前 PL 赛季年，计划期对着 ESPN 校准>,
  // 无 standingsLevel（省略 → buildUrl 不加 level，实测返回联赛表）
  // 无 dates
  shape: 'season',
  capabilities: { bracket: false, scorers: false, leaders: false, lineups: true, boxscore: false },
}
```
`fifa.world` 的 capabilities 相应补全为真实值（`bracket:true, scorers:true, lineups:true` 等），供门控读取。

### 4.2 CompetitionSwitcher（新增 `src/components/CompetitionSwitcher.tsx`）
仿 `LanguageSwitcher` 的可访问自定义下拉（button + `role=listbox` + 点击外部关闭 + 方向键导航）。选项 = `Object.values(COMPETITIONS)`，显示 `t(comp.label)`，选中 → `navigate(pathFor({ kind:'section', comp:key, section:'matches' }))`。当前赛事高亮。只有 1 个赛事时也可正常显示（不特殊隐藏——为 Phase 3b 起就有 ≥2）。

### 4.3 Header（`src/components/Header.tsx`）
- 放入 `CompetitionSwitcher`（logo 右侧）。
- section tabs 按当前赛事 capabilities 过滤：`matches` 恒显；`scorers` 仅 `capabilities.scorers`；`bracket` 仅 `capabilities.bracket`。当前 comp 从 `useRouter().route.comp` → `COMPETITIONS[comp]`。

### 4.4 StandingsView（`src/components/StandingsView.tsx`）
加 season 模式：由注册表 `shape` 单一驱动（`shape==='season'` → 单表；`shape==='tournament'` → 保持分组卡）——`season` 时渲染单张联赛表，沿用现有行样式（名次、胜平负、进失球、净胜、积分、form pill），但**不**计算/高亮世界杯的「前 2 + 最佳第三名」出线。tournament 保持现状（分组卡 + 出线高亮）。用一个 `mode: 'group' | 'league'`（或读 shape）prop 分支。

### 4.5 FixturesView（`src/components/FixturesView.tsx`）
- season 形态：积分榜不再藏在「group 阶段筛选」后，而是作为「积分榜」区常显（在赛程上方）。tournament 保持现状（`stage==='group'` 时显示分组表）。
- 分支依据：当前 comp 的 `shape`（经 `useRouter().route.comp` + 注册表）。

### 4.6 禁用 section 兜底
Header 不显示无能力的 tab。若直接深链到禁用 section（如 `/eng.1/bracket`）：在渲染层兜底——当 `section` 需要的能力当前赛事没有时，回落渲染该赛事的 matches（App 或 FixturesView 判定 `capabilities`）。不新增重定向逻辑，保持简单。

### 4.7 数据 hook（`useWorldCup`）
基本复用（Phase 2 已 comp 参数化）。标准差异经 §3 已知能被现有解析器吸收：standings 的 1 个 child 产出联赛表；league 无 stage。**可选**：把 `useWorldCup` 更名为 `useCompetition` 以名副其实——判断为**非目标**（纯改名churn，行为不变），本期不做，留意即可。

### 4.8 i18n（`src/i18n/messages.ts`）
新增 `comp.fifa.world`、`comp.eng1` 四语键（`messages.test.ts` 强制键对齐）。

## 5. 数据流

`route.comp`（Phase 2）→ `COMPETITIONS[comp]` 提供 `shape` + `capabilities` → 驱动 Header tabs、FixturesView 积分榜呈现、StandingsView 模式、section 兜底。数据 URL 与页面 URL 的 comp 同源于 `route.comp`（Phase 2 保证不漂移）。

## 6. 测试

- `competitions.test.ts`：`eng.1` 存在、`buildUrl` 对 eng.1 产出正确 URL（standings 无 level、scoreboard 无 dates）。
- `CompetitionSwitcher.test.tsx`：渲染选项、选中导航到 `/<key>`、键盘/点击外部关闭（仿 LanguageSwitcher 测试）。
- `Header.test.tsx`：capabilities 门控——`fifa.world` 显示 bracket & scorers tab；`eng.1` 隐藏两者（用 useRouter/location 设定当前 comp）。
- `StandingsView.test.tsx`：league 模式渲染单表、无出线高亮；group 模式保持现状。
- `messages.test.ts`：四语键对齐（自动覆盖新键）。

## 7. 风险 / 待定

- **eng.1 season 值**：赛季交替期（2026-07）standings 的 season 年与 scoreboard 的当前窗口可能不一致。计划期对着 ESPN 校准一个能返回「有数据的联赛表 + 合理赛程」的 season 值；必要时接受「表是刚结束赛季、赛程是新赛季」的现实。
- **StandingsView 复杂度**：该组件目前深耦合 WC 出线逻辑；加 season 模式要干净分支，避免把 league 表也跑一遍 best-third 计算。
- **capabilities 是新的事实源**：门控逻辑要单点（读注册表），别在多处各判一次 shape。
- **off-season 空数据**：英超此刻可能少/无 live 赛，赛程/积分榜仍应正常渲染（空态已有处理）。
