import { describe, it, expect } from 'vitest';
import { parseSummary, layoutStarters } from './espn';
import type { LineupPlayer } from '../types';

const summary = {
  header: {
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { id: '203' } },
          { homeAway: 'away', team: { id: '467' } },
        ],
      },
    ],
  },
  boxscore: {
    teams: [
      {
        team: { id: '203' },
        statistics: [
          { label: 'Possession', displayValue: '54%' },
          { label: 'Shots', displayValue: '21' },
        ],
      },
      {
        team: { id: '467' },
        statistics: [
          { label: 'Possession', displayValue: '46%' },
          { label: 'Shots', displayValue: '14' },
        ],
      },
    ],
  },
  commentary: [
    { time: { displayValue: '' }, text: 'First Half begins.' },
    { time: { displayValue: "3'" }, text: 'Foul by Aubrey Modiba.' },
  ],
  keyEvents: [
    {
      clock: { displayValue: "9'" },
      type: { text: 'Goal' },
      team: { id: '203' },
      text: 'Goal! Mexico 1, South Africa 0.',
    },
  ],
  rosters: [
    {
      team: { id: '203', displayName: 'Mexico' },
      formation: '4-1-4-1',
      roster: [
        {
          starter: true,
          jersey: '1',
          position: { abbreviation: 'G' },
          athlete: { displayName: 'Raúl Rangel' },
          plays: [],
        },
        {
          starter: true,
          jersey: '6',
          position: { abbreviation: 'DM' },
          athlete: { displayName: 'Érik Lira' },
          subbedOut: true,
          plays: [
            { clock: { displayValue: "76'" }, substitution: true },
            { clock: { displayValue: "40'" }, yellowCard: true },
          ],
        },
      ],
    },
    {
      team: { id: '467', displayName: 'South Africa' },
      formation: '4-3-3',
      roster: [],
    },
  ],
  gameInfo: {
    venue: { fullName: 'Estadio Banorte', address: { city: 'Mexico City' } },
    attendance: 80824,
  },
};

describe('parseSummary', () => {
  const d = parseSummary(summary);

  it('pairs team stats by label (home/away from competitor sides)', () => {
    expect(d.homeId).toBe('203');
    expect(d.awayId).toBe('467');
    expect(d.stats).toEqual([
      { label: 'Possession', home: '54%', away: '46%' },
      { label: 'Shots', home: '21', away: '14' },
    ]);
  });

  it('reads commentary as allPlays and keyEvents as keyPlays', () => {
    expect(d.allPlays).toHaveLength(2);
    expect(d.allPlays[1]).toEqual({ clock: "3'", text: 'Foul by Aubrey Modiba.', teamId: null, type: '' });
    expect(d.keyPlays[0]).toEqual({
      clock: "9'",
      text: 'Goal! Mexico 1, South Africa 0.',
      teamId: '203',
      type: 'Goal',
    });
  });

  it('parses lineups with sub minute and card from player.plays', () => {
    const mex = d.lineups[0];
    expect(mex.formation).toBe('4-1-4-1');
    expect(mex.players[0]).toMatchObject({ jersey: '1', name: 'Raúl Rangel', pos: 'G', starter: true });
    expect(mex.players[1]).toMatchObject({ subbedOutAt: "76'", card: 'yellow' });
  });

  it('reads venue and attendance', () => {
    expect(d.venue).toBe('Estadio Banorte · Mexico City');
    expect(d.attendance).toBe(80824);
  });

  it('tolerates an empty object without throwing', () => {
    const empty = parseSummary({});
    expect(empty.stats).toEqual([]);
    expect(empty.lineups).toEqual([]);
    expect(empty.attendance).toBeNull();
  });
});

function mk(pos: string, jersey: string): LineupPlayer {
  return { jersey, name: pos, pos, starter: true };
}

describe('layoutStarters', () => {
  const xi: LineupPlayer[] = [
    mk('G', '1'),
    mk('RB', '2'),
    mk('CD-R', '3'),
    mk('CD-L', '5'),
    mk('LB', '23'),
    mk('DM', '6'),
    mk('RM', '25'),
    mk('CM-R', '26'),
    mk('CM-L', '8'),
    mk('LM', '16'),
    mk('F', '9'),
  ];
  const out = layoutStarters(xi);

  it('returns one position per starter', () => {
    expect(out).toHaveLength(11);
  });

  it('puts the keeper at the bottom and the forward near the top', () => {
    const gk = out.find((p) => p.pos === 'G')!;
    const fw = out.find((p) => p.pos === 'F')!;
    expect(gk.y).toBeGreaterThan(0.85);
    expect(fw.y).toBeLessThan(0.25);
  });

  it('orders a back four left-to-right by side', () => {
    const lb = out.find((p) => p.pos === 'LB')!;
    const rb = out.find((p) => p.pos === 'RB')!;
    expect(lb.x).toBeLessThan(rb.x);
    expect(lb.x).toBeGreaterThanOrEqual(0);
    expect(rb.x).toBeLessThanOrEqual(1);
  });

  it('does not throw on an unknown position (defaults to midfield row)', () => {
    expect(() => layoutStarters([mk('???', '99')])).not.toThrow();
  });
});
