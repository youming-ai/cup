# 世界杯与电视直播网页应用 (World Cup & Live TV Stream Player) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 React + Vite + HeroUI + Tailwind CSS 搭建一个响应式的世界杯赛事直播与全球 24/7 电视直播的前端观赛网页。

**Architecture:** 
1. **赛事直播**：通过 fetch 抓取 `api.ppv.to` 的实时流，解析出嵌入源并以安全的 `<iframe>` 进行播放。
2. **电视直播**：通过 fetch 获取 `iptv-org` API 的直播频道列表，使用 `<video>` 结合 `hls.js` 原生渲染和播放 `.m3u8` 流媒体，并对跨域限制或离线流进行友好报错提示。
3. **状态管理**：使用 React Context 或简单的父组件状态结合 URL 查询参数 (`?match=...` 和 `?channel=...`) 实现路由和分享功能。

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, HeroUI (@heroui/react), hls.js, lucide-react, Vitest, React Testing Library.

## Global Constraints
*   必须使用 TypeScript 编写所有逻辑。
*   项目样式完全基于 Tailwind CSS。
*   组件样式和主题使用 HeroUI 提供的标准组件。
*   对三方 `<iframe>` 必须设置 `sandbox` 属性防止弹窗广告。
*   HLS 播放必须正确解绑 MediaSource 以避免内存泄漏。

---

### Task 1: 项目初始化与环境搭建

**Files:**
*   Create: `package.json`
*   Create: `vite.config.ts`
*   Create: `tailwind.config.js`
*   Create: `postcss.config.js`
*   Create: `tsconfig.json`
*   Create: `index.html`
*   Create: `src/index.css`
*   Create: `src/main.tsx`

**Interfaces:**
*   此任务无前置依赖，主要负责搭建项目结构与依赖安装。

- [ ] **Step 1: 创建配置文件**

在根目录下创建 `package.json`。由于当前目录是空的，我们直接覆盖写入：
```json
{
  "name": "streamcup-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@heroui/react": "^2.2.0",
    "framer-motion": "^11.0.0",
    "hls.js": "^1.5.13",
    "lucide-react": "^0.300.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.10",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: 创建 Vite 和 Tailwind 配置文件**

创建 `vite.config.ts`：
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
```

创建 `tailwind.config.js`，引入 HeroUI 插件：
```javascript
const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [heroui()],
}
```

创建 `postcss.config.js`：
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

创建 `tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 HTML 入口和基础样式**

创建 `index.html`：
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚽</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StreamCup - 世界杯与电视直播</title>
  </head>
  <body class="dark text-foreground bg-background min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

创建 `src/index.css`，引入 Tailwind：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

创建 `src/main.tsx`：
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HeroUIProvider>
      <App />
    </HeroUIProvider>
  </React.StrictMode>,
)
```

创建 `src/App.tsx` (临时骨架)：
```typescript
import React from 'react'

export default function App() {
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">StreamCup Live</h1>
    </div>
  )
}
```

创建测试环境所需的 `src/test-setup.ts`：
```typescript
import '@testing-library/jest-dom';
```
*(注：如果 npm 包未安装，将在下一步安装中获得)*

- [ ] **Step 4: 执行依赖安装**

运行命令安装依赖包：
```bash
npm install
```
验证安装是否成功：`npm run build` 是否能正常通过。

- [ ] **Step 5: 提交代码**

```bash
git init
git add .
git commit -m "chore: initialize vite react project with tailwind and heroui"
```

---

### Task 2: 核心工具函数与测试开发

**Files:**
*   Create: `src/utils/helpers.ts`
*   Create: `src/utils/helpers.test.ts`

**Interfaces:**
*   Produces: `slugify(text: string): string` 转换文本为 URL 友好的 slug。
*   Produces: `getKebabCase(text: string): string` 转换驼峰或空格文本。

- [ ] **Step 1: 创建工具函数文件**

创建 `src/utils/helpers.ts`：
```typescript
/**
 * 将字符串转为 URL 友好的 kebab-case 格式
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 移除非字母、非数字、非空白、非横杠字符
    .replace(/[\s_]+/g, '-')   // 空白或下划线替换为单个横杠
    .replace(/-+/g, '-');      // 连续横杠替换为单个
}

/**
 * 转换普通文本为匹配键值
 */
export function getKebabCase(text: string): string {
  return slugify(text);
}
```

- [ ] **Step 2: 创建单元测试**

