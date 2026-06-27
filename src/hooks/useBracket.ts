import { useMemo } from 'react';
import { type BracketMatch, type BracketSlot, ROUNDS, SEEDING } from '../data/bracketSeeding';
import type { WCGroup, WCMatch } from '../types';

// One resolved bracket cell. Either we have a real team (label + id)
// or a TBD placeholder (when the seed is not yet qualified, or the
// previous round's match is unplayed).
export interface ResolvedTeam {
  teamId: string;
  label: string; // display name (or place label if we know the seed only)
}

export interface ResolvedBracketMatch {
  index: number;
  label: string;
  round: BracketMatch['round'];
  home: ResolvedTeam | null;
  away: ResolvedTeam | null;
  match: WCMatch | null; // populated when this round has a WCMatch with results
  winner: 'home' | 'away' | null;
}

// Top 8 best third-placed teams, by the same logic as StandingsView.
function bestThirdIds(groups: WCGroup[]): Set<string> {
  const thirds = groups.map((g) => g.standings[2]).filter(Boolean);
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  return new Set(thirds.slice(0, 8).map((tm) => tm.teamId));
}

// Resolve a fixed group-position place like '1A' or '2B' to a team.
// Returns null if the group isn't loaded yet (standings haven't
// arrived) or the position is empty.
function placeTeam(groups: WCGroup[], place: string, bestThirds: Set<string>): ResolvedTeam | null {
  const m = /^([12])([A-L])$/.exec(place);
  if (m) {
    const group = m[2]!;
    const pos = Number(m[1]) - 1;
    for (const g of groups) {
      if (g.name !== group) continue;
      const row = g.standings[pos];
      if (row) return { teamId: row.teamId, label: row.name };
    }
    return null;
  }
  // 3rd-place codes like '3A/B/C/D/F' — pick the first qualifying team
  // among the listed groups.
  const m3 = /^3([A-L](\/[A-L])*)$/.exec(place);
  if (m3) {
    const candidates = m3[1]!.split('/');
    for (const letter of candidates) {
      for (const g of groups) {
        if (g.name !== letter) continue;
        const row = g.standings[2];
        if (row && bestThirds.has(row.teamId)) {
          return { teamId: row.teamId, label: row.name };
        }
      }
    }
    return null;
  }
  return null;
}

