import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// One Vite project for the SPA and the Worker (Cloudflare Vite plugin tutorial:
// developers.cloudflare.com/workers/vite-plugin/tutorial/).
export default defineConfig({
  plugins: [react(), cloudflare()],
  // `pnpm share` serves the local build through a Cloudflare quick tunnel (try.cloudflare.com).
  preview: { allowedHosts: ['.trycloudflare.com'] },
  resolve: { alias: { '@client': fileURLToPath(new URL('./src/client', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: 'hidden', // best-practices skill: no public source maps
    rollupOptions: {
      output: {
        // Keep heavy libraries out of the first paint (react-best-practices: bundle-dynamic-imports).
        manualChunks(id) {
          if (/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?(react|react-dom|scheduler)\//.test(id))
            return 'react';
          if (id.includes('node_modules/three') || id.includes('packages/viewer-3d')) return 'three';
          if (id.includes('@xyflow')) return 'xyflow';
          return undefined;
        },
      },
    },
  },
});
