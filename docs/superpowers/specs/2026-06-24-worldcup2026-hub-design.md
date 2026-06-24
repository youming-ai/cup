# 世界杯 2026 观赛中心改造设计规范 (World Cup 2026 Hub Redesign)

* **日期**：2026-06-24
* **状态**：已批准（含 i18n 增补）
* **技术栈**：React 18, Vite, TypeScript, Tailwind CSS, lucide-react, Vitest。移除 hls.js。i18n 用零依赖自研方案。部署：Cloudflare Workers（Static Assets）。
* **取代**：本规范在现有 StreamCup 应用基础上改造，聚焦本届世界杯，不再做全球电视直播。

---

## 1. 目标 (Objective)

把应用从「世界杯 + 全球电视直播」收敛为**专注 2026 世界杯的观赛中心**，并加入多语言：

1. **直播**：仅保留足球赛事直播流（来源 `api.ppv.to`，精确过滤 `Football` 分类），iframe 播放。
2. **赛程**：全部 104 场赛程总览 + 分组积分榜（来源 `worldcup26.ir` API）。
3. **球场**：16 座承办球场的风格化地图 + 卡片。
4. **赛制**：48 队新赛制说明（静态科普）。
5. **多语言**：UI 文案支持 中/英/日/韩 四语切换；**API 数据保持英文原样，不翻译**。

UI 参考 Apple Sports：暗蓝近黑底、队色渐变卡（渐隐到黑）、磨砂半透明平台、圆角、超大粗比分数字、分段导航、对齐积分网格。

---

## 2. 移除范围 (Removals)

* **电视直播（iptv-org）整体移除**：
  * `useStreams` 中的 TV 抓取（streams.json / channels.json）与 `processedChannels` 逻辑。
  * `Channel` 类型、Player 的 hls.js 分支与 `<video>`、Sidebar 的频道模式、Header 的「电视频道」tab。
  * 从 `package.json` 移除 `hls.js` 依赖，代码不再 import。
* ppv.to 直播流**只保留足球分类**：**精确匹配** `category === 'Football'`（大小写不敏感），**不可**用 `includes('foot')`——否则会误纳 "American Football" / "Australian Football"。

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
  | `GET /get/teams` | 48 队（id→name/flag 映射） |
  | `GET /get/stadiums` | 16 座球场 |

### 3.2 ppv.to（保留，仅足球）
* `GET https://api.ppv.to/api/streams`，响应 `{ success, streams: Category[] }`，每个 `Category` 有 `{ category, id, streams: Stream[] }`。
* 取 `category === 'Football'` 那一类。其 `streams` 当前为本届世界杯的直播场次（`tag: "FIFA World Cup"`）。
* `Stream` 字段：`id, name, tag, source_tag, poster, colors[2], uri_name, starts_at, ends_at, locale, category_name, iframe, viewers, substreams[]`。
* `Substream` 字段：`id, name, tag, source_tag, locale, iframe`（`source_tag` 是广播商，如 FS1 / BBC/ITV / beIN / Telemundo）。
* `colors`（两个 hex）用于 Apple Sports 队色渐变卡；`poster` 为缩略图。

### 3.3 原始字段与坑（归一化必须处理）

**worldcup26 Game**：`id, home_team_id, away_team_id, home_score, away_score, group, matchday, local_date, stadium_id, finished, time_elapsed, type, home_team_name_en, away_team_name_en, home_team_label, away_team_label`
* `home_score`/`away_score`：字符串；未开赛通常为 `"0"`，**不能凭比分判断是否已赛**，必须看 `finished`/`time_elapsed`。
* `finished`：字符串 `"TRUE"` / `"FALSE"`。
* `time_elapsed`：大小写混用——`"finished"` / `"Finished"` / `"notstarted"`（比赛中可能为分钟数或 `"HT"` 等）。比较时一律转小写。
* `type`：`group | r32 | r16 | qf | sf | third | final`。
* `home_scorers`/`away_scorers`：畸形 stringified 数组（带花引号），**初版不解析**（YAGNI）。
* `local_date`：`"MM/DD/YYYY HH:mm"`。
* **淘汰赛占位场**：`home_team_id = "0"`、`away_team_id = "0"`，**无** `*_name_en`，改用 `home_team_label` / `away_team_label`（如 `"Runner-up Group A"`）。队名解析优先级：`*_name_en` → `*_label` → `"TBD"`。
* `group` 在淘汰赛里是大写阶段名（如 `"R32"`），与 `type` 小写并存。

