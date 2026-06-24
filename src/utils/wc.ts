import type { MatchStatus, WCStanding } from '../types';

export function parseScore(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (t === '' || t.toLowerCase() === 'null') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function deriveStatus(finished: string, timeElapsed: string): MatchStatus {
  const f = (finished || '').toLowerCase();
  const te = (timeElapsed || '').toLowerCase();
  if (f === 'true' || te === 'finished') return 'finished';
  if (te === 'notstarted' || te === '') return 'upcoming';
  return 'live';
}

export function parseKickoff(s: string): Date | null {
  const m = (s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, min] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sortStandings(teams: WCStanding[]): WCStanding[] {
  return [...teams].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}
