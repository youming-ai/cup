import { useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaOutlet } from '@vidstack/react';
import { useT } from '../i18n';
import type { Match } from '../types';

// m3u8-extractor 服务基址（dev 默认本地 :3000；生产用 VITE_EXTRACTOR_URL 配置）
const EXTRACTOR = import.meta.env.VITE_EXTRACTOR_URL || 'http://localhost:3000';

interface PlayerProps {
  match: Match | null;
  selectedIframeUrl: string;
  setSelectedIframeUrl: (url: string) => void;
}

type ExtractState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; m3u8: string }
  | { status: 'error'; message: string };

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

interface ExtractResponse {
  ok?: boolean;
  m3u8?: string;
  error?: string;
}

export default function Player({ match, selectedIframeUrl, setSelectedIframeUrl }: PlayerProps) {
  const t = useT();
  const [extract, setExtract] = useState<ExtractState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // 选中信源（embed URL）后实时提取 m3u8
  useEffect(() => {
    if (!selectedIframeUrl) {
      setExtract({ status: 'idle' });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setExtract({ status: 'loading' });

    (async () => {
      try {
        const res = await fetch(`${EXTRACTOR}/extract?url=${encodeURIComponent(selectedIframeUrl)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as ExtractResponse;
        if (controller.signal.aborted) return;
        if (!res.ok || !data.ok || !data.m3u8) {
          throw new Error(data.error || 'extract failed');
        }
        setExtract({ status: 'ready', m3u8: data.m3u8 });
      } catch (err: unknown) {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        setExtract({ status: 'error', message: err instanceof Error ? err.message : 'extract failed' });
      }
    })();

    return () => controller.abort();
  }, [selectedIframeUrl]);

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

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full rounded-2xl border border-white/10 bg-black overflow-hidden">
        <CornerTicks />
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-md bg-night/80 backdrop-blur-sm border border-live/40 shadow-[0_0_10px_rgba(255,68,56,0.35)]">
          <span className="live-dot" />
          <span className="font-mono text-xs tracking-widest text-live">{t('status.live')}</span>
        </div>

        {extract.status === 'ready' ? (
          <MediaPlayer
            title={match.name}
            src={{ src: extract.m3u8, type: 'application/x-mpegurl' }}
            autoPlay
            playsInline
            controls
            className="absolute inset-0 w-full h-full"
          >
            <MediaOutlet />
          </MediaPlayer>
        ) : extract.status === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-night">
            <div className="font-mono text-xs tracking-[0.3em] text-live mb-2">{t('common.signalLost')}</div>
            <p className="font-display font-semibold text-lg text-chalk">{t('player.extractFailed')}</p>
            <p className="font-body text-sm text-chalkdim mt-1">{t('player.tryAnother')}</p>
            <p className="font-mono text-[10px] text-chalkdim/60 mt-3 max-w-sm break-words">{extract.message}</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-night">
            <span className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse motion-reduce:animate-none">
              {t('player.extracting')}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim">
              {match.category_name}
            </span>
            <span className="font-mono text-[10px] text-pitch flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-pitch" />
              {t('common.watching', { n: match.viewers })}
            </span>
          </div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-chalk tracking-wide truncate">
            {match.name}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => setSelectedIframeUrl(match.iframe)}
            aria-pressed={selectedIframeUrl === match.iframe}
            className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider border transition-colors ${
              selectedIframeUrl === match.iframe
                ? 'bg-pitch text-night border-pitch'
                : 'border-pitch/30 text-chalkdim/90 hover:text-chalk hover:border-pitch/60'
            }`}
          >
            {t('live.source')} 01
          </button>
          {match.substreams?.map((sub, i) => (
            <button
              key={sub.id}
              onClick={() => setSelectedIframeUrl(sub.iframe)}
              aria-pressed={selectedIframeUrl === sub.iframe}
              className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider border transition-colors ${
                selectedIframeUrl === sub.iframe
                  ? 'bg-pitch text-night border-pitch'
                  : 'border-pitch/30 text-chalkdim/90 hover:text-chalk hover:border-pitch/60'
              }`}
            >
              {t('live.source')} {String(i + 2).padStart(2, '0')}
              <span className="ml-1 opacity-70">{sub.source_tag || sub.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
