import { useT } from '../i18n';
import type { TopScorer } from '../types';

export default function TopScorersView({ scorers }: { scorers: TopScorer[] }) {
  const t = useT();

  if (scorers.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim">{t('scorers.empty')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display font-bold text-lg text-chalk tracking-wide">
          {t('scorers.title')}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim/60">
          {t('scorers.subtitle')}
        </span>
      </div>

      <table className="w-full text-sm border border-line bg-panel">
        <caption className="sr-only">{t('scorers.title')}</caption>
        <thead className="text-chalkdim font-mono text-[10px] uppercase tracking-[0.18em]">
          <tr className="border-b border-line">
            <th scope="col" className="text-left font-medium px-3 py-2 w-10">
              {t('scorers.rank')}
            </th>
            <th scope="col" className="text-left font-medium px-3 py-2">
              {t('scorers.player')}
            </th>
            <th scope="col" className="text-left font-medium px-3 py-2 hidden sm:table-cell">
              {t('scorers.team')}
            </th>
            <th scope="col" className="text-right font-medium px-3 py-2 w-16">
              {t('scorers.goals')}
            </th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((s, i) => {
            const rank = i + 1;
            const isLeader = rank === 1;
            return (
              <tr
                // eslint-disable-next-line react/no-array-index-key
                key={s.athleteId}
                className={`border-b border-line/60 last:border-b-0 ${isLeader ? 'bg-pitch/5' : ''}`}
              >
                <td className="px-3 py-2 font-mono tabular-nums text-chalkdim">{rank}</td>
                <td className="px-3 py-2 font-display text-chalk truncate max-w-0">
                  {s.name}
                  <span className="flex items-center gap-1 sm:hidden font-mono text-[10px] text-chalkdim/70">
                    {s.teamFlag && (
                      <img
                        src={s.teamFlag}
                        alt=""
                        className="w-3.5 h-3.5 object-contain shrink-0"
                      />
                    )}
                    <span className="truncate">{s.teamName}</span>
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-chalkdim truncate max-w-0 hidden sm:table-cell">
                  <span className="flex items-center gap-1.5">
                    {s.teamFlag && (
                      <img src={s.teamFlag} alt="" className="w-4 h-4 object-contain shrink-0" />
                    )}
                    <span className="truncate">{s.teamName}</span>
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-base sm:text-lg font-bold text-chalk tabular-nums text-right">
                  {s.goals}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
