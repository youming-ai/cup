# ESPN 隐藏 API 接入文档

> 面向 StreamCup（2026 世界杯 SPA）的 ESPN 数据接入参考。
> 既是「现状对照」（本项目已经怎么用），也是「扩展清单」（还能拿到什么）。
> 来源：本仓库 `worker/index.ts` / `vite.config.ts` / `src/utils/espn.ts` / `src/hooks/*`，
> 外加 [akeaswaran gist](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b) 与 [pseudo-r/Public-ESPN-API](https://github.com/pseudo-r/Public-ESPN-API)。

---

## 1. 总览

ESPN 的网页端 / App 调用一组**未公开但长期稳定**的内部 API。特点：

- **无需认证**：没有 API key、没有 OAuth、没有签名。直接 GET 即可。
- **返回结构化 JSON**：稳定多年，但**字段不保证**——同一份数据在不同接口/不同赛事下结构会有差异，必须防御性解析（本项目用 `obj()/arr()/str()` 强制兜底）。
- **非官方**：没有 SLA、没有文档、可能限流或改结构。生产环境务必走边缘缓存 + serve-stale（见 §7）。

### 三个常用域名

| 域名 | 风格 | 用途 | CORS |
|---|---|---|---|
| `site.api.espn.com` | **去规范化**（denormalized，数据直接内嵌） | scoreboard / standings / summary / teams / news | ✅ 开放，可浏览器直连 |
| `sports.core.api.espn.com` | **HATEOAS**（返回 `$ref` 链接，需逐层跟进 + 分页） | athletes / 统计 / 赔率 / play-by-play / 详细元数据 | ⚠️ 不保证，建议走 Worker 代理 |
| `cdn.espn.com` / `site.web.api.espn.com` / `now.core.api.espn.com` | 杂项 | CDN 实时包、搜索、实时新闻 | 视情况 |

> **本项目只用 `site.api.espn.com`**（足球数据全在这），通过 `worker/index.ts` 边缘缓存。
> `site.api` 是首选；只有 `site.api` 拿不到的细粒度数据（如逐分钟赔率、球员生涯统计）才需要下沉到 `core.api`。

---

## 2. URL 路由规则

### site.api（主力）

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/{resource}
```

- `{sport}`：`soccer` / `football` / `basketball` / `baseball` / `hockey` …
- `{league}`：联赛 slug，足球见 §4 表；NFL=`nfl`，NBA=`nba`，MLB=`mlb`，NHL=`nhl`。
- `{resource}`：`scoreboard` / `teams` / `news` / `summary` …

> **⚠️ standings 是例外**：路径里**没有 `site/`**——`/apis/v2/...standings`，不是 `/apis/site/v2/...standings`。本项目 `worker/index.ts:62` 就是这么写的，照搬即可。

### core.api（细粒度）

```
GET https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/{resource}
```

注意 site.api 是 `.../sports/soccer/{league}/...`，core.api 多一层 `leagues`：`.../sports/soccer/leagues/{league}/...`。

---

## 3. 本项目当前接入（现状对照）

浏览器永远只打**同源** `/api/wc/*`。prod 由 Worker 代理 + KV 缓存；dev 由 Vite 直接 proxy 到 ESPN（无 Worker）。**改路由时两边都要同步**（`worker/index.ts` 的 `SOURCES`/`ROUTES` 和 `vite.config.ts` 的 `rewrite`）。

| 同源路由 | 上游 ESPN URL | fresh / keep |
|---|---|---|
| `/api/wc/scoreboard` | `site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300` | 60s / 24h |
| `/api/wc/standings` | `v2/sports/soccer/fifa.world/standings?season=2026&level=3` | 300s / 24h |
| `/api/wc/summary?event={id}` | `site/v2/sports/soccer/fifa.world/summary?event={id}` | 30s / 24h |

- `dates=20260611-20260719`：覆盖 2026 世界杯整个赛程窗口（开幕到决赛）。单日用 `YYYYMMDD`，区间用 `YYYYMMDD-YYYYMMDD`。
- `limit=300`：一次拿全部 104 场（默认 limit 很小，足球必须显式调大）。
- `level=3`：standings 返回**分组层级**（`children` = 12 个小组表）。不传或更小的 level 会得到不同粒度。
- `season=2026`：赛季年。
- `event={id}`：来自 scoreboard 里每个 event 的 `id`（纯数字，Worker 用 `/^\d+$/` 校验）。

---

## 4. 足球联赛 slug

| 联赛 | slug |
|---|---|
| **FIFA 世界杯** | **`fifa.world`** |
| FIFA 女足世界杯 | `fifa.wwc` |
| 欧冠 | `uefa.champions` |
| 英超 | `eng.1` |
| 西甲 | `esp.1` |
| 德甲 | `ger.1` |
| 意甲 | `ita.1` |
| 法甲 | `fra.1` |
| 美职联 MLS | `usa.1` |
| 墨超 Liga MX | `mex.1` |
| NWSL | `usa.nwsl` |

足球通用接口（把 `{league}` 换成上表 slug）：

```
GET site/v2/sports/soccer/{league}/scoreboard      # 比分/赛程
GET site/v2/sports/soccer/{league}/news            # 新闻
GET site/v2/sports/soccer/{league}/teams           # 球队列表
GET     v2/sports/soccer/{league}/standings         # 积分榜（注意无 site/）
GET site/v2/sports/soccer/{league}/summary?event={id}  # 单场详情
```

---

## 5. 完整 Endpoint 目录

### 5.1 site.api v2（主力，浏览器可直连）

| Resource | 说明 |
|---|---|
| `scoreboard` | 比分 + 赛程 + 状态。支持 `dates` / `limit` / `seasontype` / `week` |
| `summary?event={id}` | 单场完整详情：阵容、boxscore 统计、play-by-play、关键事件、场馆 |
| `teams` | 联赛全部球队 |
| `teams/{id}` | 单队详情 |
| `teams/{id}/roster` | 球队名单 |
| `teams/{id}/schedule` | 球队赛程 |
| `athletes/{id}` | 球员资料 |
| `athletes/{id}/gamelog` | 球员逐场记录 |
| `news` | 新闻 |
| `injuries` | 伤病报告 |
| `transactions` | 转会/签约 |
| `calendar` | 赛季日历 |
| `standings` | 积分榜（**路径用 `/apis/v2/`，无 `site/`**） |

### 5.2 core.api v2（细粒度，HATEOAS + 分页）

基础：`https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/...`

**事件/单场**（`events/{id}/competitions/{cid}/...`）：

| Resource | 说明 |
|---|---|
| `odds` | 实时赔率 |
| `probabilities` | 胜率走势 |
| `plays` | 逐回合 play-by-play |
| `situation` | 当前局面 |
| `broadcasts` | 转播信息 |
| `predictor` | ESPN 赛果预测 |
| `competitors/{id}/statistics` | 参赛方统计 |

**球员/统计**：

| Resource | 说明 |
|---|---|
| `athletes` / `athletes/{id}` | 球员（分页列表 / 单个） |
| `athletes/{id}/statistics` | 生涯统计 |
| `athletes/{id}/statisticslog` | 逐场统计日志 |
| `athletes/{id}/vsathlete/{oppId}` | 对位 H2H |

**联赛级**：`standings` / `teams` / `seasons/{year}/teams` / `leaders` / `venues`。

> **core.api 的两个坑**：
> 1. 返回的是 `{"$ref": "https://.../..."}` 链接，不是内嵌对象——要拿真实数据得**再 fetch 一次 ref**。
> 2. 列表分页：响应带 `count` / `pageIndex` / `pageCount` / `pageSize`，用 `?page=N&limit=M` 翻页。
> 这就是为什么本项目优先用 site.api（一次拿全、数据内嵌）。core.api 仅在需要 site.api 拿不到的字段时再用。

### 5.3 其他域名

| 域名 / 接口 | 用途 |
|---|---|
| `site.web.api.espn.com/apis/search/v2?query={q}` | 全站搜索 |
| `cdn.espn.com/core/{sport}/scoreboard?xhr=1&league={league}` | CDN 实时比分包 |
| `cdn.espn.com/core/{sport}/playbyplay?xhr=1&gameId={id}` | 仅 play-by-play |
| `now.core.api.espn.com/v1/sports/news?limit={n}` | 实时新闻流（可按 `sport`/`leagues`/`team` 过滤） |

---

## 6. 常用查询参数

| 参数 | 例子 | 含义 |
|---|---|---|
| `dates` | `20260630` / `20260611-20260719` | 单日或区间（YYYYMMDD） |
| `limit` | `300` | 返回上限（足球必须调大，默认很小） |
| `season` | `2026` | 赛季年 |
| `seasontype` | `1`/`2`/`3` | 1=季前 2=常规 3=季后（世界杯用单一赛季，意义弱） |
| `level` | `3` | standings 层级（3=分组表） |
| `week` | `1` | 周次（美式赛事用） |
| `groups` | `8` | 分区/会议过滤（大学赛事用） |
| `event` | `727361` | summary 的赛事 id |
| `xhr` | `1` | cdn.espn.com 的 JSON 信号 |

---

## 7. 接入建议（直接复用本项目模式）

`worker/index.ts` 已经把生产级接入做完了，新接口照抄即可：

1. **同源代理 + KV 缓存**：浏览器只打 `/api/wc/*`，Worker 抓 ESPN 并把 body 存进 KV。好处：更快、绕开上游 CORS（尤其 core.api）、扛得住短时宕机。
2. **双 TTL**：`fresh`（多久内直接返回不回源）+ `keep`（KV 保留多久，≥fresh，用于宕机时返回旧副本）。KV 最小 TTL 60s。比分类 `fresh` 短（60s），积分榜长（300s）。
3. **请求合并（coalescing）**：用 in-flight `Map`，并发请求共享一次回源。
4. **serve-stale-on-outage**：上游挂了就返回 KV 里最后一份好数据，全无缓存才返回 502。
5. **stale-while-revalidate（前端）**：所有数据 hook 先显示缓存、后台刷新；每个 fetch 配 `AbortController`；轮询按页面可见性门控（scoreboard 30s，stream 60s，隐藏时暂停）。
6. **伪装 UA**：Worker 带桌面 Chrome 的 `user-agent` + `accept` 头（`worker/index.ts:113`），降低被拦概率。
7. **校验路径段**：`event` id 用 `/^\d+$/`，slug 用 `safeDecode` 兜底，永不 throw。

> **例外**：ppv.to（直播流）**不走 Worker**，浏览器直连——ppv.to 会指纹封禁数据中心 IP。ESPN 没这问题，放心走 Worker。

### 新增一个 ESPN 接口的步骤

1. `worker/index.ts` 的 `SOURCES` 加一条（url + fresh + keep），`ROUTES` 加同源路径映射。
2. `vite.config.ts` 的 `rewrite` 加同一条（dev 无 Worker，靠 Vite proxy）。
3. 写 hook：fetch 同源 `/api/wc/xxx`，用 `obj()/arr()/str()` 防御性解析成 `src/types` 里的类型。
4. 解析逻辑放 `src/utils/`，配套 `*.test.ts`。

---

## 8. 关键 JSON 结构速查（从本项目解析代码反推）

### scoreboard（`useWorldCup.ts`）

```
events[]                         # 每场比赛
  .id                            # → summary 的 event id
  .date                          # 开球 ISO 时间
  .season.slug                   # → 阶段（小组赛/淘汰赛），见 stageFromSlug
  .competitions[0]
    .competitors[]               # 两支队，靠 .homeAway = home/away 区分
      .team {id, displayName, logo}
      .score                     # 字符串比分
      .winner                    # bool（含点球胜者）
      .shootoutScore             # 点球大战比分
      .form                      # 近 5 场 W/D/L 字符串（积分榜没有，从这采集）
      .leaders[] → name='goals'  # 射手榜数据源
    .status.type {state, name, period}   # state→状态；name 含 AET/PEN
    .details[] .scoringPlay      # 进球事件（athletesInvolved[0]、type.text、clock）
    .venue {fullName, address.city}
```

### standings（`useWorldCup.ts`，`level=3`）

```
children[]                       # 12 个小组
  .name / .abbreviation          # "Group A" → "A"
  .standings.entries[]
    .team {id, displayName, logos[0].href}
    .stats[] {name, value}       # gamesPlayed/wins/ties/losses/
                                 # pointsFor/pointsAgainst/pointDifferential/points
```

> 注意：scoreboard 用 `team.logo`（字符串），standings 用 `team.logos[0].href`（数组）——`teamLogo()` 同时兼容两种。

### summary（`espn.ts` 的 `parseSummary`）

```
header.competitions[0].competitors[]   # 定 home/away id
boxscore.teams[].statistics[] {label, displayValue}   # 球队对比统计
rosters[]                              # 阵容（按队）
  .team {id, displayName}
  .formation                           # 阵型字符串
  .roster[] {jersey, athlete.displayName, position.abbreviation, starter,
             subbedIn/subbedOut, plays[]→yellowCard/redCard/substitution}
keyEvents[] {clock, text, team.id, type.text}   # 关键事件
commentary[] {time.displayValue, text}          # 文字直播
gameInfo.venue {fullName, address.city} / .attendance
```

---

## 9. 注意事项 / 已知坑

- **standings 路径无 `site/`**：`/apis/v2/...`，写错会 404。
- **足球默认 limit 小**：不传 `limit` 拿不全赛程，必须 `limit=300`（或更大）。
- **字段不稳定**：同一字段在不同接口可能在不同层级（如 `status.period` 有时在 `status.type.period`，本项目两处都读）；务必防御性解析。
- **core.api 是 ref + 分页**：别指望一次拿全，要跟 `$ref`、要翻页。
- **无认证 = 无承诺**：可能限流、可能改结构、随时可能下线。生产必须缓存 + serve-stale，别在前端裸连 core.api。
- **CORS**：site.api 开放可直连；core.api 不保证——统一走 Worker 最稳。
- **历史/未来数据**：scoreboard 拼 `?dates=YYYYMMDD` 即可取任意日期的赛程/比分。
