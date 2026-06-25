import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useWorldCup } from './useWorldCup';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

function ok(data: unknown) {
  return { ok: true, json: async () => data };
}

const games = [
  {
    id: '1', home_team_id: '1', away_team_id: '2', home_score: '2', away_score: '0',
    group: 'A', matchday: '1', stadium_id: '1', local_date: '06/11/2026 13:00',
    finished: 'TRUE', time_elapsed: 'finished', type: 'group',
    home_team_name_en: 'Mexico', away_team_name_en: 'South Africa',
  },
  {
    id: '49', home_team_id: '12', away_team_id: '9', home_score: '0', away_score: '0',
    group: 'C', matchday: '3', stadium_id: '8', local_date: '06/24/2026 18:00',
    finished: 'FALSE', time_elapsed: 'notstarted', type: 'group',
    home_team_name_en: 'Scotland', away_team_name_en: 'Brazil',
  },
  {
    id: '73', home_team_id: '0', away_team_id: '0', home_score: '0', away_score: '0',
    group: 'R32', matchday: '4', stadium_id: '16', local_date: '06/28/2026 12:00',
    finished: 'FALSE', time_elapsed: 'notstarted', type: 'r32',
    home_team_label: 'Runner-up Group A', away_team_label: 'Runner-up Group B',
  },
  {
    id: '50', home_team_id: '1', away_team_id: '2', home_score: '1', away_score: '0',
    group: 'A', matchday: '2', stadium_id: '1', local_date: '06/20/2026 15:00',
    finished: 'FALSE', time_elapsed: "67'", type: 'group',
    home_team_name_en: 'Mexico', away_team_name_en: 'South Africa',
  },
];
const groups = [
  { name: 'A', teams: [
    { team_id: '1', mp: '1', w: '1', d: '0', l: '0', gf: '2', ga: '0', gd: '2', pts: '3' },
    { team_id: '2', mp: '1', w: '0', d: '0', l: '1', gf: '0', ga: '2', gd: '-2', pts: '0' },
  ] },
];
const teams = [
  { id: '1', name_en: 'Mexico', flag: 'mex.png' },
  { id: '2', name_en: 'South Africa', flag: 'rsa.png' },
];

describe('useWorldCup', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('normalizes games, groups and stadiums', async () => {
    // worldcup26.ir wraps each payload under a key — mirror that exact shape
    fetchMock
      .mockResolvedValueOnce(ok({ games }))
      .mockResolvedValueOnce(ok({ groups }))
      .mockResolvedValueOnce(ok({ teams }));

    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(4);

    const finished = result.current.matches[0];
    expect(finished.status).toBe('finished');
    expect(finished.homeScore).toBe(2);
    expect(finished.homeFlag).toBe('mex.png');

    const upcoming = result.current.matches[1];
    expect(upcoming.status).toBe('upcoming');
    expect(upcoming.homeScore).toBeNull();

    const knockout = result.current.matches[2];
    expect(knockout.homeName).toBe('Runner-up Group A');
    expect(knockout.homeFlag).toBe('');

    const live = result.current.matches[3];
    expect(live.status).toBe('live');
    expect(live.homeScore).toBe(1); // live scores are retained, not nulled

    expect(result.current.groups[0].standings[0].name).toBe('Mexico');
  });

  it('sets error when a request fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([]));
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

  it('handles bare-array API response (unwrap fallback)', async () => {
    // worldcup26.ir may return a bare array instead of a wrapped object
    fetchMock
      .mockResolvedValueOnce(ok(games))        // bare array → unwrap returns it directly
      .mockResolvedValueOnce(ok(groups))
      .mockResolvedValueOnce(ok(teams));

    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(4);
  });

  it('uses TBD name when team id is 0 (knockout placeholder)', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ games: [games[2]] })) // only the r32 knockout game
      .mockResolvedValueOnce(ok({ groups: [] }))
      .mockResolvedValueOnce(ok({ teams: [] }));
    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const m = result.current.matches[0];
    expect(m.homeName).toBe('Runner-up Group A');
    expect(m.homeFlag).toBe('');
  });

  it('aborts the in-flight request on refetch', async () => {
    let firstSignal: AbortSignal | undefined;
    const { promise, resolve } = Promise.withResolvers<never>();
    fetchMock.mockImplementation((_url: string, options: { signal?: AbortSignal }) => {
      if (!firstSignal) firstSignal = options?.signal;
      return promise;
    });

    const { result } = renderHook(() => useWorldCup());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(firstSignal?.aborted).toBe(false);

    act(() => { result.current.refetch(); });
    expect(firstSignal?.aborted).toBe(true);

    resolve(undefined as never);
  });

  it('aborts the in-flight request on unmount', async () => {
    let firstSignal: AbortSignal | undefined;
    const { promise, resolve } = Promise.withResolvers<never>();
    fetchMock.mockImplementation((_url: string, options: { signal?: AbortSignal }) => {
      if (!firstSignal) firstSignal = options?.signal;
      return promise;
    });

    const { unmount } = renderHook(() => useWorldCup());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(firstSignal?.aborted).toBe(false);

    unmount();
    expect(firstSignal?.aborted).toBe(true);

    resolve(undefined as never);
  });
});
