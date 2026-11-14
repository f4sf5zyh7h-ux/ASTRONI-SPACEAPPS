import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import available from 'virtual:model-list';

// Drop-in GLB models: any /public/models/<id>.glb is used instead of the
// primitive (the list comes from vite.config.js). Missing files are fine —
// the game always works with primitives.

const loaded = new Map();
const loader = new GLTFLoader();

/** Load every available model. Never throws; a broken file just falls back to primitives. */
export async function preloadModels() {
  const base = import.meta.env.BASE_URL;
  const results = await Promise.allSettled(
    available.map(async (id) => {
      const gltf = await loader.loadAsync(`${base}models/${id}.glb`);
      loaded.set(id, gltf.scene);
    }),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[models] ${available[i]}.glb failed to load`, r.reason);
  });
  if (loaded.size) console.info(`[models] using: ${[...loaded.keys()].join(', ')}`);
}

/** A fresh copy of the loaded model, or null if there isn't one. */
export function getModel(id) {
  return loaded.get(id)?.clone(true) ?? null;
}

export const hasModel = (id) => loaded.has(id);
