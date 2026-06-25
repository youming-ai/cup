import { describe, it, expect } from 'vitest';
import { parseScore, deriveStatus, parseKickoff, sortStandings } from './wc';
import type { WCStanding } from '../types';

describe('parseScore', () => {
  it('parses numeric strings', () => {
    expect(parseScore('2')).toBe(2);
    expect(parseScore('0')).toBe(0);
  });
  it('returns null for empty / null / non-numeric', () => {
    expect(parseScore('')).toBeNull();
    expect(parseScore('null')).toBeNull();
    expect(parseScore('NULL')).toBeNull();
    expect(parseScore('abc')).toBeNull();
    expect(parseScore(undefined)).toBeNull();
  });
});

describe('deriveStatus', () => {
  it('finished when finished flag is TRUE or time_elapsed says finished (any case)', () => {
    expect(deriveStatus('TRUE', 'notstarted')).toBe('finished');
    expect(deriveStatus('FALSE', 'finished')).toBe('finished');
    expect(deriveStatus('FALSE', 'Finished')).toBe('finished');
  });
  it('upcoming when not started', () => {
    expect(deriveStatus('FALSE', 'notstarted')).toBe('upcoming');
    expect(deriveStatus('FALSE', '')).toBe('upcoming');
  });
  it('live when in progress', () => {
    expect(deriveStatus('FALSE', "67'")).toBe('live');
    expect(deriveStatus('FALSE', 'HT')).toBe('live');
  });
});

describe('parseKickoff', () => {
  // Assert the absolute instant (toISOString is timezone-independent), since
  // local_date is a venue wall-clock that must convert to UTC by stadium TZ.
  it('converts venue wall-clock to UTC by stadium offset', () => {
    // stadium 7 = Atlanta (EDT, UTC−4): 13:00 local → 17:00 UTC
    expect(parseKickoff('06/11/2026 13:00', '7')!.toISOString()).toBe('2026-06-11T17:00:00.000Z');
    // stadium 16 = Los Angeles (PDT, UTC−7): 19:00 local → next-day 02:00 UTC
    expect(parseKickoff('06/25/2026 19:00', '16')!.toISOString()).toBe('2026-06-26T02:00:00.000Z');
    // stadium 1 = Mexico City (CST, no DST, UTC−6): 19:00 local → next-day 01:00 UTC
    expect(parseKickoff('06/24/2026 19:00', '1')!.toISOString()).toBe('2026-06-25T01:00:00.000Z');
  });
  it('falls back to UTC−5 for an unknown stadium', () => {
    expect(parseKickoff('06/11/2026 13:00', '999')!.toISOString()).toBe('2026-06-11T18:00:00.000Z');
  });
  it('returns null for bad input', () => {
    expect(parseKickoff('not a date', '7')).toBeNull();
    expect(parseKickoff('', '7')).toBeNull();
  });
});

describe('sortStandings', () => {
  it('sorts by pts, then gd, then gf (desc) without mutating input', () => {
    const input: WCStanding[] = [
      { teamId: '1', name: 'A', flag: '', mp: 2, w: 1, d: 1, l: 0, gf: 4, ga: 0, gd: 4, pts: 4 },
      { teamId: '2', name: 'B', flag: '', mp: 2, w: 0, d: 2, l: 0, gf: 3, ga: 3, gd: 0, pts: 2 },
      { teamId: '3', name: 'C', flag: '', mp: 2, w: 0, d: 2, l: 0, gf: 2, ga: 2, gd: 0, pts: 2 },
    ];
    const out = sortStandings(input);
    expect(out.map((t) => t.teamId)).toEqual(['1', '2', '3']);
    expect(input[0].teamId).toBe('1'); // original untouched
  });
});
