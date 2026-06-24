/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const EXTRACTOR_URL = process.env.EXTRACTOR_URL || 'http://localhost:8081';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/extract': EXTRACTOR_URL,
      '/proxy': EXTRACTOR_URL,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
