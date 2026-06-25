import { useT } from '../i18n';
import type { Match } from '../types';

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

export default function Player({ match, selectedIframeUrl, setSelectedIframeUrl }: PlayerProps) {
  const t = useT();

  if (!match) {
    return (
      <div className="relative h-full min-h-[60vh] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex items-center justify-center">
        <CornerTicks />
        <div className="text-center px-8">
          <div className="font-mono text-xs tracking-[0.3em] text-pitch mb-4">{t('common.standby')}</div>
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

  const sources = [
    { iframe: match.iframe, label: match.sourceTag || t('live.source') },
    ...(match.substreams ?? []).map((s) => ({ iframe: s.iframe, label: s.source_tag || s.name })),
  ];

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full rounded-2xl border border-white/10 bg-black overflow-hidden">
        <CornerTicks />
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-md bg-night/80 backdrop-blur-sm border border-live/40 shadow-[0_0_10px_rgba(255,68,56,0.35)]">
          <span className="live-dot" />
          <span className="font-mono text-xs tracking-widest text-live">{t('status.live')}</span>
        </div>

        {selectedIframeUrl && (
          <iframe
            key={selectedIframeUrl}
            src={selectedIframeUrl}
            title={match.name}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5 space-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim">
              {match.category_name}
            </span>
            <span className="font-mono text-[10px] text-pitch flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-pitch" />
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
            {sources.map((src, i) => {
              const active = selectedIframeUrl === src.iframe;
              const q = qualityBadge(src.label);
              return (
                <button
                  key={`${i}-${src.iframe}`}
                  onClick={() => setSelectedIframeUrl(src.iframe)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    active
                      ? 'bg-pitch text-night border-pitch'
                      : 'border-white/10 bg-white/[0.03] text-chalkdim hover:text-chalk hover:border-white/25'
                  }`}
                >
                  <span className="truncate max-w-[14rem]">{src.label}</span>
                  {q && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${
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
