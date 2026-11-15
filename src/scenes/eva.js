import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { autoLook } from '../ui/mouseLook.js';
import { parts } from '../data/catalog.js';
import { exampleDesign } from '../data/catalog.js';
import { buildRocket } from '../render/rocketMesh.js';
import { addSpaceLighting, createStarfield, createEarth } from '../render/space.js';
import { createAurora } from '../render/aurora.js';
import { createNarrator } from '../ui/narrator.js';
import { transition, flash } from '../ui/fade.js';
import { state } from '../state.js';

// Spacewalk (CLAUDE.md §16.8–9): first person in a suit with a jetpack. Fly from the ship's
// hatch to AURORA-7, unbolt the broken array, fetch the new panel from the cargo module, fit it,
// connect the cable, take the data module and fly back. O₂ runs down the whole time.
// Design choices matter: no tether → you drift; no docking port → holding position costs more O₂;
// spare O₂ → more time; toolkit → the stuck bolt comes free.

const ACCEL = 1.6; // m/s² from the suit thrusters
const MAX_SPEED = 2.2;
const REACH = 2.4; // how close a hotspot must be to use it
const O2_SECONDS = 9 * 60; // real seconds of oxygen with a standard suit
const TETHER_LEN = 34;

const has = (design, id) => (design.cargo ?? []).some((c) => c.item === id && c.count > 0);
const hasPart = (design, id) => design.stack.some((e) => e.part === id);

