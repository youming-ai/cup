import { useT } from '../../i18n';
import type { TeamStatRow } from '../../types';

// Width of the home side's bar, 0..100, when both values are numeric.
function homePct(home: string, away: string): number | null {
  const h = parseFloat(home);
  const a = parseFloat(away);
  if (!Number.isFinite(h) || !Number.isFinite(a) || h + a === 0) return null;
  return (h / (h + a)) * 100;
}

export default function TeamStatsTab({ stats }: { stats: TeamStatRow[] }) {
  const t = useT();
  if (stats.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim p-4">{t('detail.noData')}</p>;
  }
  return (
    <div className="space-y-4 p-4">
      {stats.map((s) => {
        const pct = homePct(s.home, s.away);
        return (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between font-mono text-sm text-chalk tabular-nums">
              <span className="font-bold">{s.home}</span>
              <span className="text-chalkdim text-xs uppercase tracking-wider">{s.label}</span>
              <span className="font-bold">{s.away}</span>
            </div>
            {pct !== null && (
              <div className="flex h-1.5 gap-0.5">
                <span className="bg-pitch" style={{ width: `${pct}%` }} />
                <span className="bg-chalkdim/50 flex-1" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
