# Match Detail View (Apple-Sport-style) — Design

**Date:** 2026-06-25
**Status:** Approved pending user review
**Context:** The fixtures grid (`FixturesView` → `MatchCard`) now runs on ESPN data
(`useWorldCup`). ESPN's `summary?event={id}` endpoint carries full per-match
detail (team stats, play-by-play, lineups, venue). This adds a detail view that
opens from a match card and reproduces the Apple Sports layout.

## Goal & scope

Click a **finished or live** match card → full-screen modal with three tabs:
**Stats**, **Play-By-Play**, **Lineup**. Upcoming matches stay non-clickable
(no stats/plays/lineup data exists yet).

Coverage target (verified against live ESPN data): ~95% of the reference
screenshots. The one genuine gap is **player headshots** (`athlete.headshot` is
empty for this dataset) — the pitch shows numbered/named circles without photos.

Out of scope for this iteration: the "Tournament" tab (previous matches +
group table). Standings already exist in the Standings view; previous-matches
can be a follow-up.

## Architecture

Three new pieces, no router library, no new dependencies.

### 1. Worker route — `GET /api/wc/summary?event={id}`
`worker/index.ts` proxies ESPN summary with per-event KV caching.

- Validate `event` matches `/^\d+$/`; otherwise `400` (guards against SSRF /
  cache-key abuse — the id is interpolated into the upstream URL).
- Cache key `summary:{id}`, `fresh: 30` (live scores move), `keep: 86400`.
- Refactor the existing `serve()` so its KV fresh/stale/revalidate/STALE logic
  is reused: extract a `cached(cacheKey, url, fresh, keep, env, ctx)` core that
  both the static `SOURCES` routes and the dynamic summary route call. The
  static-route path keeps `name → SOURCES[name]`; the summary path builds
  `{cacheKey, url}` from the validated event id.

### 2. Hook — `useMatchDetail(eventId: string | null)`
`src/hooks/useMatchDetail.ts`, modeled on `useWorldCup` (AbortController,
loading/error). When `eventId` is null it does nothing and returns empty —
fetch happens only when a card is opened (lazy). Parses the summary into the
`MatchDetail` shape below. Parsing lives in `src/utils/espn.ts` (pure, tested).

### 3. UI — `MatchDetailModal`
`src/components/MatchDetailModal.tsx`, rendered inside `FixturesView`.

- `FixturesView` holds `openEvent: string | null`. `MatchCard` gains an
  optional `onOpen?: () => void`; finished/live cards call it. Card becomes a
  `<button>` (keyboard-focusable) only when `onOpen` is set.
- Modal: fixed full-screen overlay, score header (reuses existing flag/score
  markup), a 3-tab switch, and a body that renders the active tab. Close on ESC,
  backdrop click, and a close button. Body scrolls; backdrop does not.
- While `loading` → spinner; on `error` → inline retry; per-tab empty data →
  "no data yet" (not an error).

Sub-components (each one focused, testable): `TeamStatsTab`, `PlayByPlayTab`,
`LineupTab` (+ internal `Pitch`).

## Data model (`src/types/index.ts`)

```ts
export interface TeamStatRow { label: string; home: string; away: string } // ESPN displayValue strings
export interface PlayEvent { clock: string; text: string; teamId: string | null; type: string }
export interface LineupPlayer {
  jersey: string; name: string; pos: string; // position.abbreviation, e.g. "CD-R"
  starter: boolean;
  subbedInAt?: string; subbedOutAt?: string;  // minute strings
  card?: 'yellow' | 'red';
}
export interface TeamLineup { teamId: string; teamName: string; formation: string; players: LineupPlayer[] }
export interface MatchDetail {
  homeId: string; awayId: string;
  stats: TeamStatRow[];   // paired by label across the two boxscore teams
  allPlays: PlayEvent[];  // from `commentary` (descriptive, no team color)
  keyPlays: PlayEvent[];  // from `keyEvents` (goals/cards/subs, team-colored)
  lineups: TeamLineup[];  // [home, away]
  venue: string; attendance: number | null;
}
```

## Tab → ESPN field mapping

| Tab | Source | Notes |
|---|---|---|
| **Stats** | `boxscore.teams[].statistics[]` `{label, displayValue}` | Pair home/away by `label`; match each boxscore team to home/away via `team.id`. Apple-style paired horizontal bars (numeric stats get a proportional bar; pass to render bar only when both sides parse as numbers). Stat labels stay in ESPN English. |
| **Play-By-Play** | `commentary` (All) / `keyEvents` (Key) | Toggle. All = `commentary[].text` + `time.displayValue`. Key = `keyEvents[].text` + `clock.displayValue` + `type.text` + `team.id` (left border colored by which side). |
| **Lineup** | `rosters[]` | Per-team toggle (one team's pitch at a time, like the screenshot). `formation` string + starters on a vertical pitch, bench/subs listed below with `↑min` and card icons. |

## Pitch layout (the one piece with real logic → unit-tested)

Positioning is driven by **`position.abbreviation`**, NOT `formationPlace`
(verified: formationPlace is not a clean row order). A `positionToXY(pos,
formation)` function maps abbreviations to normalized `{x: 0..1, y: 0..1}` on a
vertical pitch (GK at bottom, attack at top):

- Row (y) from the role group: `G` → goal line; `CD/RB/LB/RWB/LWB` → defense;
  `DM` → holding; `CM/RM/LM/AM` → midfield; `F/ST/CF/RW/LW` → attack.
- Column (x) from the left/right suffix and role: `-L`/`L*` left, `-R`/`R*`
  right, otherwise centered; multiple same-row players spread evenly.
- Unknown/missing abbreviation → fall back to distributing remaining starters
  across rows parsed from the `formation` string (e.g. "4-1-4-1" → row sizes),
  in roster order. `// ponytail: position-code positioner; formation-row fallback covers oddities`

Players render as a circle with jersey number + short name; a small ↓ marker if
`subbedOutAt` is set. No headshot.

## i18n
Structural UI strings (tab names, "All Plays / Key Plays", "Starting Lineup",
"Bench", "no data", "Attendance") go through the existing i18n (`messages.ts`).
Individual ESPN stat labels and play text stay in ESPN's English —
football terms are near-universal and a ~30-row translation table isn't worth
the maintenance. `// ponytail: ESPN labels passthrough`

## Testing
- `espn.ts` parsers: a captured ESPN summary fixture → assert stat pairing,
  all/key play extraction, lineup parsing (starter/sub/card), venue/attendance.
- `positionToXY`: known abbreviations land in the right row/side; unknown falls
  back without throwing; a full XI produces 11 distinct positions.
- `MatchDetailModal`: opens with a passed detail, switches tabs, closes on ESC.

## Error handling
- Worker: bad/missing `event` → 400; upstream down with a cached copy → STALE
  (existing behavior); no copy → 502.
- Hook: failed fetch → `error` surfaced; modal shows inline retry.
- Empty section (e.g. live match with no stats yet) → per-tab "no data yet".
