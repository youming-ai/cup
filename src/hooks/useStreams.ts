import { useState, useEffect, useCallback, useRef } from 'react';
import type { Match, Substream } from '../types';
import { slugify } from '../utils/helpers';

interface APISub {
  name: string; source_tag: string; iframe: string;
}
interface APIStream {
  id: number; name: string; category_name?: string; iframe: string; viewers?: string;
  poster?: string; colors?: string[]; substreams?: APISub[]; source_tag?: string;
  tag?: string; starts_at?: number; ends_at?: number; always_live?: number;
}
interface APICategory {
  category?: string; streams?: APIStream[];
}
interface APIEnvelope {
  streams?: APICategory[];
}

export function useStreams() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    setLoading(true);
    setError(null);

    try {
      // ppv.to fingerprint-blocks datacenter requests, so it can't go through the
      // Worker — fetch it directly from the browser (it allows CORS).
      const res = await fetch('https://api.ppv.to/api/streams', { signal });
      if (!res.ok) throw new Error('Failed to fetch streams');
      const data = (await res.json()) as APIEnvelope;
      const cats: APICategory[] = data.streams ?? [];
      // 精确匹配 Football（避免 American/Australian Football）
      const football = cats.find((c) => (c.category || '').toLowerCase() === 'football');

      const flat: Match[] = (football?.streams || []).map((s) => ({
        id: s.id,
        name: s.name,
        category_name: s.category_name || 'Football',
        iframe: s.iframe,
        viewers: s.viewers || '0',
        sourceTag: s.source_tag,
        poster: s.poster,
        colors: s.colors,
        tag: s.tag,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        alwaysLive: s.always_live === 1,
        substreams: (s.substreams || []).map(
          (sub): Substream => ({
            name: sub.name,
            source_tag: sub.source_tag,
            iframe: sub.iframe,
          }),
        ),
        slug: slugify(s.name),
      }));

      if (signal.aborted) return;
      setMatches(flat);
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
      console.error('Failed to fetch streams:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch streams');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { matches, loading, error, refetch: fetchData };
}
