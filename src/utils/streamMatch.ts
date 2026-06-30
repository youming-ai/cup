import type { Match, WCMatch } from '../types';
import { slugify } from './helpers';

// ppv.to streams and ESPN fixtures are different sources with no shared id, so
// they're matched by team-name slug. ESPN's match slug is
// `${home}-vs-${away}-${espnId}`; a ppv stream's slug is slugify(name), e.g.
// "netherlands-vs-morocco". We compare on the team-name base in both orderings
// because ppv may list home/away the other way round.
export function streamForMatch(match: WCMatch, streams: Match[]): Match | null {
  const a = slugify(`${match.homeName}-vs-${match.awayName}`);
  const b = slugify(`${match.awayName}-vs-${match.homeName}`);
  return streams.find((s) => s.slug === a || s.slug === b) ?? null;
}

// Live-state of a ppv stream (lifted from the old LiveView.classify). The feed
// only carries a 2-state status, so this is best-effort: alwaysLive feeds are
// always live; otherwise live iff `now` is within [startsAt, endsAt).
export function isStreamLive(stream: Match, now: number): boolean {
  if (stream.alwaysLive) return true;
  const start = stream.startsAt ? stream.startsAt * 1000 : null;
  const end = stream.endsAt ? stream.endsAt * 1000 : null;
  if (start && now < start) return false;
  if (end && now >= end) return false;
  return true;
}
