import { defineConfig } from 'vite';

/**
 * Base path is configurable so the game can be deployed either at the root of a
 * domain (default) or inside a sub-directory of a static host.
 * Example: VITE_BASE_PATH=/games/math-runner-3d/ npm run build
 */
export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_PATH ?? '/';
  const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787';

  // Proxying keeps the browser on one origin, so the API needs no CORS
  // exception during development and the client can use a relative base path.
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: false },
  };

  return {
    base,
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 900,
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      proxy,
    },
  };
});
