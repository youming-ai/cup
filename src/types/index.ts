// One {source, id} pair from streamed.pk's match.sources — resolved to embed
// URLs on demand (in Player) via /api/stream/{source}/{id}.
export interface StreamRef {
  source: string;
  id: string;
}

export interface Match {
  id: string;
  name: string;
  category_name: string;
  slug: string;
  status: 'live' | 'upcoming';
  streamSources: StreamRef[];
  poster?: string;
  startsAt?: number; // unix seconds
}

export type MatchStatus = 'finished' | 'live' | 'upcoming';

// ESPN's finer-grained status for an in-progress or recently-completed match.
// `status` mirrors the upstream status.type.state; `clock` is the current
// minute (0 when not playing); `displayClock` is what the UI should render
// (e.g. "23'", "45'+2'", "HT", "FT", "90'+5'"); `period` is the half number
// (1, 2 — or 3/4 for ET, 5 for penalties during knockouts).
export type ProgressStatus = 'pre' | 'in' | 'halftime' | 'post';

export interface MatchProgress {
  status: ProgressStatus;
  clock: number;
  displayClock: string;
  period: number;
}

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';

export interface WCMatch {
  id: string;
  homeName: string;
  awayName: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  group: string;
  kickoff: Date | null;
  status: MatchStatus;
  stage: Stage;
  homeScorers: string[];
  awayScorers: string[];
  venue: string; // "Estadio Azteca · Mexico City" or '' when unknown
  // Optional richer status (only set when not 'upcoming'). For 'finished' this
  // carries the FT clock; for 'live' it carries the current minute or HT.
  progress?: MatchProgress;
}

export interface WCStanding {
  teamId: string;
  name: string;
  flag: string;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export interface WCGroup {
  name: string;
  standings: WCStanding[];
}

export interface TeamStatRow {
  label: string;
  home: string; // ESPN displayValue, e.g. "54%", "21"
  away: string;
}
export interface PlayEvent {
  clock: string; // e.g. "45'+3'" or "" for pre-match notes
  text: string;
  teamId: string | null; // set for key plays, null for general commentary
  type: string; // e.g. "Goal", "Yellow Card", "" for commentary
}
export interface LineupPlayer {
  jersey: string;
  name: string;
  pos: string; // position.abbreviation, e.g. "CD-R", "G"
  starter: boolean;
  subbedInAt?: string; // minute the player came on
  subbedOutAt?: string; // minute the player went off
  card?: 'yellow' | 'red';
}
export interface TeamLineup {
  teamId: string;
  teamName: string;
  formation: string; // e.g. "4-3-3"
  players: LineupPlayer[];
}
export interface MatchDetail {
  homeId: string;
  awayId: string;
  stats: TeamStatRow[];
  allPlays: PlayEvent[];
  keyPlays: PlayEvent[];
  lineups: TeamLineup[]; // [home, away]
  venue: string;
  attendance: number | null;
}
