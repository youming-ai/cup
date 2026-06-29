import { lazy, type ReactNode, Suspense, useCallback, useEffect } from 'react';
import Footer from './components/Footer';
import Header, { type View } from './components/Header';
import LiveView from './components/LiveView';
import MatchDetailPage from './components/MatchDetailPage';
import PlayerPage from './components/PlayerPage';
import TeamPage from './components/TeamPage';
import { useStreams } from './hooks/useStreams';
import { useWorldCup } from './hooks/useWorldCup';
import { translate, useLang, useT } from './i18n';
import { navigate, useRouter } from './utils/router';

const FixturesView = lazy(() => import('./components/FixturesView'));

function Loading() {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-full bg-night gap-4">
      <span className="font-mono text-xs tracking-[0.3em] text-pitch animate-pulse motion-reduce:animate-none">
        {t('common.loading')}
      </span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-full bg-night p-card text-center gap-3">
      <div className="font-mono text-xs tracking-[0.3em] text-live">{t('common.signalLost')}</div>
      <h2 className="font-display font-bold text-2xl text-chalk tracking-wide">
        {t('common.error')}
      </h2>
      <p className="font-body text-sm text-chalkdim max-w-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 px-4 py-2 bg-pitch text-onaccent font-display font-semibold tracking-wide hover:brightness-110 transition"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-full bg-night gap-3 p-card text-center">
      <div className="font-mono text-xs tracking-[0.3em] text-chalkdim">404</div>
      <h2 className="font-display font-bold text-2xl text-chalk tracking-wide">
        {t('common.error')}
      </h2>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 px-4 py-2 bg-pitch text-onaccent font-display font-semibold tracking-wide hover:brightness-110 transition"
      >
        {t('detail.back')}
      </button>
    </div>
  );
}

export default function App() {
  const { lang } = useLang();
  const streams = useStreams();
  const wc = useWorldCup();
  const { route } = useRouter();

  useEffect(() => {
    document.title = `StreamCup — ${translate(lang, 'brand.subtitle')}`;
  }, [lang]);

  // Top-nav highlight is derived from the route — single source of truth, no
  // separate persisted "view" state. Selecting a tab just navigates.
  const view: View = route.kind === 'live' || route.kind === 'stream' ? 'live' : 'schedule';
  const onSelectView = useCallback((v: View) => navigate(v === 'live' ? '/live' : '/'), []);
  const backHome = useCallback(() => navigate('/', { replace: true }), []);

  // Backward-compat for pre-route bookmarks: /?view=live → /live,
  // /?view=schedule → /, /?match=<slug> → /live/<slug> (the old ?match was
  // always a live stream). Run once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const legacyMatch = params.get('match');
    const legacyView = params.get('view');
    if (legacyMatch) {
      navigate(`/live/${encodeURIComponent(legacyMatch)}`, { replace: true });
    } else if (legacyView === 'live') {
      navigate('/live', { replace: true });
    } else if (legacyView === 'schedule') {
      navigate('/', { replace: true });
    }
  }, []);

  // Build the content for the current route. WC-data pages wait for the
  // schedule fetch (and surface its error) before deciding anything is
  // missing, so a cold-loaded shared link never flashes 404.
  let content: ReactNode;
  if (route.kind === 'section') {
    content = wc.loading ? (
      <Loading />
    ) : wc.error ? (
      <ErrorState message={wc.error} onRetry={wc.refetch} />
    ) : (
      <Suspense fallback={<Loading />}>
        <FixturesView
          section={route.section}
          matches={wc.matches}
          groups={wc.groups}
          scorers={wc.scorers}
        />
      </Suspense>
    );
  } else if (route.kind === 'live' || route.kind === 'stream') {
    content = streams.loading ? (
      <Loading />
    ) : streams.error ? (
      <ErrorState message={streams.error} onRetry={streams.refetch} />
    ) : (
      <LiveView
        matches={streams.matches}
        initialSlug={route.kind === 'stream' ? route.slug : undefined}
      />
    );
  } else if (route.kind === 'match') {
    if (wc.loading) {
      content = <Loading />;
    } else if (wc.error) {
      content = <ErrorState message={wc.error} onRetry={wc.refetch} />;
    } else {
      const match = wc.matches.find((m) => m.slug === route.slug);
      content = match ? (
        <MatchDetailPage match={match} onBack={backHome} />
      ) : (
        <NotFound onBack={backHome} />
      );
    }
  } else if (route.kind === 'team') {
    content = wc.loading ? (
      <Loading />
    ) : wc.error ? (
      <ErrorState message={wc.error} onRetry={wc.refetch} />
    ) : (
      <TeamPage
        teamId={route.teamId}
        groups={wc.groups}
        matches={wc.matches}
        scorers={wc.scorers}
        onBack={backHome}
      />
    );
  } else {
    content = wc.loading ? (
      <Loading />
    ) : wc.error ? (
      <ErrorState message={wc.error} onRetry={wc.refetch} />
    ) : (
      <PlayerPage
        athleteId={route.athleteId}
        groups={wc.groups}
        matches={wc.matches}
        scorers={wc.scorers}
        onBack={backHome}
      />
    );
  }

  return (
    // Single scroll container for the whole app, so the sticky Header shares the
    // SAME scrollbar gutter as the content below — they line up on desktop
    // (classic scrollbar) and mobile (overlay) with no per-platform padding hack.
    <div className="flex flex-col h-dvh overflow-y-auto [scrollbar-gutter:stable_both-edges] bg-night">
      <Header view={view} setView={onSelectView} />
      <div className="flex-1 flex flex-col">{content}</div>
      {route.kind === 'section' && <Footer />}
    </div>
  );
}
