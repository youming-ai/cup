import type { MatchStatus, Stage, WCStanding } from '../types';

export function parseScore(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === 'string' && s.trim() === '') return null;
  const n = typeof s === 'number' ? s : Number(s.trim());
  return Number.isFinite(n) ? n : null;
}

// ESPN status: competition.status.type.state is 'pre' | 'in' | 'post'.
export function statusFromState(state: string | undefined): MatchStatus {
  if (state === 'post') return 'finished';
  if (state === 'in') return 'live';
  return 'upcoming';
}

// ESPN season.slug → our Stage. Anything unknown stays 'group'.
const SLUG_TO_STAGE: Record<string, Stage> = {
  'group-stage': 'group',
  'round-of-32': 'r32',
  'round-of-16': 'r16',
  quarterfinals: 'qf',
  semifinals: 'sf',
  'third-place': 'third',
  final: 'final',
};
export function stageFromSlug(slug: string | undefined): Stage {
  return (slug && SLUG_TO_STAGE[slug]) || 'group';
}

// Build a display scorer line from an ESPN scoring play, e.g.
// "Breel Embolo 17' (p)" / "L. Messi 90'+5'" / "J. Doe 30' (OG)".
export function scorerLabel(name: string, clock: string, typeText: string): string {
  const t = (typeText || '').toLowerCase();
  const tag = t.includes('own') ? ' (OG)' : t.includes('penalty') ? ' (p)' : '';
  return `${name} ${clock}${tag}`.trim();
}

export function sortStandings(teams: WCStanding[]): WCStanding[] {
  return [...teams].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}
