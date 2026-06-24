import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Radio } from 'lucide-react';
import Hls from 'hls.js';
import { Match, Channel } from '../types';

interface PlayerProps {
  selectedItem: Match | Channel | null;
  mode: 'events' | 'channels';
  selectedIframeUrl: string;
  setSelectedIframeUrl: (url: string) => void;
}

// 转播摄像取景角标 —— 本设计的签名元素
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

// 导播机位选择器
function FeedButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded font-mono text-xs tracking-wider border transition-colors ${
        active
          ? 'bg-pitch text-night border-pitch'
          : 'border-line text-chalkdim hover:text-chalk hover:border-chalkdim'
      }`}
    >
      {label}
      {sub && <span className="ml-1 opacity-70">{sub}</span>}
    </button>
  );
}

export default function Player({
  selectedItem,
  mode,
  selectedIframeUrl,
  setSelectedIframeUrl,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  // 初始化信源（赛事模式选中主线路 iframe）
  useEffect(() => {
    if (mode === 'events' && selectedItem) {
      setSelectedIframeUrl((selectedItem as Match).iframe);
      setPlayError(null);
    }
  }, [selectedItem, mode, setSelectedIframeUrl]);

  // HLS 视频流加载逻辑（用于 24/7 电视直播）
  useEffect(() => {
    if (mode !== 'channels' || !selectedItem) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setPlayError(null);
    const m3u8Url = (selectedItem as Channel).url;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
      });
      hlsRef.current = hls;

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // 浏览器自动播放拦截，忽略
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlayError('直播源离线，或因跨域（CORS）被浏览器拦截');
              hls.destroy();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setPlayError('播放器内部致命错误，无法加载此直播流');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 原生支持
      video.src = m3u8Url;
      video.addEventListener('error', () => {
        setPlayError('Safari 原生加载失败，可能流已失效或受 CORS 限制');
      });
    } else {
      setPlayError('您的浏览器不支持 HLS（.m3u8）播放格式');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedItem, mode]);

  // 待机画面（未选中任何信源）
  if (!selectedItem) {
    return (
      <div className="relative h-full min-h-[60vh] rounded-lg border border-line bg-panel overflow-hidden flex items-center justify-center">
        <CornerTicks />
        <div className="text-center px-8">
          <div className="font-mono text-xs tracking-[0.3em] text-pitch mb-4">STANDBY · 待机</div>
          <h2 className="font-display font-bold text-3xl text-chalk tracking-wide mb-3">
            等待信号接入
          </h2>
          <p className="font-body text-sm text-chalkdim max-w-sm mx-auto leading-relaxed">
            从左侧选择一场世界杯赛事或全球 24/7 电视频道，即可开始即时观赛。
          </p>
        </div>
      </div>
    );
  }

  const match = selectedItem as Match;
  const channel = selectedItem as Channel;

  return (
    <div className="space-y-4">
      {/* 画面取景区 */}
      <div className="relative aspect-video w-full rounded-lg border border-line bg-black overflow-hidden">
        <CornerTicks />

        {/* 左上角直播 bug */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2 py-1 rounded bg-night/80 backdrop-blur-sm border border-line">
          <span className="live-dot" />
          <span className="font-mono text-[10px] tracking-widest text-live">LIVE</span>
        </div>

        {mode === 'events' ? (
          // 赛事：沙箱 iframe，防止广告劫持顶层导航
          <iframe
            src={selectedIframeUrl}
            allowFullScreen
            allow="autoplay; encrypted-media"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
            className="absolute inset-0 w-full h-full border-0"
            title={match.name}
          />
        ) : playError ? (
          // 信号中断
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-night">
            <ShieldAlert className="w-10 h-10 text-live mb-3" />
            <p className="font-display font-semibold text-lg text-chalk mb-1">信号中断</p>
            <p className="font-body text-sm text-chalkdim max-w-sm">{playError}</p>
            <p className="font-mono text-[10px] tracking-wider text-chalkdim/70 mt-3">
              SIGNAL LOST · 源可能离线或受 CORS 限制
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
      </div>

      {/* 转播下沿条 / score bug */}
      <div className="rounded-lg border border-line bg-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalkdim">
                {mode === 'events' ? match.category_name : channel.category}
              </span>
              {mode === 'events' ? (
                <span className="font-mono text-[10px] text-pitch flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-pitch" />
                  {match.viewers} 在看
                </span>
              ) : (
                <span className="font-mono text-[10px] text-pitch flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  24/7
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-chalk tracking-wide truncate">
              {mode === 'events' ? match.name : channel.title}
            </h1>
          </div>

          {/* 信源切换（仅赛事） */}
          {mode === 'events' && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <FeedButton
                active={selectedIframeUrl === match.iframe}
                onClick={() => setSelectedIframeUrl(match.iframe)}
                label="FEED 01"
                sub="PPV"
              />
              {match.substreams?.map((sub, i) => (
                <FeedButton
                  key={sub.id}
                  active={selectedIframeUrl === sub.iframe}
                  onClick={() => setSelectedIframeUrl(sub.iframe)}
                  label={`FEED ${String(i + 2).padStart(2, '0')}`}
                  sub={sub.locale ? sub.locale.toUpperCase() : sub.source_tag || sub.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