创建 `src/utils/helpers.test.ts`：
```typescript
import { describe, it, expect } from 'vitest';
import { slugify } from './helpers';

describe('slugify', () => {
  it('should convert mixed case and spaces to kebab-case', () => {
    expect(slugify('Colombia vs. Congo DR')).toBe('colombia-vs-congo-dr');
    expect(slugify('Atlanta Braves vs. San Diego Padres')).toBe('atlanta-braves-vs-san-diego-padres');
  });

  it('should handle special characters', () => {
    expect(slugify('France 3 Nord Pas-de-Calais HD')).toBe('france-3-nord-pas-de-calais-hd');
    expect(slugify('H@ll0 W0rld!')).toBe('hll0-w0rld');
  });

  it('should handle leading/trailing spaces and multiple dashes', () => {
    expect(slugify('  Hello   World  ')).toBe('hello-world');
  });
});
```

- [ ] **Step 3: 运行测试并验证**

运行 `npx vitest run src/utils/helpers.test.ts` 确保测试全部通过。

- [ ] **Step 4: 提交代码**

```bash
git add src/utils/helpers.ts src/utils/helpers.test.ts
git commit -m "feat: add slugify helper and unit tests"
```

---

### Task 3: 数据源服务与自定义 Hook 开发

**Files:**
*   Create: `src/types/index.ts`
*   Create: `src/hooks/useStreams.ts`

**Interfaces:**
*   Produces: `useStreams()` 返回 `{ matches: Match[], channels: Channel[], loading: boolean, error: string | null, refetch: () => void }`。
*   Match / Channel 数据结构：
```typescript
export interface Substream {
  id: number;
  name: string;
  tag: string;
  source_tag: string;
  locale: string;
  iframe: string;
}

export interface Match {
  id: number;
  name: string;
  category_name: string;
  iframe: string;
  viewers: string;
  substreams: Substream[];
  slug: string;
}

export interface Channel {
  channel: string;
  title: string;
  url: string; // m3u8
  logo: string;
  category: string;
  slug: string;
}
```

- [ ] **Step 1: 创建类型声明文件**

创建 `src/types/index.ts`：
```typescript
export interface Substream {
  id: number;
  name: string;
  tag: string;
  source_tag: string;
  locale: string;
  iframe: string;
}

export interface Match {
  id: number;
  name: string;
  category_name: string;
  iframe: string;
  viewers: string;
  substreams: Substream[];
  slug: string;
}

export interface Channel {
  channel: string;
  title: string;
  url: string;
  logo: string;
  category: string;
  slug: string;
}
```

- [ ] **Step 2: 编写 useStreams 自定义 Hook**

创建 `src/hooks/useStreams.ts`：
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Match, Channel } from '../types';
import { slugify } from '../utils/helpers';

