import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { Match } from '../types';
import { isTrustedStreamUrl } from '../utils/streamSources';

interface PlayerProps {
  match: Match | null;
}

// Derive a coarse live-state for the player overlay from streamed.pk's
// `alwaysLive` flag + the configured kickoff window. streamed.pk's Match
// type only carries a 2-state status ('live' | 'upcoming'), so HT/FT
// detection here is best-effort:
//   - alwaysLive matches are treated as `live`
//   - matches with startsAt in the future show as `upcoming`
//   - 45-60min into a non-alwaysLive window = likely HT (heuristic)
// The detailed HT/FT state for ESPN-backed matches is handled in
// `MatchCard` via `WCMatch.progress` — this overlay is intentionally
// simpler so it works against the streamed.pk data source.
function playerStatus(match: Match): 'live' | 'ht' | 'finished' | 'upcoming' {
  if (match.alwaysLive) return 'live';
  const now = Math.floor(Date.now() / 1000);
  if (match.endsAt && now > match.endsAt) return 'finished';
  if (match.startsAt && now < match.startsAt) return 'upcoming';
  // Half-time heuristic: 35-60 minutes after kickoff is the most likely
  // break window for a regulation 90+ minute football match.
  if (match.startsAt) {
    const minutesIn = (now - match.startsAt) / 60;
    if (minutesIn >= 35 && minutesIn <= 60) return 'ht';
  }
  return 'live';
}

// One stream object from streamed.pk's /api/stream/{source}/{id}.
interface APIStreamObj {
  language?: string;
  hd?: boolean;
  embedUrl: string;
}

interface Source {
  iframe: string;
  label: string;
  hd: boolean;
}

function CornerTicks() {
  const base = 'absolute w-4 h-4 border-pitch/70 pointer-events-none z-10';
  return (
    <>
      <span className={`${base} top-2 left-2 border-t-2 border-l-2`} />
      <span className={`${base} top-2 right-2 border-t-2 border-r-2`} />
      <span className={`${base} bottom-2 left-2 border-b-2 border-l-2`} />
      <span className={`${base} bottom-2 right-2 border-b-2 border-r-2`} />
    </>
  );
}

// Top-left status badge over the iframe. Mirrors MatchCard's status pill but
// tuned for the dark video background:
//   - live   → red `LIVE` with pulse dot
//   - ht     → amber `HT` (distinct from LIVE)
//   - finished → muted `Final`
//   - upcoming → muted `Upcoming`
function PlayerStatusBadge({
  status,
  t,
}: {
  status: 'live' | 'ht' | 'finished' | 'upcoming';
  t: (k: string) => string;
}) {
  if (status === 'ht') {
    return (
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-pitch/60 shadow-[0_0_10px_rgb(var(--c-pitch)_/_0.35)]">
        <span className="font-mono text-xs tracking-widest text-pitch">{t('status.ht')}</span>
      </div>
    );
  }
  if (status === 'live') {
    return (
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-live/40 shadow-[0_0_10px_rgb(var(--c-live)_/_0.35)]">
        <span className="live-dot" />
        <span className="font-mono text-xs tracking-widest text-live">{t('status.live')}</span>
      </div>
    );
  }
  if (status === 'finished') {
    return (
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-chalkdim/40">
        <span className="font-mono text-xs tracking-widest text-chalkdim">{t('status.ft')}</span>
      </div>
    );
  }
  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-chalkdim/40">
      <span className="font-mono text-xs tracking-widest text-chalkdim/70">
        {t('status.upcoming')}
      </span>
    </div>
  );
}

export default function Player({ match }: PlayerProps) {
  const t = useT();
  const [sources, setSources] = useState<Source[]>([]);
  const [resolving, setResolving] = useState(true);
  const [selectedIframeUrl, setSelectedIframeUrl] = useState('');

  // Resolve the match's {source, id} refs into embed URLs. streamed.pk needs a
  // second fetch per source, so this happens on open (not in the match list).
  useEffect(() => {
    if (!match) return;
    const controller = new AbortController();
    setResolving(true);
    setSources([]);
    setSelectedIframeUrl('');
    (async () => {
      try {
        const lists = await Promise.all(
          match.streamSources.map((s) =>
            fetch(`https://streamed.pk/api/stream/${s.source}/${s.id}`, {
              signal: controller.signal,
            })
              .then((r) => (r.ok ? (r.json() as Promise<APIStreamObj[]>) : []))
              .catch(() => [] as APIStreamObj[]),
          ),
        );
        if (controller.signal.aborted) return;
        const flat = lists
          .flat()
          .filter((s) => isTrustedStreamUrl(s.embedUrl))
          .map(
            (s): Source => ({
              iframe: s.embedUrl,
              label: s.language || t('live.source'),
              hd: Boolean(s.hd),
            }),
          )
          .filter((s, i, all) => all.findIndex((x) => x.iframe === s.iframe) === i);
        setSources(flat);
        setSelectedIframeUrl(flat[0]?.iframe ?? '');
      } finally {
        if (!controller.signal.aborted) setResolving(false);
      }
    })();
    return () => controller.abort();
  }, [match, t]);

  // iframe 加载完成前盖一层信号接入动画；切换线路时 iframe 因 key 改变而重挂，
  // onLoad 再次触发 setLoading(false)
  const [loading, setLoading] = useState(true);

  if (!match) {
    return (
      <div className="relative h-full min-h-[60vh] border border-line bg-panel overflow-hidden flex items-center justify-center">
        <CornerTicks />
        <div className="text-center px-8">
          <div className="font-mono text-xs tracking-[0.3em] text-pitch mb-4">
            {t('common.standby')}
          </div>
          <h2 className="font-display font-bold text-3xl text-chalk tracking-wide mb-3">
            {t('live.standbyTitle')}
          </h2>
          <p className="font-body text-sm text-chalkdim max-w-sm mx-auto leading-relaxed">
            {t('live.standbyBody')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full border border-line bg-black overflow-hidden">
        <CornerTicks />
        <PlayerStatusBadge status={playerStatus(match)} t={t} />

        {selectedIframeUrl && (
          <iframe
            key={selectedIframeUrl}
            src={selectedIframeUrl}
            title={match.name}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoading(false)}
            className="absolute inset-0 w-full h-full"
          />
        )}

        {(resolving || (selectedIframeUrl && loading) || !selectedIframeUrl) && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black"
            aria-live="polite"
          >
            <span className="live-dot" />
            <span className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse motion-reduce:animate-none">
              {resolving || selectedIframeUrl ? t('common.loading') : t('live.noSource')}
            </span>
          </div>
        )}
      </div>

      <div className="border border-line bg-panel p-4 sm:p-5 space-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim">
              {match.category_name}
            </span>
          </div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-chalk tracking-wide">
            {match.name}
          </h1>
        </div>

        {sources.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-chalkdim mb-2.5">
              {t('live.sources')}
            </p>
            <div className="flex flex-wrap gap-2">
              {sources.map((src) => {
                const active = selectedIframeUrl === src.iframe;
                return (
                  <button
                    key={src.iframe}
                    type="button"
                    onClick={() => setSelectedIframeUrl(src.iframe)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 px-3 py-2 border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-pitch text-night border-pitch'
                        : 'border-line bg-panel2 text-chalkdim hover:text-chalk hover:border-chalkdim'
                    }`}
                  >
                    <span className="truncate max-w-[14rem]">{src.label}</span>
                    {src.hd && (
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                          active ? 'bg-night/20 text-night' : 'bg-pitch/15 text-pitch'
                        }`}
                      >
                        HD
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
