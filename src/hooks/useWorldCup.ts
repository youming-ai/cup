import { useState, useEffect, useCallback, useRef } from 'react';
import type { WCMatch, WCGroup, WCStanding } from '../types';
import { parseScore, deriveStatus, parseKickoff, sortStandings } from '../utils/wc';

const BASE = 'https://worldcup26.ir';

// Each endpoint returns the array wrapped under a key, e.g. { games: [...] };
// accept a bare array too in case the shape ever changes.
function unwrap<T>(json: unknown, key: string): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object') {
    const v = (json as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

interface RawGame {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string;
  away_score: string;
  group: string;
  matchday: string;
  stadium_id: string;
  local_date: string;
  finished: string;
  time_elapsed: string;
  type: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_label?: string;
  away_team_label?: string;
}
interface RawTeam {
  id: string;
  name_en: string;
  flag?: string;
}
interface RawStandingTeam {
  team_id: string;
  mp: string; w: string; d: string; l: string; gf: string; ga: string; gd: string; pts: string;
}
interface RawGroup {
  name: string;
  teams: RawStandingTeam[];
}

export function useWorldCup() {
  const [matches, setMatches] = useState<WCMatch[]>([]);
  const [groups, setGroups] = useState<WCGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    setLoading(true);
    setError(null);

    try {
      const [gRes, grRes, tRes] = await Promise.all([
        fetch(`${BASE}/get/games`, { signal }),
        fetch(`${BASE}/get/groups`, { signal }),
        fetch(`${BASE}/get/teams`, { signal }),
      ]);
      if (!gRes.ok || !grRes.ok || !tRes.ok) {
        throw new Error('Failed to load World Cup data');
      }
      const [gamesJson, groupsJson, teamsJson] = await Promise.all([
        gRes.json(),
        grRes.json(),
        tRes.json(),
      ]);
      // worldcup26.ir wraps each payload in an object ({ games: [...] }, { teams: [...] }, …);
      // unwrap by key, tolerating a bare array too.
      const games = unwrap<RawGame>(gamesJson, 'games');
      const rawGroups = unwrap<RawGroup>(groupsJson, 'groups');
      const teams = unwrap<RawTeam>(teamsJson, 'teams');

      const teamMap = new Map<string, { name: string; flag: string }>();
      teams.forEach((t) => teamMap.set(t.id, { name: t.name_en, flag: t.flag || '' }));

      const ms: WCMatch[] = games.map((g) => {
        const status = deriveStatus(g.finished, g.time_elapsed);
        return {
          id: g.id,
          homeName: g.home_team_name_en || g.home_team_label || '',
          awayName: g.away_team_name_en || g.away_team_label || '',
          homeFlag: teamMap.get(g.home_team_id)?.flag || '',
          awayFlag: teamMap.get(g.away_team_id)?.flag || '',
          homeScore: status === 'upcoming' ? null : parseScore(g.home_score),
          awayScore: status === 'upcoming' ? null : parseScore(g.away_score),
          group: g.group,
          matchday: Number(g.matchday) || 0,
          stadiumId: g.stadium_id,
          kickoff: parseKickoff(g.local_date, g.stadium_id),
          status,
          stage: g.type,
        };
      });

      const gr: WCGroup[] = rawGroups
        .map((group) => ({
          name: group.name,
          standings: sortStandings(
            group.teams.map((t): WCStanding => {
              const meta = teamMap.get(t.team_id) || { name: t.team_id, flag: '' };
              return {
                teamId: t.team_id,
                name: meta.name,
                flag: meta.flag,
                mp: Number(t.mp) || 0,
                w: Number(t.w) || 0,
                d: Number(t.d) || 0,
                l: Number(t.l) || 0,
                gf: Number(t.gf) || 0,
                ga: Number(t.ga) || 0,
                gd: Number(t.gd) || 0,
                pts: Number(t.pts) || 0,
              };
            }),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (signal.aborted) return;
      setMatches(ms);
      setGroups(gr);
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
      console.error('useWorldCup fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load World Cup data');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    return () => abortRef.current?.abort();
  }, [fetchAll]);

  return { matches, groups, loading, error, refetch: fetchAll };
}