export function useStreams() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Sports Streams (CORS-friendly)
      const sportsRes = await fetch('https://api.ppv.to/api/streams');
      if (!sportsRes.ok) throw new Error('Failed to fetch sports streams');
      const sportsData = await sportsRes.json();
      
      const flatMatches: Match[] = [];
      const categories = Array.isArray(sportsData) ? sportsData : (sportsData.streams || []);
      categories.forEach((cat: any) => {
        if (cat.streams) {
          cat.streams.forEach((s: any) => {
            flatMatches.push({
              id: s.id,
              name: s.name,
              category_name: s.category_name || cat.category || 'Other',
              iframe: s.iframe,
              viewers: s.viewers || '0',
              substreams: s.substreams || [],
              slug: slugify(s.name),
            });
          });
        }
      });
      setMatches(flatMatches);

      // 2. Fetch TV Streams and Channel Metadata
      const [tvStreamsRes, tvChannelsRes] = await Promise.all([
        fetch('https://iptv-org.github.io/api/streams.json'),
        fetch('https://iptv-org.github.io/api/channels.json'),
      ]);

      if (!tvStreamsRes.ok || !tvChannelsRes.ok) {
        throw new Error('Failed to fetch TV channels data');
      }

      const tvStreams = await tvStreamsRes.json();
      const tvChannels = await tvChannelsRes.json();

      // Create a map for quick lookups of channel meta
      const channelMap = new Map<string, { logo: string; category: string }>();
      tvChannels.forEach((ch: any) => {
        channelMap.set(ch.id, {
          logo: ch.logo || '',
          category: (ch.categories && ch.categories[0]) || 'General',
        });
      });

      const processedChannels: Channel[] = tvStreams
        .filter((stream: any) => stream.url && stream.url.endsWith('.m3u8'))
        .map((stream: any) => {
          const meta = channelMap.get(stream.channel) || { logo: '', category: 'General' };
          return {
            channel: stream.channel || '',
            title: stream.title || 'Unnamed Channel',
            url: stream.url,
            logo: meta.logo,
            category: meta.category,
            slug: slugify(stream.title || ''),
          };
        });

      setChannels(processedChannels);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { matches, channels, loading, error, refetch: fetchAllData };
}
```

- [ ] **Step 3: 编写 Hook 的测试文件并运行**

这里我们为接口拉取和转换编写基本 mock 单元测试。
创建 `src/hooks/useStreams.test.ts`：
*(由于篇幅限制，这里编写标准 mock 逻辑)*
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStreams } from './useStreams';

global.fetch = vi.fn();

describe('useStreams Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and parse streams successfully', async () => {
    const mockSports = [
      {
        category: 'Football',
        streams: [
          { id: 1, name: 'Colombia vs Congo DR', iframe: 'https://embedindia.st/1', viewers: '100' }
        ]
      }
    ];

    const mockTvStreams = [
      { channel: 'test.cn', title: 'CCTV 1', url: 'https://live.m3u8' }
    ];

    const mockTvChannels = [
      { id: 'test.cn', logo: 'logo-url', categories: ['general'] }
    ];

    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => mockSports })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvStreams })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvChannels });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].name).toBe('Colombia vs Congo DR');
    expect(result.current.matches[0].slug).toBe('colombia-vs-congo-dr');
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.channels[0].title).toBe('CCTV 1');
    expect(result.current.channels[0].logo).toBe('logo-url');
  });
});
```

运行测试验证：`npx vitest run src/hooks/useStreams.test.ts`。

- [ ] **Step 4: 提交代码**

```bash
git add src/types/index.ts src/hooks/useStreams.ts src/hooks/useStreams.test.ts
git commit -m "feat: implement useStreams hook with API fetching and parsing"
```

---

### Task 4: UI 组件开发 - 导航栏与侧边栏赛事列表

**Files:**
*   Create: `src/components/Header.tsx`
*   Create: `src/components/Sidebar.tsx`

**Interfaces:**
*   `Header` Consumes: `mode: 'events' | 'channels'`, `setMode: (m: 'events' | 'channels') => void`, `category: string`, `setCategory: (c: string) => void`, `availableCategories: string[]`
*   `Sidebar` Consumes: `items: (Match | Channel)[]`, `selectedId: string | number | null`, `onSelect: (item: any) => void`, `mode: 'events' | 'channels'`, `searchQuery: string`, `setSearchQuery: (q: string) => void`

- [ ] **Step 1: 开发 Header 顶部栏组件**

使用 HeroUI 的 `Navbar`, `Tabs`, `Tab` 创建 `src/components/Header.tsx`：
```typescript
import React from 'react';
import { Navbar, NavbarBrand, Tabs, Tab } from '@heroui/react';
import { Trophy } from 'lucide-react';

interface HeaderProps {
  mode: 'events' | 'channels';
  setMode: (m: 'events' | 'channels') => void;
  category: string;
  setCategory: (c: string) => void;
  categories: string[];
}

export default function Header({ mode, setMode, category, setCategory, categories }: HeaderProps) {
  return (
    <Navbar isBordered className="bg-neutral-900 border-neutral-800 text-white py-2" maxWidth="full">
      <NavbarBrand className="flex items-center gap-2">
        <Trophy className="text-yellow-500 w-6 h-6" />
        <span className="font-extrabold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
          StreamCup
        </span>
      </NavbarBrand>

      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* 大类目切换 */}
        <Tabs
          selectedKey={mode}
          onSelectionChange={(key) => {
            setMode(key as 'events' | 'channels');
            setCategory('all');
          }}
          variant="solid"
          color="warning"
          classNames={{
            tabList: "bg-neutral-800 border border-neutral-700",
            cursor: "bg-gradient-to-r from-yellow-500 to-amber-600",
            tabContent: "group-data-[selected=true]:text-neutral-950 font-bold"
          }}
        >
          <Tab key="events" title="⚽ 体育赛事直播" />
          <Tab key="channels" title="📺 24/7 电视直播" />
        </Tabs>

        {/* 细分类目切换 */}
        <Tabs
          selectedKey={category}
          onSelectionChange={(key) => setCategory(key as string)}
          variant="light"
          color="warning"
          classNames={{
            tabList: "max-w-[300px] overflow-x-auto bg-transparent",
            tabContent: "text-neutral-400 font-semibold"
          }}
        >
          <Tab key="all" title="全部" />
          {categories.map((cat) => (
            <Tab key={cat} title={cat} />
          ))}
        </Tabs>
      </div>
    </Navbar>
  );
}
```

