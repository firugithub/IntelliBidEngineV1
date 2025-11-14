import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  packages: 'external',
  // Exclude dev-only modules from production bundle
  external: [
    './vite.js',
    './vite',
    '../vite.config.js',
    '../vite.config'
  ],
});
