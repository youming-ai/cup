import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useMatchDetail } from '../hooks/useMatchDetail';
import TeamStatsTab from './matchdetail/TeamStatsTab';
import PlayByPlayTab from './matchdetail/PlayByPlayTab';
import LineupTab from './matchdetail/LineupTab';
import type { WCMatch } from '../types';

type Tab = 'stats' | 'play' | 'lineup';

export default function MatchDetailModal({ match, onClose }: { match: WCMatch; onClose: () => void }) {
  const t = useT();
  const { detail, loading, error } = useMatchDetail(match.id);
  const [tab, setTab] = useState<Tab>('stats');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const homeId = detail?.homeId ?? '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-night/80 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-night border border-line my-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-display text-sm text-chalk truncate">
            {match.homeName} {match.homeScore ?? ''} : {match.awayScore ?? ''} {match.awayName}
          </span>
          <button
            onClick={onClose}
            aria-label={t('detail.close')}
            className="text-chalkdim hover:text-chalk px-2 font-mono"
          >
            ✕
          </button>
        </div>

        {/* tabs */}
        <div className="flex border-b border-line">
          {(['stats', 'play', 'lineup'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`flex-1 py-2.5 font-display text-sm transition-colors ${
                tab === k ? 'text-chalk border-b-2 border-pitch' : 'text-chalkdim hover:text-chalk'
              }`}
            >
              {t(k === 'stats' ? 'detail.stats' : k === 'play' ? 'detail.playByPlay' : 'detail.lineup')}
            </button>
          ))}
        </div>

        {/* body */}
        {loading ? (
          <p className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse p-6 text-center">
            {t('common.loading')}
          </p>
        ) : error ? (
          <p className="font-mono text-xs text-live p-6 text-center">{error}</p>
        ) : detail ? (
          <>
            {tab === 'stats' && <TeamStatsTab stats={detail.stats} />}
            {tab === 'play' && (
              <PlayByPlayTab allPlays={detail.allPlays} keyPlays={detail.keyPlays} homeId={homeId} />
            )}
            {tab === 'lineup' && <LineupTab lineups={detail.lineups} homeId={homeId} />}
            {(detail.venue || detail.attendance) && (
              <div className="px-4 py-3 border-t border-line font-mono text-[10px] text-chalkdim space-y-1">
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
