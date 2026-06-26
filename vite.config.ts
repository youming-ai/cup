/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['umuo.app', '.umuo.app'],
    // dev only: no Worker locally, so forward /api/wc/* straight to ESPN, mirroring
    // the routes the KV-caching Worker serves in prod (see worker/index.ts).
    proxy: {
      '/api/wc': {
        target: 'https://site.api.espn.com',
        changeOrigin: true,
        rewrite: (p) => {
          const [path, query = ''] = p.split('?');
          if (path === '/api/wc/scoreboard')
            return '/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300';
          if (path === '/api/wc/standings')
            return '/apis/v2/sports/soccer/fifa.world/standings?season=2026&level=3';
          if (path === '/api/wc/summary')
            // forward the ?event=… id
            return `/apis/site/v2/sports/soccer/fifa.world/summary?${query}`;
          return p;
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
