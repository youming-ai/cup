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
    <div className="space-y-4">
      <div className="flex bg-white/5 rounded-full p-1 border border-white/5 w-fit select-none">
        {(['all', 'key'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`px-4 py-1.5 rounded-full font-display text-sm transition-all duration-200 ${
              tab === k
                ? 'bg-white/10 text-chalk shadow-sm font-bold'
                : 'text-chalkdim hover:text-chalk'
            }`}
          >
            {t(k === 'all' ? 'detail.allPlays' : 'detail.keyPlays')}
          </button>
        ))}
      </div>

      {plays.length === 0 ? (
        <p className="font-mono text-xs tracking-wider text-chalkdim p-2">{t('detail.noData')}</p>
      ) : (
        <ul className="space-y-4 relative pl-6 border-l border-white/10 ml-3">
          {plays.map((p) => {
            const isKey = tab === 'key' && p.teamId;
            const isHome = p.teamId === homeId;
            return (
              <li
                key={`${p.clock}-${p.text}`}
                className={`relative bg-panel2/20 rounded-2xl px-4 py-3 border border-line/20 ${
                  isKey ? `border-l-2 ${isHome ? 'border-l-pitch' : 'border-l-live'}` : ''
                }`}
              >
                {/* Timeline dot */}
                <div className="absolute -left-[31px] top-[18px] w-2.5 h-2.5 rounded-full bg-white/20 border-2 border-night flex items-center justify-center">
                  {p.type && (
                    <span
                      className={`absolute w-1.5 h-1.5 rounded-full ${
                        p.type === 'Goal'
                          ? 'bg-pitch'
                          : p.type.includes('Red')
                            ? 'bg-live'
                            : p.type.includes('Card')
                              ? 'bg-yellow-400'
                              : 'bg-chalk'
                      }`}
                    />
                  )}
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="font-body text-sm text-chalk leading-relaxed">{p.text}</div>
                  {p.clock && (
                    <span className="font-mono text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                      {p.clock}
                    </span>
                  )}
                </div>

                {p.type && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] select-none" aria-hidden>
                      {p.type === 'Goal'
                        ? '⚽'
                        : p.type.includes('Yellow')
                          ? '🟨'
                          : p.type.includes('Red')
                            ? '🟥'
                            : '⏱️'}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-pitch font-bold">
                      {p.type}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
