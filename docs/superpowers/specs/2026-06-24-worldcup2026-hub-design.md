# 世界杯 2026 观赛中心改造设计规范 (World Cup 2026 Hub Redesign)

* **日期**：2026-06-24
* **状态**：已批准（待 spec 复核）
* **技术栈**：React 18, Vite, TypeScript, Tailwind CSS, hls.js→移除, lucide-react, Vitest
* **取代**：本规范在现有 StreamCup 应用基础上改造，聚焦本届世界杯，不再做全球电视直播。

---

## 1. 目标 (Objective)

把应用从「世界杯 + 全球电视直播」收敛为**专注 2026 世界杯的观赛中心**：

1. **直播**：仅保留足球赛事直播流（来源 `api.ppv.to`，过滤 Football 分类），iframe 播放。
2. **赛程**：全部 104 场赛程总览 + 分组积分榜（来源 `worldcup26.ir` API）。
3. **球场**：16 座承办球场的风格化地图 + 卡片。
4. **赛制**：48 队新赛制说明（静态科普）。

UI 参考 Apple Sports：暗色、圆角卡片、队旗色彩点缀、大号比分、状态胶囊。

---

## 2. 移除范围 (Removals)

* **电视直播（iptv-org）整体移除**：
  * `useStreams` 中的 TV 抓取（streams.json / channels.json）与 `processedChannels` 逻辑。
  * `Channel` 类型、Player 的 hls.js 分支与 `<video>`、Sidebar 的频道模式、Header 的「电视频道」tab。
  * 依赖 `hls.js` 从代码中移除（保留 package.json 中亦可，但代码不再 import；为干净起见从 package.json 移除）。
* ppv.to 直播流**只保留 Football 分类**（`category_name` 含 "football"/"soccer"，大小写不敏感）。

---

## 3. 数据源 (Data Sources)

### 3.1 worldcup26.ir API
* **基址**：`https://worldcup26.ir`
* **鉴权**：GET 端点无需鉴权。
* **CORS**：`Access-Control-Allow-Origin: *`，浏览器可直接请求，无需代理。
* **使用端点**：
  | 端点 | 用途 |
  |------|------|
  | `GET /get/games` | 104 场赛程（含比分、球场、阶段） |
  | `GET /get/groups` | 12 组积分（每队 mp/w/d/l/pts/gf/ga/gd） |
  | `GET /get/teams` | 48 队（id→name/flag/group 映射） |
  | `GET /get/stadiums` | 16 座球场 |

### 3.2 ppv.to（保留，仅足球）
* `GET https://api.ppv.to/api/streams`，过滤出足球分类的直播场次。

### 3.3 原始数据字段与坑（归一化必须处理）
* **Game**：`id, home_team_id, away_team_id, home_score, away_score, group, matchday, local_date, stadium_id, finished, time_elapsed, type, home_team_name_en, away_team_name_en`
  * `home_score`/`away_score`：字符串；未开赛为空字符串或 `"null"`。
  * `finished`：字符串 `"TRUE"` / 其它。
  * `home_scorers`/`away_scorers`：畸形 stringified 数组（带花引号），**初版不解析**（YAGNI）。
  * `local_date`：`"MM/DD/YYYY HH:mm"`。
  * `type`：`"group"` 或淘汰赛阶段（如 round-of-32 等）。
* **Group**：`name`, `teams[]`（`team_id, mp, w, d, l, pts, gf, ga, gd`，均为字符串）。
* **Team**：`id/_id, name, flag, group`。
* **Stadium**：`id, name_en, fifa_name, city_en, country_en, capacity(number), region`。

---

## 4. 数据层 (Hooks & Normalization)

### 4.1 `useWorldCup()`
并行请求 games/groups/teams/stadiums，归一化后返回：

```typescript
interface WCMatch {
  id: string;
  homeId: string; awayId: string;
  homeName: string; awayName: string;   // 来自 *_name_en
  homeFlag?: string; awayFlag?: string;  // 由 teams 映射补齐
  homeScore: number | null;              // 解析失败/未赛 → null
  awayScore: number | null;
  group: string;
  matchday: number;
  stadiumId: string;
  kickoff: Date | null;                  // 解析 local_date
  finished: boolean;                     // "TRUE" → true
  status: 'finished' | 'live' | 'upcoming';
  stage: string;                         // type
}

interface WCStanding { teamId: string; name: string; flag?: string;
  mp: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number; }
interface WCGroup { name: string; standings: WCStanding[] } // 已按 pts→gd→gf 排序
interface WCStadium { id: string; name: string; fifaName: string; city: string; country: string; capacity: number; region: string }

useWorldCup(): { matches: WCMatch[]; groups: WCGroup[]; stadiums: WCStadium[];
  loading: boolean; error: string | null; refetch: () => void }
```

* **status 推导**：`finished` → finished；否则若 `time_elapsed` 非 finished 且 kickoff 已过且未完赛 → live；否则 upcoming。（保守：拿不准归 upcoming。）
* **AbortController** 模式沿用现有 `useStreams`（取消在途请求、防竞态）。
* 单一数据源失败时给出可重试 error；部分成功的容错策略沿用现有 useStreams 思路。

