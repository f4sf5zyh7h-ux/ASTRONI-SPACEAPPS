import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { exampleDesign } from '../data/catalog.js';
import { addSpaceLighting, createStarfield, createEarth } from '../render/space.js';
import { createServicingSite, DAMAGE } from '../render/servicingSite.js';
import { rigArm, STOWED } from '../render/roboticArm.js';
import { createNarrator } from '../ui/narrator.js';
import { transition } from '../ui/fade.js';
import { state } from '../state.js';

// Robotic-arm station (inside the ship): unfold the arm, inspect AURORA-7 with the wrist camera
// for damage, grab the new panel off the cargo module and park it beside the satellite's mount
// for the spacewalker. The player steers the grabber; the arm's joints follow (roboticArm.js).

const SPEED = 1.1; // m/s grabber speed
const SCAN_RANGE = 1.9;
const SCAN_TIME = 1.2;
const GRAB_RANGE = 0.5;
const PARK_RANGE = 0.8;
const ease = (u) => u * u * (3 - 2 * u);

export function createArmScene() {
  const design = state.design?.stack.some((e) => e.part === 'capsule-2') ? state.design : exampleDesign();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.userData.envIntensity = 0.3;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20000);
  const armCam = new THREE.PerspectiveCamera(62, 1.4, 0.28, 20000); // near plane skips the camera's own housing
  addSpaceLighting(scene);
  const stars = createStarfield();
  scene.add(stars);
  const earth = createEarth(400);
  earth.position.set(0, -440, -60);
  scene.add(earth);

  const site = createServicingSite(scene, design);
  scene.userData.debug = { site, get phase() { return phase; } }; // for automated checks
  const arm = rigArm(site.arm);
  const READY = arm.solve(new THREE.Vector3(2.6, -0.2, 0.45)) ?? { yaw: 0, sh: 0.3, el: -0.9, wr: 0 };
  scene.updateMatrixWorld(true);
  const grapple = site.panel.getObjectByName('grapple') ?? site.panel;
  const mountWorld = site.armMount.getWorldPosition(new THREE.Vector3());
  const fwd = site.hinge.clone().sub(mountWorld).setY(0).normalize(); // W: towards the satellite
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  // Floodlight on the work area.
  const flood = new THREE.SpotLight(0xffffff, 40, 30, 0.6, 0.5, 1.2);
  flood.position.copy(mountWorld).add(new THREE.Vector3(0, 3, 1));
  flood.target.position.copy(site.hinge);
  scene.add(flood, flood.target);

  // Markers: pulsing ring for the current target, faint amber rings near suspected damage, a ghost
  // panel where the arm should park it.
  const ringGeo = new THREE.TorusGeometry(0.3, 0.025, 8, 32);
  const marker = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, depthTest: false }));
  marker.renderOrder = 5;
  scene.add(marker);
  const hints = Object.fromEntries(Object.keys(DAMAGE).map((k) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthTest: false }));
    m.renderOrder = 5;
    m.position.copy(site.damage[k]);
    scene.add(m);
    return [k, m];
  }));
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(0.29, 1, 1.5), new THREE.MeshBasicMaterial({ color: 0x4fc3f7, wireframe: true, transparent: true, opacity: 0.6 }));
  ghost.position.copy(site.parkSpot);
  ghost.quaternion.copy(site.ship.quaternion);
  ghost.visible = false;
  scene.add(ghost);

  let phase = 'unfold'; // unfold → inspect → grab → park → done
  let t = 0;
  let unfold = 0;
  let gripK = 0;
  let gripGoal = 0;
  let scanT = 0;
  let scanning = null;
  let toastT = 0;
  const found = new Set();
  const target = new THREE.Vector3();
  const keys = new Set();
  let ui;
  let manager;
  let narrator;
  let controls;
  let panelEl;
  let toastEl;
  let pipEl;
  let cardEl;
  const listeners = [];
  const on = (o, type, fn) => { o.addEventListener(type, fn); listeners.push(() => o.removeEventListener(type, fn)); };
  const toast = (msg) => { toastEl.textContent = msg; toastEl.classList.add('show'); toastT = 3; };

  const TASKS = [
    ['unfold', 'Unfold the arm'],
    ['inspect', 'Inspect AURORA-7 for damage'],
    ['grab', 'Grab the new panel off the cargo module'],
    ['park', 'Park it beside the broken mount'],
  ];
  const order = TASKS.map((x) => x[0]);
  const showPanel = () => {
    const pi = order.indexOf(phase);
    const g = arm.gripWorld();
    const near = Object.keys(DAMAGE).filter((k) => !found.has(k) && g.distanceTo(site.damage[k]) < SCAN_RANGE);
    panelEl.innerHTML = `
      <div class="obj-tag">ROBOTIC ARM · CONTROL STATION</div>
      ${TASKS.map(([id, label], i) => `<div class="${i < pi || phase === 'done' ? 'good' : i === pi ? '' : 'muted'}">${i < pi || phase === 'done' ? '✔' : i === pi ? '▸' : '·'} ${label}</div>`).join('')}
      ${phase === 'inspect' ? `<div class="arm-hint">Steer the wrist camera (bottom right) close to AURORA-7 and look for damage. Amber rings show when you're near something. ${near.length ? '<b>Hold C to scan.</b>' : ''}</div>
        <button data-act="inspected" class="${found.size ? 'cta' : ''}">Done inspecting (${found.size} found)</button>` : ''}
      ${phase === 'grab' ? '<div class="arm-hint">Line the open jaws up with the grapple pin on the panel (blue ring), then press <kbd>G</kbd>.</div>' : ''}
      ${phase === 'park' ? '<div class="arm-hint">Carry the panel to the blue outline next to the mount and press <kbd>G</kbd> to let go.</div>' : ''}
      <h4>Damage log</h4>
      ${found.size ? [...found].map((k) => `<div class="dmg"><b>${DAMAGE[k].name}</b><span>${DAMAGE[k].text}</span></div>`).join('') : '<div class="muted">Nothing logged yet.</div>'}
      <h4>Controls</h4>
      <div class="arm-keys"><span><kbd>W</kbd><kbd>S</kbd></span> towards / away from AURORA-7</div>
      <div class="arm-keys"><span><kbd>A</kbd><kbd>D</kbd></span> left / right</div>
      <div class="arm-keys"><span><kbd>R</kbd><kbd>F</kbd></span> up / down</div>
      <div class="arm-keys"><span><kbd>C</kbd></span> scan (hold) · <kbd>G</kbd> grab / release</div>
      <div class="arm-keys"><span>Mouse</span> drag to look around the ship</div>
      <div class="arm-joints muted">Joints: swivel ${deg(arm.pose.yaw)} · shoulder ${deg(arm.pose.sh)} · elbow ${deg(arm.pose.el)}</div>`;
  };
  const deg = (r) => `${Math.round(THREE.MathUtils.radToDeg(r))}°`;

  const finish = () => {
    phase = 'done';
    state.repair = { found: [...found], parked: true };
    const missed = Object.keys(DAMAGE).length - found.size;
    narrator.say('Panel parked. Ready for the spacewalk.');
    cardEl = document.createElement('div');
    cardEl.className = 'brief';
    cardEl.innerHTML = `<div class="brief-tag">ARM WORK DONE</div>
      <blockquote class="good">New panel parked beside AURORA-7's mount</blockquote>
      <p>Damage logged: <b>${found.size} of ${Object.keys(DAMAGE).length}</b>. ${missed ? 'Anything you missed won\'t be on the spacewalk list, and the system test after the repair will show it.' : 'Nothing missed: every fault goes on the spacewalk list.'}</p>
      <ul class="db-causes">${[...found].map((k) => `<li>${DAMAGE[k].fix}</li>`).join('')}</ul>
      <div class="brief-actions"><button class="cta" data-act="eva">Suit up ▶</button></div>`;
    cardEl.addEventListener('click', (e) => { if (e.target.dataset.act === 'eva') transition(manager, 'eva'); });
    ui.appendChild(cardEl);
  };

  const pressG = () => {
    const g = arm.gripWorld();
    if (phase === 'grab') {
      const gp = grapple.getWorldPosition(new THREE.Vector3());
      if (g.distanceTo(gp) > GRAB_RANGE) return toast(`Not lined up: the grapple pin is ${g.distanceTo(gp).toFixed(1)} m from the jaws.`);
      gripGoal = 1;
      arm.grabber.attach(site.panel);
      phase = 'park';
      ghost.visible = true;
      narrator.say('Capture. Panel released from the cargo module.');
    } else if (phase === 'park') {
      const d = site.panel.getWorldPosition(new THREE.Vector3()).distanceTo(site.parkSpot);
      if (d > PARK_RANGE + 0.6) return toast(`Too far from the parking spot (${d.toFixed(1)} m). Bring it to the blue outline.`);
      gripGoal = 0;
      scene.attach(site.panel);
      ghost.visible = false;
      finish();
    }
  };

  return {
    scene,
    camera,
    enter(ctx) {
      ui = ctx.ui;
      manager = ctx.manager;
      narrator = createNarrator(ui);
      panelEl = document.createElement('div');
      panelEl.className = 'arm-panel panel';
      ui.appendChild(panelEl);
      pipEl = document.createElement('div');
      pipEl.className = 'arm-pip';
      pipEl.innerHTML = '<div class="obj-tag">WRIST CAMERA</div><i></i>';
      ui.appendChild(pipEl);
      toastEl = document.createElement('div');
      toastEl.className = 'arm-toast';
      ui.appendChild(toastEl);
      const skip = document.createElement('button');
      skip.className = 'skip';
      skip.textContent = 'Skip ›';
      skip.onclick = () => { skip.remove(); if (phase !== 'done') { found.add('array'); site.parkPanel(); finish(); } };
      ui.appendChild(skip);
      panelEl.addEventListener('click', (e) => {
        if (e.target.dataset.act === 'inspected') {
          if (!found.size) return toast('Scan the damage first: get close to the broken array and hold C.');
          phase = 'grab';
          narrator.say(`Inspection logged, ${found.size} fault${found.size > 1 ? 's' : ''}. Now grab the new panel.`);
        }
      });

      // From the side (beyond the broken wing) so the ship, the arm and the satellite all show.
      const mid = mountWorld.clone().lerp(site.hinge, 0.5);
      camera.position.copy(mid).addScaledVector(right, 11).add(new THREE.Vector3(0, 3.5, 0)).addScaledVector(fwd, -2);
      controls = new OrbitControls(camera, ctx.renderer.domElement);
      controls.target.copy(mid);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 4;
      controls.maxDistance = 30;
      controls.update();
      on(window, 'keydown', (e) => {
        keys.add(e.code);
        if (e.code === 'KeyG' && !e.repeat) pressG();
      });
      on(window, 'keyup', (e) => keys.delete(e.code));
      narrator.say('Arm station. Unfolding the robotic arm. Inspect AURORA-7 for damage first, then bring the new panel across.');
    },
    exit() {
      listeners.forEach((off) => off());
      controls?.dispose();
      narrator?.stop();
    },
    render(renderer) {
      const size = renderer.getSize(new THREE.Vector2());
      renderer.setViewport(0, 0, size.x, size.y);
      renderer.render(scene, camera);
      // Wrist camera, picture-in-picture (bottom right).
      const w = Math.round(size.x * 0.26);
      const h = Math.round(w / 1.4);
      const x = size.x - w - 20;
      const y = 20;
      armCam.aspect = w / h;
      armCam.updateProjectionMatrix();
      arm.aimCamera(armCam);
      renderer.setScissorTest(true);
      renderer.setScissor(x, y, w, h);
      renderer.setViewport(x, y, w, h);
      marker.visible = false; // keep the camera feed clean
      renderer.render(scene, armCam);
      marker.visible = phase === 'grab';
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, size.x, size.y);
      if (pipEl) Object.assign(pipEl.style, { width: `${w}px`, height: `${h}px`, right: '20px', bottom: '20px' });
    },
    update(dt) {
      t += dt;
      earth.userData.tick(dt);
      stars.position.copy(camera.position);
      controls?.update();
      site.spark.visible = Math.random() < 0.3;

      if (phase === 'unfold') {
        unfold = Math.min(1, unfold + dt / 3);
        arm.blend(STOWED, READY, ease(unfold));
        if (unfold >= 1) {
          phase = 'inspect';
          target.copy(arm.gripWorld());
        }
      } else if (phase !== 'done') {
        // Steer the grabber; the arm only moves if the new spot is reachable.
        const move = new THREE.Vector3();
        if (keys.has('KeyW')) move.add(fwd);
        if (keys.has('KeyS')) move.sub(fwd);
        if (keys.has('KeyD')) move.add(right);
        if (keys.has('KeyA')) move.sub(right);
        if (keys.has('KeyR')) move.y += 1;
        if (keys.has('KeyF')) move.y -= 1;
        if (move.lengthSq()) {
          const next = target.clone().addScaledVector(move.normalize(), SPEED * dt);
          // Keep clear of the ship's own hull.
          const axis = new THREE.Vector2(next.x - site.ship.position.x, next.z - site.ship.position.z).length();
          if (axis < 1.45) toast('Too close to our own hull.');
          else if (arm.reach(next)) target.copy(next);
          else toast('Out of reach: the arm is fully stretched.');
        }
      }
      gripK += (gripGoal - gripK) * Math.min(1, dt * 5);
      arm.setGrip(gripK);

      // Damage scanning (hold C near a fault).
      const g = arm.gripWorld();
      for (const [k, m] of Object.entries(hints)) {
        const d = g.distanceTo(site.damage[k]);
        const show = phase === 'inspect' && !found.has(k) && d < SCAN_RANGE * 1.6;
        m.material.opacity = show ? 0.35 + Math.sin(t * 6) * 0.25 : found.has(k) && phase === 'inspect' ? 0.15 : 0;
        m.lookAt(camera.position);
      }
      if (phase === 'inspect' && keys.has('KeyC')) {
        const k = Object.keys(DAMAGE).find((id) => !found.has(id) && g.distanceTo(site.damage[id]) < SCAN_RANGE);
        if (k) {
          if (scanning !== k) { scanning = k; scanT = 0; }
          scanT += dt;
          if (scanT >= SCAN_TIME) {
            found.add(k);
            scanning = null;
            narrator.say(`Logged: ${DAMAGE[k].name.toLowerCase()}.`);
          }
        } else if (!scanning) toast('Nothing to scan here. Get closer to the satellite.');
      } else scanning = null;

      if (phase === 'grab') {
        grapple.getWorldPosition(marker.position);
        marker.lookAt(camera.position);
        marker.material.opacity = 0.5 + Math.sin(t * 6) * 0.3;
      }
      ghost.material.opacity = 0.35 + Math.sin(t * 4) * 0.2;

      if (toastT > 0 && (toastT -= dt) <= 0) toastEl.classList.remove('show');
      if (panelEl && Math.floor(t * 8) !== Math.floor((t - dt) * 8)) showPanel();
      if (pipEl) pipEl.querySelector('i').style.width = scanning ? `${(scanT / SCAN_TIME) * 100}%` : '0';
    },
  };
}
