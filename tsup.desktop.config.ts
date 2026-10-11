import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'src/desktop/main/index.ts',
    preload: 'src/desktop/preload/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  outDir: 'dist-desktop',
  clean: false,
  sourcemap: false,
  external: ['electron'],
});
