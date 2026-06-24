import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useStreams } from './useStreams';

// Type-safe mock function for global fetch
const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch; // Cast fetch mock for testing

describe('useStreams Hook', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('should fetch and parse streams successfully with array format for sports data', async () => {
    const mockSports = [
      {
        category: 'Football',
        streams: [
          {
            id: 1,
            name: 'Colombia vs Congo DR',
            iframe: 'https://embedindia.st/1',
            viewers: '100',
            substreams: [
              {
                id: 101,
                name: 'Backup Stream',
                tag: 'backup',
                source_tag: 'src-1',
                locale: 'en',
                iframe: 'https://embedindia.st/1/backup',
              },
            ],
          },
        ],
      },
    ];

    const mockTvStreams = [
      { channel: 'test.cn', title: 'CCTV 1', url: 'https://live.m3u8' },
    ];

    const mockTvChannels = [
      { id: 'test.cn', logo: 'logo-url', categories: ['general'] },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => mockSports })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvStreams })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvChannels });

    const { result } = renderHook(() => useStreams());

    // Initially should be loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].name).toBe('Colombia vs Congo DR');
    expect(result.current.matches[0].slug).toBe('colombia-vs-congo-dr');
    expect(result.current.matches[0].substreams).toHaveLength(1);
    expect(result.current.matches[0].substreams[0].name).toBe('Backup Stream');
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.channels[0].title).toBe('CCTV 1');
    expect(result.current.channels[0].logo).toBe('logo-url');
  });

  it('should fetch and parse streams successfully with envelope format for sports data', async () => {
    const mockSportsEnvelope = {
      streams: [
        {
          category: 'Basketball',
          streams: [
            { id: 2, name: 'Lakers vs Celtics', iframe: 'https://embedindia.st/2', viewers: '500' },
          ],
        },
      ],
    };

    const mockTvStreams = [
      { channel: 'test2.cn', title: 'CCTV 5', url: 'https://live2.m3u8' },
    ];

    const mockTvChannels = [
      { id: 'test2.cn', logo: 'logo-url-2', categories: ['sports'] },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => mockSportsEnvelope })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvStreams })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvChannels });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].name).toBe('Lakers vs Celtics');
    expect(result.current.matches[0].slug).toBe('lakers-vs-celtics');
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.channels[0].title).toBe('CCTV 5');
    expect(result.current.channels[0].logo).toBe('logo-url-2');
  });

  it('should filter out TV streams that do not end with .m3u8', async () => {
    const mockSports: unknown[] = [];
    const mockTvStreams = [
      { channel: 'test.cn', title: 'CCTV 1', url: 'https://live.m3u8' },
      { channel: 'test2.cn', title: 'CCTV 2', url: 'https://live.mp4' }, // Should be filtered out
    ];
    const mockTvChannels = [
      { id: 'test.cn', logo: 'logo-url', categories: ['general'] },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => mockSports })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvStreams })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvChannels });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.channels[0].title).toBe('CCTV 1');
  });

  it('should handle error when both sports and TV API fetches fail', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('Failed to fetch sports streams');
    expect(result.current.matches).toHaveLength(0);
    expect(result.current.channels).toHaveLength(0);
  });

  it('should handle partial failure where sports API fails but TV API succeeds', async () => {
    const mockTvStreams = [
      { channel: 'test.cn', title: 'CCTV 1', url: 'https://live.m3u8' },
    ];
    const mockTvChannels = [
      { id: 'test.cn', logo: 'logo-url', categories: ['general'] },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvStreams })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvChannels });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(0);
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.channels[0].title).toBe('CCTV 1');
  });

  it('should handle partial failure where TV API fails but sports API succeeds', async () => {
    const mockSports = [
      {
        category: 'Football',
        streams: [{ id: 1, name: 'Colombia vs Congo DR', iframe: 'https://embed.st/1' }],
      },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => mockSports })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matches[0].name).toBe('Colombia vs Congo DR');
    expect(result.current.channels).toHaveLength(0);
  });

  it('should pass abort signal to fetch calls', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalled();
    for (const mockCall of fetchMock.mock.calls) {
      const options = mockCall[1];
      expect(options).toBeDefined();
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('should trigger refetch successfully', async () => {
    const mockSports1 = [
      {
        category: 'Football',
        streams: [{ id: 1, name: 'Match 1', iframe: 'https://embedindia.st/1' }],
      },
    ];

    const mockTvStreams1 = [
      { channel: 'test.cn', title: 'CCTV 1', url: 'https://live.m3u8' },
    ];

    const mockTvChannels1 = [
      { id: 'test.cn', logo: 'logo-url', categories: ['general'] },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => mockSports1 })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvStreams1 })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvChannels1 });

    const { result } = renderHook(() => useStreams());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.matches[0].name).toBe('Match 1');

    // Prepare mock data for refetch
    const mockSports2 = [
      {
        category: 'Football',
        streams: [{ id: 2, name: 'Match 2', iframe: 'https://embedindia.st/2' }],
      },
    ];
    const mockTvStreams2 = [
      { channel: 'test.cn', title: 'CCTV 1 Refetched', url: 'https://live.m3u8' },
    ];
    const mockTvChannels2 = [
      { id: 'test.cn', logo: 'logo-url-refetched', categories: ['general'] },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => mockSports2 })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvStreams2 })
      .mockResolvedValueOnce({ ok: true, json: async () => mockTvChannels2 });

    // Trigger refetch
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.matches[0].name).toBe('Match 2');
    expect(result.current.channels[0].title).toBe('CCTV 1 Refetched');
  });
});
