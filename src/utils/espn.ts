import type { LineupPlayer } from '../types';

export type PositionedPlayer = LineupPlayer & { x: number; y: number };

// 5 rows back-to-front; y grows downward (GK at the bottom of a vertical pitch).
const ROW_Y = [0.93, 0.72, 0.56, 0.4, 0.16];

function rowGroup(pos: string): number {
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK') return 0;
  if (p.includes('DM')) return 2;
  if (p === 'SW' || p.startsWith('CD') || p.startsWith('D') || p.endsWith('B')) return 1; // SW/CB/RB/LB/WB/CD
  if (p.startsWith('F') || p.endsWith('F') || p.startsWith('S') || p.endsWith('W')) return 4; // F/LF/RF/ST/RW/LW
  return 3; // CM/RM/LM/AM/M and unknowns → midfield
}
function sideScore(pos: string): number {
  const p = pos.toUpperCase();
  if (p.endsWith('-L')) return -1;
  if (p.endsWith('-R')) return 1;
  if (p.startsWith('L')) return -1;
  if (p.startsWith('R')) return 1;
  return 0;
}

// ponytail: position-code positioner; unknown codes fall to the midfield row
export function layoutStarters(starters: LineupPlayer[]): PositionedPlayer[] {
  const rows = new Map<number, LineupPlayer[]>();
  for (const pl of starters) {
    const g = rowGroup(pl.pos);
    (rows.get(g) ?? rows.set(g, []).get(g)!).push(pl);
  }
  const out: PositionedPlayer[] = [];
  for (const [g, list] of rows) {
    list.sort(
      (a, b) =>
        sideScore(a.pos) - sideScore(b.pos) || (Number(a.jersey) || 0) - (Number(b.jersey) || 0),
    );
    const n = list.length;
    list.forEach((pl, i) => {
      const x = n === 1 ? 0.5 : 0.15 + (i * 0.7) / (n - 1);
      out.push({ ...pl, x, y: ROW_Y[g] });
    });
  }
  return out;
}
