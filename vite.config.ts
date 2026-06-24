/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // dev: forward /extract to the local grab service (prod uses nginx same-origin proxy)
  server: {
    proxy: {
      '/extract': 'http://localhost:8081',
      '/proxy': 'http://localhost:8081',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
