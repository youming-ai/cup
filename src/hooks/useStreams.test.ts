import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStreams } from './useStreams';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

// Route the two parallel fetches (/matches/football and /matches/live) to the
// given payloads based on the URL.
function mockApi(football: unknown[], live: unknown[] = []) {
  fetchMock.mockImplementation((url: string) => {
    const body = url.includes('/matches/live') ? live : football;
    return Promise.resolve({ ok: true, json: async () => body });
  });
}

const future = Date.now() + 7200000;
const past = Date.now() - 7200000;

function apiMatch(over: Record<string, unknown>) {
  return {
    id: 'x',
    title: 'X vs Y',
    category: 'football',
    date: future,
    sources: [{ source: 'echo', id: '1' }],
    ...over,
  };
}

describe('useStreams (streamed.pk football)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('maps football matches and marks the live ones from /matches/live', async () => {
    const a = apiMatch({ id: 'a', title: 'A vs B' });
    const b = apiMatch({ id: 'b', title: 'C vs D' });
    mockApi([a, b], [a]);

    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(2);
    const byName = Object.fromEntries(result.current.matches.map((m) => [m.name, m]));
    expect(byName['A vs B'].status).toBe('live');
    expect(byName['A vs B'].slug).toBe('a-vs-b');
    expect(byName['C vs D'].status).toBe('upcoming');
    expect(byName['C vs D'].streamSources).toEqual([{ source: 'echo', id: '1' }]);
  });

  it('builds an absolute poster URL from the relative path', async () => {
    mockApi([apiMatch({ poster: '/api/images/proxy/abc.webp' })]);
    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.matches[0].poster).toBe('https://streamed.pk/api/images/proxy/abc.webp');
  });

  it('drops matches without any sources', async () => {
    mockApi([apiMatch({ sources: [] })]);
    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.matches).toHaveLength(0);
  });

  it('drops ended matches (past kickoff, not currently live)', async () => {
    mockApi([apiMatch({ date: past })]);
    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.matches).toHaveLength(0);
  });

  it('sets error on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch streams');
  });

  it('sets error when fetch throws (network failure)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('returns empty matches when the football list is empty', async () => {
    mockApi([]);
    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(0);
  });

  it('aborts the in-flight request when refetch is called', async () => {
    let firstSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, options: { signal?: AbortSignal }) => {
      if (!firstSignal) firstSignal = options?.signal;
      return new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });

    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(firstSignal?.aborted).toBe(false);

    act(() => {
      result.current.refetch();
    });
    expect(firstSignal?.aborted).toBe(true);
  });

  it('aborts the in-flight request on unmount', async () => {
    let firstSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, options: { signal?: AbortSignal }) => {
      if (!firstSignal) firstSignal = options?.signal;
      return new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });

    const { unmount } = renderHook(() => useStreams());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(firstSignal?.aborted).toBe(false);

    unmount();
    expect(firstSignal?.aborted).toBe(true);
  });
});
