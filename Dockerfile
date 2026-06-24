# ── Build the SPA with Bun ───────────────────────────────────────────
# Bun resolves platform-specific native deps (e.g. the Linux rollup binary)
# correctly at install time, sidestepping npm's optional-deps lockfile bug.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ── Serve static files + reverse-proxy /extract → extractor ──────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
