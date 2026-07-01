// Single source of truth for which competitions the app serves. The Worker
// (worker/index.ts) and the dev proxy (vite.config.ts) both build their
// upstream ESPN URLs from here via buildUrl(), so the two never drift.
// Pure data + a pure function — no DOM/React deps — so both build targets
// (app tsconfig + tsconfig.worker.json) compile it.

export type Sport = 'soccer' | 'basketball' | 'football' | 'baseball' | 'hockey';
export type Resource = 'scoreboard' | 'standings' | 'summary';

export interface Competition {
  key: string; // URL first segment, e.g. 'fifa.world'
  sport: Sport;
  league: string; // ESPN league slug
  label: string; // i18n key (wired into the switcher in Phase 2)
  season: number;
  dates?: string; // scoreboard date window — tournaments need it, season comps omit it
  standingsLevel?: number; // soccer standings depth (World Cup = 3 → the group tables)
  shape: 'tournament' | 'season';
  capabilities: {
    bracket: boolean;
    scorers: boolean;
    leaders: boolean;
    lineups: boolean;
    boxscore: boolean;
  };
}

export const COMPETITIONS: Record<string, Competition> = {
  'fifa.world': {
    key: 'fifa.world',
    sport: 'soccer',
    league: 'fifa.world',
    label: 'comp.fifa.world',
    season: 2026,
    dates: '20260611-20260719',
    standingsLevel: 3,
    shape: 'tournament',
    capabilities: { bracket: true, scorers: true, leaders: false, lineups: true, boxscore: false },
  },
  'eng.1': {
    key: 'eng.1',
    sport: 'soccer',
    league: 'eng.1',
    label: 'comp.eng1',
    // 赛季交替期（2026 年中）：2025 = 2025-26 赛季，standings 返回满员联赛表；
    // scoreboard 无 dates → ESPN 返回当前窗口（2026-27 upcoming）。见 spec §7。
    season: 2025,
    shape: 'season',
    capabilities: {
      bracket: false,
      scorers: false,
      leaders: false,
      lineups: true,
      boxscore: false,
    },
  },
};

export const DEFAULT_COMPETITION = 'fifa.world';

const ESPN = 'https://site.api.espn.com/apis';

// ESPN quirk: standings lives under /apis/v2/ (NO `site/`); scoreboard and
// summary live under /apis/site/v2/. See docs/espn-api.md §2 & §9.
export function buildUrl(c: Competition, resource: Resource, event?: string): string {
  const path = `sports/${c.sport}/${c.league}`;
  if (resource === 'standings') {
    const q = new URLSearchParams({ season: String(c.season) });
    if (c.standingsLevel) q.set('level', String(c.standingsLevel));
    return `${ESPN}/v2/${path}/standings?${q}`;
  }
  if (resource === 'summary') {
    return `${ESPN}/site/v2/${path}/summary?event=${event}`;
  }
  // scoreboard
  const q = new URLSearchParams();
  if (c.dates) q.set('dates', c.dates);
  q.set('limit', '300'); // ponytail: hardcoded cap; make it a Competition field when a comp needs a different one
  return `${ESPN}/site/v2/${path}/scoreboard?${q}`;
}
