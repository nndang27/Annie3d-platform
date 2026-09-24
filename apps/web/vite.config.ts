import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Desktop web pack: record which source modules went into each client file, so the desktop
 * manifest can say which features a deploy changes (scripts/desktop-manifest.mjs).
 */
function chunkMap(): Plugin {
  return {
    name: 'annie3d-chunk-map',
    generateBundle(_, bundle) {
      if (this.environment?.name !== 'client') return;
      const map: Record<string, string[]> = {};
      const rel = (id: string) => relative(repoRoot, id.split('?')[0]!).replaceAll('\\', '/');
      for (const [file, out] of Object.entries(bundle)) {
        if (out.type === 'chunk') map[file] = Object.keys(out.modules).map(rel);
        else map[file] = (out.originalFileNames ?? []).map((n) => rel(`${repoRoot}/apps/web/${n}`));
      }
      this.emitFile({ type: 'asset', fileName: 'desktop/chunks.json', source: JSON.stringify(map) });
    },
  };
}

// One Vite project for the SPA and the Worker (Cloudflare Vite plugin tutorial:
// developers.cloudflare.com/workers/vite-plugin/tutorial/).
export default defineConfig({
  plugins: [react(), cloudflare(), chunkMap()],
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
