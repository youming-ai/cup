# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

StreamCup is a single-page React app for the 2026 FIFA World Cup: schedule/standings/scorers/bracket, ESPN-backed match detail pages, and live-stream playback. It deploys as a Cloudflare Worker that serves the static SPA and edge-caches the upstream data APIs.

## Commands

```bash
npm run dev          # Vite dev server (proxies /api/wc/* straight to ESPN — no Worker locally)
npm run build        # tsc (app) + tsc -p tsconfig.worker.json (worker) + vite build → dist/
npm run typecheck    # type-check BOTH app and worker without building
npm test             # vitest (watch). `npx vitest run` for a single pass (CI mode)
npm run lint         # biome lint .   (lint:fix to autofix)
npm run format       # biome format --write .

npx vitest run src/utils/wc.test.ts          # one test file
npx vitest run -t "renders the match header"  # one test by name
```

Deploys to Cloudflare (config in `wrangler.jsonc`: Worker `main` + static `assets` from `dist/`, plus the `CACHE` KV namespace). There is no `deploy` npm script — `wrangler` isn't a dependency, so deployment runs outside the repo (CI / Cloudflare git integration).

Tests run under jsdom with `globals: true` and **`fileParallelism: false`** (vite.config.ts) — tests run serially; don't assume isolation gives you parallel speedups. Setup is `src/test-setup.ts`. Tests are colocated as `*.test.ts(x)`.

## Architecture

### Two data backends, fetched two different ways
- **ESPN** (public site API, no key, CORS-open) provides all World Cup data. The browser calls same-origin `/api/wc/{scoreboard,standings,summary}`. In **prod** these hit the Worker (`worker/index.ts`), which fetches ESPN and KV-caches it. In **dev** there is no Worker — `vite.config.ts` proxies the same paths directly to ESPN. Keep the route list in `worker/index.ts` and the dev proxy in `vite.config.ts` in sync.
- **ppv.to** provides live streams and is fetched **directly from the browser** (`useStreams.ts`), bypassing the Worker, because ppv.to fingerprint-blocks datacenter IPs. Stream iframe URLs are gated through an allowlist in `src/utils/streamSources.ts` (`isTrustedStreamUrl`) — only HTTPS URLs on trusted hosts are rendered.

### The Worker is an edge cache, not app logic
`worker/index.ts`: per-source `fresh` (serve-without-revalidate) / `keep` (KV retention) TTLs, request coalescing via an in-flight map (concurrent callers share one upstream fetch), and serve-stale-on-outage (returns last good KV copy if upstream fails, 502 only if nothing cached). It also serves static assets / SPA fallback via the `ASSETS` binding (`not_found_handling: single-page-application` in wrangler.jsonc), which is what makes deep links resolve on refresh.

### Data shaping happens in hooks + utils, over untyped ESPN JSON
`useWorldCup.ts` is the largest transform: it folds ESPN's `scoreboard` (104 matches) + `standings` (12 groups) into the app's `WCMatch` / `WCGroup` / `TopScorer` types (`src/types/index.ts`), cross-referencing them (e.g. team→group map, per-team form strings collected from the scoreboard and attached to standings rows). ESPN JSON is untyped and inconsistent, so parsing uses defensive `obj()/arr()/str()` coercion helpers rather than trusting shapes. Pure status/score/slug/stage helpers live in `src/utils/wc.ts`; match-detail (lineups, play-by-play, team stats) transforms live in `src/utils/espn.ts` and `useMatchDetail.ts`.

All data hooks share a pattern: **stale-while-revalidate** (show cached immediately, refetch in background), `AbortController` per fetch, and **visibility-gated polling** (useWorldCup 30s, useStreams 60s; paused when tab hidden).

### Routing is a custom ~150-line History API module — no react-router
`src/utils/router.ts` defines the `Route` union and `parseRoute`/`pathFor`/`navigate`/`useRouter`. Every view is addressable (`/`, `/standings`, `/scorers`, `/bracket`, `/live`, `/live/<slug>`, `/match/<slug>`, `/team/<id>`, `/player/<id>`). Because `pushState` doesn't emit `popstate`, `navigate()` dispatches a custom `app:routechange` event that `useRouter` listens for — that's how programmatic navigation stays in sync without prop-drilling a setter. `App.tsx` is the switchboard: it reads the route, derives the top-nav highlight from it (no separate "view" state), and renders the matching page, gating WC-data pages on the `useWorldCup` fetch so cold-loaded shared links never flash a false 404. Path segments are untrusted — decode defensively (`safeDecode`) and fall back to home, never throw.

### i18n is custom, 4 languages
`src/i18n/` — `messages.ts` is a flat `key → string` map per language (`en`, `zh`, `ja`, `ko`; en is the fallback), `index.tsx` provides `LanguageProvider`/`useT`/`translate` with `{var}` interpolation. Language is detected from localStorage then `navigator.languages`. `messages.test.ts` enforces key parity across languages — add a key to every language.

## Conventions

- **Colors only through tokens.** Palette is CSS variables in `src/index.css` `:root` as `--c-*` channel values (`"R G B"`), mapped to Tailwind colors in `tailwind.config.js` (`night`/`panel`/`panel2`/`line`/`chalk`/`chalkdim`/`pitch`/`live`/`amber`) via `rgb(var(--c-x) / <alpha-value>)` so alpha modifiers (`bg-pitch/40`) work. Don't hardcode hex/`rgba()` or use Tailwind's named palette for recurring semantic colors — add a token. Exception: `bg-white/5`-style translucent overlays are the accepted elevation idiom and are intentionally not tokenized.
- **Visual style** is a rounded "Apple Sports" look (rounded corners, soft shadows, overlays). An earlier square/zero-radius aesthetic was removed — don't reintroduce the `borderRadius: 0` Tailwind override.
- **Single scroll container** (`App.tsx` root) so the sticky `Header` shares the same scrollbar gutter as content and they align across platforms (`--sb-w` in index.css is the single source for that width). Don't add nested scroll containers or per-platform padding hacks.
- **Formatting/lint**: Biome (config `biome.json`), 2-space indent, single quotes, semicolons, trailing commas, line width 100. The `style` rule group is **off**; `*.css` and `worker-configuration.d.ts` are excluded from Biome. Run `npm run typecheck` to validate the worker too (it has a separate `tsconfig.worker.json`).