### 4.2 `useStreams()` 瘦身
* 删除 TV 部分，仅返回足球 `matches`，签名简化为 `{ matches, loading, error, refetch }`。

### 4.3 归一化 helpers（可测）
放入 `src/utils/wc.ts`：
* `parseScore(s: string): number | null`
* `parseFinished(s: string): boolean`
* `parseKickoff(s: string): Date | null`
* `sortStandings(teams): WCStanding[]`（pts→gd→gf 降序）

---

## 5. 导航与路由 (Navigation)

* 顶部 Apple Sports 式分段导航，4 主区：**直播 / 赛程 / 球场 / 赛制**。
* **积分榜**作为「赛程」内的子切换（`赛程 | 积分`），不单列 tab。
* 轻量路由：`view` 用 React state，并同步到 URL `?view=live|fixtures|stadiums|format`；直播区保留 `?match=<slug>` 分享。**不引入 react-router**。
* 切换主区时重置子状态（筛选/搜索），更新 URL。

---

## 6. 组件 (Components)

所有卡片采用 Apple Sports 语言：`rounded-2xl`、队旗做色彩点缀、比分大号等宽数字、状态胶囊（LIVE 红点 / FT / 开球时间）。

| 组件 | 职责 | 依赖 |
|------|------|------|
| `Header` | 4 区分段导航（含移动端）；品牌 | view state |
| `MatchCard` | 单场比分卡：主队(旗+名) — 比分/时间 — 客队，状态胶囊 | `WCMatch` |
| `LiveView` | 足球直播流列表 + iframe 播放器（复用现有 Player 的 iframe 部分），`?match=` 分享 | `useStreams` |
| `FixturesView` | 104 场：按 matchday 分段、按分组/阶段筛选；顶部 `赛程 \| 积分` 子切换 | `useWorldCup` |
| `StandingsView` | 12 组积分表（P/W/D/L/GF/GA/GD/Pts），前 2 名晋级线高亮 | `useWorldCup` |
| `StadiumsView` | 美/墨/加风格化 SVG 地图打点 + 16 张球场卡（名/城市/容量/region/fifa_name） | `useWorldCup` |
| `FormatGuide` | 静态：12 组 × 4 队 → 每组前 2 + 最佳 8 个第三名 → 32 强淘汰赛，附简明图示 | 静态 |

* **Player 简化**：删 hls/video/Channel，仅保留 iframe 渲染（沿用上一次去掉 sandbox 的版本）与信源切换。
* `Sidebar` 在直播区继续作为流列表；不再有频道模式。

---

## 7. 视觉 (Visual Direction)

* 暗色基底沿用现有 token（night/panel/line/chalk/pitch/live）。
* 向 Apple Sports 收敛：圆角加大（`rounded-2xl`），比分用大号 `font-mono tabular-nums`，队旗（emoji 或 flag 字段）作主要色彩来源，去掉新区块里的 broadcast 取景角标等重装饰，仅直播播放器可保留轻量 LIVE bug。
* 状态胶囊：LIVE（红点+脉动，respect reduced-motion）、FT（灰）、开球时间（chalkdim）。

---

## 8. 异常 / 加载 / 空态 (Error Handling)

* 每个区独立 loading（骨架或 "TUNING SIGNAL…" 文案）与 error（可重试）。
* 赛程/球场为静态参考数据，加载失败给重试；直播流失败不阻塞其它区。
* 空筛选结果显示友好提示。

---

## 9. 测试 (Testing)

* `src/utils/wc.ts` 的归一化函数全部出 vitest 单测（parseScore 边界：空串/"null"/正常；parseFinished；parseKickoff；sortStandings 排序与并列）。
* `MatchCard` 一个渲染快照/断言测试（已赛显示比分、未赛显示时间、live 显示状态）。
* 沿用现有 `npm run build`（tsc 严格模式）+ `vitest run` 作为验收。

---

## 10. 目录结构 (Directory)

```
src/
├── components/
│   ├── Header.tsx          # 改：4 区导航
│   ├── MatchCard.tsx       # 新
│   ├── LiveView.tsx        # 新（聚合 Sidebar+Player）
│   ├── Sidebar.tsx         # 改：仅足球流列表
│   ├── Player.tsx          # 改：仅 iframe
│   ├── FixturesView.tsx    # 新
│   ├── StandingsView.tsx   # 新
│   ├── StadiumsView.tsx    # 新
│   └── FormatGuide.tsx     # 新
├── hooks/
│   ├── useStreams.ts       # 改：仅足球
│   └── useWorldCup.ts      # 新
├── utils/
│   ├── helpers.ts          # 保留 slugify
│   └── wc.ts               # 新：归一化 + 测试
├── types/index.ts          # 改：去 Channel，加 WC* 类型
└── App.tsx                 # 改：view 路由
```

## 11. 非目标 (Out of Scope, YAGNI)

* 进球者明细解析（数据畸形，初版不做）。
* 直播流与具体 fixture 的自动关联匹配（可后续做）。
* 用户登录、捐赠、日记/Wrapped 等 worldcup26/cupdiary 的社交功能。
* 真·交互地图瓦片。
