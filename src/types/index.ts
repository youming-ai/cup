export interface Substream {
  id: number;
  name: string;
  source_tag: string;
  locale: string;
  iframe: string;
}

export interface Match {
  id: number;
  name: string;
  category_name: string;
  iframe: string;
  viewers: string;
  substreams: Substream[];
  slug: string;
  poster?: string;
  colors?: string[];
  tag?: string;
  startsAt?: number; // unix seconds
  endsAt?: number; // unix seconds
  alwaysLive?: boolean;
}

export type MatchStatus = 'finished' | 'live' | 'upcoming';

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
  stage: string;
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
