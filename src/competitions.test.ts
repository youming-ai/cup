import { describe, expect, it } from 'vitest';
import { buildUrl, COMPETITIONS, DEFAULT_COMPETITION } from './competitions';

describe('buildUrl', () => {
  const wc = COMPETITIONS[DEFAULT_COMPETITION];

  it('builds the World Cup scoreboard URL with the date window and limit', () => {
    expect(buildUrl(wc, 'scoreboard')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300',
    );
  });

  it('builds the standings URL WITHOUT the site/ path segment', () => {
    expect(buildUrl(wc, 'standings')).toBe(
      'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026&level=3',
    );
  });

  it('builds the summary URL with the event id', () => {
    expect(buildUrl(wc, 'summary', '760420')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760420',
    );
  });
});

describe('registry', () => {
  it('exposes the default competition', () => {
    expect(COMPETITIONS[DEFAULT_COMPETITION]).toBeDefined();
    expect(COMPETITIONS[DEFAULT_COMPETITION].sport).toBe('soccer');
  });
});
