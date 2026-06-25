import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, Play } from 'lucide-react';
import Player from './Player';
import Footer from './Footer';
import { useT } from '../i18n';
import type { Match } from '../types';

type LiveKind = 'live' | 'upcoming';

// 用 ppv 的 starts_at/ends_at/always_live 判定状态；已结束的场次不展示
function classify(m: Match, now: number): LiveKind | 'ended' {
  if (m.alwaysLive) return 'live';
  const start = m.startsAt ? m.startsAt * 1000 : null;
  const end = m.endsAt ? m.endsAt * 1000 : null;
  if (start && now < start) return 'upcoming';
  if (end && now >= end) return 'ended';
  return 'live'; // 已开始（或无开始时间）且未结束
}

function formatKickoff(startsAt?: number): string {
  if (!startsAt) return '';
  return new Date(startsAt * 1000).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function LiveCard({ m, kind, onSelect, t }: {
  m: Match;
  kind: LiveKind;
  onSelect: (m: Match) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const grad =
    m.colors && m.colors.length >= 2
      ? `linear-gradient(140deg, ${m.colors[0]}, ${m.colors[1]})`
      : 'linear-gradient(140deg, #1A211D, #0A0F0D)';

  const media = (
    <>
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {m.poster ? (
          <img
            src={m.poster}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: grad }} aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute top-3 left-3">
          {kind === 'live' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-black/65 backdrop-blur-sm border border-live/40 font-mono text-[10px] tracking-widest text-live">
              <span className="live-dot" />
              {t('status.live')}
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-black/65 backdrop-blur-sm font-mono text-[10px] tracking-wider text-white/90 whitespace-nowrap">
              {formatKickoff(m.startsAt) || t('status.upcoming')}
            </span>
          )}
        </div>
        {kind === 'live' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="flex items-center justify-center w-12 h-12 bg-black/60 backdrop-blur-sm border border-white/30">
              <Play fill="currentColor" className="w-5 h-5 text-white ml-0.5" />
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        {m.tag && (
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-pitch/80 mb-1">{m.tag}</p>
        )}
        <h3 className="font-display font-bold text-base text-chalk leading-tight truncate">{m.name}</h3>
        {kind === 'live' && (
          <p className="mt-1 font-mono text-[10px] text-chalkdim flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-pitch" />
            {t('common.watching', { n: m.viewers })}
          </p>
        )}
      </div>

      {/* thin accent line in the stream's own brand colour */}
      <div className="h-0.5 w-full" style={{ background: m.colors?.[0] || '#2BD96B' }} aria-hidden />
    </>
  );

  // 仅正在直播可点击进入播放页；即将开始为静态信息卡（不可点击）
  if (kind === 'live') {
    return (
      <button
        onClick={() => onSelect(m)}
        aria-label={m.name}
        className="group text-left border border-line bg-panel2 overflow-hidden hover:border-pitch transition-colors"
      >
        {media}
      </button>
    );
  }

  return (
    <div className="border border-line bg-panel2 overflow-hidden opacity-80">
      {media}
    </div>
  );
}

function Section({ label, count, accent, children }: {
  label: string;
  count: number;
  accent: 'live' | 'dim';
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {accent === 'live' && <span className="live-dot" />}
        <h2 className="font-mono text-xs tracking-[0.25em] uppercase text-chalkdim">{label}</h2>
        <span className="font-mono text-xs tabular-nums text-pitch">{String(count).padStart(2, '0')}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export default function LiveView({ matches }: { matches: Match[] }) {
  const t = useT();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('match'),
  );
  const [iframeUrl, setIframeUrl] = useState('');

  // 只有正在直播的场次可进入播放页；指向"即将开始"的 ?match 深链回退到列表
  const selected = useMemo(() => {
    if (!selectedSlug) return null;
    const m = matches.find((x) => x.slug === selectedSlug);
    if (!m) return null;
    return classify(m, Date.now()) === 'live' ? m : null;
  }, [selectedSlug, matches]);

  // 深链：?match 已存在但 iframe 尚未设置时，等 matches 加载出来后补上默认线路
  useEffect(() => {
    if (selected && !iframeUrl) setIframeUrl(selected.iframe);
  }, [selected, iframeUrl]);

  const backToList = useCallback(() => {
    setSelectedSlug(null);
    setIframeUrl('');
    const params = new URLSearchParams(window.location.search);
    params.delete('match');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  // Escape 键退出播放页
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') backToList(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, backToList]);

  const { live, upcoming } = useMemo(() => {
    const now = Date.now();
    const live: Match[] = [];
    const upcoming: Match[] = [];
    for (const m of matches) {
      const kind = classify(m, now);
      if (kind === 'live') live.push(m);
      else if (kind === 'upcoming') upcoming.push(m);
    }
    upcoming.sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
    return { live, upcoming };
  }, [matches]);

  const openMatch = (m: Match) => {
    setSelectedSlug(m.slug);
    setIframeUrl(m.iframe);
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'live');
    params.set('match', m.slug);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };


  // 播放页
  if (selected) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-night flex flex-col justify-between">
        <div className="flex-1 max-w-5xl mx-auto w-full">
          <button
            onClick={backToList}
            className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-chalkdim hover:text-chalk transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('live.back')}
          </button>
          <Player match={selected} selectedIframeUrl={iframeUrl} setSelectedIframeUrl={setIframeUrl} />
        </div>
        <Footer />
      </div>
    );
  }

  // 列表页
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-night flex flex-col justify-between">
      <div className="flex-1 max-w-6xl mx-auto w-full space-y-8">
        {live.length === 0 && upcoming.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-mono text-xs tracking-wider text-chalkdim">{t('live.empty')}</p>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <Section label={t('live.sectionLive')} count={live.length} accent="live">
                {live.map((m) => (
                  <LiveCard key={m.id} m={m} kind="live" onSelect={openMatch} t={t} />
                ))}
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section label={t('live.sectionUpcoming')} count={upcoming.length} accent="dim">
                {upcoming.map((m) => (
                  <LiveCard key={m.id} m={m} kind="upcoming" onSelect={openMatch} t={t} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
