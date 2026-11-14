import * as THREE from 'three';
import { addSpaceLighting, createStarfield, createEarth } from '../render/space.js';
import { transition } from '../ui/fade.js';
import { modelProgress, modelsReady } from '../render/models.js';

/** Title screen: Earth's limb at dawn, the ASTRONI logo, Continue. */
export function createTitleScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.userData.envIntensity = 0.2; // space: little reflected light
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 20000);
  addSpaceLighting(scene);
  const stars = createStarfield();
  scene.add(stars);
  const earth = createEarth(100);
  earth.position.set(0, -104, -20);
  scene.add(earth);

  let t = 0;
  let onKey;
  return {
    scene,
    camera,
    enter({ ui, manager }) {
      const root = document.createElement('div');
      root.className = 'title-screen';
      root.innerHTML = `
        <h1 class="logo">ASTRONI</h1>
        <p class="tagline">Build it. Fly it. Fix it. Bring them home.</p>
        <button class="cta">Continue</button>
        <div class="hint">or press Enter</div>
        <div class="load-bar" title="Loading the 3D parts"><i></i><span></span></div>
        <footer>NASA Space Apps Challenge 2026 · Space Mission Design Game</footer>`;
      ui.appendChild(root);

      // Models keep loading behind the title; show progress, and wait for them on Continue.
      const bar = root.querySelector('.load-bar');
      const paint = () => {
        const { done, total } = modelProgress;
        bar.querySelector('i').style.width = `${total ? (done / total) * 100 : 100}%`;
        bar.querySelector('span').textContent = done >= total ? 'Ready' : `Loading parts ${done} / ${total}`;
        bar.classList.toggle('done', done >= total);
      };
      paint();
      const timer = setInterval(paint, 150);
      modelsReady().then(() => { paint(); clearInterval(timer); });

      let leaving = false;
      const go = async () => {
        if (leaving) return;
        leaving = true;
        root.querySelector('.cta').textContent = 'Loading…';
        await modelsReady();
        transition(manager, 'missions');
      };
      root.querySelector('.cta').onclick = go;
      onKey = (e) => e.key === 'Enter' && go();
      window.addEventListener('keydown', onKey);
    },
    exit() {
      window.removeEventListener('keydown', onKey);
    },
    update(dt) {
      t += dt;
      earth.userData.tick(dt * 3);
      // Slow drift so the scene feels alive.
      camera.position.set(Math.sin(t * 0.05) * 6, 4 + Math.sin(t * 0.07) * 1.5, 40);
      camera.lookAt(0, 2, -60);
      stars.position.copy(camera.position);
    },
  };
}
