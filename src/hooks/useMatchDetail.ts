import { useState, useEffect } from 'react';
import type { MatchDetail } from '../types';
import { parseSummary } from '../utils/espn';

export function useMatchDetail(eventId: string | null) {
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/wc/summary?event=${eventId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load match detail');
        return res.json();
      })
      .then((json) => {
        if (controller.signal.aborted) return;
        setDetail(parseSummary(json));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Failed to load match detail');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [eventId]);

  return { detail, loading, error };
}
