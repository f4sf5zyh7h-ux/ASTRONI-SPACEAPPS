import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MODELS_DIR = resolve(import.meta.dirname, 'public/models');
const VIRTUAL_ID = 'virtual:model-list';

/** Exposes the list of GLB files in public/models as `virtual:model-list`; reloads when files change. */
function modelList() {
  const list = () => (existsSync(MODELS_DIR) ? readdirSync(MODELS_DIR).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)) : []);
  return {
    name: 'model-list',
    resolveId: (id) => (id === VIRTUAL_ID ? '\0' + VIRTUAL_ID : null),
    load: (id) => (id === '\0' + VIRTUAL_ID ? `export default ${JSON.stringify(list())};` : null),
    configureServer(server) {
      server.watcher.add(MODELS_DIR);
      const onChange = (file) => {
        // Compare loosely: Windows paths differ in slash direction and drive-letter case.
        const norm = (p) => p.replaceAll('\\', '/').toLowerCase();
        if (!norm(file).startsWith(norm(MODELS_DIR))) return;
        const mod = server.moduleGraph.getModuleById('\0' + VIRTUAL_ID);
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
  plugins: [modelList()],
  // Three.js alone is ~550 kB minified; that's expected.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    passWithNoTests: true,
  },
});
