import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { parts } from '../data/catalog.js';
import { buildRocket } from '../render/rocketMesh.js';
import { createStarfield } from '../render/space.js';
import { createLaunchPad, MOUNT_H } from '../render/launchPad.js';
import { transition } from '../ui/fade.js';
import { state } from '../state.js';
import { referenceDesign } from '../data/designs.js';

const EYE = 1.65; // eye height above the walkway
const SPEED = 2.4; // walking speed, m/s
const HATCH_REACH = 1.9; // how close you must be to climb in
const ENTER_TIME = 3.2; // seconds for the climb-in camera move

const ease = (u) => u * u * (3 - 2 * u);

/** Boarding: first person at the top of the service tower; walk the access arm, climb in, sit down. */
export function createBoardingScene() {
  // Dev shortcut ?scene=boarding has no design yet: use the example rocket.
  const design = state.design?.stack.some((e) => e.part === 'capsule-2') ? state.design : referenceDesign();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1022);
  scene.fog = new THREE.Fog(0x0a1022, 150, 700);
  scene.userData.envIntensity = 0.3;
  const camera = new THREE.PerspectiveCamera(70, 1, 0.03, 3000);
  scene.add(new THREE.HemisphereLight(0x8aa4d6, 0x1a1f14, 0.6));
  const moon = new THREE.DirectionalLight(0xbcd0ff, 0.6);
  moon.position.set(-60, 100, 40);
  scene.add(moon);
  const stars = createStarfield(3000, 2500);
  scene.add(stars);

  // ---- rocket on the launch table ----
  const rocket = buildRocket(design, parts);
  rocket.group.position.y = MOUNT_H;
  scene.add(rocket.group);
  const capIndex = design.stack.findIndex((e) => e.part === 'capsule-2');
  const capsule = rocket.objects[capIndex];
  const capY = MOUNT_H + capsule.position.y; // capsule base height in the world

  // Capsule geometry (capsule-2.glb): side hatch on +X, 0.95–1.85 m up, hinged at z = −0.45;
  // seats recline facing the control panel on −X.
  const hatchNode = capsule.getObjectByName('hatch-side');
  if (hatchNode) hatchNode.rotation.y = 1.7; // the door is already open when you arrive
  const hatch = new THREE.Vector3(1.05, capY + 1.4, 0);
  const armY = capY + 0.9; // walkway floor just below the hatch sill
  const pad = createLaunchPad(scene, { armY, armTipX: 1.25, towerH: armY + 9 });

  // Warm light inside the capsule so the cabin isn't black.
  const cabinLight = new THREE.PointLight(0xffe2b0, 0.6, 3.5, 1.5);
  cabinLight.position.set(0, capY + 2.2, 0);
  scene.add(cabinLight);

  // ---- first-person state ----
  const pos = new THREE.Vector3(pad.towerX, armY + EYE, 0); // top of the stairs
  const keys = new Set();
  let controls;
  let mode = 'walk'; // walk → entering → seated
  let enterT = 0;
  let enterFrom;
  let enterLook;
  let ui;
  let manager;
  let prompt;
  let help;
  let objective;
  const listeners = [];
  const on = (t, type, fn) => { t.addEventListener(type, fn); listeners.push(() => t.removeEventListener(type, fn)); };

  // Walkable area: the tower top (4 × 4 m) and the 1.5 m wide arm out to the hatch.
  const clampWalk = (p) => {
    p.x = THREE.MathUtils.clamp(p.x, 1.6, pad.towerX + 1.6);
    const onTower = p.x > pad.towerX - 2;
    const zMax = onTower ? 1.6 : 0.6;
    p.z = THREE.MathUtils.clamp(p.z, -zMax, zMax);
  };

  const setObjective = (text, done = false) => {
    objective.innerHTML = `<div class="obj-tag">OBJECTIVE</div><div class="${done ? 'good' : ''}">${done ? '✔ ' : '▸ '}${text}</div>`;
  };

  const startEnter = () => {
    mode = 'entering';
    enterT = 0;
    enterFrom = camera.position.clone();
    enterLook = camera.getWorldDirection(new THREE.Vector3()).add(camera.position);
    controls.unlock();
    prompt.classList.remove('show');
    help.classList.add('gone');
    setObjective('Take the commander’s seat');
  };

  // Climb-in path: hatch → inside → commander's seat (seat-1, z ≈ −0.32), looking at the panel.
  const seatEye = new THREE.Vector3(0.25, capY + 1.2, -0.32);
  const panel = new THREE.Vector3(-0.62, capY + 1.5, -0.05);
  const path = () => [enterFrom, new THREE.Vector3(1.9, capY + 1.45, 0), new THREE.Vector3(0.6, capY + 1.3, -0.1), seatEye];

  const seated = () => {
    mode = 'seated';
    setObjective('Seated in the commander’s seat', true);
    const card = document.createElement('div');
    card.className = 'seated-card panel';
    card.innerHTML = `
      <div class="brief-tag">COCKPIT</div>
      <p>You're strapped in. In front of you is the control pad, where you'll run the launch checklist, pick the approach orbit and check the cargo.</p>
      <p class="muted">The control pad is the next build step.</p>
      <div class="brief-actions">
        <button data-act="look">Look around</button>
        <button class="cta" data-act="workshop">Back to workshop</button>
      </div>`;
    card.addEventListener('click', (e) => {
      if (e.target.dataset.act === 'workshop') transition(manager, 'workshop');
      if (e.target.dataset.act === 'look') { card.remove(); controls.lock(); }
    });
    ui.appendChild(card);
  };

  return {
    scene,
    camera,
    enter(ctx) {
      ui = ctx.ui;
      manager = ctx.manager;
      camera.position.copy(pos);
      camera.lookAt(0, pos.y - 0.6, 0); // face the rocket
      controls = new PointerLockControls(camera, ctx.renderer.domElement);
      controls.pointerSpeed = 0.7;

      objective = document.createElement('div');
      objective.className = 'objective';
      ui.appendChild(objective);
      setObjective('Walk along the access arm and board the capsule');

      help = document.createElement('div');
      help.className = 'fp-help';
      help.innerHTML = `<div><kbd>Click</kbd> look around</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</div><div><kbd>E</kbd> interact</div><div><kbd>Esc</kbd> free the mouse</div>`;
      ui.appendChild(help);

      const cross = document.createElement('div');
      cross.className = 'crosshair';
      ui.appendChild(cross);
      prompt = document.createElement('div');
      prompt.className = 'interact';
      prompt.innerHTML = `<b>Capsule hatch</b><span><kbd>E</kbd> Climb in</span>`;
      ui.appendChild(prompt);

      on(ctx.renderer.domElement, 'click', () => { if (mode !== 'entering') controls.lock(); });
      on(window, 'keydown', (e) => {
        keys.add(e.code);
        if (e.code === 'KeyE' && mode === 'walk' && prompt.classList.contains('show')) startEnter();
      });
      on(window, 'keyup', (e) => keys.delete(e.code));
    },
    exit() {
      listeners.forEach((off) => off());
      controls?.unlock();
      controls?.dispose();
    },
    update(dt) {
      stars.position.copy(camera.position);
      // Floodlights have no shadows, so they'd shine through the capsule walls: dim them inside.
    const inside = mode !== 'walk' ? 0.03 : 1;
    for (const l of pad.lights) l.intensity += (900 * inside - l.intensity) * Math.min(1, dt * 3);
    // The studio reflection map also makes the shiny cabin glare; keep it faint inside.
    scene.environmentIntensity += ((inside < 1 ? 0.04 : 0.3) - scene.environmentIntensity) * Math.min(1, dt * 3);
    if (mode === 'walk') {
        // Move on the horizontal plane relative to where you're looking.
        const fwd = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
        const right = new THREE.Vector3().crossVectors(fwd, camera.up);
        const move = new THREE.Vector3();
        if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
        if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
        if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
        if (move.lengthSq() > 0) {
          pos.addScaledVector(move.normalize(), SPEED * dt);
          clampWalk(pos);
        }
        // Subtle head bob while walking.
        const bob = move.lengthSq() > 0 ? Math.sin(performance.now() / 140) * 0.03 : 0;
        camera.position.set(pos.x, pos.y + bob, pos.z);
        const near = Math.hypot(pos.x - hatch.x, pos.z - hatch.z) < HATCH_REACH;
        prompt.classList.toggle('show', near);
      } else if (mode === 'entering') {
        enterT += dt / ENTER_TIME;
        const u = Math.min(1, enterT);
        // Walk the path piecewise with easing.
        const pts = path();
        const seg = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1)));
        const local = ease(u * (pts.length - 1) - seg);
        camera.position.lerpVectors(pts[seg], pts[seg + 1], local);
        const look = enterLook.clone().lerp(panel, ease(u));
        camera.lookAt(look);
        if (u >= 1) seated();
      } else if (mode === 'seated') {
        camera.position.copy(seatEye);
      }
    },
  };
}
