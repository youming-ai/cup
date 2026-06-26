import type { LineupPlayer, MatchDetail, PlayEvent, TeamLineup, TeamStatRow } from '../types';

// local json guards (kept here so this module is self-contained)
type Obj = Record<string, unknown>;
function obj(v: unknown): Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {};
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function cardOf(plays: unknown[]): 'yellow' | 'red' | undefined {
  let card: 'yellow' | undefined;
  for (const raw of plays) {
    const p = obj(raw);
    if (p.redCard) return 'red';
    if (p.yellowCard) card = 'yellow';
  }
  return card;
}
function subClock(plays: unknown[]): string | undefined {
  const s = plays.map(obj).find((p) => p.substitution);
  return s ? str(obj(s.clock).displayValue) : undefined;
}

export function parseSummary(json: unknown): MatchDetail {
  const d = obj(json);

  // home/away ids from the header competitors
  const competitors = arr(obj(arr(obj(d.header).competitions)[0]).competitors).map(obj);
  const homeId = str(obj(competitors.find((c) => c.homeAway === 'home')?.team).id);
  const awayId = str(obj(competitors.find((c) => c.homeAway === 'away')?.team).id);

  // stats: map each boxscore team's label→displayValue, pair by home team's order
  const byTeam = new Map<string, Map<string, string>>();
  for (const rawTeam of arr(obj(d.boxscore).teams)) {
    const t = obj(rawTeam);
    const id = str(obj(t.team).id);
    const m = new Map<string, string>();
    for (const rawStat of arr(t.statistics)) {
      const s = obj(rawStat);
      m.set(str(s.label), str(s.displayValue));
    }
    byTeam.set(id, m);
  }
  const homeStats = byTeam.get(homeId) ?? new Map();
  const awayStats = byTeam.get(awayId) ?? new Map();
  const stats: TeamStatRow[] = [...homeStats.entries()].map(([label, home]) => ({
    label,
    home,
    away: awayStats.get(label) ?? '',
  }));

  const allPlays: PlayEvent[] = arr(d.commentary).map((raw) => {
    const c = obj(raw);
    return { clock: str(obj(c.time).displayValue), text: str(c.text), teamId: null, type: '' };
  });
  const keyPlays: PlayEvent[] = arr(d.keyEvents)
    .filter((k) => str(obj(k).text))
    .map((raw) => {
      const k = obj(raw);
      return {
        clock: str(obj(k.clock).displayValue),
        text: str(k.text),
        teamId: str(obj(k.team).id) || null,
        type: str(obj(k.type).text),
      };
    });

  const lineups: TeamLineup[] = arr(d.rosters).map((raw): TeamLineup => {
    const r = obj(raw);
    const team = obj(r.team);
    const players: LineupPlayer[] = arr(r.roster).map((rawP): LineupPlayer => {
      const p = obj(rawP);
      const plays = arr(p.plays);
      const sub = subClock(plays);
      return {
        jersey: str(p.jersey),
        name: str(obj(p.athlete).displayName),
        pos: str(obj(p.position).abbreviation),
        starter: Boolean(p.starter),
        ...(p.subbedIn && sub ? { subbedInAt: sub } : {}),
        ...(p.subbedOut && sub ? { subbedOutAt: sub } : {}),
        ...(cardOf(plays) ? { card: cardOf(plays) } : {}),
      };
    });
    return {
      teamId: str(team.id),
      teamName: str(team.displayName),
      formation: str(r.formation),
      players,
    };
  });
  // Enforce the [home, away] contract regardless of ESPN roster order.
  const rank = (l: TeamLineup) => (l.teamId === homeId ? 0 : l.teamId === awayId ? 1 : 2);
  lineups.sort((a, b) => rank(a) - rank(b));

  const venueObj = obj(obj(d.gameInfo).venue);
  const city = str(obj(venueObj.address).city);
  const venueName = str(venueObj.fullName);
  const att = obj(d.gameInfo).attendance;

  return {
    homeId,
    awayId,
    stats,
    allPlays,
    keyPlays,
    lineups,
    venue: venueName && city ? `${venueName} · ${city}` : venueName,
    attendance: typeof att === 'number' ? att : null,
  };
}

export type PositionedPlayer = LineupPlayer & { x: number; y: number };

// 5 rows back-to-front; y grows downward (GK at the bottom of a vertical pitch).
const ROW_Y = [0.93, 0.72, 0.56, 0.4, 0.16];

function rowGroup(pos: string): number {
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK') return 0;
  if (p.includes('DM')) return 2;
  if (p === 'SW' || p.startsWith('CD') || p.startsWith('D') || p.endsWith('B')) return 1; // SW/CB/RB/LB/WB/CD
  if (p.startsWith('F') || p.endsWith('F') || p.startsWith('S') || p.endsWith('W')) return 4; // F/LF/RF/ST/RW/LW
  return 3; // CM/RM/LM/AM/M and unknowns → midfield
}
function sideScore(pos: string): number {
  const p = pos.toUpperCase();
  if (p.endsWith('-L')) return -1;
  if (p.endsWith('-R')) return 1;
  if (p.startsWith('L')) return -1;
  if (p.startsWith('R')) return 1;
  return 0;
}

// ponytail: position-code positioner; unknown codes fall to the midfield row
export function layoutStarters(starters: LineupPlayer[]): PositionedPlayer[] {
  const rows = new Map<number, LineupPlayer[]>();
  for (const pl of starters) {
    const g = rowGroup(pl.pos);
    (rows.get(g) ?? rows.set(g, []).get(g)!).push(pl);
  }
  const out: PositionedPlayer[] = [];
  for (const [g, list] of rows) {
    list.sort(
      (a, b) =>
        sideScore(a.pos) - sideScore(b.pos) || (Number(a.jersey) || 0) - (Number(b.jersey) || 0),
    );
    const n = list.length;
    list.forEach((pl, i) => {
      const x = n === 1 ? 0.5 : 0.15 + (i * 0.7) / (n - 1);
      out.push({ ...pl, x, y: ROW_Y[g] });
    });
  }
  return out;
}
