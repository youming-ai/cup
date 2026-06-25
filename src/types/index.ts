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
  matchday: number;
  stadiumId: string;
  kickoff: Date | null;
  status: MatchStatus;
  stage: Stage;
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
