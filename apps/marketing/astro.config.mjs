import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Public site is fully prerendered. The app lives at /app/ on the same origin in production preview.
export default defineConfig({
  site: 'https://3dads.example',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  integrations: [sitemap({ filter: (page) => !page.includes('/legal/') })],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    resolve: {
      alias: {
        '@3dads/viewer-3d': new URL('../../packages/viewer-3d/src/index.ts', import.meta.url).pathname,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) =>
            id.includes('node_modules/three') || id.includes('packages/viewer-3d') ? 'viewer-3d' : undefined,
        },
      },
    },
  },
});