**worldcup26 Group**：`name`, `teams[]`（`team_id, mp, w, d, l, pts, gf, ga, gd`，**均为字符串**）。

**worldcup26 Team**：`id`(字符串如 `"2"`), `name_en`, `flag`（URL，如 `https://flagcdn.com/w80/za.png`）, `fifa_code`, `groups`。

**worldcup26 Stadium**：`id, name_en, fifa_name, city_en, country_en, capacity(number), region`。

---

## 4. 数据层 (Hooks & Normalization)

### 4.1 `useWorldCup()`
并行请求 games/groups/teams/stadiums，归一化后返回。类型定义：

```typescript
type MatchStatus = 'finished' | 'live' | 'upcoming';

interface WCMatch {
  id: string;
  homeName: string; awayName: string;   // *_name_en → *_label → "TBD"
  homeFlag: string; awayFlag: string;    // 由 team map 补齐，缺失为 ""
  homeScore: number | null;              // 见下；upcoming → null
  awayScore: number | null;
  group: string;                         // 原始 group 字段（"A" / "R32"…）
  matchday: number;
  stadiumId: string;
  kickoff: Date | null;                  // 解析 local_date，失败 → null
  status: MatchStatus;
  stage: string;                         // type（group/r32/…）
}

interface WCStanding {
  teamId: string; name: string; flag: string;
  mp: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number;
}
interface WCGroup { name: string; standings: WCStanding[] } // 已按 pts→gd→gf 降序排序

interface WCStadium {
  id: string; name: string; fifaName: string; city: string; country: string; capacity: number; region: string;
}

useWorldCup(): {
  matches: WCMatch[]; groups: WCGroup[]; stadiums: WCStadium[];
  loading: boolean; error: string | null; refetch: () => void;
}
```

* **status 推导**（`wc.ts` 的 `deriveStatus`）：
  * `finished === "TRUE"` 或 `time_elapsed.toLowerCase() === "finished"` → `finished`
  * 否则 `time_elapsed.toLowerCase() === "notstarted"` → `upcoming`
  * 否则（有进行中的分钟/HT 等）→ `live`
* **score 归一化**：`status === 'upcoming'` → `null`；否则 `parseScore`（`""`/`"null"` → null，数字串 → number）。
* **team 映射**：用 `/get/teams` 建 `id → { name_en, flag }`；比赛行优先用自带 `*_name_en`，旗用 map 补；淘汰赛占位用 label，旗为 ""。
* **AbortController** 模式沿用现有 `useStreams`（取消在途请求、防竞态）。
* 任一端点失败给出可重试 `error`；四个端点用 `Promise.all`，整体失败即报错（参考数据需完整）。

### 4.2 `useStreams()` 瘦身
* 删除 TV 部分。仅取 ppv `Football` 分类。`Match` 增加 `poster?: string`、`colors?: string[]`。
* 签名简化为 `{ matches: Match[], loading, error, refetch }`。

### 4.3 归一化 helpers（纯函数，可测）—— `src/utils/wc.ts`
* `parseScore(s: string): number | null`
* `deriveStatus(finished: string, timeElapsed: string): MatchStatus`
* `parseKickoff(s: string): Date | null`（`MM/DD/YYYY HH:mm`）
* `sortStandings(teams: WCStanding[]): WCStanding[]`（pts→gd→gf 降序，稳定）

---

## 5. 多语言 (Internationalization, i18n)

* **零依赖自研**（不引 react-i18next）：UI 字符串集合有限，自研 ~50 行足够，符合 YAGNI。
* **语言**：`type Lang = 'en' | 'zh' | 'ja' | 'ko'`。默认从 `navigator.language` 推断（匹配前缀，否则回退 `en`），持久化到 `localStorage('lang')`。
* **结构**（`src/i18n/`）：
  * `messages.ts`：`const messages: Record<Lang, Record<string, string>>`，四语各一份 key→译文字典。
  * `index.tsx`：`LanguageContext`、`<LanguageProvider>`、`useLang(): { lang, setLang }`、`useT(): (key: string, vars?: Record<string,string|number>) => string`。
  * `t(key)` 缺失译文回退到 `en`，再回退到 key 本身；支持 `{var}` 简单插值。
