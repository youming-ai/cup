import { Search, Tv } from 'lucide-react';
import { Match, Channel } from '../types';

type StreamItem = Match | Channel;

interface SidebarProps {
  items: StreamItem[];
  selectedItem: StreamItem | null;
  onSelectItem: (item: StreamItem) => void;
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
    <div className="flex flex-col h-full bg-panel border-r border-line">
      {/* 板块标签 + 计数 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="font-mono text-xs tracking-[0.25em] text-chalkdim">
          {mode === 'events' ? 'FIXTURES' : 'CHANNELS'}
        </span>
        <span className="font-mono text-xs text-pitch tabular-nums">
          {String(items.length).padStart(2, '0')}
        </span>
      </div>

      {/* 搜索：转播式下划线输入 */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 border-b border-line focus-within:border-pitch transition-colors pb-2">
          <Search className="w-4 h-4 text-chalkdim shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={mode === 'events' ? '搜索赛事…' : '搜索频道…'}
            className="w-full bg-transparent outline-none text-sm text-chalk placeholder:text-chalkdim/60 font-body"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="font-mono text-xs text-chalkdim hover:text-chalk shrink-0"
            >
              CLR
            </button>
          )}
        </div>
      </div>

      {/* 赛程列表 */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="font-mono text-xs tracking-wider text-chalkdim">未找到内容</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {items.map((item) => {
              const isSelected =
                !!selectedItem &&
                (mode === 'events'
                  ? (item as Match).id === (selectedItem as Match).id
                  : (item as Channel).channel === (selectedItem as Channel).channel);

              const name = mode === 'events' ? (item as Match).name : (item as Channel).title;
              const cat =
                mode === 'events' ? (item as Match).category_name : (item as Channel).category;

              return (
                <li key={mode === 'events' ? (item as Match).id : (item as Channel).channel}>
                  <button
                    onClick={() => onSelectItem(item)}
                    aria-pressed={isSelected}
                    className={`group w-full flex items-center gap-3 px-4 py-3 text-left border-l-2 transition-colors ${
                      isSelected
                        ? 'border-live bg-pitch/[0.06]'
                        : 'border-transparent hover:bg-panel2'
                    }`}
                  >
                    {/* 频道 LOGO 或赛事徽章 */}
                    {mode === 'channels' ? (
                      <div className="w-9 h-9 rounded bg-night border border-line flex items-center justify-center overflow-hidden shrink-0">
                        {(item as Channel).logo ? (
                          <img
                            src={(item as Channel).logo}
                            alt={(item as Channel).title}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Tv className="w-4 h-4 text-chalkdim" />
                        )}
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded bg-night border border-line flex items-center justify-center shrink-0 text-base">
                        ⚽
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-display font-semibold text-[15px] leading-tight truncate transition-colors ${
                          isSelected ? 'text-chalk' : 'text-chalk/90 group-hover:text-chalk'
                        }`}
                      >
                        {name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-chalkdim truncate">
                          {cat}
                        </span>
                        {mode === 'events' && (
                          <span className="font-mono text-[10px] text-pitch flex items-center gap-1 shrink-0">
                            <span className="w-1 h-1 rounded-full bg-pitch" />
                            {(item as Match).viewers}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="font-mono text-[9px] tracking-wider text-live flex items-center gap-1 shrink-0">
                        <span className="live-dot" />
                        LIVE
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