- [ ] **Step 2: 开发 Sidebar 列表与搜索组件**

使用 HeroUI 的 `Input`, `Card`, `CardBody`, `Chip` 开发 `src/components/Sidebar.tsx`：
```typescript
import React from 'react';
import { Input, Card, CardBody, Chip } from '@heroui/react';
import { Search, Users, Tv } from 'lucide-react';
import { Match, Channel } from '../types';

interface SidebarProps {
  items: any[];
  selectedItem: any;
  onSelectItem: (item: any) => void;
  mode: 'events' | 'channels';
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export default function Sidebar({
  items,
  selectedItem,
  onSelectItem,
  mode,
  searchQuery,
  setSearchQuery,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full bg-neutral-900 border-r border-neutral-800 p-4">
      {/* 搜索框 */}
      <Input
        isClearable
        placeholder={mode === 'events' ? "搜索赛事（如 Colombia）..." : "搜索频道..."}
        startContent={<Search className="text-neutral-400 w-4 h-4" />}
        value={searchQuery}
        onValueChange={setSearchQuery}
        variant="bordered"
        className="mb-4 text-white"
        classNames={{
          inputWrapper: "border-neutral-700 bg-neutral-800 hover:border-neutral-600 focus-within:!border-yellow-500",
          input: "text-neutral-200"
        }}
      />

      {/* 滚动卡片列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {items.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            没有找到相关内容
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedItem && (mode === 'events' ? item.id === selectedItem.id : item.channel === selectedItem.channel);
            
            return (
              <Card
                key={mode === 'events' ? item.id : item.channel}
                isPressable
                onPress={() => onSelectItem(item)}
                className={`w-full bg-neutral-800 border transition-all hover:bg-neutral-750 ${
                  isSelected ? 'border-yellow-500 bg-neutral-800 shadow-md shadow-yellow-500/10' : 'border-neutral-750'
                }`}
              >
                <CardBody className="p-3 flex flex-row items-center gap-3">
                  {mode === 'channels' ? (
                    // 电视 LOGO 或者占位符
                    <div className="w-10 h-10 rounded bg-neutral-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.logo ? (
                        <img src={item.logo} alt={item.title} className="w-full h-full object-contain" />
                      ) : (
                        <Tv className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                  ) : (
                    // 赛事占位徽章
                    <div className="w-10 h-10 rounded bg-yellow-600/20 text-yellow-500 flex items-center justify-center font-extrabold flex-shrink-0 text-lg">
                      ⚽
                    </div>
                  )}

                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-sm text-neutral-200 truncate">{mode === 'events' ? item.name : item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Chip size="sm" variant="flat" color={mode === 'events' ? "warning" : "default"} className="h-5 text-[10px]">
                        {mode === 'events' ? item.category_name : item.category}
                      </Chip>
                      {mode === 'events' && (
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {item.viewers}
                        </span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交代码**

```bash
git add src/components/Header.tsx src/components/Sidebar.tsx
git commit -m "feat: implement Header and Sidebar components with search & filters"
```

---

### Task 5: UI 组件开发 - 播放器及信源选择器组件

**Files:**
*   Create: `src/components/Player.tsx`

**Interfaces:**
*   `Player` Consumes: `selectedItem: Match | Channel | null`, `mode: 'events' | 'channels'`, `selectedIframeUrl: string`, `setSelectedIframeUrl: (url: string) => void`

- [ ] **Step 1: 编写播放器组件与 HLS 直播流集成**

创建 `src/components/Player.tsx`。对于电视直播，我们将利用 `hls.js` 来处理 `.m3u8` 直播流的渲染与重试；对于体育赛事直播，我们利用沙箱 `<iframe>`。
```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import { Play, ShieldAlert, Radio, Users } from 'lucide-react';
import Hls from 'hls.js';
import { Match, Channel } from '../types';

interface PlayerProps {
  selectedItem: any;
  mode: 'events' | 'channels';
  selectedIframeUrl: string;
  setSelectedIframeUrl: (url: string) => void;
}

