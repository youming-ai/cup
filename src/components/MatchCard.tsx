import { memo } from 'react';
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
  homeScorers?: string[];
  awayScorers?: string[];
  venue?: string;
  onOpen?: () => void;
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
    return (
      <span className="font-mono text-[10px] tracking-widest text-chalkdim">{t('status.ft')}</span>
    );
  }
  return (
    <span className="font-mono text-[10px] tracking-widest text-chalkdim/70">
      {t('status.upcoming')}
    </span>
  );
}

function Flag({ src, alt, dim }: { src?: string; alt: string; dim?: boolean }) {
  const cls = dim ? 'opacity-50' : '';
  const size = 'w-8 h-6 sm:w-10 sm:h-7';
  if (!src) return <div className={`${size} bg-panel2 ${cls}`} aria-hidden />;
  return <img src={src} alt={alt} className={`${size} object-cover ${cls}`} />;
}

export default memo(function MatchCard({
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
  homeScorers = [],
  awayScorers = [],
  venue,
  onOpen,
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

  const clickable = Boolean(onOpen);
  const Root = clickable ? 'button' : 'div';
  return (
    <Root
      {...(clickable ? { onClick: onOpen, type: 'button' as const } : {})}
      className={`block w-full text-left border border-line bg-panel overflow-hidden transition-colors ${
        clickable ? 'hover:border-pitch cursor-pointer' : 'hover:border-chalkdim'
      }`}
    >
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

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4">
        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={homeFlag} alt={homeName || tbd} dim={awayWon} />
          <span className={teamCls(homeWon, awayWon)}>{homeName || tbd}</span>
        </div>

        <div className="flex flex-col items-center gap-1 px-1 sm:px-2">
          {status === 'upcoming' ? (
            <span className="font-mono text-sm sm:text-lg font-bold text-chalk tabular-nums whitespace-nowrap leading-none">
              {kickoff
                ? kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : tbd}
            </span>
          ) : (
            <span className="font-mono text-2xl sm:text-4xl font-bold text-chalk tabular-nums leading-none whitespace-nowrap">
              {/* Screen-reader-friendly full-score announcement; visually hidden. */}
              <span className="sr-only">
                {`${homeName || tbd} ${homeScore ?? 0} - ${awayName || tbd} ${awayScore ?? 0}`}
              </span>
              <span aria-hidden>{`${homeScore ?? 0} : ${awayScore ?? 0}`}</span>
            </span>
          )}
          <StatusPill status={status} t={t} />
        </div>

        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={awayFlag} alt={awayName || tbd} dim={homeWon} />
          <span className={teamCls(awayWon, homeWon)}>{awayName || tbd}</span>
        </div>
      </div>

      {(homeScorers.length > 0 || awayScorers.length > 0) && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-3 -mt-1">
          <ul className="space-y-0.5 text-[11px] text-chalkdim leading-tight min-w-0">
            {homeScorers.map((s) => (
              <li key={s} className="truncate">
                ⚽ {s}
              </li>
            ))}
          </ul>
          <ul className="space-y-0.5 text-[11px] text-chalkdim leading-tight text-right min-w-0">
            {awayScorers.map((s) => (
              <li key={s} className="truncate">
                {s} ⚽
              </li>
            ))}
          </ul>
        </div>
      )}

      {venue && (
        <div className="px-4 py-2 border-t border-line">
          <span className="font-mono text-[10px] text-chalkdim/70 truncate block">{venue}</span>
        </div>
      )}
    </Root>
  );
});
