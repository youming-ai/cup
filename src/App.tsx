import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@heroui/react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import { useStreams } from './hooks/useStreams';
import { Match, Channel } from './types';

type StreamItem = Match | Channel;

export default function App() {
  const { matches, channels, loading, error } = useStreams();

  const [mode, setMode] = useState<'events' | 'channels'>('events');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedItem, setSelectedItem] = useState<StreamItem | null>(null);
  const [selectedIframeUrl, setSelectedIframeUrl] = useState<string>('');

  // 1. 提取当前模式下所有分类项以供 Header Tabs 渲染
  const categories = useMemo(() => {
    if (mode === 'events') {
      return Array.from(new Set(matches.map((m) => m.category_name)));
    }
    return Array.from(new Set(channels.map((c) => c.category)));
  }, [mode, matches, channels]);

  // 2. 根据搜索词与大/细分类过滤列表项
  const filteredItems = useMemo<StreamItem[]>(() => {
    const list: StreamItem[] = mode === 'events' ? matches : channels;
    return list.filter((item) => {
      const name = mode === 'events' ? (item as Match).name : (item as Channel).title;
      const cat = mode === 'events' ? (item as Match).category_name : (item as Channel).category;

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
      const match = matches.find((m) => m.slug === matchSlug);
      if (match) {
        setMode('events');
        setSelectedItem(match);
        setSelectedIframeUrl(match.iframe);
      }
    } else if (channelSlug) {
      const channel = channels.find((c) => c.slug === channelSlug);
      if (channel) {
        setMode('channels');
        setSelectedItem(channel);
      }
    }
  }, [loading, matches, channels]);

  // 4. 点击选择某项时，更新 URL 参数以供分享
  const handleSelectItem = (item: StreamItem) => {
    setSelectedItem(item);

    const newParams = new URLSearchParams();
    if (mode === 'events') {
      newParams.set('match', (item as Match).slug);
      setSelectedIframeUrl((item as Match).iframe);
    } else {
      newParams.set('channel', (item as Channel).slug);
    }

    window.history.replaceState(null, '', `?${newParams.toString()}`);
  };

  // 5. 大类目切换时清空选择并重置 URL
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
