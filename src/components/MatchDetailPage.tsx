import { type KeyboardEvent as ReactKeyboardEvent, useState } from 'react';
import { useMatchDetail } from '../hooks/useMatchDetail';
import { useT } from '../i18n';
import type { WCMatch } from '../types';
import LineupTab from './matchdetail/LineupTab';
import PlayByPlayTab from './matchdetail/PlayByPlayTab';
import TeamStatsTab from './matchdetail/TeamStatsTab';

type Tab = 'stats' | 'play' | 'lineup';

function StatusBadge({
  status,
  progress,
  t,
}: {
  status: 'upcoming' | 'live' | 'finished';
  progress: WCMatch['progress'];
  t: (k: string) => string;
}) {
  if (status === 'live') {
    const isHT = progress?.status === 'halftime';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full font-mono text-[10px] font-bold tracking-wider uppercase select-none ${
          isHT
            ? 'bg-amber/25 text-amber border border-amber/30'
            : 'bg-live/25 text-live border border-live/30'
        }`}
      >
        {!isHT && <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />}
        {isHT ? t('status.ht') : progress?.displayClock || t('status.live')}
      </span>
    );
  }
  if (status === 'finished') {
    return (
      <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-chalkdim/10 text-chalkdim border border-white/10 font-mono text-[10px] font-bold tracking-wider uppercase select-none">
        {t('status.ft')}
      </span>
    );
  }
  return null;
}

export default function MatchDetailPage({ match, onBack }: { match: WCMatch; onBack: () => void }) {
  const t = useT();
  const { detail, loading, error, reload } = useMatchDetail(match.id);
  const [tab, setTab] = useState<Tab>('stats');

  const homeId = detail?.homeId ?? '';

  // Wrap tab navigation in a button-onclick trap so keyboard users can
  // Tab between the three tab buttons without leaving the page header.
  const onTabKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const order: Tab[] = ['stats', 'play', 'lineup'];
    const i = order.indexOf(tab);
    const next =
      e.key === 'ArrowRight'
        ? order[(i + 1) % order.length]
        : order[(i + order.length - 1) % order.length];
    if (next) setTab(next);
  };

  return (
    // Identical frame to the schedule/header (px OUTSIDE, max-w-6xl INSIDE) so
    // the content column lines up exactly — padding inside max-w would shift it
    // in by one p-6 and break alignment.
    <div className="px-4 md:px-6 py-4 md:py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Back navigation */}
        <div>
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-xs tracking-widest text-chalkdim hover:text-chalk transition-colors inline-flex items-center gap-1.5 py-1"
            aria-label={t('detail.back')}
          >
            ← <span>{t('detail.back')}</span>
          </button>
        </div>

        {/* Hero Scoreboard (Apple Sports style) */}
        <div className="bg-gradient-to-b from-panel/95 to-panel/85 rounded-[24px] md:rounded-[32px] p-6 md:p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-xl border border-line/30 backdrop-blur-md">
          {/* Subtle radial glow background circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-pitch/5 rounded-full blur-3xl pointer-events-none select-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-live/5 rounded-full blur-3xl pointer-events-none select-none" />
          {/* Stage/Group Label */}
          <div className="text-center mb-5 shrink-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim">
              {match.stage === 'group'
                ? `${t('common.group')} ${match.group}`
                : t(`stage.${match.stage}`)}
            </span>
          </div>

          <div className="flex items-center justify-between w-full max-w-2xl gap-4">
            {/* Home Team */}
            <div className="flex-1 flex flex-col items-center text-center min-w-0">
              <div className="w-14 h-10 md:w-20 md:h-14 overflow-hidden rounded-xl bg-panel2 shadow-lg mb-3 border border-white/10 shrink-0">
                {match.homeFlag ? (
                  <img
                    src={match.homeFlag}
                    alt={match.homeName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-panel2" />
                )}
              </div>
              <span className="font-display text-base md:text-xl font-bold text-chalk truncate max-w-full">
                {match.homeName}
              </span>
            </div>

            {/* Score & Status */}
            <div className="flex flex-col items-center justify-center shrink-0 px-2 sm:px-6">
              {match.status === 'upcoming' ? (
                <div className="text-center">
                  <span className="font-mono text-xl md:text-3xl font-black tracking-wider text-chalk">
                    {match.kickoff
                      ? match.kickoff.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : t('common.tbd')}
                  </span>
                  {match.kickoff && (
                    <div className="font-mono text-[10px] text-chalkdim mt-1.5">
                      {match.kickoff.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center gap-4 sm:gap-8 font-display text-4xl md:text-6xl font-black text-chalk tabular-nums select-none leading-none">
                    <span>{match.homeScore ?? 0}</span>
                    <span className="text-chalkdim/30 text-2xl md:text-3xl font-light font-body select-none">
                      :
                    </span>
                    <span>{match.awayScore ?? 0}</span>
                  </div>
                  <div className="mt-3.5">
                    <StatusBadge status={match.status} progress={match.progress} t={t} />
                  </div>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 flex flex-col items-center text-center min-w-0">
              <div className="w-14 h-10 md:w-20 md:h-14 overflow-hidden rounded-xl bg-panel2 shadow-lg mb-3 border border-white/10 shrink-0">
                {match.awayFlag ? (
                  <img
                    src={match.awayFlag}
                    alt={match.awayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-panel2" />
                )}
              </div>
              <span className="font-display text-base md:text-xl font-bold text-chalk truncate max-w-full">
                {match.awayName}
              </span>
            </div>
          </div>
        </div>

        {/* Tab List (Segmented Control style) */}
        <div
          role="tablist"
          aria-label={t('detail.tabsLabel')}
          onKeyDown={onTabKey}
          className="flex bg-panel/60 rounded-full p-1 border border-line/20 backdrop-blur-md"
        >
          {(['stats', 'play', 'lineup'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              onClick={() => setTab(k)}
              aria-selected={tab === k}
              className={`flex-1 py-2 rounded-full font-display text-sm transition-all duration-200 ${
                tab === k
                  ? 'bg-white/10 text-chalk shadow-sm font-bold'
                  : 'text-chalkdim hover:text-chalk'
              }`}
            >
              {t(
                k === 'stats'
                  ? 'detail.stats'
                  : k === 'play'
                    ? 'detail.playByPlay'
                    : 'detail.lineup',
              )}
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="bg-panel/75 rounded-[24px] md:rounded-[32px] p-6 min-h-32 shadow-xl border border-line/30 backdrop-blur-md">
          {loading ? (
            <p className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse p-6 text-center">
              {t('common.loading')}
            </p>
          ) : error ? (
            <div className="p-6 text-center space-y-3">
              <p className="font-mono text-xs text-live">{t('common.error')}</p>
              <button
                type="button"
                onClick={reload}
                className="font-display text-sm text-chalk border border-white/10 rounded-full px-5 py-1.5 hover:border-pitch hover:bg-white/5 transition-colors"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : detail ? (
            <>
              {tab === 'stats' && <TeamStatsTab stats={detail.stats} />}
              {tab === 'play' && (
                <PlayByPlayTab
                  allPlays={detail.allPlays}
                  keyPlays={detail.keyPlays}
                  homeId={homeId}
                />
              )}
              {tab === 'lineup' && <LineupTab lineups={detail.lineups} homeId={homeId} />}
              {(detail.venue || detail.attendance) && (
                <div className="pt-5 mt-5 border-t border-white/5 font-mono text-[10px] text-chalkdim space-y-1.5">
                  {detail.venue && <div>{detail.venue}</div>}
                  {detail.attendance && (
                    <div>
                      {t('detail.attendance')}: {detail.attendance.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
