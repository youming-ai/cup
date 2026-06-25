import { useState } from 'react';
import { useT } from '../../i18n';
import type { PlayEvent } from '../../types';

export default function PlayByPlayTab({
  allPlays,
  keyPlays,
  homeId,
}: {
  allPlays: PlayEvent[];
  keyPlays: PlayEvent[];
  homeId: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<'all' | 'key'>('all');
  const plays = tab === 'all' ? allPlays : keyPlays;

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-1 p-1 border border-line bg-panel w-fit">
        {(['all', 'key'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`px-3 py-1.5 font-display text-sm transition-colors ${
              tab === k ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
            }`}
          >
            {t(k === 'all' ? 'detail.allPlays' : 'detail.keyPlays')}
          </button>
        ))}
      </div>
      {plays.length === 0 ? (
        <p className="font-mono text-xs tracking-wider text-chalkdim">{t('detail.noData')}</p>
      ) : (
        <ul className="space-y-2">
          {plays.map((p, i) => (
            <li
              key={`${i}-${p.clock}-${p.text}`}
              className={`border border-line bg-panel px-3 py-2 ${
                tab === 'key' && p.teamId ? `border-l-2 ${p.teamId === homeId ? 'border-l-pitch' : 'border-l-live'}` : ''
              }`}
            >
              <div className="font-body text-sm text-chalk">{p.text}</div>
              {(p.clock || p.type) && (
                <div className="flex items-center gap-2 mt-1">
                  {p.clock && <span className="font-mono text-[10px] text-chalkdim tabular-nums">{p.clock}</span>}
                  {p.type && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-pitch">{p.type}</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
