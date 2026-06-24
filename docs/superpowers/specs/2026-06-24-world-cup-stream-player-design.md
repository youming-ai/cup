# 世界杯体育直播网页应用设计规范 (World Cup Live Streaming Web App Design Specification)

*   **日期**：2026-06-24
*   **状态**：已提议
*   **技术栈**：React, Vite, Tailwind CSS, HeroUI, Lucide React

---

## 1. 目标与背景 (Objective & Background)
本项目旨在构建一个极简、现代且响应式的主页，允许用户浏览并在线观看世界性体育赛事以及全球电视直播频道：
1. **赛事直播 (Live Events)**：通过对接公开的第三方 API (`https://api.ppv.to/api/streams`) 获取赛事的直播源，利用安全的 `<iframe>` 嵌入播放器来实现即时观赛。
2. **24/7 电视直播 (TV Channels)**：通过对接 `iptv-org` 的官方 JSON API 获取全球电视直播源，并基于 `hls.js` 在页面内实现原生的 HLS 视频流播放。
---

## 2. 系统架构与数据源 (Architecture & Data Source)

### 2.1 数据源接口
应用将直接请求以下两个主要数据源：

#### A. 体育赛事直播源 (Live Events)
*   **URL**：`https://api.ppv.to/api/streams`
*   **格式**：JSON
*   **数据结构**：返回一个分类数组（例如 Football, Basketball, Baseball），其中 streams 包含 `id`, `name`, `iframe`, `viewers` 以及 `substreams`（子信号源列表）。

#### B. 24/7 电视直播源 (TV Channels)
*   **流媒体接口 URL**：`https://iptv-org.github.io/api/streams.json`
*   **频道属性接口 URL**：`https://iptv-org.github.io/api/channels.json`
*   **格式**：JSON
*   **数据结构**：
    *   `streams.json` 返回包含 `channel`（频道 ID）, `title`（频道名称）, `url`（.m3u8 播放地址）等属性的数组。
    *   `channels.json` 返回包含频道分类（categories）、LOGO（logo）等属性的列表，前端可使用 `channel` ID 进行级联匹配以展示频道分类与标志。
### 2.2 播放技术选择
*   **赛事直播 (Live Events)**：使用 `<iframe>` 嵌入。
    *   **安全沙盒设置**：为了防止嵌入网页包含恶意广告弹窗或跳转，`<iframe>` 必须设置适当 a的 `sandbox` 属性：
        ```html
        <iframe
          src={selectedIframeUrl}
          allowFullScreen
          allow="autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          class="w-full h-full border-none"
        />
        ```
        *注：移除 `allow-top-navigation` 以防止广告页面强行跳转宿主页面。*
*   **24/7 电视直播 (TV Channels)**：使用 `<video>` + `hls.js`。
    *   直接加载来自 `streams.json` 的 `.m3u8` 地址。
    *   通过 `hls.js` 库在不支持原生 HLS 的浏览器（如 Chrome, Firefox）中播放 m3u8。如果流加载失败，前端捕获媒体错误并给出跨域或下线提示。

---

## 3. UI 界面设计与布局 (UI Layout & Components)

页面采用全宽响应式布局。在大屏下为左右分栏模式，在移动端小屏下为上下单栏布局。

### 3.1 页面分区 (Layout Sections)

1.  **顶部导航栏 (Navbar)**
    *   **左侧**：StreamCup 品牌 Logo 和标题。
    *   **中间/右侧**：大类目切换（HeroUI `Tabs`：⚽ 直播赛事 / 📺 24/7电视直播）。
    *   **右侧**：当前大类目下的具体分类过滤（如直播赛事下的：全部、足球、篮球；电视直播下的：综合、新闻、体育、电影等）。
2.  **左侧：主播放区 (Main Player Area - 65% 宽度)**
    *   **播放器卡片 (Player Card)**：
        *   未选中赛事/频道时：显示精美图文占位区（"请在右侧选择一个频道或比赛开始观赛"）。
        *   已选中赛事时：以 `16:9` 比例渲染 `<iframe>`（赛事流）或 原生 `<video>`（电视流）。
    *   **详情信息 (Detail Info)**：显示当前播放的赛事/频道名称、当前热度或类别。
    *   **线路选择器 (Source Selector)**：
        *   仅在直播赛事模式下显示。列出该赛事的所有可用信源（主信源 + Substreams），点击可切换 `<iframe>` 的 `src`。
3.  **右侧：列表区 (Sidebar - 35% 宽度)**
    *   **搜索框 (Search Bar)**：提供一个固定的 HeroUI `Input` 输入框，支持对赛事/频道名称进行模糊搜索。
    *   **滚动列表 (Scrollable List)**：
        *   在“直播赛事”模式下，展示赛事卡片列表。
        *   在“24/7电视直播”模式下，展示电视卡片列表（包含频道 LOGO 和名称）。
        *   当前播放的项目卡片会有高亮边框和激活状态指示。
---

## 4. 关键交互与路由状态 (Interactive Features)

### 4.1 URL 参数定位（可分享链接）
为了方便用户直接分享特定比赛的直播链接，应用将支持通过 URL 查询参数或 Hash 自动定位赛事：
*   **规则**：当页面加载时，检查 URL 中的 `?match=slug` 或 `?channel=slug` 参数。
*   **匹配逻辑**：将 URL 中的 slug 与获取到的赛事名称或频道名称（转为 kebab-case）进行匹配。如果匹配成功，则自动切换到相应模式、选中该比赛/频道并开始播放。
*   **更新机制**：当用户切换比赛或频道时，使用 `window.history.replaceState` 动态更新 URL，无需刷新页面。
### 4.2 搜索与分类级联过滤
*   用户选择分类 Tabs 时，列表只显示该分类的赛事。
*   用户输入搜索词时，在当前分类（或全部）下过滤赛事名称。
*   如果无搜索结果，展示友好提示。

---

## 5. 项目初始化结构规划 (Directory Structure)

```
cup/
├── src/
│   ├── assets/          # 静态资源
│   ├── components/      # UI 组件
│   │   ├── Player.tsx       # 播放器及信息展示组件
│   │   ├── Sidebar.tsx      # 搜索及赛事列表组件
│   │   └── Header.tsx       # 顶部导航栏
│   ├── hooks/           # 自定义 Hook (如 useStreams.ts)
│   ├── App.tsx          # 页面主入口与状态管理
│   ├── main.tsx         # React 渲染入口
│   └── index.css        # Tailwind CSS 与 HeroUI 配置
├── tailwind.config.js    # Tailwind 配置文件
├── vite.config.ts       # Vite 配置文件
└── package.json         # 项目依赖
```

---

## 6. 异常与边界处理 (Error Handling)
1.  **加载状态 (Loading)**：API 请求期间，赛事列表和播放器区域显示 HeroUI 的 `Spinner` 加载动画。
2.  **API 请求失败 (Fetch Error)**：如果 API 无法连接，在界面上弹出警告，并允许用户点击“重试”按钮重新加载。
3.  **无直播赛事 (Empty State)**：当没有正在直播的赛事时，在列表区显示“当前无正在直播的赛事，请稍后再试”。
