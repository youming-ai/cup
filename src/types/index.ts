export interface Substream {
  name: string;
  source_tag: string;
  iframe: string;
}

export interface Match {
  id: number;
  name: string;
  category_name: string;
  iframe: string;
  viewers: string;
  sourceTag?: string;
  substreams: Substream[];
  slug: string;
  poster?: string;
  colors?: string[];
  tag?: string;
  startsAt?: number;
  endsAt?: number;
  alwaysLive?: boolean;
}

export type MatchStatus = 'finished' | 'live' | 'upcoming';

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
