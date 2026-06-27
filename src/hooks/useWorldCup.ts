import { useCallback, useEffect, useRef, useState } from 'react';
import type { TopScorer, WCGroup, WCMatch, WCStanding } from '../types';
import {
  matchSlug,
  parseScore,
  progressFromStatus,
  scorerLabel,
  sortStandings,
  stageFromSlug,
  statusFromState,
} from '../utils/wc';

// same-origin Worker that edge-caches ESPN's public API in KV (see worker/index.ts)
const BASE = '/api/wc';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: unknown): Record<string, unknown> {
  return isPlainObject(v) ? v : {};
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ESPN standings stats are [{name, value}]; pull one by name.
function stat(entry: Record<string, unknown>, name: string): number {
  const s = arr(entry.stats).find((x) => obj(x).name === name);
  return s ? Number(obj(s).value) || 0 : 0;
}

// A competitor/team's crest URL: scoreboard uses `team.logo` (string),
// standings uses `team.logos: [{href}]`.
function teamLogo(team: Record<string, unknown>): string {
  if (str(team.logo)) return str(team.logo);
  const logos = arr(team.logos);
  return logos.length ? str(obj(logos[0]).href) : '';
}

export function useWorldCup() {
  const [matches, setMatches] = useState<WCMatch[]>([]);
  const [groups, setGroups] = useState<WCGroup[]>([]);
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<{
    matches: WCMatch[];
    groups: WCGroup[];
    scorers: TopScorer[];
    ts: number;
  } | null>(null);
  const initialRef = useRef(true);

  const fetchAll = useCallback(async () => {
    // stale-while-revalidate: show cached data immediately on subsequent fetches
    if (cacheRef.current && !initialRef.current) {
      setMatches(cacheRef.current.matches);
      setGroups(cacheRef.current.groups);
      setScorers(cacheRef.current.scorers);
      setLoading(false);
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    if (initialRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const [sbRes, stRes] = await Promise.all([
        fetch(`${BASE}/scoreboard`, { signal }),
        fetch(`${BASE}/standings`, { signal }),
      ]);
      if (signal.aborted) return;
      if (!sbRes.ok || !stRes.ok) throw new Error('Failed to load World Cup data');
      const [sbJson, stJson] = await Promise.all([sbRes.json(), stRes.json()]);

      // --- standings → groups (+ a teamId → group-letter map for the matches) ---
      const teamGroup = new Map<string, string>();
      const gr: WCGroup[] = arr(obj(stJson).children)
        .map((raw): WCGroup => {
          const g = obj(raw);
          const letter = str(g.name).replace(/^Group\s+/i, '') || str(g.abbreviation);
          const entries = arr(obj(g.standings).entries);
          const standings = entries.map((rawEntry): WCStanding => {
            const e = obj(rawEntry);
            const team = obj(e.team);
            const id = str(team.id);
            if (id) teamGroup.set(id, letter);
            return {
              teamId: id,
              name: str(team.displayName),
              flag: teamLogo(team),
              mp: stat(e, 'gamesPlayed'),
              w: stat(e, 'wins'),
              d: stat(e, 'ties'),
              l: stat(e, 'losses'),
              gf: stat(e, 'pointsFor'),
              ga: stat(e, 'pointsAgainst'),
              gd: stat(e, 'pointDifferential'),
              pts: stat(e, 'points'),
            };
          });
          return { name: letter, standings: sortStandings(standings) };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      // --- scoreboard → matches ---
      const ms: WCMatch[] = arr(obj(sbJson).events).map((rawEvent): WCMatch => {
        const ev = obj(rawEvent);
        const comp = obj(arr(ev.competitions)[0]);
        const competitors = arr(comp.competitors).map(obj);
        const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
        const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
        const homeTeam = obj(home.team);
        const awayTeam = obj(away.team);
        const statusObj = obj(comp.status);
        const status = statusFromState(str(obj(statusObj.type).state));

        // goals: scoring plays from competition.details, split by team id
        const homeId = str(homeTeam.id);
        const homeScorers: string[] = [];
        const awayScorers: string[] = [];
        for (const rawDetail of arr(comp.details)) {
          const d = obj(rawDetail);
          if (!d.scoringPlay) continue;
          const who = str(obj(arr(d.athletesInvolved)[0]).displayName);
          if (!who) continue;
          const label = scorerLabel(who, str(obj(d.clock).displayValue), str(obj(d.type).text));
          (str(obj(d.team).id) === homeId ? homeScorers : awayScorers).push(label);
        }

        const venue = obj(comp.venue);
        const city = str(obj(venue.address).city);
        const venueName = str(venue.fullName);
        const date = str(ev.date);
        const kickoff = date ? new Date(date) : null;

        // Richer status: clock, displayClock, period (only set for live/finished).
        const progress =
          status === 'upcoming'
            ? undefined
            : progressFromStatus({
                clock: Number(statusObj.clock) || 0,
                displayClock: str(statusObj.displayClock),
                type: {
                  state: str(obj(statusObj.type).state),
                  period: Number(obj(statusObj.type).period) || 0,
                },
                // Some ESPN responses put period at the top level of `status`.
                period: Number(statusObj.period) || 0,
              });

        return {
          id: str(ev.id),
          homeName: str(homeTeam.displayName),
          awayName: str(awayTeam.displayName),
          homeFlag: teamLogo(homeTeam),
          awayFlag: teamLogo(awayTeam),
          homeScore: status === 'upcoming' ? null : parseScore(str(home.score)),
          awayScore: status === 'upcoming' ? null : parseScore(str(away.score)),
          group: teamGroup.get(homeId) || teamGroup.get(str(awayTeam.id)) || '',
          kickoff: kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff : null,
          status,
          stage: stageFromSlug(str(obj(ev.season).slug)),
          homeScorers: status === 'upcoming' ? [] : homeScorers,
          awayScorers: status === 'upcoming' ? [] : awayScorers,
          venue: venueName && city ? `${venueName} · ${city}` : venueName,
          slug: matchSlug(str(homeTeam.displayName), str(awayTeam.displayName)),
          ...(progress ? { progress } : {}),
        };
      });

      // --- top scorers (tournament-level) ---
      // Each competitor in each event has a `leaders` array; we want the
      // "goals" entry (ESPN emits two duplicate entries named "goals" and
      // "goalsLeaders" — take the first matching one). Aggregate across all
      // events, dedupe by athlete id, keep the highest goal count (a player
      // may appear under multiple matches). Resolve team display name from
      // the team map built from the standings feed.
      const teamMap = new Map<string, string>();
      for (const g of gr) {
        for (const s of g.standings) teamMap.set(s.teamId, s.name);
      }
      const scorerMap = new Map<string, TopScorer>();
      for (const rawEvent of arr(obj(sbJson).events)) {
        const comp = obj(arr(obj(rawEvent).competitions)[0]);
        for (const rawComp of arr(comp.competitors)) {
          const c = obj(rawComp);
          for (const cat of arr(c.leaders)) {
            const catObj = obj(cat);
            if (str(catObj.name) !== 'goals') continue;
            for (const rawLeader of arr(catObj.leaders)) {
              const l = obj(rawLeader);
              const a = obj(l.athlete);
              const id = str(a.id);
              if (!id) continue;
              const goals = Number(l.value) || 0;
              const teamId = str(obj(a.team).id);
              const existing = scorerMap.get(id);
              if (!existing || goals > existing.goals) {
                scorerMap.set(id, {
                  athleteId: id,
                  name: str(a.displayName) || str(a.shortName),
                  teamId,
                  teamName: teamMap.get(teamId) || '',
                  goals,
                });
              }
            }
            break; // one goals category is enough
          }
        }
      }
      const sc: TopScorer[] = [...scorerMap.values()]
        .filter((s) => s.goals > 0)
        .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
        .slice(0, 50);

      if (signal.aborted) return;
      cacheRef.current = { matches: ms, groups: gr, scorers: sc, ts: Date.now() };
      setMatches(ms);
      setGroups(gr);
      setScorers(sc);
      setError(null);
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
      console.error('useWorldCup fetch failed:', err);
      if (!cacheRef.current)
        setError(err instanceof Error ? err.message : 'Failed to load World Cup data');
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        initialRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Poll every 30s when tab is visible, pause when hidden
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchAll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll();
    }, 30_000);
    return () => {
      abortRef.current?.abort();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAll]);

  return { matches, groups, scorers, loading, error, refetch: fetchAll };
}
