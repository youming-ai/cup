import { type KeyboardEvent as ReactKeyboardEvent, useState } from 'react';
import { useMatchDetail } from '../hooks/useMatchDetail';
import { useT } from '../i18n';
import type { WCMatch } from '../types';
import LineupTab from './matchdetail/LineupTab';
import PlayByPlayTab from './matchdetail/PlayByPlayTab';
import TeamStatsTab from './matchdetail/TeamStatsTab';

type Tab = 'stats' | 'play' | 'lineup';

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
    // max-w-6xl matches the schedule so detail pages share its width instead
    // of sitting in a narrower, off-aligned column.
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-xs tracking-widest text-chalkdim hover:text-chalk transition-colors inline-flex items-center gap-1"
          aria-label={t('detail.back')}
        >
          ← <span>{t('detail.back')}</span>
        </button>
        <span className="font-display text-sm text-chalk truncate">
          {match.homeName} {match.homeScore ?? ''} : {match.awayScore ?? ''} {match.awayName}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t('detail.tabsLabel')}
        onKeyDown={onTabKey}
        className="flex border-b border-line"
      >
        {(['stats', 'play', 'lineup'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            onClick={() => setTab(k)}
            aria-selected={tab === k}
            className={`flex-1 py-2.5 font-display text-sm transition-colors ${
              tab === k ? 'text-chalk border-b-2 border-pitch' : 'text-chalkdim hover:text-chalk'
            }`}
          >
            {t(
              k === 'stats' ? 'detail.stats' : k === 'play' ? 'detail.playByPlay' : 'detail.lineup',
            )}
          </button>
        ))}
      </div>

      <div className="border border-line bg-panel p-4 min-h-32">
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
              className="font-display text-sm text-chalk border border-line px-4 py-1.5 hover:border-pitch transition-colors"
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
              <div className="pt-4 mt-4 border-t border-line font-mono text-[10px] text-chalkdim space-y-1">
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
  );
}
