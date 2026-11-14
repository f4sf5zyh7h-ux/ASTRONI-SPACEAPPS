import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Exposes the files in a public/ folder as a virtual module (list of names without
 * extension) and reloads the page when files are added or removed.
 * Used for drop-in models (public/models/*.glb) and voice lines (public/audio/*.mp3).
 */
function fileList(virtualId, folder, ext) {
  const dir = resolve(import.meta.dirname, 'public', folder);
  const list = () => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)) : []);
  return {
    name: `file-list-${folder}`,
    resolveId: (id) => (id === virtualId ? '\0' + virtualId : null),
    load: (id) => (id === '\0' + virtualId ? `export default ${JSON.stringify(list())};` : null),
    configureServer(server) {
      server.watcher.add(dir);
      const onChange = (file) => {
        // Compare loosely: Windows paths differ in slash direction and drive-letter case.
        const norm = (p) => p.replaceAll('\\', '/').toLowerCase();
        if (!norm(file).startsWith(norm(dir))) return;
        const mod = server.moduleGraph.getModuleById('\0' + virtualId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig({
  // Relative base so the build works on Vercel and GitHub Pages alike.
  base: './',
  plugins: [fileList('virtual:model-list', 'models', '.glb'), fileList('virtual:audio-list', 'audio', '.mp3')],
  // Three.js alone is ~550 kB minified; that's expected.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    passWithNoTests: true,
  },
});