// Match the SEEDING R32 row to a real WCMatch by team group. Each
// r32 WCMatch in our data has a home team with `group` set to the
// home team's group letter; the away team's group letter isn't on
// WCMatch today, so we match by (homeGroup, awayGroup) from the
// SEEDING place codes.
function r32MatchFor(groups: WCGroup[], matches: WCMatch[], seeding: BracketMatch): WCMatch | null {
  if (seeding.round !== 'R32') return null;
  if (seeding.home.kind !== 'place' || seeding.away.kind !== 'place') return null;
  // The home side is a single-group position like '1A' or '2A'.
  // The away side is either a single position (1X/2X) or a 3rd-place
  // group list. For 3rd-place matches, the away group letter is the
  // first letter in the slash list (FIFA's official ordering is the
  // order of the actual groups).
  const homeGroup = (seeding.home.place.match(/^[12]([A-L])$/) ?? [])[1];
  const awayGroup =
    (seeding.away.place.match(/^[12]([A-L])$/) ?? [])[1] ??
    (seeding.away.place.match(/^3([A-L])\//) ?? [])[1];
  if (!homeGroup || !awayGroup) return null;
  for (const m of matches) {
    if (m.stage !== 'r32') continue;
    if (m.group !== homeGroup) continue;
    // The away team's group letter isn't on WCMatch. Look up the away
    // team by name match in any group matching the expected away group.
    for (const g of groups) {
      if (g.name !== awayGroup) continue;
      for (const s of g.standings) {
        if (s.name === m.awayName) return m;
      }
    }
  }
  return null;
}

// Find the WCMatch for a 'winner' slot by looking up the WCMatch at
// the target stage and matching the two team names against the
// resolved home/away teams from previous round matches.
function bracketMatchForStage(
  matches: WCMatch[],
  target: BracketMatch,
  home: ResolvedTeam | null,
  away: ResolvedTeam | null,
): WCMatch | null {
  const stage = target.round === '3rd' ? 'third' : (target.round.toLowerCase() as WCMatch['stage']);
  for (const m of matches) {
    if (m.stage !== stage) continue;
    if (home && (m.homeName === home.label || m.awayName === home.label)) {
      if (!away || m.homeName === away.label || m.awayName === away.label) {
        return m;
      }
    }
  }
  return null;
}

export function useBracket(groups: WCGroup[], matches: WCMatch[]) {
  return useMemo(() => {
    const bestThirds = bestThirdIds(groups);
    // Pre-resolve: build a Map<matchIndex, ResolvedTeam> for the R32
    // round first, so that R16+ can look up winners by index.
    const resolved: ResolvedBracketMatch[] = SEEDING.map((bm) => {
      const resolveOne = (slot: BracketSlot): ResolvedTeam | null => {
        if (slot.kind === 'place') return placeTeam(groups, slot.place, bestThirds);
        return null; // 'winner' resolved below after we have R32 results
      };
      return {
        index: bm.index,
        label: bm.label,
        round: bm.round,
        home: resolveOne(bm.home),
        away: resolveOne(bm.away),
        match: null,
        winner: null,
      };
    });

    // For R32: also try to attach the actual WCMatch. The hook iterates
    // rounds, so we can resolve winner slots progressively. But the
    // simplest approach: do a second pass to attach matches + winners.
    for (let i = 0; i < resolved.length; i++) {
      const bm = SEEDING[i]!;
      const r = resolved[i]!;
      // Attach the actual WCMatch when one exists.
      if (bm.round === 'R32') {
        r.match = r32MatchFor(groups, matches, bm);
      } else {
        // R16 / QF / SF / 3rd / Final: look up by stage + team names.
        r.match = bracketMatchForStage(matches, bm, r.home, r.away);
      }
      // Determine the winner if the WCMatch has been played.
      if (
        r.match &&
        r.match.status === 'finished' &&
        r.match.homeScore != null &&
        r.match.awayScore != null
      ) {
        r.winner = r.match.homeScore > r.match.awayScore ? 'home' : 'away';
      }
    }

    // Now resolve R16+ winner slots. For each non-R32 row, walk the
    // winner indices and pull the resolved team from the prior match.
    // Re-resolve after R32 results are known.
    for (let i = 0; i < resolved.length; i++) {
      const bm = SEEDING[i]!;
      const r = resolved[i]!;
      const resolveWinner = (slot: BracketSlot): ResolvedTeam | null => {
        if (slot.kind === 'place') return placeTeam(groups, slot.place, bestThirds);
        const target = resolved[slot.matchIndex];
        if (!target) return null;
        if (target.winner === 'home') return target.home;
        if (target.winner === 'away') return target.away;
        return null;
      };
      r.home = resolveWinner(bm.home);
      r.away = resolveWinner(bm.away);
      // Re-attach the WCMatch (now that we have team names resolved
      // from previous rounds, the lookup can succeed even when the
      // r32 winner wasn't a 'place' seed).
      if (bm.round === 'R32') {
        r.match = r32MatchFor(groups, matches, bm);
      } else {
        r.match = bracketMatchForStage(matches, bm, r.home, r.away);
      }
      if (
        r.match &&
        r.match.status === 'finished' &&
        r.match.homeScore != null &&
        r.match.awayScore != null
      ) {
        r.winner = r.match.homeScore > r.match.awayScore ? 'home' : 'away';
      }
    }

    return {
      rounds: ROUNDS.map((round) => ({
        round,
        matches: resolved.filter((m) => m.round === round),
      })),
      resolved,
    };
  }, [groups, matches]);
}
