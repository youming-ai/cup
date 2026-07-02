import { describe, expect, it } from 'vitest';
import { buildUrl, COMPETITIONS, DEFAULT_COMPETITION, seasonForDate } from './competitions';

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

describe('eng.1 (season-shape league)', () => {
  const pl = COMPETITIONS['eng.1'];

  it('is registered as a season-shape soccer league', () => {
    expect(pl).toBeDefined();
    expect(pl.sport).toBe('soccer');
    expect(pl.shape).toBe('season');
  });

  it('hides bracket and scorers via capabilities', () => {
    expect(pl.capabilities.bracket).toBe(false);
    expect(pl.capabilities.scorers).toBe(false);
  });

  it('builds a standings URL with no level and a scoreboard URL with no dates', () => {
    // season is derived at request time (no hardcoded year) — assert via the same helper
    expect(buildUrl(pl, 'standings')).toBe(
      `https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=${seasonForDate(new Date())}`,
    );
    expect(buildUrl(pl, 'scoreboard')).toBe(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=300',
    );
  });
});

describe('seasonForDate', () => {
  it('rolls the season over in August (ESPN keys cross-year seasons by starting year)', () => {
    expect(seasonForDate(new Date(2026, 7, 1))).toBe(2026); // Aug 1 → new season
    expect(seasonForDate(new Date(2026, 6, 31))).toBe(2025); // Jul 31 → still 2025-26
    expect(seasonForDate(new Date(2027, 0, 15))).toBe(2026); // mid-season January
  });
});
