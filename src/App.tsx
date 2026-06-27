import { lazy, type ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
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
    <div className="flex flex-col items-center justify-center h-full bg-night p-6 text-center gap-3">
      <div className="font-mono text-xs tracking-[0.3em] text-live">{t('common.signalLost')}</div>
      <h2 className="font-display font-bold text-2xl text-chalk tracking-wide">
        {t('common.error')}
      </h2>
      <p className="font-body text-sm text-chalkdim max-w-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 px-4 py-2 bg-pitch text-night font-display font-semibold tracking-wide hover:brightness-110 transition"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center h-full bg-night gap-3 p-6 text-center">
      <div className="font-mono text-xs tracking-[0.3em] text-chalkdim">404</div>
      <h2 className="font-display font-bold text-2xl text-chalk tracking-wide">
        {t('common.error')}
      </h2>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 px-4 py-2 bg-pitch text-night font-display font-semibold tracking-wide hover:brightness-110 transition"
      >
        {t('detail.back')}
      </button>
    </div>
  );
}

// Tiny local hook: persist the last-selected tab to localStorage so
// returning visitors land where they left off.
function usePersistedView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() => {
    try {
      const stored = localStorage.getItem('cup:view');
      if (stored === 'live' || stored === 'schedule') return stored;
    } catch {
      /* ignore */
    }
    return 'schedule';
  });
  const setViewPersisted = useCallback((v: View) => {
    setView(v);
    try {
      localStorage.setItem('cup:view', v);
    } catch {
      /* ignore */
    }
  }, []);
  return [view, setViewPersisted];
}

export default function App() {
  const { lang } = useLang();
  const streams = useStreams();
  const wc = useWorldCup();
  const { route } = useRouter();

  useEffect(() => {
    document.title = `StreamCup — ${translate(lang, 'brand.subtitle')}`;
  }, [lang]);

  const [view, setView] = usePersistedView();
  const onSelectView = useCallback(
    (v: View) => {
      setView(v);
      navigate('/', { replace: true });
    },
    [setView],
  );

  // Backward-compat: bookmarks/shares from before the /match route used query
  // strings (e.g. /?view=live&match=live-game). Translate those once on mount
  // into the new route so old links still open the right tab/player.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const legacyMatch = params.get('match');
    const legacyView = params.get('view');
    if (legacyMatch) {
      navigate(`/match/${encodeURIComponent(legacyMatch)}`, { replace: true });
    } else if (legacyView === 'live' || legacyView === 'schedule') {
      setView(legacyView);
      navigate('/', { replace: true });
    }
  }, [setView]);

  // Build the content for the current route.
  let content: ReactNode;
  if (route.kind === 'match') {
    // Two slug spaces share /match/. wc:<slug> → ESPN schedule match
    // (MatchDetailPage); anything else → streamed.pk match (LiveView's
    // player iframe view). LiveView reads the URL on mount.
    if (route.slug.startsWith('wc:')) {
      const wcSlug = route.slug.slice('wc:'.length);
      // A cold load of a shared /match/wc:… URL hits this while the schedule
      // is still fetching: wait for data (and surface fetch errors) before
      // deciding the match doesn't exist, otherwise valid links flash 404.
      if (wc.loading) {
        content = <Loading />;
      } else if (wc.error) {
        content = <ErrorState message={wc.error} onRetry={wc.refetch} />;
      } else {
        const match = wc.matches.find((m) => m.slug === wcSlug);
        content = match ? (
          <MatchDetailPage match={match} onBack={() => navigate('/', { replace: true })} />
        ) : (
          <NotFound onBack={() => navigate('/', { replace: true })} />
        );
      }
    } else if (streams.loading) {
      content = <Loading />;
    } else if (streams.error) {
      content = <ErrorState message={streams.error} onRetry={streams.refetch} />;
    } else {
      content = <LiveView matches={streams.matches} initialSlug={route.slug} />;
    }
  } else if (route.kind === 'team') {
    // /team/[id] is a deep link into the schedule view's data — render
    // only after the WC data has loaded so a cold-loaded shared link
    // doesn't flash 404.
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
        onBack={() => navigate('/', { replace: true })}
      />
    );
  } else if (route.kind === 'player') {
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
        onBack={() => navigate('/', { replace: true })}
      />
    );
  } else {
    // Home: render whichever tab is selected.
    if (view === 'live') {
      content = streams.loading ? (
        <Loading />
      ) : streams.error ? (
        <ErrorState message={streams.error} onRetry={streams.refetch} />
      ) : (
        <LiveView matches={streams.matches} />
      );
    } else {
      content = wc.loading ? (
        <Loading />
      ) : wc.error ? (
        <ErrorState message={wc.error} onRetry={wc.refetch} />
      ) : (
        <Suspense fallback={<Loading />}>
          <FixturesView matches={wc.matches} groups={wc.groups} scorers={wc.scorers} />
        </Suspense>
      );
    }
  }

  return (
    // Single scroll container for the whole app, so the sticky Header shares the
    // SAME scrollbar gutter as the content below — they line up on desktop
    // (classic scrollbar) and mobile (overlay) with no per-platform padding hack.
    <div className="flex flex-col h-dvh overflow-y-auto [scrollbar-gutter:stable_both-edges] bg-night">
      <Header view={view} setView={onSelectView} />
      <div className="flex-1 flex flex-col">{content}</div>
      {route.kind === 'home' && view === 'schedule' && <Footer />}
    </div>
  );
}
