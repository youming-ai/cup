/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['umuo.app', '.umuo.app'],
    // dev only: no Worker locally, so forward /api/* straight to the upstreams
    // (prod serves these from the KV-caching Worker — see worker/index.ts)
    proxy: {
      '/api/wc': {
        target: 'https://worldcup26.ir',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/wc/, '/get'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
