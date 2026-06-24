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

function Flag({ src, alt }: { src?: string; alt: string }) {
  if (!src) return <div className="w-10 h-7 rounded bg-white/10" aria-hidden />;
  return <img src={src} alt={alt} className="w-10 h-7 object-cover rounded shadow" />;
}

export default function MatchCard(p: MatchCardProps) {
  const t = useT();

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={p.homeFlag} alt={p.homeName || t('common.tbd')} />
          <span className="font-display font-semibold text-sm text-chalk text-center truncate w-full">
            {p.homeName || t('common.tbd')}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 px-2">
          {p.status === 'upcoming' ? (
            <span className="font-mono text-sm text-chalkdim tabular-nums whitespace-nowrap">
              {p.kickoff
                ? p.kickoff.toLocaleString(undefined, {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })
                : t('common.tbd')}
            </span>
          ) : (
            <span className="font-mono text-4xl font-bold text-chalk tabular-nums leading-none whitespace-nowrap">
              {`${p.homeScore ?? 0} : ${p.awayScore ?? 0}`}
            </span>
          )}
          <StatusPill status={p.status} t={t} />
        </div>

        <div className="flex flex-col items-center gap-2 min-w-0">
          <Flag src={p.awayFlag} alt={p.awayName || t('common.tbd')} />
          <span className="font-display font-semibold text-sm text-chalk text-center truncate w-full">
            {p.awayName || t('common.tbd')}
          </span>
        </div>
      </div>
    </div>
  );
}
