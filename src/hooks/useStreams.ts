import { useCallback, useEffect, useRef, useState } from 'react';
import type { Match, Substream } from '../types';
import { slugify } from '../utils/helpers';
import { isTrustedStreamUrl } from '../utils/streamSources';

interface APISub {
  name: string;
  source_tag: string;
  iframe: string;
}
interface APIStream {
  id: number;
  name: string;
  category_name?: string;
  iframe: string;
  viewers?: string;
  poster?: string;
  colors?: string[];
  substreams?: APISub[];
  source_tag?: string;
  tag?: string;
  starts_at?: number;
  ends_at?: number;
  always_live?: number;
}
interface APICategory {
  category?: string;
  streams?: APIStream[];
}
interface APIEnvelope {
  streams?: APICategory[];
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
      // ppv.to fingerprint-blocks datacenter requests, so it can't go through the
      // Worker — fetch it directly from the browser (it allows CORS).
      const res = await fetch('https://api.ppv.to/api/streams', { signal });
      if (signal.aborted) return;
      if (!res.ok) throw new Error('Failed to fetch streams');
      const data = (await res.json()) as APIEnvelope;
      const cats: APICategory[] = data.streams ?? [];
      // 精确匹配 Football（避免 American/Australian Football）
      const football = cats.find((c) => (c.category || '').toLowerCase() === 'football');

      const flat: Match[] = (football?.streams || [])
        .map((s): Match | null => {
          const substreams = (s.substreams || [])
            .map(
              (sub): Substream => ({
                name: sub.name,
                source_tag: sub.source_tag,
                iframe: sub.iframe,
              }),
            )
            .filter((sub) => isTrustedStreamUrl(sub.iframe));
          const iframe = isTrustedStreamUrl(s.iframe) ? s.iframe : substreams[0]?.iframe;
          if (!iframe) return null;

          return {
            id: s.id,
            name: s.name,
            category_name: s.category_name || 'Football',
            iframe,
            viewers: s.viewers || '0',
            sourceTag: s.source_tag,
            poster: s.poster,
            colors: s.colors,
            tag: s.tag,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            alwaysLive: s.always_live === 1,
            substreams,
            slug: slugify(s.name),
          };
        })
        .filter((m): m is Match => m !== null);

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
