import { useCallback, useEffect, useState } from 'react';

// One-route-fits-all router built on the History API. No react-router /
// wouter dep — the surface area needed here is tiny (3 paths) so a 60-line
// module is enough. The Worker already serves index.html for unknown paths
// (assets.not_found_handling = single-page-application), so deep links
// like /match/<slug> resolve to the SPA at page refresh.

export type Route =
  | { kind: 'home' }
  | { kind: 'match'; slug: string }
  | { kind: 'team'; teamId: string }
  | { kind: 'player'; athleteId: string };

export function parseRoute(pathname: string): Route {
  // Normalise: strip query and trailing slash.
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return { kind: 'home' };

  const m = path.match(/^\/match\/([^/]+)$/);
  if (m) return { kind: 'match', slug: decodeURIComponent(m[1]!) };

  const t = path.match(/^\/team\/([^/]+)$/);
  if (t) return { kind: 'team', teamId: decodeURIComponent(t[1]!) };

  const p = path.match(/^\/player\/([^/]+)$/);
  if (p) return { kind: 'player', athleteId: decodeURIComponent(p[1]!) };

  return { kind: 'home' };
}

export function pathFor(route: Route): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'match':
      return `/match/${encodeURIComponent(route.slug)}`;
    case 'team':
      return `/team/${encodeURIComponent(route.teamId)}`;
    case 'player':
      return `/player/${encodeURIComponent(route.athleteId)}`;
  }
}

// pushState/replaceState do NOT emit `popstate`, so `useRouter` can't see a
// programmatic navigation on its own. Every `navigate()` dispatches this event
// and the hook re-parses on it — that's what keeps any caller (FixturesView,
// LiveView, App) in sync without threading a setter through props.
const ROUTE_CHANGE = 'app:routechange';

// Programmatic navigation. Default behaviour: pushState (back/forward works).
// Pass `{ replace: true }` for state-only updates that shouldn't grow the
// history stack (e.g. tab switches).
export function navigate(path: string, opts: { replace?: boolean; scroll?: boolean } = {}): void {
  const { replace = false, scroll = false } = opts;
  if (window.location.pathname + window.location.search === path) return;
  if (replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
  window.dispatchEvent(new Event(ROUTE_CHANGE));
}

// React hook: subscribes to popstate (back/forward) + our route-change event
// (programmatic navigate), returns the current Route and a `go` alias.
export function useRouter(): {
  route: Route;
  go: (path: string, opts?: { replace?: boolean; scroll?: boolean }) => void;
} {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', sync);
    window.addEventListener(ROUTE_CHANGE, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(ROUTE_CHANGE, sync);
    };
  }, []);

  const go = useCallback((path: string, opts?: { replace?: boolean; scroll?: boolean }) => {
    navigate(path, opts);
    setRoute(parseRoute(path));
  }, []);

  return { route, go };
}