* **范围**：所有**界面文案**走 `t('key')`（导航名、按钮、状态 LIVE/FT、错误/空态、赛制说明、表头等）。
* **不翻译**：API 返回的队名、赛事名、球场名、城市、阶段缩写等数据原样展示（英文）。
* **切换器**：Header 内一个语言切换组件（地球图标 + 四语，`EN / 中 / 日 / 한`）。切换即时生效（Context 重渲染），并写 `<html lang>`。
* `main.tsx` 用 `<LanguageProvider>` 包裹 `<App/>`。

---

## 6. 导航与路由 (Navigation)

* 顶部 Apple Sports 式分段导航，4 主区：**直播 / 赛程 / 球场 / 赛制**（文案经 i18n）。
* **积分榜**作为「赛程」内的子切换（`赛程 | 积分`），不单列 tab。
* 轻量路由：`view` 用 React state，同步到 URL `?view=live|fixtures|stadiums|format`；直播区保留 `?match=<slug>` 分享。**不引入 react-router**。
* 切换主区时重置子状态（筛选/搜索），更新 URL。

---

## 7. 组件 (Components)

Apple Sports 卡片语言：暗蓝近黑底、磨砂半透明平台（`bg-white/5` + `backdrop-blur`）、`rounded-2xl/3xl`、队色渐变（来自 ppv `colors` 或队旗）渐隐到黑、比分用大号粗体 `tabular-nums`、状态胶囊（LIVE 红点脉动 / FT 灰 / 开球时间）。

| 组件 | 职责 | 依赖 |
|------|------|------|
| `Header` | 4 区分段导航（含移动端）；品牌；**语言切换器** | view state, i18n |
| `LanguageSwitcher` | 四语切换（EN/中/日/한） | i18n |
| `MatchCard` | 三栏比分卡：主队(旗+名) — 比分/时间/状态 — 客队；队色渐变 | `WCMatch` 或直播 `Match` |
| `LiveView` | 足球直播流列表 + iframe 播放器（复用现有 Player 的 iframe 部分），`?match=` 分享 | `useStreams`, i18n |
| `Sidebar` | 直播区流列表（仅足球，不再有频道模式） | `Match`, i18n |
| `Player` | 仅 iframe 渲染 + 信源切换（删 hls/video/Channel） | `Match`, i18n |
| `FixturesView` | 104 场：按 matchday 分段、按分组/阶段筛选；顶部 `赛程 \| 积分` 子切换 | `useWorldCup`, i18n |
| `StandingsView` | 12 组积分网格（P/W/D/L/GF/GA/GD/Pts），前 2 名晋级线高亮 | `useWorldCup`, i18n |
| `StadiumsView` | 风格化 SVG 地图打点 + 16 张球场卡（名/城市/容量/region/fifa_name） | `useWorldCup`, i18n |
| `FormatGuide` | 静态：12 组 × 4 队 → 每组前 2 + 最佳 8 个第三名 → 32 强淘汰赛，简明图示（文案 i18n） | i18n |

---

## 8. 视觉 (Visual Direction，落地 Apple Sports)

* **底色**：暗蓝近黑（沿用/微调现有 `night` token）。区块顶部可用队色/赛色渐变渐隐到底色。
* **卡片**：磨砂平台 `bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl`；比分卡用 ppv `colors[0]→colors[1]` 或两队色做 `bg-gradient` 渐隐到黑。
* **比分**：超大粗体等宽 `text-4xl font-bold tabular-nums`；队名小一号常规；标签更小、`uppercase`、次级色。
* **状态**：LIVE（红点脉动 + 轻微渐变流动，respect `prefers-reduced-motion`）、FT（灰胶囊）、未赛（开球时间 chalkdim）。
* **积分**：单一对齐网格（避免分裂子表错位），表头用次级色，`tabular-nums` 锁列，前 2 行晋级高亮（pitch 色左条）。
* 新区块收敛 broadcast 取景角标等重装饰；直播播放器可保留轻量 LIVE bug。

