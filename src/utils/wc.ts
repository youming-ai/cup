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

// worldcup26.ir gives `local_date` as wall-clock time at the venue's city, with
// no timezone. Map each venue (by stadium_id) to its UTC offset for the
// tournament window (Jun–Jul 2026): US/Canada are on DST; Mexico has no DST
// (UTC−6 year-round since 2022). Verified against ppv.to's absolute UTC kickoffs.
const STADIUM_UTC_OFFSET: Record<string, number> = {
  '1': -6, '2': -6, '3': -6, // Mexico City, Guadalajara, Monterrey (CST)
  '4': -5, '5': -5, '6': -5, // Dallas, Houston, Kansas City (CDT)
  '7': -4, '8': -4, '9': -4, '10': -4, '11': -4, '12': -4, // Atlanta, Miami, Boston, Philadelphia, NY/NJ, Toronto (EDT)
  '13': -7, '14': -7, '15': -7, '16': -7, // Vancouver, Seattle, SF Bay, LA (PDT)
};

// Parse `local_date` into an absolute instant so it displays in the viewer's
// own timezone — matching how ppv.to's unix `starts_at` is shown.
export function parseKickoff(localDate: string, stadiumId: string): Date | null {
  const m = (localDate || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, min] = m;
  const offset = STADIUM_UTC_OFFSET[stadiumId] ?? -5; // ponytail: -5 fallback for an unknown venue
  const utcMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min) - offset * 3600000;
  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sortStandings(teams: WCStanding[]): WCStanding[] {
  return [...teams].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}
