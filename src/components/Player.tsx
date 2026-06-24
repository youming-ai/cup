import { useEffect, useRef, useState } from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import { ShieldAlert, Radio, Users } from 'lucide-react';
import Hls from 'hls.js';
import { Match, Channel } from '../types';

interface PlayerProps {
  selectedItem: Match | Channel | null;
  mode: 'events' | 'channels';
  selectedIframeUrl: string;
  setSelectedIframeUrl: (url: string) => void;
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
              setPlayError('网络错误：直播源离线或因跨域（CORS）被浏览器拦截');
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

  if (!selectedItem) {
    return (
      <Card className="w-full h-full bg-neutral-900 border-neutral-800 flex items-center justify-center text-center p-8">
        <div className="max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto mb-4 text-2xl">
            ⚽
          </div>
          <h2 className="text-xl font-bold text-neutral-200 mb-2">欢迎来到 StreamCup</h2>
          <p className="text-sm text-neutral-500">
            请在右侧选择感兴趣的世界杯球赛直播或全球 24/7 直播频道，开启即时高清观赛体验。
          </p>
        </div>
      </Card>
    );
  }

  const match = selectedItem as Match;
  const channel = selectedItem as Channel;

  return (
    <div className="space-y-4">
      {/* 播放器渲染区 */}
      <Card className="bg-black border border-neutral-850 overflow-hidden shadow-lg">
        <CardBody className="p-0">
          <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center">
            {mode === 'events' ? (
              // 赛事直播：沙箱 iframe，防止广告劫持顶层导航
              <iframe
                src={selectedIframeUrl}
                allowFullScreen
                allow="autoplay; encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                className="absolute inset-0 w-full h-full border-0"
                title={match.name}
              />
            ) : (
              // 电视直播：原生 Video + Hls.js
              <>
                {playError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-neutral-900 text-neutral-300">
                    <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
                    <p className="font-bold text-sm max-w-sm">{playError}</p>
                    <p className="text-xs text-neutral-500 mt-2">
                      提示：某些源不支持 HTTPS 播放，或服务器限制了外部域名的请求。
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
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 赛事/频道元信息展示 */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Chip
              size="sm"
              color={mode === 'events' ? 'warning' : 'default'}
              variant="flat"
              className="h-5"
            >
              {mode === 'events' ? match.category_name : channel.category}
            </Chip>
            {mode === 'events' && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {match.viewers} 在看
              </span>
            )}
            {mode === 'channels' && (
              <span className="text-xs text-emerald-500 flex items-center gap-1 animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                24/7 实时直播
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-white">
            {mode === 'events' ? match.name : channel.title}
          </h1>
        </div>

        {/* 体育线路切换 */}
        {mode === 'events' && (
          <div className="flex flex-wrap gap-2">
            {/* 主线路 */}
            <Button
              size="sm"
              variant={selectedIframeUrl === match.iframe ? 'solid' : 'bordered'}
              color="warning"
              onPress={() => setSelectedIframeUrl(match.iframe)}
              className="font-bold"
            >
              主线路 (PPV)
            </Button>
            {/* 分支信源（Substreams） */}
            {match.substreams?.map((sub) => (
              <Button
                key={sub.id}
                size="sm"
                variant={selectedIframeUrl === sub.iframe ? 'solid' : 'bordered'}
                color="warning"
                onPress={() => setSelectedIframeUrl(sub.iframe)}
                className="font-bold"
              >
                线路 ({sub.source_tag || sub.name}) {sub.locale ? `[${sub.locale.toUpperCase()}]` : ''}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