---

## 9. 异常 / 加载 / 空态 (Error Handling)

* 每个区独立 loading（文案 i18n）与 error（可重试）。
* 赛程/球场为静态参考数据，加载失败给重试；直播流失败不阻塞其它区。
* 空筛选结果显示友好提示（i18n）。

---

## 10. 测试 (Testing)

* `src/utils/wc.ts` 全部纯函数出 vitest 单测：`parseScore`（空串/"null"/正常/非数字）、`deriveStatus`（TRUE / finished/Finished 大小写 / notstarted / live）、`parseKickoff`（合法/非法）、`sortStandings`（排序与并列稳定）。
* `src/i18n` 出测试：`t` 命中、缺失回退 en、再回退 key、`{var}` 插值。
* `MatchCard` 渲染断言：finished 显比分、upcoming 显开球时间、live 显状态。
* 沿用 `npm run build`（tsc 严格模式：`noUnusedLocals`/`noUnusedParameters`、`react-jsx` 故组件不 `import React`）+ `vitest run` 作为验收。

---

## 11. 目录结构 (Directory)

```
src/
├── components/
│   ├── Header.tsx            # 改：4 区导航 + 语言切换器
│   ├── LanguageSwitcher.tsx  # 新
│   ├── MatchCard.tsx         # 新
│   ├── LiveView.tsx          # 新（聚合 Sidebar+Player）
│   ├── Sidebar.tsx           # 改：仅足球流列表
│   ├── Player.tsx            # 改：仅 iframe
│   ├── FixturesView.tsx      # 新
│   ├── StandingsView.tsx     # 新
│   ├── StadiumsView.tsx      # 新
│   └── FormatGuide.tsx       # 新
├── hooks/
│   ├── useStreams.ts         # 改：仅足球 + poster/colors
│   └── useWorldCup.ts        # 新
├── i18n/
│   ├── index.tsx             # 新：Context/Provider/useT/useLang
│   ├── messages.ts           # 新：en/zh/ja/ko 字典
│   └── messages.test.ts      # 新
├── utils/
│   ├── helpers.ts            # 保留 slugify
│   ├── wc.ts                 # 新：归一化
│   └── wc.test.ts            # 新
├── types/index.ts            # 改：去 Channel，加 WC* 与 Match.poster/colors
├── main.tsx                  # 改：包 LanguageProvider
└── App.tsx                   # 改：view 路由
```

## 12. 部署 (Deployment — Cloudflare Workers)

* **形态**：纯静态 SPA，跑在 **Cloudflare Workers Static Assets**（非 Pages）。两个数据 API 均 `Access-Control-Allow-Origin: *`，浏览器直连，**无需 Worker 服务端代理/脚本**。
* **配置**：`wrangler.jsonc` 仅声明静态资源：
  ```jsonc
  {
    "name": "streamcup-wc2026",
    "compatibility_date": "2026-06-01",
    "assets": {
      "directory": "./dist",
      "not_found_handling": "single-page-application"  // SPA 路由回退到 index.html
    }
  }
  ```
  无 `main`（无 Worker 脚本，纯资源服务）。
* **依赖**：`wrangler` 加入 devDependencies。
* **脚本**：`package.json` 增加 `"deploy": "npm run build && wrangler deploy"`。
* **实现期注意**：编写/校验 wrangler 配置时加载 `wrangler` 技能以对齐当前语法（Static Assets 字段名随版本演进）。
* **CSP/字体**：Google Fonts 由 `index.html` 外链加载；Workers 不加额外 CSP 限制，沿用现状即可。

## 13. 非目标 (Out of Scope, YAGNI)

* 进球者明细解析（数据畸形，初版不做）。
* 翻译 API 数据（明确不做）。
* 直播流与具体 fixture 的自动关联匹配（可后续做）。
* 用户登录、捐赠、日记/Wrapped 等社交功能。
* 真·交互地图瓦片；复数/性数等复杂 i18n 语法（仅简单插值）。
