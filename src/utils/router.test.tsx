import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, parseRoute, pathFor, useRouter } from './router';

describe('parseRoute', () => {
  it('returns home for / and empty path', () => {
    expect(parseRoute('/')).toEqual({ kind: 'home' });
    expect(parseRoute('')).toEqual({ kind: 'home' });
    expect(parseRoute('/?view=schedule')).toEqual({ kind: 'home' });
  });

  it('returns home for trailing slashes', () => {
    expect(parseRoute('/match/foo/')).toEqual({ kind: 'match', slug: 'foo' });
  });

  it('parses /match/<slug>', () => {
    expect(parseRoute('/match/foo')).toEqual({ kind: 'match', slug: 'foo' });
    expect(parseRoute('/match/foo?tab=stats')).toEqual({ kind: 'match', slug: 'foo' });
  });

  it('parses /team/<id>', () => {
    expect(parseRoute('/team/464')).toEqual({ kind: 'team', teamId: '464' });
  });

  it('parses /player/<id>', () => {
    expect(parseRoute('/player/12345')).toEqual({ kind: 'player', athleteId: '12345' });
  });

  it('decodes URI-encoded slugs', () => {
    expect(parseRoute('/match/argentina-vs-france')).toEqual({
      kind: 'match',
      slug: 'argentina-vs-france',
    });
  });

  it('falls back to home for unknown paths', () => {
    expect(parseRoute('/something/random')).toEqual({ kind: 'home' });
  });

  it('falls back to home on malformed percent-encoding instead of throwing', () => {
    // decodeURIComponent throws URIError on these; parseRoute must not.
    expect(() => parseRoute('/match/%')).not.toThrow();
    expect(parseRoute('/match/%')).toEqual({ kind: 'home' });
    expect(parseRoute('/team/%E0%A4%A')).toEqual({ kind: 'home' });
    expect(parseRoute('/player/%C3%28')).toEqual({ kind: 'home' });
  });
});

describe('pathFor', () => {
  it('round-trips parseRoute → pathFor → parseRoute', () => {
    const cases: Array<ReturnType<typeof parseRoute>> = [
      { kind: 'home' },
      { kind: 'match', slug: 'argentina-vs-france' },
      { kind: 'team', teamId: '464' },
      { kind: 'player', athleteId: '12345' },
    ];
    for (const r of cases) {
      expect(parseRoute(pathFor(r))).toEqual(r);
    }
  });

  it('URI-encodes special characters in slugs', () => {
    expect(pathFor({ kind: 'match', slug: 'foo bar' })).toBe('/match/foo%20bar');
    expect(pathFor({ kind: 'team', teamId: 'a/b' })).toBe('/team/a%2Fb');
  });
});

describe('navigate', () => {
  let original: { push: typeof history.pushState; replace: typeof history.replaceState };

  beforeEach(() => {
    original = { push: window.history.pushState, replace: window.history.replaceState };
    window.history.pushState = vi.fn() as unknown as typeof window.history.pushState;
    window.history.replaceState = vi.fn() as unknown as typeof window.history.replaceState;
    // reset to a known pathname.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    window.history.pushState = original.push;
    window.history.replaceState = original.replace;
  });

  it('uses pushState by default', () => {
    navigate('/match/abc');
    expect(window.history.pushState).toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('uses replaceState when { replace: true }', () => {
    navigate('/match/abc', { replace: true });
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it('is a no-op when navigating to the current path', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/match/abc' },
      writable: true,
      configurable: true,
    });
    navigate('/match/abc');
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('dispatches a route-change event so useRouter can sync', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    navigate('/match/abc');
    expect(spy.mock.calls.some(([e]) => (e as Event).type === 'app:routechange')).toBe(true);
    spy.mockRestore();
  });
});

describe('useRouter', () => {
  function Harness({ onReady }: { onReady: (r: ReturnType<typeof useRouter>) => void }) {
    onReady(useRouter());
    return null;
  }

  it('returns the parsed route on mount', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/match/foo' },
      writable: true,
      configurable: true,
    });
    let captured!: ReturnType<typeof useRouter>;
    render(<Harness onReady={(route) => (captured = route)} />);
    expect(captured.route).toEqual({ kind: 'match', slug: 'foo' });
  });

  it('reacts to popstate events', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/' },
      writable: true,
      configurable: true,
    });
    let captured!: ReturnType<typeof useRouter>;
    render(<Harness onReady={(route) => (captured = route)} />);
    expect(captured.route).toEqual({ kind: 'home' });

    // Simulate back navigation to /match/foo.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/match/foo' },
      writable: true,
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(captured.route).toEqual({ kind: 'match', slug: 'foo' });
  });

  it('reacts to route-change events from a programmatic navigate()', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/' },
      writable: true,
      configurable: true,
    });
    let captured!: ReturnType<typeof useRouter>;
    render(<Harness onReady={(route) => (captured = route)} />);
    expect(captured.route).toEqual({ kind: 'home' });

    // A direct navigate() (as FixturesView/LiveView do) updates history and
    // fires the route-change event; useRouter must re-parse off it.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/match/foo' },
      writable: true,
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(new Event('app:routechange'));
    });

    expect(captured.route).toEqual({ kind: 'match', slug: 'foo' });
  });

  it('exposes a go() that updates the route immediately', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/' },
      writable: true,
      configurable: true,
    });
    let captured!: ReturnType<typeof useRouter>;
    render(<Harness onReady={(route) => (captured = route)} />);
    expect(captured.route).toEqual({ kind: 'home' });

    act(() => {
      captured.go('/match/abc');
    });
    expect(captured.route).toEqual({ kind: 'match', slug: 'abc' });
  });
});