export default function Player({
  selectedItem,
  mode,
  selectedIframeUrl,
  setSelectedIframeUrl,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  // 初始化信源
  useEffect(() => {
    if (mode === 'events' && selectedItem) {
      setSelectedIframeUrl(selectedItem.iframe);
      setPlayError(null);
    }
  }, [selectedItem, mode, setSelectedIframeUrl]);

  // HLS 视频流加载逻辑（用于 24/7 电视直播）
  useEffect(() => {
    if (mode !== 'channels' || !selectedItem) {
      // 清空先前的 HLS 实例
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setPlayError(null);
    const m3u8Url = selectedItem.url;

    // 清空现有的 HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
      });
      hlsRef.current = hls;

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // 浏览器自动播放拦截处理
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlayError('网络错误：直播源离线或因跨域（CORS）被浏览器拦截');
              hls.destroy();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setPlayError('播放器内部致命错误，无法加载此直播流');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 原生支持
      video.src = m3u8Url;
      video.addEventListener('error', () => {
        setPlayError('Safari 原生加载失败，可能流已失效或受 CORS 限制');
      });
    } else {
      setPlayError('您的浏览器不支持 HLS（.m3u8）播放格式');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedItem, mode]);

  if (!selectedItem) {
    return (
      <Card className="w-full h-full bg-neutral-900 border-neutral-800 flex items-center justify-center text-center p-8">
        <div className="max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto mb-4 text-2xl">
            ⚽
          </div>
          <h2 className="text-xl font-bold text-neutral-200 mb-2">欢迎来到 StreamCup</h2>
          <p className="text-sm text-neutral-500">
            请在右侧选择感兴趣的世界杯球赛直播或全球 24/7 直播频道，开启即时高清观赛体验。
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 播放器渲染区 */}
      <Card className="bg-black border border-neutral-850 overflow-hidden shadow-lg">
        <CardBody className="p-0">
          <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center">
            {mode === 'events' ? (
              // 赛事直播：使用 Iframe，加入沙箱限制防止广告顶层劫持
              <iframe
                src={selectedIframeUrl}
                allowFullScreen
                allow="autoplay; encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                className="absolute inset-0 w-full h-full border-0"
                title={selectedItem.name}
              />
            ) : (
              // 电视直播：使用原生 Video + Hls.js
              <>
                {playError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-neutral-900 text-neutral-300">
                    <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
                    <p className="font-bold text-sm max-w-sm">{playError}</p>
                    <p className="text-xs text-neutral-500 mt-2">提示：某些源不支持 HTTPS 播放，或服务器限制了外部域名的请求。</p>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    controls
                    playsInline
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                )}
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 赛事/频道元信息展示 */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Chip size="sm" color={mode === 'events' ? "warning" : "default"} variant="flat" className="h-5">
              {mode === 'events' ? selectedItem.category_name : selectedItem.category}
            </Chip>
            {mode === 'events' && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {selectedItem.viewers} 在看
              </span>
            )}
            {mode === 'channels' && (
              <span className="text-xs text-emerald-500 flex items-center gap-1 animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                24/7 实时直播
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-white">{mode === 'events' ? selectedItem.name : selectedItem.title}</h1>
        </div>

        {/* 体育线路切换 */}
        {mode === 'events' && (
          <div className="flex flex-wrap gap-2">
            {/* 主线路 */}
            <Button
              size="sm"
              variant={selectedIframeUrl === selectedItem.iframe ? 'solid' : 'bordered'}
              color="warning"
              onPress={() => setSelectedIframeUrl(selectedItem.iframe)}
              className="font-bold"
            >
              主线路 ({selectedItem.source_tag || 'PPV'})
            </Button>
            {/* 分支信源（Substreams） */}
            {selectedItem.substreams?.map((sub: any) => (
              <Button
                key={sub.id}
                size="sm"
                variant={selectedIframeUrl === sub.iframe ? 'solid' : 'bordered'}
                color="warning"
                onPress={() => setSelectedIframeUrl(sub.iframe)}
                className="font-bold"
              >
                线路 ({sub.source_tag || sub.name}) {sub.locale ? `[${sub.locale.toUpperCase()}]` : ''}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/Player.tsx
git commit -m "feat: implement Player component with Iframe support and Hls.js playback"
```

---

### Task 6: 整合页面并加入 URL 路由与分享

**Files:**
*   Modify: `src/App.tsx`

**Interfaces:**
*   Consumes: `useStreams` Custom Hook, `Header`, `Sidebar`, `Player` components.
*   实现通过 URL 查询参数 `?match=colombia-vs-congo-dr` 或 `?channel=cctv-1` 的定位和加载。

- [ ] **Step 1: 编写 App.tsx 的整合逻辑**

替换 `src/App.tsx` 以包含完整的业务状态与 URL 路由控制：
```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@heroui/react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import { useStreams } from './hooks/useStreams';
import { Match, Channel } from './types';
import { slugify } from './utils/helpers';

export default function App() {
  const { matches, channels, loading, error } = useStreams();

  const [mode, setMode] = useState<'events' | 'channels'>('events');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedIframeUrl, setSelectedIframeUrl] = useState<string>('');

  // 1. 提取当前模式下所有的分类项以供 Header Tabs 渲染
  const categories = useMemo(() => {
    if (mode === 'events') {
      const cats = matches.map(m => m.category_name);
      return Array.from(new Set(cats));
    } else {
      const cats = channels.map(c => c.category);
      return Array.from(new Set(cats));
    }
  }, [mode, matches, channels]);

  // 2. 根据搜索词与大/细分类过滤列表项
  const filteredItems = useMemo(() => {
    const list = mode === 'events' ? matches : channels;
    return list.filter((item: any) => {
      const name = mode === 'events' ? item.name : item.title;
      const cat = mode === 'events' ? item.category_name : item.category;

      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || cat === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [mode, matches, channels, searchQuery, selectedCategory]);

  // 3. 处理 URL 路由初始化匹配 (e.g. ?match=colombia-vs-congo-dr)
  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);
    const matchSlug = params.get('match');
    const channelSlug = params.get('channel');

    if (matchSlug) {
      const match = matches.find(m => m.slug === matchSlug);
      if (match) {
        setMode('events');
        setSelectedItem(match);
        setSelectedIframeUrl(match.iframe);
      }
    } else if (channelSlug) {
      const channel = channels.find(c => c.slug === channelSlug);
      if (channel) {
        setMode('channels');
        setSelectedItem(channel);
      }
    }
  }, [loading, matches, channels]);

  // 4. 点击选择某项时，更新 URL 参数以供分享
  const handleSelectItem = (item: any) => {
    setSelectedItem(item);
    
    const newParams = new URLSearchParams();
    if (mode === 'events') {
      newParams.set('match', item.slug);
      setSelectedIframeUrl(item.iframe);
    } else {
      newParams.set('channel', item.slug);
    }
    
    window.history.replaceState(null, '', `?${newParams.toString()}`);
  };

  // 5. 类目重置时，清空选择（除非通过路由重新匹配）
  const handleModeChange = (newMode: 'events' | 'channels') => {
    setMode(newMode);
    setSelectedItem(null);
    setSearchQuery('');
    window.history.replaceState(null, '', '/');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-white gap-4">
        <Spinner size="lg" color="warning" />
        <p className="text-sm text-neutral-400 font-bold">载入流媒体源中，请稍候...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-white p-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-red-600/10 text-red-500 flex items-center justify-center text-3xl">
          ⚠️
        </div>
        <h2 className="text-lg font-bold text-red-500">接口数据加载失败</h2>
        <p className="text-sm text-neutral-400 max-w-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-yellow-500 text-neutral-950 font-bold rounded-lg hover:bg-yellow-400 transition"
        >
          重新尝试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-950">
      {/* 顶部 Header */}
      <Header
        mode={mode}
        setMode={handleModeChange}
        category={selectedCategory}
        setCategory={setSelectedCategory}
        categories={categories}
      />

      {/* 主体分栏 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 左/上侧：列表展示 (Sidebar) */}
        <div className="w-full md:w-80 flex-shrink-0 h-1/2 md:h-full">
          <Sidebar
            items={filteredItems}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
            mode={mode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </div>

        {/* 右/下侧：核心播放器与流详情 */}
        <div className="flex-1 p-4 overflow-y-auto bg-neutral-950">
          <Player
            selectedItem={selectedItem}
            mode={mode}
            selectedIframeUrl={selectedIframeUrl}
            setSelectedIframeUrl={setSelectedIframeUrl}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行构建与最终测试**

运行打包构建确保无 TypeScript 类型错误：
```bash
npm run build
```

- [ ] **Step 3: 提交代码**

```bash
git add src/App.tsx
git commit -m "feat: integrate Header, Sidebar, Player and add URL shareable query routers"
```
