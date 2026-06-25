import { describe, it, expect } from 'vitest';
import { parseSummary } from './espn';

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
