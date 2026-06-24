import { useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import Player from './Player';
import type { Match } from '../types';

export default function LiveView({ matches }: { matches: Match[] }) {
  const [selected, setSelected] = useState<Match | null>(null);
  const [iframeUrl, setIframeUrl] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => matches.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())),
    [matches, query],
  );

  // ?match=<slug> 初始定位（仅在尚未选中时，避免 refetch 带来的新数组身份覆盖用户选择）
  useEffect(() => {
    if (selected) return;
    const slug = new URLSearchParams(window.location.search).get('match');
    if (slug && matches.length) {
      const m = matches.find((x) => x.slug === slug);
      if (m) {
        setSelected(m);
        setIframeUrl(m.iframe);
      }
    }
  }, [matches, selected]);

  const handleSelect = (m: Match) => {
    setSelected(m);
    setIframeUrl(m.iframe);
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'live');
    params.set('match', m.slug);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <div className="w-full md:w-80 flex-shrink-0 h-1/2 md:h-full">
        <Sidebar
          items={filtered}
          selectedItem={selected}
          onSelectItem={handleSelect}
          searchQuery={query}
          setSearchQuery={setQuery}
        />
      </div>
      <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-night">
        <Player match={selected} selectedIframeUrl={iframeUrl} setSelectedIframeUrl={setIframeUrl} />
      </div>
    </div>
  );
}
