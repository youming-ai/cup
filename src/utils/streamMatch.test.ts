import { describe, expect, it } from 'vitest';
import type { Match, WCMatch } from '../types';
import { isStreamLive, streamForMatch } from './streamMatch';

function wc(partial: Partial<WCMatch> = {}): WCMatch {
  return {
    id: '760488',
    homeName: 'Netherlands',
    awayName: 'Morocco',
    homeFlag: '',
    awayFlag: '',
    homeId: '1',
    awayId: '2',
    homeScore: null,
    awayScore: null,
    group: '',
    kickoff: null,
    status: 'live',
    stage: 'r16',
    homeScorers: [],
    awayScorers: [],
    venue: '',
    slug: 'netherlands-vs-morocco-760488',
    ...partial,
  };
}
function stream(partial: Partial<Match> = {}): Match {
  return {
    id: 1,
    name: 'Netherlands vs. Morocco',
    category_name: 'Football',
    iframe: 'https://x',
    viewers: '0',
    substreams: [],
    slug: 'netherlands-vs-morocco',
    ...partial,
  };
}

describe('streamForMatch', () => {
  it('matches a ppv stream to an ESPN fixture by team-name slug', () => {
    const s = stream();
    expect(streamForMatch(wc(), [s])).toBe(s);
  });

  it('matches when the stream lists the teams in reverse order', () => {
    const s = stream({ slug: 'morocco-vs-netherlands' });
    expect(streamForMatch(wc(), [s])).toBe(s);
  });

  it('returns null when no stream matches', () => {
    expect(streamForMatch(wc(), [stream({ slug: 'france-vs-sweden' })])).toBeNull();
  });
});

describe('isStreamLive', () => {
  const now = 1_700_000_000_000; // fixed ms

  it('is live for alwaysLive streams regardless of window', () => {
    expect(isStreamLive(stream({ alwaysLive: true }), now)).toBe(true);
  });

  it('is not live before startsAt', () => {
    expect(isStreamLive(stream({ startsAt: now / 1000 + 3600 }), now)).toBe(false);
  });

  it('is not live at/after endsAt', () => {
    expect(isStreamLive(stream({ endsAt: now / 1000 - 3600 }), now)).toBe(false);
  });

  it('is live within the [startsAt, endsAt) window', () => {
    expect(
      isStreamLive(stream({ startsAt: now / 1000 - 60, endsAt: now / 1000 + 3600 }), now),
    ).toBe(true);
  });
});
