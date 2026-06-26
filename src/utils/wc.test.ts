import { describe, expect, it } from 'vitest';
import type { WCStanding } from '../types';
import { parseScore, scorerLabel, sortStandings, stageFromSlug, statusFromState } from './wc';

describe('parseScore', () => {
  it('parses numeric strings and numbers', () => {
    expect(parseScore('2')).toBe(2);
    expect(parseScore('0')).toBe(0);
    expect(parseScore(3)).toBe(3);
  });
  it('returns null for empty / null / non-numeric', () => {
    expect(parseScore('')).toBeNull();
    expect(parseScore('  ')).toBeNull();
    expect(parseScore('abc')).toBeNull();
    expect(parseScore(undefined)).toBeNull();
    expect(parseScore(null)).toBeNull();
  });
});

describe('statusFromState', () => {
  it('maps ESPN state to MatchStatus', () => {
    expect(statusFromState('post')).toBe('finished');
    expect(statusFromState('in')).toBe('live');
    expect(statusFromState('pre')).toBe('upcoming');
    expect(statusFromState(undefined)).toBe('upcoming');
  });
});

describe('stageFromSlug', () => {
  it('maps known season slugs, defaults to group', () => {
    expect(stageFromSlug('group-stage')).toBe('group');
    expect(stageFromSlug('round-of-32')).toBe('r32');
    expect(stageFromSlug('round-of-16')).toBe('r16');
    expect(stageFromSlug('quarterfinals')).toBe('qf');
    expect(stageFromSlug('semifinals')).toBe('sf');
    expect(stageFromSlug('final')).toBe('final');
    expect(stageFromSlug('mystery')).toBe('group');
    expect(stageFromSlug(undefined)).toBe('group');
  });
});

describe('scorerLabel', () => {
  it('appends penalty/own-goal tags, keeps clock notation', () => {
    expect(scorerLabel('Breel Embolo', "17'", 'Penalty - Scored')).toBe("Breel Embolo 17' (p)");
    expect(scorerLabel('B. Khoukhi', "90'+5'", 'Goal')).toBe("B. Khoukhi 90'+5'");
    expect(scorerLabel('J. Doe', "30'", 'Own Goal')).toBe("J. Doe 30' (OG)");
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
