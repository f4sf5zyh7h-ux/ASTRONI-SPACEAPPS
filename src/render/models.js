import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import available from 'virtual:model-list';
import { applyLivery } from './livery.js';

// Drop-in GLB models: any /public/models/<id>.glb is used instead of the
// primitive (the list comes from vite.config.js). Missing files are fine —
// the game always works with primitives.

const loaded = new Map();
const loader = new GLTFLoader();

/** Loading progress for the title screen: { done, total }. */
export const modelProgress = { done: 0, total: available.length };
let readyPromise = null;

/**
 * Load every available model (once). Never throws; a broken file just falls back to primitives.
 * `onProgress(done, total)` is called as each file finishes.
 */
export function preloadModels(onProgress) {
  if (readyPromise) return readyPromise;
  const base = import.meta.env.BASE_URL;
  readyPromise = Promise.allSettled(
    available.map(async (id) => {
      try {
        const gltf = await loader.loadAsync(`${base}models/${id}.glb`);
        loaded.set(id, applyLivery(gltf.scene, id)); // paint once; every clone shares the materials
      } finally {
        modelProgress.done++;
        onProgress?.(modelProgress.done, modelProgress.total);
      }
    }),
  ).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn(`[models] ${available[i]}.glb failed to load`, r.reason);
    });
    if (loaded.size) console.info(`[models] ${loaded.size} models loaded`);
  });
  return readyPromise;
}

/** Resolves when all models are in (start loading if nobody has yet). */
export const modelsReady = () => preloadModels();

/** A fresh copy of the loaded model, or null if there isn't one. */
export function getModel(id) {
  return loaded.get(id)?.clone(true) ?? null;
}

export const hasModel = (id) => loaded.has(id);
