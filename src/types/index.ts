export interface Substream {
  id: number;
  name: string;
  tag: string;
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

export interface WCStadium {
  id: string;
  name: string;
  fifaName: string;
  city: string;
  country: string;
  capacity: number;
  region: string;
}
