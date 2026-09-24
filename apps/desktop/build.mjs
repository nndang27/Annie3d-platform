// Bundles the shell (main process + preload) with esbuild. The web app is not built here: the
// shell serves the website build (apps/web/dist/client) as its bundled web pack.
import { build } from 'esbuild';

const common = {
  // esbuild resolves entry points against this directory, whoever runs the script.
  absWorkingDir: new URL('.', import.meta.url).pathname,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: 'linked',
  external: ['electron'],
  logLevel: 'warning',
};
await Promise.all([
  build({
    ...common,
    entryPoints: ['src/main/index.ts'],
    outfile: 'dist/main.js',
    external: ['electron', 'electron-updater'],
  }),
  // Sandboxed preload: one self-contained file, only `electron` imported.
  build({ ...common, entryPoints: ['src/preload/bridge.ts'], outfile: 'dist/preload.js' }),
]);
console.log('desktop shell built');
