import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works on Vercel and GitHub Pages alike.
  base: './',
  // Three.js alone is ~550 kB minified; that's expected.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    passWithNoTests: true,
  },
});
