import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { checkInitialJsBudget } from './build/initialJsBudget.mjs';

export default defineConfig({
  plugins: [react(), {
    name: 'release-build-checks',
    generateBundle(_options, bundle) {
      checkInitialJsBudget(bundle);
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify({
          commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
          builtAt: new Date().toISOString(),
        }),
      });
    },
  }],
  build: { sourcemap: false },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
