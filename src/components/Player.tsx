import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import type { Match } from '../types';
import { isTrustedStreamUrl } from '../utils/streamSources';

interface PlayerProps {
  match: Match | null;
  selectedIframeUrl: string;
  setSelectedIframeUrl: (url: string) => void;
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

// ppv.to feeds carry only a language code (not a country), so a flag would be a
// guess — show the broadcaster tag + a quality badge for 4K/UHD feeds instead.
function qualityBadge(label: string): string | null {
  return /\b4k\b/i.test(label) || /\buhd\b/i.test(label) ? '4K' : null;
}

// Derive a coarse live-state for the player overlay from the match's
// `alwaysLive` flag + kickoff window. The feed only carries a 2-state status,
// so HT/FT detection here is best-effort:
//   - alwaysLive matches are treated as `live`
//   - now past endsAt = `finished`; before startsAt = `upcoming`
//   - 35-60min into a non-alwaysLive window = likely HT (heuristic)
// The detailed HT/FT state for ESPN-backed matches lives on `WCMatch.progress`
// (MatchCard); this overlay is intentionally simpler.
function playerStatus(match: Match): 'live' | 'ht' | 'finished' | 'upcoming' {
  if (match.alwaysLive) return 'live';
  const now = Math.floor(Date.now() / 1000);
  if (match.endsAt && now > match.endsAt) return 'finished';
  if (match.startsAt && now < match.startsAt) return 'upcoming';
  // ponytail: HT heuristic — 35-60min after kickoff is the likely break window
  if (match.startsAt) {
    const minutesIn = (now - match.startsAt) / 60;
    if (minutesIn >= 35 && minutesIn <= 60) return 'ht';
  }
  return 'live';
}

// Top-left status badge over the iframe. Mirrors MatchCard's status pill but
// tuned for the dark video background: live → red pulse, ht → amber, finished
// / upcoming → muted.
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

export default function Player({ match, selectedIframeUrl, setSelectedIframeUrl }: PlayerProps) {
  const t = useT();
  const sources = useMemo(() => {
    if (!match) return [];
    const raw = [
      { iframe: match.iframe, label: match.sourceTag || t('live.source') },
      ...(match.substreams ?? []).map((s) => ({ iframe: s.iframe, label: s.source_tag || s.name })),
    ];
    return raw
      .filter((src) => isTrustedStreamUrl(src.iframe))
      .filter((src, index, all) => all.findIndex((item) => item.iframe === src.iframe) === index);
  }, [match, t]);
  const activeIframeUrl = sources.some((src) => src.iframe === selectedIframeUrl)
    ? selectedIframeUrl
    : '';

  // 切换线路 / 进入直播时，iframe 重新加载 —— 在其 onLoad 前盖一层信号接入动画
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
  }, []);
  useEffect(() => {
    if (!match) return;
    const fallback = sources[0]?.iframe ?? '';
    if (selectedIframeUrl !== fallback && !activeIframeUrl) {
      setSelectedIframeUrl(fallback);
    }
  }, [activeIframeUrl, match, selectedIframeUrl, setSelectedIframeUrl, sources]);

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

        {activeIframeUrl && (
          <iframe
            key={activeIframeUrl}
            src={activeIframeUrl}
            title={match.name}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoading(false)}
            className="absolute inset-0 w-full h-full"
          />
        )}

        {activeIframeUrl && loading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black"
            aria-live="polite"
          >
            <span className="live-dot" />
            <span className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse motion-reduce:animate-none">
              {t('common.loading')}
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
            <span className="font-mono text-[10px] text-pitch flex items-center gap-1">
              <span className="w-1 h-1 bg-pitch" />
              {t('common.watching', { n: match.viewers })}
            </span>
          </div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-chalk tracking-wide">
            {match.name}
          </h1>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-chalkdim mb-2.5">
            {t('live.sources')}
          </p>
          <div className="flex flex-wrap gap-2">
            {sources.map((src) => {
              const active = activeIframeUrl === src.iframe;
              const q = qualityBadge(src.label);
              return (
                <button
                  // iframe URL is unique per source, so it's a stable key on
                  // its own — array index would only matter if the same URL
                  // could appear twice in `sources`, which the dedupe above
                  // already prevents.
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
                  {q && (
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                        active ? 'bg-night/20 text-night' : 'bg-pitch/15 text-pitch'
                      }`}
                    >
                      {q}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