export function createEvaScene() {
  const design = state.design?.stack.some((e) => e.part === 'capsule-2') ? state.design : exampleDesign();
  const tether = has(design, 'tether');
  const toolkit = has(design, 'toolkit');
  const docked = true; // no docking port needed: the Specialist flies across on the tether
  const o2Total = O2_SECONDS * (has(design, 'spare-o2') ? 1.35 : 1);
  const o2Rate = docked ? 1 : 1.3; // without a docking port the ship drifts and you work harder

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.userData.envIntensity = 0.25;
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 20000);
  addSpaceLighting(scene);
  const stars = createStarfield();
  scene.add(stars);
  const earth = createEarth(400);
  earth.position.set(0, -440, -60);
  scene.add(earth);

  // AURORA-7, damaged.
  const aurora = createAurora();
  aurora.setBroken(true);
  scene.add(aurora.group);
  scene.updateMatrixWorld(true);
  const satBox = new THREE.Box3().setFromObject(aurora.group);
  const satCentre = satBox.getCenter(new THREE.Vector3());
  const satSize = satBox.getSize(new THREE.Vector3());

  // Where the broken wing's hinge is (the wing itself is hidden while broken).
  const hinge = new THREE.Vector3();
  if (aurora.wingToShatter) {
    aurora.wingToShatter.getWorldPosition(hinge);
  } else hinge.set(satCentre.x + 1.2, satCentre.y, satCentre.z);
  // Broken stub left on the hinge (a shard of the old panel) that you unbolt and push away.
  const stub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 1.3), new THREE.MeshStandardMaterial({ color: 0x1b3a8a, roughness: 0.4, metalness: 0.4 }));
  stub.position.copy(hinge).add(new THREE.Vector3(0.9, 0.3, 0));
  stub.rotation.set(0.5, 0.3, -0.4);
  scene.add(stub);

  // The ship: crew section only (everything above the first engine stage), hatch facing the satellite.
  const firstEngine = design.stack.findIndex((e) => e.engines || e.inside?.some((c) => c.engines) || /^tank/.test(e.part));
  const shipDesign = { stack: design.stack.slice(0, firstEngine > 0 ? firstEngine : design.stack.length), cargo: [] };
  const ship = buildRocket(shipDesign, parts).group;
  ship.rotation.y = Math.PI / 2; // side hatch (+X in part space) now faces −Z, towards AURORA-7
  ship.position.set(satCentre.x + 2, satCentre.y - 3, satCentre.z + satSize.z / 2 + 16); // beside the bus: the wings span the view
  scene.add(ship);
  scene.updateMatrixWorld(true);
  const capIdx = shipDesign.stack.findIndex((e) => e.part === 'capsule-2');
  const capsule = ship.children.find((o) => o.userData.index === capIdx);
  const hatch = capsule ? capsule.localToWorld(new THREE.Vector3(1.6, 1.4, 0)) : ship.position.clone();
  const cargoIdx = shipDesign.stack.findIndex((e) => /cargo-module/.test(e.part));
  const cargoObj = ship.children.find((o) => o.userData.index === cargoIdx);
  const cargoDoor = cargoObj ? cargoObj.localToWorld(new THREE.Vector3(1.8, 1.5, 0)) : hatch.clone().add(new THREE.Vector3(0, -3, 0));

  // Replacement panel crate (carried by the astronaut once fetched).
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 1.5), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 }));
  crate.position.copy(cargoDoor);
  crate.visible = false;
  scene.add(crate);
  const dataBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x401800 }));
  const dataSpot = satCentre.clone().add(new THREE.Vector3(0, 0.6, satSize.z / 2 + 0.25));
  dataBox.position.copy(dataSpot);
  scene.add(dataBox);

  // ---- the job, step by step ----
  const bolt = (k, dy, dz) => ({ id: `bolt${k}`, label: `Unbolt the broken array (${k} / 4)`, pos: hinge.clone().add(new THREE.Vector3(0.3, dy, dz)), hold: 1.4 });
  const steps = [
    bolt(1, 0.45, 0.45), bolt(2, 0.45, -0.45), bolt(3, -0.45, 0.45), bolt(4, -0.45, -0.45),
    { id: 'push', label: 'Push the broken array away', pos: stub.position.clone(), hold: 0.6 },
    { id: 'fetch', label: 'Get the new panel from the cargo module', pos: cargoDoor, hold: 1.0 },
    { id: 'fit', label: 'Fit the new panel on the mount', pos: hinge.clone().add(new THREE.Vector3(0.4, 0, 0)), hold: 2.2 },
    { id: 'cable', label: 'Connect the power cable', pos: hinge.clone().add(new THREE.Vector3(0.2, -0.8, 0)), hold: 1.6 },
    { id: 'data', label: 'Take the data module', pos: dataSpot, hold: 1.2 },
    { id: 'home', label: 'Fly back to the hatch', pos: hatch, hold: 0.8 },
  ];
  // One random bolt sticks (CLAUDE.md §8 stuck-bolt event); the toolkit frees it.
  const stuck = Math.floor(Math.random() * 4);
  steps[stuck].hold = toolkit ? 3.2 : 7;
  steps[stuck].stuck = true;

  let stepI = 0;
  let holdT = 0;
  let o2 = 1;
  let elapsed = 0;
  let done = false;
  let o2Warned = false;
  const vel = new THREE.Vector3();
  const pos = hatch.clone().add(new THREE.Vector3(-1.5, 0, 0));
  const keys = new Set();

  // Glowing marker on the current hotspot.
  const marker = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
  marker.renderOrder = 5;
  scene.add(marker);
  // Tether line from the hatch to you.
  const tetherLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([hatch, pos]), new THREE.LineBasicMaterial({ color: 0xffe066 }));
  tetherLine.visible = tether;
  scene.add(tetherLine);
  // Suit lamp so the work area isn't black on the shadow side.
  const lamp = new THREE.SpotLight(0xfff4e0, 6, 25, 0.5, 0.5, 1.5);
  scene.add(lamp, lamp.target);

  let controls;
  let look = null;
  let ui;
  let manager;
  let narrator;
  let hud;
  const listeners = [];
  const on = (t, type, fn) => { t.addEventListener(type, fn); listeners.push(() => t.removeEventListener(type, fn)); };

  const finish = (outcome) => {
    if (done) return;
    done = true;
    state.eva = {
      repaired: stepI > steps.findIndex((s) => s.id === 'cable'),
      dataModule: stepI > steps.findIndex((s) => s.id === 'data'),
      minutes: elapsed / 60 * 8, // game minutes (the walk is time-compressed ~8×)
      injured: outcome === 'o2',
      outcome,
    };
    controls.unlock();
    const msg = outcome === 'ok'
      ? 'Specialist back inside. Hatch closed. Nice work.'
      : outcome === 'o2' ? 'Oxygen critical! The Commander hauls the Specialist back in on the tether.'
        : 'Lost contact with the Specialist. The Commander goes out on a rescue line.';
    narrator.say(msg);
    setTimeout(() => transition(manager, 'return', {}, 900), 4500);
  };

  const showHud = () => {
    const s = steps[stepI];
    const dist = s ? pos.distanceTo(s.pos) : 0;
    const o2Pct = Math.max(0, Math.round(o2 * 100));
    const o2Col = o2 < 0.15 ? 'var(--bad)' : o2 < 0.35 ? '#ffcc66' : 'var(--ok)';
    const tDist = pos.distanceTo(hatch);
    hud.innerHTML = `
      <div class="eva-o2" style="--p:${o2Pct};--c:${o2Col}"><b>${o2Pct}%</b><span>O₂</span></div>
      <div class="eva-stats">
        <div>TETHER <b class="${tether ? 'good' : 'bad'}">${tether ? `${tDist.toFixed(0)} / ${TETHER_LEN} m` : 'NONE · drift risk'}</b></div>
        <div>SPEED <b>${vel.length().toFixed(1)} m/s</b></div>
        ${docked ? '' : '<div class="bad">No docking port: holding position costs extra O₂</div>'}
      </div>
      <div class="objective eva-obj"><div class="obj-tag">SPACEWALK · STEP ${Math.min(stepI + 1, steps.length)} / ${steps.length}</div>
        ${steps.map((st, i) => `<div class="${i < stepI ? 'good' : i === stepI ? '' : 'muted'}">${i < stepI ? '✔' : i === stepI ? '▸' : '·'} ${st.label}</div>`).filter((_, i) => i >= stepI - 2 && i <= stepI + 2).join('')}
        ${s ? `<div class="muted">${dist.toFixed(1)} m away${s.stuck && dist < REACH ? (toolkit ? ' · bolt is stuck: using the toolkit' : ' · bolt is stuck and you have no toolkit!') : ''}</div>` : ''}
      </div>
      <div class="interact ${s && dist < REACH ? 'show' : ''}"><b>${s?.label ?? ''}</b><span>hold <kbd>E</kbd></span>
        <div class="hold"><i style="width:${s ? Math.min(100, (holdT / s.hold) * 100) : 0}%"></i></div></div>`;
  };

  return {
    scene,
    camera,
    enter(ctx) {
      ui = ctx.ui;
      manager = ctx.manager;
      narrator = createNarrator(ui);
      const visor = document.createElement('div');
      visor.className = 'visor';
      ui.appendChild(visor);
      hud = document.createElement('div');
      hud.className = 'eva-hud';
      ui.appendChild(hud);
      const help = document.createElement('div');
      help.className = 'fp-help';
      help.innerHTML = '<div>Move the mouse to look</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> thrust</div><div><kbd>Space</kbd>/<kbd>Shift</kbd> up / down</div><div><kbd>X</kbd> brake · hold <kbd>E</kbd> work</div>';
      ui.appendChild(help);
      setTimeout(() => help.classList.add('gone'), 12000);
      const cross = document.createElement('div');
      cross.className = 'crosshair';
      ui.appendChild(cross);

      camera.position.copy(pos);
      camera.lookAt(hinge);
      controls = new PointerLockControls(camera, ctx.renderer.domElement);
      controls.pointerSpeed = 0.6;
      look = autoLook(controls, { enabled: () => !done }); // camera follows the mouse at once
      on(ctx.renderer.domElement, 'click', () => look.tryLock());
      on(window, 'keydown', (e) => keys.add(e.code));
      on(window, 'keyup', (e) => keys.delete(e.code));
      narrator.say(`Hatch open. ${tether ? 'Tether clipped on.' : 'No tether packed. Careful, nothing will stop you drifting.'} AURORA-7 is ahead of you. Start with the four bolts on the broken array.`);
    },
    exit() {
      listeners.forEach((off) => off());
      look?.dispose();
      controls?.unlock();
      controls?.dispose();
      narrator?.stop();
    },
    update(dt) {
      earth.userData.tick(dt);
      stars.position.copy(camera.position);
      if (done) return;
      elapsed += dt;

      // Suit thrusters: accelerate in the look direction; X brakes. Space has no friction,
      // only a weak auto-stabiliser (less of it without a tether to steady you).
      const fwd = camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
      const thrust = new THREE.Vector3();
      if (keys.has('KeyW')) thrust.add(fwd);
      if (keys.has('KeyS')) thrust.sub(fwd);
      if (keys.has('KeyD')) thrust.add(right);
      if (keys.has('KeyA')) thrust.sub(right);
      if (keys.has('Space')) thrust.y += 1;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) thrust.y -= 1;
      if (thrust.lengthSq()) vel.addScaledVector(thrust.normalize(), ACCEL * dt);
      if (keys.has('KeyX')) vel.multiplyScalar(Math.max(0, 1 - dt * 3));
      vel.multiplyScalar(1 - dt * (tether ? 0.35 : 0.08));
      if (vel.length() > MAX_SPEED) vel.setLength(MAX_SPEED);
      pos.addScaledVector(vel, dt);

      // Tether: can't go further than its length from the hatch.
      const fromHatch = pos.clone().sub(hatch);
      if (tether && fromHatch.length() > TETHER_LEN) {
        pos.copy(hatch).addScaledVector(fromHatch.normalize(), TETHER_LEN);
        vel.multiplyScalar(-0.3);
      }
      if (!tether && fromHatch.length() > 90) return finish('drift');
      camera.position.copy(pos);
      tetherLine.geometry.setFromPoints([hatch, pos.clone().add(new THREE.Vector3(0, -0.4, 0))]);
      lamp.position.copy(pos);
      lamp.target.position.copy(pos).addScaledVector(fwd, 5);

      // Oxygen.
      o2 -= (dt / o2Total) * o2Rate * (thrust.lengthSq() ? 1.25 : 1);
      if (o2 <= 0) return finish('o2');
      if (o2 < 0.2 && !o2Warned) { o2Warned = true; narrator.say('Oxygen low. Finish up and head back.'); }

      // Current job.
      const s = steps[stepI];
      marker.position.copy(s.pos);
      marker.lookAt(camera.position);
      marker.material.opacity = 0.5 + Math.sin(elapsed * 6) * 0.3;
      if (crate.visible) crate.position.copy(pos).addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, -0.6, 0));
      if (stepI > steps.findIndex((x) => x.id === 'data')) dataBox.position.copy(pos).addScaledVector(fwd, 0.9).add(new THREE.Vector3(0.4, -0.5, 0));

      const near = pos.distanceTo(s.pos) < REACH;
      if (near && keys.has('KeyE')) {
        holdT += dt;
        if (s.stuck) o2 -= dt * 0.004; // fighting a stuck bolt burns oxygen
        if (holdT >= s.hold) {
          holdT = 0;
          if (s.id === 'push') { stub.userData.v = new THREE.Vector3(0.8, 0.3, 0.2); }
          if (s.id === 'fetch') { crate.visible = true; narrator.say('Got the panel. Take it to the mount.'); }
          if (s.id === 'fit') { crate.visible = false; aurora.setBroken(false); flash(150); narrator.say('Panel latched on.'); }
          if (s.id === 'cable') { narrator.say('Power restored! AURORA-7 science instruments coming back online.'); }
          if (s.id === 'data') narrator.say('Data module secured. Head home.');
          if (s.stuck) narrator.say(toolkit ? 'Stuck bolt freed with the torque wrench.' : 'Finally! That bolt cost you a lot of oxygen.');
          stepI++;
          if (stepI >= steps.length) return finish('ok');
        }
      } else holdT = Math.max(0, holdT - dt * 2);
      if (stub.userData.v) {
        stub.position.addScaledVector(stub.userData.v, dt);
        stub.rotation.x += dt * 0.6;
      }
      showHud();
    },
  };
}
