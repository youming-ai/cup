import { useCallback, useEffect, useRef, useState } from 'react';
import type { Match, StreamRef } from '../types';
import { slugify } from '../utils/helpers';

const API = 'https://streamed.pk/api';

interface APIMatch {
  id: string;
  title: string;
  category: string;
  date?: number; // ms epoch, kickoff time
  poster?: string; // path like /api/images/proxy/<hash>.webp
  sources?: StreamRef[];
}

function toMatch(m: APIMatch, status: 'live' | 'upcoming'): Match | null {
  if (!m.sources || m.sources.length === 0) return null;
  return {
    id: m.id,
    name: m.title,
    category_name: 'Football',
    slug: slugify(m.title),
    status,
    streamSources: m.sources,
    poster: m.poster ? `https://streamed.pk${m.poster}` : undefined,
    startsAt: m.date ? Math.floor(m.date / 1000) : undefined,
  };
}

export function useStreams() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<{ data: Match[]; ts: number } | null>(null);
  const initialRef = useRef(true);

  const fetchData = useCallback(async () => {
    // stale-while-revalidate: show cached data immediately on subsequent fetches
    if (cacheRef.current && !initialRef.current) {
      setMatches(cacheRef.current.data);
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
      // streamed.pk allows CORS (access-control-allow-origin: *), so fetch it
      // directly from the browser. /matches/football is the full football list
      // (live + upcoming); /matches/live tells us which ones are live right now.
      const [allRes, liveRes] = await Promise.all([
        fetch(`${API}/matches/football`, { signal }),
        fetch(`${API}/matches/live`, { signal }),
      ]);
      if (signal.aborted) return;
      if (!allRes.ok) throw new Error('Failed to fetch streams');
      const all = (await allRes.json()) as APIMatch[];
      const live = liveRes.ok ? ((await liveRes.json()) as APIMatch[]) : [];

      const liveFootball = live.filter((m) => m.category === 'football');
      const liveIds = new Set(liveFootball.map((m) => m.id));

      // Live football matches first (some may not appear in /matches/football),
      // then the rest of the football list, deduped by id.
      const byId = new Map<string, APIMatch>();
      for (const m of liveFootball) byId.set(m.id, m);
      for (const m of all) if (!byId.has(m.id)) byId.set(m.id, m);

      const now = Date.now();
      const flat: Match[] = [];
      for (const m of byId.values()) {
        const isLive = liveIds.has(m.id);
        // Not live and kickoff is in the past → ended; streamed.pk gives no end
        // time, so dropping past non-live matches is the only "ended" signal.
        if (!isLive && m.date && m.date <= now) continue;
        const match = toMatch(m, isLive ? 'live' : 'upcoming');
        if (match) flat.push(match);
      }

      if (signal.aborted) return;
      cacheRef.current = { data: flat, ts: Date.now() };
      setMatches(flat);
      setError(null);
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
      console.error('Failed to fetch streams:', err);
      if (!cacheRef.current)
        setError(err instanceof Error ? err.message : 'Failed to fetch streams');
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        initialRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 60s when tab is visible, pause when hidden
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 60_000);
    return () => {
      abortRef.current?.abort();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchData]);

  return { matches, loading, error, refetch: fetchData };
}
