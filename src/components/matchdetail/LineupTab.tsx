import { useState } from 'react';
import { useT } from '../../i18n';
import type { LineupPlayer, TeamLineup } from '../../types';
import { layoutStarters } from '../../utils/espn';

function Pitch({ starters }: { starters: LineupPlayer[] }) {
  const placed = layoutStarters(starters);
  return (
    <div className="relative w-full aspect-[3/4] bg-pitch/15 border border-line overflow-hidden">
      <div className="absolute inset-x-0 top-1/2 h-px bg-chalkdim/30" />
      {placed.map((p) => (
        <div
          key={p.jersey + p.name}
          className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 w-16 text-center"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <span className="flex items-center justify-center w-7 h-7 bg-panel border border-chalkdim font-mono text-xs text-chalk">
            {p.jersey}
          </span>
          <span className="font-display text-[10px] text-chalk truncate w-full mt-0.5">
            {p.name}
          </span>
          {p.card && (
            <span
              className={`mt-0.5 w-2 h-3 ${p.card === 'red' ? 'bg-live' : 'bg-yellow-400'}`}
              aria-hidden
            />
          )}
          {p.subbedOutAt && (
            <span className="font-mono text-[10px] text-live">↓ {p.subbedOutAt}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Bench({ players }: { players: LineupPlayer[] }) {
  const t = useT();
  const subs = players.filter((p) => !p.starter);
  if (subs.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim mb-2">
        {t('detail.bench')}
      </h4>
      <ul className="space-y-1">
        {subs.map((p) => (
          <li
            key={p.jersey + p.name}
            className="flex items-center gap-2 font-body text-sm text-chalkdim"
          >
            <span className="font-mono text-xs w-6 text-right">{p.jersey}</span>
            <span className="text-chalk">{p.name}</span>
            {p.card && (
              <span className={`w-2.5 h-3.5 ${p.card === 'red' ? 'bg-live' : 'bg-yellow-400'}`} />
            )}
            {p.subbedInAt && (
              <span className="font-mono text-[10px] text-pitch">↑ {p.subbedInAt}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LineupTab({ lineups, homeId }: { lineups: TeamLineup[]; homeId: string }) {
  const t = useT();
  const [side, setSide] = useState<'home' | 'away'>('home');
  if (lineups.length === 0) {
    return (
      <p className="font-mono text-xs tracking-wider text-chalkdim p-4">{t('detail.noData')}</p>
    );
  }
  const home = lineups.find((l) => l.teamId === homeId) ?? lineups[0];
  const away = lineups.find((l) => l.teamId !== homeId) ?? lineups[1] ?? home;
  const team = side === 'home' ? home : away;

  if (team.players.length === 0) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex gap-1 p-1 border border-line bg-panel">
          {(['home', 'away'] as const).map((s) => {
            const lineup = s === 'home' ? home : away;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                aria-pressed={side === s}
                className={`flex-1 px-3 py-1.5 font-display text-sm transition-colors ${
                  side === s ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
                }`}
              >
                {lineup.teamName} · {lineup.formation}
              </button>
            );
          })}
        </div>
        <p className="font-mono text-xs tracking-wider text-chalkdim">{t('detail.noData')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-1 p-1 border border-line bg-panel">
        {(['home', 'away'] as const).map((s) => {
          const lineup = s === 'home' ? home : away;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={`flex-1 px-3 py-1.5 font-display text-sm transition-colors ${
                side === s ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
              }`}
            >
              {lineup.teamName} · {lineup.formation}
            </button>
          );
        })}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim">
        {t('detail.startingLineup')} · <span>{team.formation}</span>
      </div>
      <Pitch starters={team.players.filter((p) => p.starter)} />
      <Bench players={team.players} />
    </div>
  );
}
