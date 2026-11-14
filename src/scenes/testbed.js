import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Phase 0 placeholder: proves rendering, camera and the UI overlay work.
 * Shows a primitive rocket at real scale (metres) on a launch pad.
 * Replaced by the real scenes from Phase 2 on.
 */
export function createTestbedScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(28, 18, 28);

  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x202020, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  const grid = new THREE.GridHelper(60, 60, 0x4fc3f7, 0x1c2a3a);
  scene.add(grid);

  scene.add(buildSampleRocket());

  let controls;
  return {
    scene,
    camera,
    enter({ renderer, ui }) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 8, 0);
      controls.enableDamping = true;
      controls.update();

      const card = document.createElement('div');
      card.className = 'panel';
      card.style.cssText = 'position:absolute;left:16px;top:16px;max-width:320px';
      card.innerHTML = `
        <strong>ASTRONI — scaffold OK</strong><br>
        <span style="color:var(--muted)">Drag to orbit · scroll to zoom · right-drag to pan.<br>
        Grid squares are 1 m. The rocket is a placeholder at real scale.</span>`;
      ui.appendChild(card);
    },
    exit() {
      controls?.dispose();
    },
    update() {
      controls?.update();
    },
  };
}

/** Placeholder stack using standard diameters (L = 3.75 m, M = 2.5 m). */
function buildSampleRocket() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.4, metalness: 0.6 });

  let y = 0;
  const stack = (mesh, height) => {
    mesh.position.y = y + height / 2;
    group.add(mesh);
    y += height;
  };

  // Engine bell, tank-l (10.2 m), adapter, capsule cone.
  stack(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 2, 24), dark), 2);
  stack(new THREE.Mesh(new THREE.CylinderGeometry(1.875, 1.875, 10.2, 32), white), 10.2);
  stack(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.875, 1, 32), dark), 1);
  stack(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.25, 3.5, 32), white), 3.5);

  return group;
}
