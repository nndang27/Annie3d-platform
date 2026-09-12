import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The app lives under /app/ on the same origin as the Astro site (see scripts/preview-server.mjs).
export default defineConfig({
  base: '/app/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // Keep heavy, route-specific libraries in their own chunks so public/shell routes never pay for them.
        manualChunks(id) {
          // pnpm resolves peer deps under nested paths, so match React before library paths. React Flow is
          // not pinned to a chunk: only the lazily loaded WorkflowTab imports it, so it stays in that chunk.
          if (
            /node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?(react|react-dom|scheduler|zustand|use-sync-external-store)\//.test(
              id,
            )
          )
            return 'react';
          if (id.includes('node_modules/three') || id.includes('packages/viewer-3d')) return 'viewer-3d';
          if (id.includes('@tanstack')) return 'tanstack';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 5174 },
});
