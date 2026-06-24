import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useStreams } from './useStreams';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

describe('useStreams (football only)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('keeps only the Football category and ignores American Football', async () => {
    const payload = {
      streams: [
        {
          category: 'American Football',
          streams: [{ id: 1, name: 'CFL Game', iframe: 'x', viewers: '0' }],
        },
        {
          category: 'Football',
          streams: [
            {
              id: 23637,
              name: 'Bosnia-Herzegovina vs. Qatar',
              category_name: 'Football',
              iframe: 'https://embedindia.st/embed/wc/bih-qat',
              viewers: '4',
              poster: 'p.jpg',
              colors: ['#112855', '#691a40'],
              substreams: [
                { id: 23638, name: 'B vs Q', tag: 'WC', source_tag: 'FS1', locale: 'en', iframe: 'fox' },
              ],
            },
          ],
        },
      ],
    };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => payload });

    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].name).toBe('Bosnia-Herzegovina vs. Qatar');
    expect(result.current.matches[0].colors).toEqual(['#112855', '#691a40']);
    expect(result.current.matches[0].substreams).toHaveLength(1);
    expect(result.current.matches[0].slug).toBe('bosnia-herzegovina-vs-qatar');
  });

  it('sets error on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    const { result } = renderHook(() => useStreams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch streams');
  });

  it('aborts the in-flight request when refetch is called', async () => {
    let firstSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, options) => {
      if (!firstSignal) firstSignal = options?.signal;
      return new Promise(() => {}); // never resolves
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
    fetchMock.mockImplementation((_url, options) => {
      if (!firstSignal) firstSignal = options?.signal;
      return new Promise(() => {}); // never resolves
    });

    const { unmount } = renderHook(() => useStreams());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(firstSignal?.aborted).toBe(false);

    unmount();
    expect(firstSignal?.aborted).toBe(true);
  });
});
