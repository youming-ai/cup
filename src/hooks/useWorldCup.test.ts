import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorldCup } from './useWorldCup';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

function ok(data: unknown) {
  return { ok: true, json: async () => data };
}

// minimal ESPN scoreboard shape: a finished group match + an upcoming knockout match
const scoreboard = {
  events: [
    {
      id: '760420',
      date: '2026-06-13T19:00Z',
      season: { slug: 'group-stage' },
      competitions: [
        {
          status: { type: { state: 'post' } },
          venue: { fullName: "Levi's Stadium", address: { city: 'Santa Clara, California' } },
          competitors: [
            {
              homeAway: 'home',
              score: '2',
              team: { id: '1', displayName: 'Mexico', logo: 'mex.png' },
            },
            {
              homeAway: 'away',
              score: '0',
              team: { id: '2', displayName: 'South Africa', logo: 'rsa.png' },
            },
          ],
          details: [
            {
              scoringPlay: true,
              clock: { displayValue: "22'" },
              type: { text: 'Goal' },
              team: { id: '1' },
              athletesInvolved: [{ id: '4577', displayName: 'H. Lozano' }],
            },
            {
              scoringPlay: true,
              clock: { displayValue: "80'" },
              type: { text: 'Penalty - Scored' },
              team: { id: '1' },
              athletesInvolved: [{ id: '4579', displayName: 'R. Jiménez' }],
            },
            { scoringPlay: false, type: { text: 'Yellow Card' }, team: { id: '2' } },
          ],
        },
      ],
    },
    {
      id: '760900',
      date: '2026-07-04T16:00Z',
      season: { slug: 'round-of-16' },
      competitions: [
        {
          status: { type: { state: 'pre' } },
          venue: { fullName: 'MetLife Stadium', address: { city: 'East Rutherford' } },
          competitors: [
            {
              homeAway: 'home',
              score: '0',
              team: { id: '9', displayName: 'Brazil', logos: [{ href: 'bra.png' }] },
            },
            {
              homeAway: 'away',
              score: '0',
              team: { id: '12', displayName: 'Scotland', logos: [{ href: 'sco.png' }] },
            },
          ],
          details: [],
        },
      ],
    },
  ],
};

const standings = {
  children: [
    {
      name: 'Group A',
      standings: {
        entries: [
          {
            team: { id: '1', displayName: 'Mexico', logos: [{ href: 'mex.png' }] },
            stats: [
              { name: 'gamesPlayed', value: 1 },
              { name: 'wins', value: 1 },
              { name: 'ties', value: 0 },
              { name: 'losses', value: 0 },
              { name: 'pointsFor', value: 2 },
              { name: 'pointsAgainst', value: 0 },
              { name: 'pointDifferential', value: 2 },
              { name: 'points', value: 3 },
            ],
          },
          {
            team: { id: '2', displayName: 'South Africa', logos: [{ href: 'rsa.png' }] },
            stats: [
              { name: 'gamesPlayed', value: 1 },
              { name: 'wins', value: 0 },
              { name: 'ties', value: 0 },
              { name: 'losses', value: 1 },
              { name: 'pointsFor', value: 0 },
              { name: 'pointsAgainst', value: 2 },
              { name: 'pointDifferential', value: -2 },
              { name: 'points', value: 0 },
            ],
          },
        ],
      },
    },
  ],
};

describe('useWorldCup', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('normalizes ESPN scoreboard + standings', async () => {
    fetchMock.mockResolvedValueOnce(ok(scoreboard)).mockResolvedValueOnce(ok(standings));

    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(2);

    const finished = result.current.matches[0];
    expect(finished.status).toBe('finished');
    expect(finished.homeScore).toBe(2);
    expect(finished.homeFlag).toBe('mex.png');
    expect(finished.stage).toBe('group');
    expect(finished.group).toBe('A'); // resolved from standings membership
    expect(finished.homeScorers).toEqual([
      { playerId: '4577', name: 'H. Lozano', minute: "22'", tag: '' },
      { playerId: '4579', name: 'R. Jiménez', minute: "80'", tag: ' (p)' },
    ]);
    expect(finished.awayScorers).toEqual([]);
    expect(finished.venue).toBe("Levi's Stadium · Santa Clara, California");
    expect(finished.kickoff?.toISOString()).toBe('2026-06-13T19:00:00.000Z');

    const upcoming = result.current.matches[1];
    expect(upcoming.status).toBe('upcoming');
    expect(upcoming.homeScore).toBeNull();
    expect(upcoming.stage).toBe('r16');
    expect(upcoming.homeFlag).toBe('bra.png'); // logos[].href fallback

    const groupA = result.current.groups[0];
    expect(groupA.name).toBe('A'); // "Group A" → "A"
    expect(groupA.standings[0].name).toBe('Mexico');
    expect(groupA.standings[0].pts).toBe(3);
    expect(groupA.standings[0].gd).toBe(2);
  });

  it('sets error when a request fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(ok(standings));
    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load World Cup data');
  });

  it('sets error when fetch throws (network failure)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network error'));
    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('tolerates missing/empty payloads without throwing', async () => {
    fetchMock.mockResolvedValueOnce(ok({})).mockResolvedValueOnce(ok({}));
    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.matches).toEqual([]);
    expect(result.current.groups).toEqual([]);
  });

  it('aborts the in-flight request on refetch', async () => {
    let firstSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, options: { signal?: AbortSignal }) => {
      if (!firstSignal) firstSignal = options?.signal;
      return new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          {
            once: true,
          },
        );
      });
    });

    const { result } = renderHook(() => useWorldCup());
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
          {
            once: true,
          },
        );
      });
    });

    const { unmount } = renderHook(() => useWorldCup());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(firstSignal?.aborted).toBe(false);

    unmount();
    expect(firstSignal?.aborted).toBe(true);
  });
});
