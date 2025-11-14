import * as esbuild from 'esbuild';

console.log('Building backend with esbuild (excluding vite from production)...');
await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  packages: 'external',
  // Exclude dev-only vite modules from production bundle
  external: [
    './vite.js',
    './vite',
    '../vite.config.js',
    '../vite.config'
  ],
});

console.log('\n✅ Backend build completed successfully!');
