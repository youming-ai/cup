import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import Player from './Player';
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

  return (
    <button
      onClick={() => onSelect(m)}
      className="group text-left rounded-2xl border border-white/10 bg-panel2 overflow-hidden hover:border-white/25 transition-colors"
    >
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
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
        <div className="absolute top-3 left-3">
          {kind === 'live' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-night/75 backdrop-blur-sm border border-live/40 font-mono text-[10px] tracking-widest text-live">
              <span className="live-dot" />
              {t('status.live')}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-md bg-night/75 backdrop-blur-sm font-mono text-[10px] tracking-wider text-chalkdim whitespace-nowrap">
              {formatKickoff(m.startsAt) || t('status.upcoming')}
            </span>
          )}
        </div>
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
    </button>
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

  const selected = useMemo(
    () => (selectedSlug ? matches.find((m) => m.slug === selectedSlug) ?? null : null),
    [selectedSlug, matches],
  );

  // 深链：?match 已存在但 iframe 尚未设置时，等 matches 加载出来后补上默认线路
  useEffect(() => {
    if (selected && !iframeUrl) setIframeUrl(selected.iframe);
  }, [selected, iframeUrl]);

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

  const backToList = () => {
    setSelectedSlug(null);
    setIframeUrl('');
    const params = new URLSearchParams(window.location.search);
    params.delete('match');
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  // 播放页
  if (selected) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-night">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={backToList}
            className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-chalkdim hover:text-chalk transition-colors"
          >
            <CaretLeft className="w-4 h-4" weight="bold" />
            {t('live.back')}
          </button>
          <Player match={selected} selectedIframeUrl={iframeUrl} setSelectedIframeUrl={setIframeUrl} />
        </div>
      </div>
    );
  }

  // 列表页
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-night">
      <div className="max-w-6xl mx-auto space-y-8">
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
    </div>
  );
}
