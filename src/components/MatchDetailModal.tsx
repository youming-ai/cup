import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useMatchDetail } from '../hooks/useMatchDetail';
import { useT } from '../i18n';
import type { WCMatch } from '../types';
import LineupTab from './matchdetail/LineupTab';
import PlayByPlayTab from './matchdetail/PlayByPlayTab';
import TeamStatsTab from './matchdetail/TeamStatsTab';

type Tab = 'stats' | 'play' | 'lineup';

export default function MatchDetailModal({
  match,
  onClose,
}: {
  match: WCMatch;
  onClose: () => void;
}) {
  const t = useT();
  const { detail, loading, error, reload } = useMatchDetail(match.id);
  const [tab, setTab] = useState<Tab>('stats');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keep keyboard focus inside the dialog while it is open.
  const onTrapKey = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const homeId = detail?.homeId ?? '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-night/80 p-4 overflow-y-auto"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClose();
        }
      }}
      // A <button> backdrop can't legally contain the role="dialog" panel
      // (interactive descendants), so the backdrop is a <div> with role +
      // tabindex + keyboard handler. The a11y/useSemanticElements rule is
      // disabled for this file in biome.json. The role is intentionally
      // unlabeled — the close button inside the panel is the labelled
      // dismiss affordance, and this backdrop is just a click target.
      role="button"
      tabIndex={-1}
    >
      <div
        className="w-full max-w-lg bg-night border border-line my-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onTrapKey}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-display text-sm text-chalk truncate">
            {match.homeName} {match.homeScore ?? ''} : {match.awayScore ?? ''} {match.awayName}
          </span>
          <button
            type="button"
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
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`flex-1 py-2.5 font-display text-sm transition-colors ${
                tab === k ? 'text-chalk border-b-2 border-pitch' : 'text-chalkdim hover:text-chalk'
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

        {/* body */}
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
