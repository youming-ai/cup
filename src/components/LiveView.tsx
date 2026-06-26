import { ChevronLeft, Play, Star } from 'lucide-react';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useFavorites } from '../hooks/useFavorites';
import { useT } from '../i18n';
import type { Match } from '../types';
import Footer from './Footer';
import { FavoriteButton, ReminderMenu } from './MatchActions';
import Player from './Player';

type LiveKind = 'live' | 'upcoming';

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

const LiveCard = memo(function LiveCard({
  m,
  kind,
  onSelect,
  t,
  isFavorite,
  onToggleFavorite,
}: {
  m: Match;
  kind: LiveKind;
  onSelect: (m: Match) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const grad = 'linear-gradient(140deg, rgb(var(--c-surface2)), rgb(var(--c-bg)))';

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
        <h3 className="font-display font-bold text-base text-chalk leading-tight truncate">
          {m.name}
        </h3>
      </div>

      <div className="h-0.5 w-full bg-pitch" aria-hidden />
    </>
  );

  // 收藏 / 提醒浮层，置于右上角；脱离可点击的卡片本体（避免 button 套 button）
  const overlay = (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/65 backdrop-blur-sm border border-white/15">
      {kind === 'upcoming' && m.startsAt && (
        <ReminderMenu title={m.name} start={new Date(m.startsAt * 1000)} t={t} />
      )}
      <FavoriteButton active={isFavorite} onToggle={onToggleFavorite} t={t} />
    </div>
  );

  // 仅正在直播可点击进入播放页；即将开始为静态信息卡（不可点击）
  return (
    <div className="relative">
      {overlay}
      {kind === 'live' ? (
        <button
          type="button"
          onClick={() => onSelect(m)}
          aria-label={m.name}
          className="group text-left w-full border border-line bg-panel2 overflow-hidden hover:border-pitch transition-colors"
        >
          {media}
        </button>
      ) : (
        <div className="border border-line bg-panel2 overflow-hidden opacity-80">{media}</div>
      )}
    </div>
  );
});

function Section({
  label,
  count,
  accent,
  children,
}: {
  label: string;
  count: number;
  accent: 'live' | 'dim' | 'fav';
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {accent === 'live' && <span className="live-dot" />}
        {accent === 'fav' && (
          <Star className="w-3.5 h-3.5 text-pitch" fill="currentColor" aria-hidden />
        )}
        <h2 className="font-mono text-xs tracking-[0.25em] uppercase text-chalkdim">{label}</h2>
        <span className="font-mono text-xs tabular-nums text-pitch">
          {String(count).padStart(2, '0')}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">{children}</div>
    </section>
  );
}

export default function LiveView({ matches }: { matches: Match[] }) {
  const t = useT();
  const { toggle, isFavorite } = useFavorites();
  const favKey = (m: Match) => `live:${m.slug}`;
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('match'),
  );

  // 只有正在直播的场次可进入播放页；指向"即将开始"的 ?match 深链回退到列表
  const selected = useMemo(() => {
    if (!selectedSlug) return null;
    const m = matches.find((x) => x.slug === selectedSlug);
    if (!m) return null;
    return m.status === 'live' ? m : null;
  }, [selectedSlug, matches]);

  const backToList = useCallback(() => {
    setSelectedSlug(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('match');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  // Escape 键退出播放页
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') backToList();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, backToList]);

  const { live, upcoming } = useMemo(() => {
    const live: Match[] = [];
    const upcoming: Match[] = [];
    for (const m of matches) {
      if (m.status === 'live') live.push(m);
      else upcoming.push(m);
    }
    upcoming.sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
    return { live, upcoming };
  }, [matches]);

  const openMatch = useCallback((m: Match) => {
    setSelectedSlug(m.slug);
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'live');
    params.set('match', m.slug);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  // favorited matches (live + upcoming) get pinned into a section at the top,
  // and are removed from their normal section so they aren't shown twice.
  const { favLive, favUpcoming, favCount, liveRest, upcomingRest } = useMemo(() => {
    const fl: Match[] = [],
      fu: Match[] = [];
    const lr: Match[] = [],
      ur: Match[] = [];
    for (const m of live) (isFavorite(`live:${m.slug}`) ? fl : lr).push(m);
    for (const m of upcoming) (isFavorite(`live:${m.slug}`) ? fu : ur).push(m);
    return {
      favLive: fl,
      favUpcoming: fu,
      favCount: fl.length + fu.length,
      liveRest: lr,
      upcomingRest: ur,
    };
  }, [live, upcoming, isFavorite]);

  const renderCard = (m: Match, kind: LiveKind) => (
    <LiveCard
      key={m.id}
      m={m}
      kind={kind}
      onSelect={openMatch}
      t={t}
      isFavorite={isFavorite(favKey(m))}
      onToggleFavorite={() => toggle(favKey(m))}
    />
  );

  // 播放页
  if (selected) {
    return (
      <div className="flex-1 p-4 md:p-6 bg-night flex flex-col justify-between">
        <div className="flex-1 max-w-6xl mx-auto w-full">
          <button
            type="button"
            onClick={backToList}
            className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-chalkdim hover:text-chalk transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('live.back')}
          </button>
          <Player match={selected} />
        </div>
        <Footer />
      </div>
    );
  }

  // 列表页
  return (
    <div className="flex-1 p-4 md:p-6 bg-night flex flex-col justify-between">
      <div className="flex-1 max-w-6xl mx-auto w-full space-y-8">
        {live.length === 0 && upcoming.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-mono text-xs tracking-wider text-chalkdim">{t('live.empty')}</p>
          </div>
        ) : (
          <>
            {favCount > 0 && (
              <Section label={t('live.sectionFavorites')} count={favCount} accent="fav">
                {favLive.map((m) => renderCard(m, 'live'))}
                {favUpcoming.map((m) => renderCard(m, 'upcoming'))}
              </Section>
            )}
            {liveRest.length > 0 && (
              <Section label={t('live.sectionLive')} count={liveRest.length} accent="live">
                {liveRest.map((m) => renderCard(m, 'live'))}
              </Section>
            )}
            {upcomingRest.length > 0 && (
              <Section label={t('live.sectionUpcoming')} count={upcomingRest.length} accent="dim">
                {upcomingRest.map((m) => renderCard(m, 'upcoming'))}
              </Section>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
