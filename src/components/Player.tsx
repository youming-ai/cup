import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, SpeakerHigh, SpeakerSimpleX, CornersOut } from '@phosphor-icons/react';
import { useT } from '../i18n';
import type { Match } from '../types';

// 同源调用：nginx 把 /extract 反代到内部的 grab 服务（dev 由 vite proxy 转发）
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
        const res = await fetch(`/extract?url=${encodeURIComponent(selectedIframeUrl)}`, {
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

  const wrapRef = useRef<HTMLDivElement>(null); // fullscreen target
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setStarted(false);
  }, [selectedIframeUrl]);

  // Load the (proxied) m3u8 into the <video> via hls.js, and mirror play/mute state.
  const m3u8 = extract.status === 'ready' ? extract.m3u8 : null;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !m3u8) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(m3u8);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setExtract({ status: 'error', message: data.details || 'playback error' });
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8; // Safari / iOS native HLS
    }

    const reveal = () => setStarted(true);
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    const onVol = () => setMuted(video.muted);
    video.addEventListener('canplay', reveal);
    video.addEventListener('playing', reveal);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVol);

    return () => {
      hls?.destroy();
      video.removeEventListener('canplay', reveal);
      video.removeEventListener('playing', reveal);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVol);
    };
  }, [m3u8]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (v) (v.paused ? v.play() : v.pause());
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

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
      <div ref={wrapRef} className="relative aspect-video w-full rounded-2xl border border-white/10 bg-black overflow-hidden">
        <CornerTicks />
        {started && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-md bg-night/80 backdrop-blur-sm border border-live/40 shadow-[0_0_10px_rgba(255,68,56,0.35)]">
            <span className="live-dot" />
            <span className="font-mono text-xs tracking-widest text-live">{t('status.live')}</span>
          </div>
        )}

        {extract.status === 'ready' && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        )}

        {/* live-stream controls — no timeline (it's a live feed) */}
        {started && (
          <div className="absolute bottom-0 inset-x-0 z-20 flex items-center gap-4 px-4 py-3 bg-gradient-to-t from-night/90 via-night/40 to-transparent">
            <button
              onClick={togglePlay}
              aria-label={paused ? 'Play' : 'Pause'}
              className="text-chalk hover:text-pitch transition-colors"
            >
              {paused ? <Play weight="fill" className="w-5 h-5" /> : <Pause weight="fill" className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="text-chalk hover:text-pitch transition-colors"
            >
              {muted ? <SpeakerSimpleX className="w-5 h-5" /> : <SpeakerHigh className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              className="ml-auto text-chalk hover:text-pitch transition-colors"
            >
              <CornersOut className="w-5 h-5" />
            </button>
          </div>
        )}

        {extract.status === 'error' ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-night">
            <div className="font-mono text-xs tracking-[0.3em] text-live mb-2">{t('common.signalLost')}</div>
            <p className="font-display font-semibold text-lg text-chalk">{t('player.extractFailed')}</p>
            <p className="font-body text-sm text-chalkdim mt-1">{t('player.tryAnother')}</p>
            <p className="font-mono text-[10px] text-chalkdim/60 mt-3 max-w-sm break-words">{extract.message}</p>
          </div>
        ) : (
          (extract.status === 'loading' || (extract.status === 'ready' && !started)) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-night">
              <span className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse motion-reduce:animate-none">
                {t('player.extracting')}
              </span>
            </div>
          )
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
