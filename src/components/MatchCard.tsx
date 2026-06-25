import { useT } from '../i18n';
import type { MatchStatus } from '../types';

interface MatchCardProps {
  homeName: string;
  awayName: string;
  homeFlag?: string;
  awayFlag?: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoff: Date | null;
  stage: string;
  group: string;
}

function StatusPill({ status, t }: { status: MatchStatus; t: (k: string) => string }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-live">
        <span className="live-dot" />
        {t('status.live')}
      </span>
    );
  }
  if (status === 'finished') {
    return <span className="font-mono text-[10px] tracking-widest text-chalkdim">{t('status.ft')}</span>;
  }
  return <span className="font-mono text-[10px] tracking-widest text-chalkdim/70">{t('status.upcoming')}</span>;
}

function Flag({ src, alt, dim }: { src?: string; alt: string; dim?: boolean }) {
  const cls = dim ? 'opacity-50' : '';
  if (!src) return <div className={`w-10 h-7 rounded bg-white/10 ${cls}`} aria-hidden />;
  return <img src={src} alt={alt} className={`w-10 h-7 object-cover rounded shadow ${cls}`} />;
}

export default function MatchCard(p: MatchCardProps) {
  const t = useT();
  const tbd = t('common.tbd');
  const stageLabel = p.stage === 'group' ? `${t('common.group')} ${p.group}` : t(`stage.${p.stage}`);

  // finished: brighten the winner, dim the loser
  const homeWon = p.status === 'finished' && (p.homeScore ?? 0) > (p.awayScore ?? 0);
  const awayWon = p.status === 'finished' && (p.awayScore ?? 0) > (p.homeScore ?? 0);
  const teamCls = (won: boolean, lost: boolean) =>
    `font-display text-sm text-center truncate w-full ${
      lost ? 'font-normal text-chalkdim' : won ? 'font-bold text-chalk' : 'font-semibold text-chalk'
    }`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalkdim truncate">
          {stageLabel}
        </span>
        {p.kickoff && (
          <span className="font-mono text-[10px] tabular-nums text-chalkdim/70 shrink-0 ml-2">
            {p.kickoff.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4">
        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={p.homeFlag} alt={p.homeName || tbd} dim={awayWon} />
          <span className={teamCls(homeWon, awayWon)}>{p.homeName || tbd}</span>
        </div>

        <div className="flex flex-col items-center gap-1 px-2">
          {p.status === 'upcoming' ? (
            <span className="font-mono text-lg font-bold text-chalk tabular-nums whitespace-nowrap leading-none">
              {p.kickoff
                ? p.kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : tbd}
            </span>
          ) : (
            <span
              className="font-mono text-4xl font-bold text-chalk tabular-nums leading-none whitespace-nowrap"
              aria-label={`${p.homeName || tbd} ${p.homeScore ?? 0} - ${p.awayName || tbd} ${p.awayScore ?? 0}`}
            >
              {`${p.homeScore ?? 0} : ${p.awayScore ?? 0}`}
            </span>
          )}
          <StatusPill status={p.status} t={t} />
        </div>

        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={p.awayFlag} alt={p.awayName || tbd} dim={homeWon} />
          <span className={teamCls(awayWon, homeWon)}>{p.awayName || tbd}</span>
        </div>
      </div>
    </div>
  );
}
