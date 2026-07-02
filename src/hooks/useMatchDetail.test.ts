import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useMatchDetail } from './useMatchDetail';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
});

it('does not fetch when eventId is null', () => {
  renderHook(() => useMatchDetail(null, 'fifa.world'));
  expect(fetchMock).not.toHaveBeenCalled();
});

it('fetches and parses the summary for an event id', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      header: { competitions: [{ competitors: [{ homeAway: 'home', team: { id: '1' } }] }] },
      boxscore: { teams: [] },
      gameInfo: { attendance: 100 },
    }),
  });
  const { result } = renderHook(() => useMatchDetail('760420', 'fifa.world'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/fifa.world/summary?event=760420',
    expect.any(Object),
  );
  expect(result.current.detail?.homeId).toBe('1');
  expect(result.current.error).toBeNull();
});

it('surfaces an error when the request fails', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false });
  const { result } = renderHook(() => useMatchDetail('1', 'fifa.world'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeTruthy();
  expect(result.current.detail).toBeNull();
});

it('refetches on reload() and populates detail on success', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      header: { competitions: [{ competitors: [{ homeAway: 'home', team: { id: '7' } }] }] },
      boxscore: { teams: [] },
      gameInfo: {},
    }),
  });
  const { result } = renderHook(() => useMatchDetail('1', 'fifa.world'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  act(() => result.current.reload());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.error).toBeNull();
  expect(result.current.detail?.homeId).toBe('7');
});
