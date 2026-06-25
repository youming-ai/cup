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
  if (!src) return <div className={`w-10 h-7 bg-panel2 ${cls}`} aria-hidden />;
  return <img src={src} alt={alt} className={`w-10 h-7 object-cover ${cls}`} />;
}

export default function MatchCard({
  homeName,
  awayName,
  homeFlag,
  awayFlag,
  homeScore,
  awayScore,
  status,
  kickoff,
  stage,
  group,
}: MatchCardProps) {
  const t = useT();
  const tbd = t('common.tbd');
  const stageLabel = stage === 'group' ? `${t('common.group')} ${group}` : t(`stage.${stage}`);

  // finished: brighten the winner, dim the loser
  const homeWon = status === 'finished' && (homeScore ?? 0) > (awayScore ?? 0);
  const awayWon = status === 'finished' && (awayScore ?? 0) > (homeScore ?? 0);
  const teamCls = (won: boolean, lost: boolean) =>
    `font-display text-sm text-center truncate w-full ${
      lost ? 'font-normal text-chalkdim' : won ? 'font-bold text-chalk' : 'font-semibold text-chalk'
    }`;

  return (
    <div className="border border-line bg-panel overflow-hidden hover:border-chalkdim transition-colors">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-chalkdim truncate">
          {stageLabel}
        </span>
        {kickoff && (
          <span className="font-mono text-[10px] tabular-nums text-chalkdim/70 shrink-0 ml-2">
            {kickoff.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4">
        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={homeFlag} alt={homeName || tbd} dim={awayWon} />
          <span className={teamCls(homeWon, awayWon)}>{homeName || tbd}</span>
        </div>

        <div className="flex flex-col items-center gap-1 px-2">
          {status === 'upcoming' ? (
            <span className="font-mono text-lg font-bold text-chalk tabular-nums whitespace-nowrap leading-none">
              {kickoff
                ? kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : tbd}
            </span>
          ) : (
            <span
              className="font-mono text-4xl font-bold text-chalk tabular-nums leading-none whitespace-nowrap"
              aria-label={`${homeName || tbd} ${homeScore ?? 0} - ${awayName || tbd} ${awayScore ?? 0}`}
            >
              {`${homeScore ?? 0} : ${awayScore ?? 0}`}
            </span>
          )}
          <StatusPill status={status} t={t} />
        </div>

        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={awayFlag} alt={awayName || tbd} dim={homeWon} />
          <span className={teamCls(awayWon, homeWon)}>{awayName || tbd}</span>
        </div>
      </div>
    </div>
  );
}
