import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The dev server proxies /api to the Express API so the browser only ever talks
 * to a single origin. In production, serve the built web app behind the same
 * reverse proxy as the API (see docs/DEMO_GUIDE.md).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // The API listens on PORT (default 3001). Change both if you move it.
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 4173 },
  build: { outDir: 'dist', sourcemap: true },
});
