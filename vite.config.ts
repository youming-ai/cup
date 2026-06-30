/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { buildUrl, COMPETITIONS } from './src/competitions';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['umuo.app', '.umuo.app'],
    // dev only: no Worker locally, so forward /api/<key>/* straight to ESPN, mirroring
    // the routes the KV-caching Worker serves in prod (see worker/index.ts).
    proxy: {
      '/api': {
        target: 'https://site.api.espn.com',
        changeOrigin: true,
        rewrite: (p) => {
          const [path, query = ''] = p.split('?');
          const m = path.match(/^\/api\/([^/]+)\/(scoreboard|standings|summary)$/);
          if (!m) return p;
          const comp = COMPETITIONS[m[1]];
          if (!comp) return p;
          const event = new URLSearchParams(query).get('event') ?? undefined;
          const full = buildUrl(comp, m[2] as 'scoreboard' | 'standings' | 'summary', event);
          const u = new URL(full);
          // ponytail: drops buildUrl's host because every competition is on
          // site.api.espn.com today (the fixed `target` above). If a future
          // comp's buildUrl returns a different host (e.g. core.api.espn.com),
          // derive the target per-request via the proxy `router` option instead.
          return u.pathname + u.search;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    fileParallelism: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
