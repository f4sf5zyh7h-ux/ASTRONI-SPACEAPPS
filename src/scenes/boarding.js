import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { parts } from '../data/catalog.js';
import { buildRocket, hullRadiusAt } from '../render/rocketMesh.js';
import { createPadSetting } from '../render/padSetting.js';
import { createLaunchPad, padBase, addPadVehicles } from '../render/launchPad.js';
import { transition } from '../ui/fade.js';
import { state } from '../state.js';
import { exampleDesign } from '../data/catalog.js';
import { createControlPad } from '../ui/controlPad.js';
import missionData from '../data/missions.json';

const EYE = 1.65; // eye height above the walkway
const SPEED = 2.4; // walking speed, m/s
const HATCH_REACH = 1.9; // how close you must be to climb in
const ENTER_TIME = 3.2; // seconds for the climb-in camera move

const ease = (u) => u * u * (3 - 2 * u);

/** Boarding: first person at the top of the service tower; walk the access arm, climb in, sit down. */
export function createBoardingScene() {
  // Dev shortcut ?scene=boarding has no design yet: use the example rocket.
  const design = state.design?.stack.some((e) => e.part === 'capsule-2') ? state.design : exampleDesign();
  const scene = new THREE.Scene();
  scene.userData.envIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(70, 1, 0.06, 20000);
  // Daytime at the pad: blue sky, island launch site in the ocean (padSetting.js).
  const setting = createPadSetting(scene);

  // ---- rocket on the launch table ----
  const rocket = buildRocket(design, parts);
  rocket.group.traverse((o) => { if (o.name === 'wing') o.rotation.z = -Math.PI / 2; }); // solar panels stay folded until orbit
  const BASE = padBase();
  rocket.group.position.y = BASE;
  scene.add(rocket.group);
  const capIndex = design.stack.findIndex((e) => e.part === 'capsule-2');
  const capsule = rocket.objects[capIndex];
  const capY = BASE + capsule.position.y; // capsule base height in the world

  // Capsule geometry (capsule-2.glb): side hatch on +X, 0.95–1.85 m up, hinged at z = −0.45;
  // seats recline facing the control panel on −X.
  const hatchNode = capsule.getObjectByName('hatch-side');
  if (hatchNode) hatchNode.rotation.y = 1.7; // the door is already open when you arrive
  const hatch = new THREE.Vector3(1.05, capY + 1.4, 0);
  const armY = capY + 0.9; // walkway floor just below the hatch sill
  addPadVehicles(scene, 'boarding');
  const pad = createLaunchPad(scene, { armY, armTipX: 1.25, towerH: armY + 9, radiusAt: (y) => hullRadiusAt(design, parts, rocket, y - BASE) });

  // Warm light inside the capsule so the cabin isn't black.
  // Cabin lighting: two warm ceiling lamps over the seats + a cool fill (no shadows in this engine,
  // so outside daylight is dimmed while you're inside and these take over).
  const cabinLights = [
    new THREE.PointLight(0xffe4bc, 0, 3.2, 1.6),
    new THREE.PointLight(0xffe4bc, 0, 3.2, 1.6),
    new THREE.PointLight(0xbcd4ff, 0, 2.6, 1.8),
  ];
  cabinLights[0].position.set(0.1, capY + 2.3, -0.45);
  cabinLights[1].position.set(0.1, capY + 2.3, 0.45);
  cabinLights[2].position.set(0.6, capY + 1.2, 0);
  const CABIN_ON = [1.6, 1.6, 0.5];
  scene.add(...cabinLights);

  // ---- first-person state ----
  const pos = new THREE.Vector3(pad.startX, armY + EYE, 0); // end of the stairs, on the arm
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
  let canvas;
  let padClock = 0;
  const listeners = [];
  const on = (t, type, fn) => { t.addEventListener(type, fn); listeners.push(() => t.removeEventListener(type, fn)); };

  // Walkable area: the tower top (4 × 4 m) and the 1.5 m wide arm out to the hatch.
  const clampWalk = (p) => {
    p.x = THREE.MathUtils.clamp(p.x, 1.6, pad.walkMaxX);
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

  // ---- control pad on the capsule's panel ----
  const mission = missionData.missions.find((m) => m.id === state.missionId) ?? missionData.missions[0];
  let pad2d = null;
  let screen = null;
  let toastEl;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const panelCentre = new THREE.Vector3(-0.5, capY + 1.52, -0.02);

  const makeScreen = () => {
    pad2d = createControlPad({
      design, mission, state,
      onLaunch: () => {
        if (manager.factories.has('launch')) transition(manager, 'launch', {}, 900);
        else showToast('LIFTOFF! (The launch cutscene is the next build step.)');
      },
    });
    // 1024×640 screen, 0.74 m wide, facing the commander's eyes, just in front of the panel.
    screen = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.4625), new THREE.MeshBasicMaterial({ map: pad2d.texture, toneMapped: false, depthTest: false }));
    screen.position.copy(panelCentre).lerp(seatEye, 0.08);
    screen.lookAt(seatEye);
    screen.renderOrder = 10; // drawn over the panel bracket so nothing cuts across it
    scene.add(screen);
    // Soft blue glow from the screen onto the cabin.
    const glow = new THREE.PointLight(0x4fc3f7, 0.06, 1.5);
    glow.position.copy(screen.position).lerp(seatEye, 0.3);
    scene.add(glow);
  };

  /** The control-pad uv under the mouse (or under the crosshair while looking around). */
  const screenUv = (e) => {
    if (!screen) return null;
    if (controls.isLocked || !e) ndc.set(0, 0);
    else {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(screen)[0]?.uv ?? null;
  };

  const showToast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3500);
  };

  const seated = () => {
    mode = 'seated';
    setObjective('Run the checks on the control pad, then LAUNCH');
    makeScreen();
    camera.lookAt(screen.position);
    camera.fov = 48; // lean in: the screen fills more of the view
    camera.updateProjectionMatrix();
    const tips = document.createElement('div');
    tips.className = 'fp-help';
    tips.innerHTML = '<div>Click the screen to use it</div><div>Click elsewhere to look around · <kbd>Esc</kbd> mouse</div><div><kbd>1</kbd>–<kbd>6</kbd> screen pages</div>';
    ui.appendChild(tips);
    const back = document.createElement('button');
    back.className = 'skip';
    back.textContent = '‹ Workshop';
    back.onclick = () => transition(manager, 'workshop');
    ui.appendChild(back);
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

      canvas = ctx.renderer.domElement;
      toastEl = document.createElement('div');
      toastEl.className = 'ws-toast';
      ui.appendChild(toastEl);
      on(canvas, 'click', (e) => {
        if (mode === 'entering') return;
        if (mode === 'seated') {
          const uv = screenUv(e);
          if (uv) return pad2d.click(uv); // pressed something on the screen
        }
        controls.lock();
      });
      on(canvas, 'pointermove', (e) => { if (mode === 'seated') pad2d.hover(screenUv(e)); });
      on(window, 'keydown', (e) => {
        keys.add(e.code);
        if (e.code === 'KeyE' && mode === 'walk' && prompt.classList.contains('show')) startEnter();
        if (mode === 'seated' && /^Digit[1-6]$/.test(e.code)) pad2d.key(Number(e.code.slice(5)));
      });
      on(window, 'keyup', (e) => keys.delete(e.code));
    },
    exit() {
      listeners.forEach((off) => off());
      controls?.unlock();
      controls?.dispose();
    },
    update(dt) {
      setting.update(camera, 0);
      // Lights have no shadows, so daylight would shine straight through the capsule walls: dim it inside.
    const inside = mode !== 'walk' ? 0.03 : 1;
    const k = Math.min(1, dt * 3);
    setting.sun.intensity += (2.6 * inside - setting.sun.intensity) * k;
    // The studio reflection map also makes the shiny cabin glare; keep it faint inside.
    scene.environmentIntensity += ((inside < 1 ? 0.22 : 0.5) - scene.environmentIntensity) * k;
    cabinLights.forEach((l, n) => (l.intensity += ((inside < 1 ? CABIN_ON[n] : 0.25 * CABIN_ON[n]) - l.intensity) * k));
    setting.fill.intensity += ((inside < 1 ? 0.1 : 1.1) - setting.fill.intensity) * k;
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
        padClock += dt;
        if (padClock > 0.5) { padClock = 0; pad2d.draw(performance.now() / 1000); } // blink
      }
    },
  };
}
