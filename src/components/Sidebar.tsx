import { MagnifyingGlass } from '@phosphor-icons/react';
import { useT } from '../i18n';
import type { Match } from '../types';

interface SidebarProps {
  items: Match[];
  selectedItem: Match | null;
  onSelectItem: (item: Match) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export default function Sidebar({
  items,
  selectedItem,
  onSelectItem,
  searchQuery,
  setSearchQuery,
}: SidebarProps) {
  const t = useT();
  return (
    <div className="flex flex-col h-full bg-panel border-r border-line">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="font-mono text-xs tracking-[0.25em] text-chalkdim">{t('nav.live').toUpperCase()}</span>
        <span className="font-mono text-xs text-pitch tabular-nums">
          {String(items.length).padStart(2, '0')}
        </span>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 border-b border-line focus-within:border-pitch transition-colors pb-2">
          <MagnifyingGlass className="w-4 h-4 text-chalkdim shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full bg-transparent outline-none text-sm text-chalk placeholder:text-chalkdim/60 font-body"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="font-mono text-xs tracking-wider text-chalkdim">{t('live.empty')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {items.map((item) => {
              const isSelected = !!selectedItem && item.id === selectedItem.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onSelectItem(item)}
                    aria-pressed={isSelected}
                    className={`group w-full flex items-center gap-3 px-4 py-3 text-left border-l-2 transition-colors ${
                      isSelected ? 'border-live bg-pitch/[0.06]' : 'border-transparent hover:bg-panel2'
                    }`}
                  >
                    <div className="w-9 h-9 rounded bg-night border border-line flex items-center justify-center shrink-0 text-base">
                      ⚽
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-display font-semibold text-[15px] leading-tight truncate transition-colors ${
                          isSelected ? 'text-chalk' : 'text-chalk/90 group-hover:text-chalk'
                        }`}
                      >
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-chalkdim truncate">
                          {item.category_name}
                        </span>
                        <span className="font-mono text-[10px] text-pitch flex items-center gap-1 shrink-0">
                          <span className="w-1 h-1 rounded-full bg-pitch" />
                          {item.viewers}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="font-mono text-[9px] tracking-wider text-live flex items-center gap-1 shrink-0">
                        <span className="live-dot" />
                        {t('status.live')}
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
