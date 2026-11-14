import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPartMesh } from './partMesh.js';

// Small catalogue pictures: render each part once with a throwaway renderer, keep the PNGs.
const cache = new Map();

/** Map of part id → data URL. Renders on first call (~30 parts, a fraction of a second). */
export function partThumbnails(partList, parts, size = 112) {
  const todo = partList.filter((p) => !cache.has(p.id));
  if (!todo.length) return cache;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);

  for (const p of todo) {
    const obj = createPartMesh(p, null, parts);
    scene.add(obj);
    // Frame the part: look slightly down from the front-right, fit its bounding sphere.
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.05;
    const dir = new THREE.Vector3(0.9, 0.55, 1.2).normalize();
    camera.position.copy(sphere.center).addScaledVector(dir, dist);
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    cache.set(p.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(obj);
  }
  pmrem.dispose();
  renderer.dispose();
  return cache;
}
