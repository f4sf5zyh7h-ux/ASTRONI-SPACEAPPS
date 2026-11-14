import * as THREE from 'three';
import { parts } from '../data/catalog.js';
import { referenceDesign } from '../data/designs.js';
import { simulateMission, missionLegs } from '../physics/mission.js';
import { buildRocket } from '../render/rocketMesh.js';
import { createStarfield, createEarth, addSpaceLighting } from '../render/space.js';
import { createAurora } from '../render/aurora.js';
import { createLaunchPad, MOUNT_H } from '../render/launchPad.js';
import { createNarrator } from '../ui/narrator.js';
import { transition, fadeTo } from '../ui/fade.js';
import { state } from '../state.js';
import missionData from '../data/missions.json';

// Launch cutscene, driven by the leg-by-leg physics result (CLAUDE.md §5, §16.7):
// countdown → liftoff → the player's own stages separating → orbit → transfer → time warp → arrival.
// It's cinematic, not a flight simulation: timings are scaled, outcomes come from simulateMission.

const COUNTDOWN = 10; // seconds
const ASCENT_TIME = 18; // seconds of screen time for the whole launch leg
const PARKING_KM = 400;
const ORBIT_KMS = 7.67; // circular speed at 400 km (orbits.js gives the same)

const ease = (u) => u * u * (3 - 2 * u);

/** Stack index → section number (0 = bottom), splitting at decouplers like splitStages(). */
function sectionMap(design) {
  const map = [];
  let sec = 0;
  for (let i = design.stack.length - 1; i >= 0; i--) {
    map[i] = sec;
    if (parts.get(design.stack[i].part)?.role === 'decoupler' && i > 0) sec++;
  }
  return { map, count: sec + 1 };
}

/** Exhaust plume: an outer orange cone and an inner white-blue core, pointing down. */
function createFlame(radius) {
  const g = new THREE.Group();
  const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius * 1.6, 1, 20, 1, true).translate(0, -0.5, 0), mat(0xff8a2a, 0.55));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.25, 1, 16, 1, true).translate(0, -0.5, 0), mat(0xcfe8ff, 0.8));
  g.add(outer, core);
  const light = new THREE.PointLight(0xffa04a, 0, 120, 1.2);
  light.position.y = -3;
  g.add(light);
  g.userData = { outer, core, light };
  g.visible = false;
  return g;
}

export function createLaunchScene() {
  const mission = missionData.missions.find((m) => m.id === state.missionId) ?? missionData.missions[0];
  const design = state.design?.stack.some((e) => e.part === 'capsule-2') ? state.design : referenceDesign();
  const approach = mission.approaches.find((a) => a.id === state.approach) ?? mission.approaches[0];
  const sim = simulateMission(design, parts, mission, approach.id);
  const report = sim.report;
  const need = missionLegs(mission, approach.id);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1022);
  scene.fog = new THREE.Fog(0x0a1022, 300, 2500);
  scene.userData.envIntensity = 0.3;
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 60000);
  const sky = new THREE.HemisphereLight(0x8aa4d6, 0x1a1f14, 0.7);
  scene.add(sky);
  const moonLight = new THREE.DirectionalLight(0xdde6ff, 1.2);
  moonLight.position.set(-60, 100, 40);
  scene.add(moonLight);
  const stars = createStarfield(4000, 20000);
  scene.add(stars);

  // ---- the ship, split into separable sections ----
  const rocket = buildRocket(design, parts);
  const { map, count } = sectionMap(design);
  const ship = new THREE.Group();
  const sections = Array.from({ length: count }, () => new THREE.Group());
  sections.forEach((s) => ship.add(s));
  for (const child of [...rocket.group.children]) sections[map[child.userData.index]].add(child);
  // Bottom y of each section (where its flame goes).
  const bottoms = sections.map((s) => Math.min(...s.children.map((c) => c.position.y)));
  ship.position.y = MOUNT_H;
  scene.add(ship);

  const capIndex = design.stack.findIndex((e) => e.part === 'capsule-2');
  const capY = MOUNT_H + rocket.objects[capIndex].position.y;
  const pad = createLaunchPad(scene, { armY: capY + 0.9, armTipX: 1.25, towerH: capY + 9.9 });
  for (const l of pad.lights) l.intensity = 600;

  // Engine sections in firing order (bottom first) and when each one runs dry during launch.
  const launchNeed = sim.legs.find((l) => l.id === 'launch')?.required ?? need.launch;
  const launchGot = sim.legs.find((l) => l.id === 'launch')?.delivered ?? 0;
  const staging = []; // progress (0–1 of the launch leg) at which section k separates
  let cum = 0;
  report.stages.forEach((st, k) => {
    if (!st.section.engines.length || k === count - 1) return;
    cum += st.dv;
    if (cum < launchNeed) staging.push({ k, at: cum / launchNeed });
  });
  const flames = sections.map((s, k) => {
    const r = Math.max(1, Math.max(...s.children.map((c) => new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3()).x)) / 2);
    const f = createFlame(Math.min(r, 2.2));
    f.position.y = bottoms[k];
    sections[k].add(f);
    return f;
  });
  const vacuumFlame = (k) => report.sections[k]?.vacuumOnly;

  // ---- orbit set (shown after the cut to space) ----
  const orbitSet = new THREE.Group();
  orbitSet.visible = false;
  const earth = createEarth(4000);
  earth.position.set(0, -4300, -1500);
  orbitSet.add(earth);
  const aurora = createAurora();
  aurora.group.visible = false;
  orbitSet.add(aurora.group);
  scene.add(orbitSet);
  const sun = addSpaceLighting(orbitSet);
  sun.intensity = 0;

  // ---- runtime state ----
  let phase = 'countdown'; // countdown → ascent → (orbit → warp → arrive) | failed
  let t = 0; // time in the current phase
  let progress = 0; // fraction of the launch leg delivered
  let active = 0; // lowest attached section
  const dropped = [];
  const smoke = [];
  const camPos = new THREE.Vector3(55, 8, 60);
  const camLook = new THREE.Vector3(0, 40, 0);
  let ui;
  let manager;
  let narrator;
  let hud;
  const said = new Set();
  // Mission Control lines (captions + voice), each said once.
  const say = (id, text) => { if (!said.has(id)) { said.add(id); narrator.say(text); } };

  const setHud = ({ clock, alt, speed, stage, label }) => {
    hud.innerHTML = `
      <div class="lh-clock">${clock}</div>
      <div class="lh-row"><span>ALT</span><b>${alt}</b></div>
      <div class="lh-row"><span>SPEED</span><b>${speed}</b></div>
      <div class="lh-row"><span>STAGE</span><b>${stage}</b></div>
      <div class="lh-phase">${label}</div>`;
  };
  const met = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `MET ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const engineStages = report.stages.filter((s) => s.section.engines.length).length;

  /** World centre of the sections still attached (the camera follows this, not the dropped stages). */
  const box = new THREE.Box3();
  const shipCentre = () => {
    box.makeEmpty();
    for (let k = active; k < count; k++) for (const c of sections[k].children) if (c.userData.index !== undefined) box.expandByObject(c);
    return box.getCenter(new THREE.Vector3());
  };

  const separate = (k) => {
    const sec = sections[k];
    flames[k].visible = false;
    scene.attach(sec); // keep its world position, stop following the ship
    dropped.push({ obj: sec, v: new THREE.Vector3(0, -6, 0), spin: new THREE.Vector3(0.3, 0.1, 0.5) });
    active = k + 1;
    flames[active].visible = true;
    say(`sep${k}`, 'Stage separation confirmed. Upper stage ignition.');
  };

  const puff = (pos) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 3, (Math.random() - 0.5) * 14), age: 0 };
    scene.add(m);
    smoke.push(m);
  };

  /** End card: success (arrived) or failure with the physics reason. */
  const endCard = (ok, title, body) => {
    const card = document.createElement('div');
    card.className = 'brief';
    card.innerHTML = `
      <div class="brief-tag">${ok ? 'FLIGHT REPORT' : 'MISSION FAILED'}</div>
      <blockquote class="${ok ? 'good' : 'bad'}">${title}</blockquote>
      ${body}
      <div class="brief-actions">
        <button data-act="retry">↺ Launch again</button>
        <button class="cta" data-act="workshop">Back to workshop (keep design)</button>
      </div>`;
    card.addEventListener('click', (e) => {
      if (e.target.dataset.act === 'workshop') transition(manager, 'workshop');
      if (e.target.dataset.act === 'retry') transition(manager, 'launch');
    });
    ui.appendChild(card);
  };
  const legTable = () => `<p class="muted">Speed change (Δv) for every leg of the mission, from the physics model:</p><table class="leg-table">${sim.legs.map((l) => `<tr class="${l.ok ? 'good' : 'bad'}"><td>${l.id}</td><td>needed ${Math.round(l.required)} m/s</td><td>got ${Math.round(l.delivered)} m/s</td><td>${l.ok ? '✔' : `✘ short ${Math.round(l.shortfall)}`}</td></tr>`).join('')}</table>`;
  const fail = (title) => {
    phase = 'failed';
    flames.forEach((f) => (f.visible = false));
    narrator.say(title);
    endCard(false, title, `<p>${sim.reason ?? ''}</p>${legTable()}<p class="muted">Tip: the workshop's mission check shows the same numbers before you launch.</p>`);
  };

  const goOrbit = async () => {
    phase = 'cut';
    await fadeTo(1, 700);
    // Swap to the space set: pad and atmosphere gone, Earth below, ship coasting.
    scene.traverse((o) => { if (o.isMesh && !ship.getObjectById(o.id) && !orbitSet.getObjectById(o.id) && o !== stars) o.visible = false; });
    for (const d of dropped) d.obj.visible = false;
    for (const s of smoke) s.visible = false;
    for (const l of pad.lights) l.intensity = 0;
    sky.intensity = 0.15;
    moonLight.intensity = 0;
    sun.intensity = 3;
    scene.fog = null;
    scene.background = new THREE.Color(0x000000);
    orbitSet.visible = true;
    ship.position.set(0, 0, 0);
    ship.rotation.set(0, 0, -Math.PI / 2); // flying horizontally
    flames[active].visible = false;
    phase = 'orbit';
    t = 0;
    await fadeTo(0, 700);
  };

  return {
    scene,
    camera,
    enter(ctx) {
      ui = ctx.ui;
      manager = ctx.manager;
      narrator = createNarrator(ui);
      hud = document.createElement('div');
      hud.className = 'launch-hud';
      ui.appendChild(hud);
      const skip = document.createElement('button');
      skip.className = 'skip';
      skip.textContent = 'Skip ›';
      skip.onclick = () => {
        skip.remove();
        narrator.stop();
        if (sim.failedAt) fail(sim.reason ?? 'Mission failed');
        else endCard(true, 'Arrived at AURORA-7', `<p>The approach went as planned.</p>${legTable()}`);
        phase = 'failed';
      };
      ui.appendChild(skip);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
    },
    exit() {
      narrator?.stop();
    },
    update(dt) {
      t += dt;
      stars.position.copy(camera.position);
      earth.userData.tick?.(dt * (phase === 'warp' ? 40 : 1));

      if (phase === 'countdown') {
        const left = Math.max(0, COUNTDOWN - t);
        setHud({ clock: `T−${Math.ceil(left)}`, alt: '0 km', speed: '0 km/s', stage: `1 / ${engineStages}`, label: 'COUNTDOWN' });
        if (t > 0.5) say('count', 'All stations, final countdown. We are go for launch.');
        if (left < 3) {
          say('ign', 'Ignition sequence start.');
          flames[0].visible = true;
          const s = Math.min(1, (3 - left) / 1.5);
          flames[0].scale.set(1, 6 + s * 14, 1);
          flames[0].userData.light.intensity = 400 * s;
          if (Math.random() < 0.6) puff(new THREE.Vector3(0, 1, 0));
        }
        if (left <= 0) {
          if (!report.checks.liftoff) {
            phase = 'stuck';
            t = 0;
          } else {
            phase = 'ascent';
            t = 0;
            say('lift', 'Liftoff! We have liftoff.');
          }
        }
      } else if (phase === 'stuck') {
        // Not enough thrust: the rocket roars and shakes but can't climb.
        ship.position.x = (Math.random() - 0.5) * 0.15;
        if (Math.random() < 0.8) puff(new THREE.Vector3(0, 1, 0));
        setHud({ clock: met(t), alt: '0 km', speed: '0 km/s', stage: `1 / ${engineStages}`, label: 'NO LIFTOFF' });
        if (t > 5) fail(`The rocket couldn't lift off: thrust-to-weight ${report.stages[0].twr.toFixed(2)}, needs at least 1.2.`);
      } else if (phase === 'ascent') {
        const limit = launchGot / launchNeed; // < 1 if the launch leg is short
        progress = Math.min(limit, t / ASCENT_TIME);
        const p = progress;
        // Gravity-turn style path: straight up first, then pitching over downrange.
        ship.position.set(1400 * p ** 3, MOUNT_H + 5200 * p ** 2 + 2 * t * t, 0);
        ship.rotation.z = -1.25 * ease(Math.min(1, p * 1.4));
        for (const st of staging) if (p >= st.at && active <= st.k) separate(st.k);
        const f = flames[active];
        f.visible = true;
        const vac = vacuumFlame(active);
        f.scale.set(vac ? 1.8 : 1, (vac ? 10 : 18) * (1 + p) * (0.9 + Math.random() * 0.2), vac ? 1.8 : 1);
        f.userData.outer.material.opacity = vac ? 0.3 : 0.55;
        if (t < 4 && Math.random() < 0.7) puff(new THREE.Vector3(0, 1, 0));
        // Sky darkens with altitude.
        const dark = Math.min(1, p * 2.2);
        scene.background.setRGB(0.04 * (1 - dark), 0.06 * (1 - dark), 0.13 * (1 - dark));
        if (scene.fog) scene.fog.far = 2500 + p * 40000;
        setHud({
          clock: met(t * 30), alt: `${Math.round(PARKING_KM * p ** 1.3)} km`, speed: `${(ORBIT_KMS * p).toFixed(2)} km/s`,
          stage: `${Math.min(engineStages, staging.filter((s) => s.k < active).length + 1)} / ${engineStages}`, label: 'ASCENT',
        });
        if (p >= limit && limit < 1) {
          f.visible = false;
          say('cut', 'Main engine cutoff. We are short of orbit.');
          if (t > ASCENT_TIME * limit + 3) fail('Fell short of orbit: the rocket ran out of fuel during launch.');
        } else if (p >= 1) {
          say('orbit', 'Orbit insertion. Parking orbit, four hundred kilometres.');
          goOrbit();
        }
      } else if (phase === 'orbit') {
        // Transfer burn towards AURORA-7, then time warp.
        const f = flames[active];
        f.visible = t > 1.5 && t < 4;
        f.scale.set(1.8, 8, 1.8);
        setHud({ clock: met(540 + t * 60), alt: '400 km', speed: `${ORBIT_KMS.toFixed(2)} km/s`, stage: 'UPPER', label: 'TRANSFER BURN' });
        if (t > 1.5) say('xfer', `Transfer burn, ${Math.round(need.transfer)} metres per second, for the ${approach.name.toLowerCase()}.`);
        if (t > 5) {
          if (sim.failedAt === 'transfer') return fail('Ran out of fuel on the transfer burn.');
          phase = 'warp';
          t = 0;
          say('warp', `Coasting to AURORA-7. About ${approach.hours} hours.`);
        }
      } else if (phase === 'warp') {
        const hours = approach.hours * Math.min(1, t / 6);
        setHud({ clock: met(600 + hours * 3600), alt: `${Math.round(400 + 300 * Math.min(1, t / 6))} km`, speed: '7.5 km/s', stage: 'UPPER', label: '⏩ TIME WARP' });
        if (t > 6) {
          phase = 'arrive';
          t = 0;
          aurora.group.visible = true;
          aurora.group.position.set(-260, 4, -40);
          say('see', 'AURORA-7 in sight. Closing in on thrusters.');
        }
      } else if (phase === 'arrive') {
        // The satellite drifts in from ahead; RCS does the last few metres.
        const u = ease(Math.min(1, t / 7));
        aurora.group.position.lerpVectors(new THREE.Vector3(-260, 4, -40), new THREE.Vector3(-30, 2, -6), u);
        aurora.group.rotation.y += dt * 0.05;
        setHud({ clock: met(600 + approach.hours * 3600 + t * 60), alt: '700 km', speed: '7.50 km/s', stage: 'RCS', label: 'RENDEZVOUS' });
        if (t > 7.5) {
          phase = 'done';
          if (sim.failedAt === 'rendezvous') return fail('Not enough RCS fuel to line up with the satellite.');
          narrator.say('Holding position next to AURORA-7. Time to suit up.');
          endCard(true, 'Arrived at AURORA-7', `<p>You reached the satellite. Next: suit up and spacewalk to replace the panel and take the data module (next build step).</p>${legTable()}`);
        }
      }

      // Dropped stages fall and tumble away.
      for (const d of dropped) {
        d.obj.position.addScaledVector(d.v, dt);
        d.v.y -= 9.8 * dt;
        d.obj.rotation.x += d.spin.x * dt;
        d.obj.rotation.z += d.spin.z * dt;
      }
      for (const s of smoke) {
        s.userData.age += dt;
        s.position.addScaledVector(s.userData.v, dt);
        s.scale.setScalar(1 + s.userData.age * 3);
        s.material.opacity = Math.max(0, 0.45 - s.userData.age * 0.08);
      }

      // Camera: watch from the ground at first, then chase the ship.
      const centre = shipCentre();
      if (phase === 'countdown' || phase === 'stuck' || (phase === 'ascent' && t < 4)) {
        camLook.lerp(centre, Math.min(1, dt * 2));
        camera.position.copy(camPos).add(new THREE.Vector3(0, 0, 0).random().subScalar(0.5).multiplyScalar(flames[0].visible ? 0.25 : 0));
      } else if (phase === 'ascent' || phase === 'failed') {
        const want = centre.clone().add(new THREE.Vector3(60, -25, 90));
        camera.position.lerp(want, Math.min(1, dt * 1.5));
        camLook.lerp(centre, Math.min(1, dt * 3));
      } else if (phase === 'orbit' || phase === 'warp' || phase === 'arrive' || phase === 'done') {
        const want = centre.clone().add(new THREE.Vector3(30, 14, 70));
        camera.position.lerp(want, Math.min(1, dt * 2));
        camLook.lerp(phase === 'arrive' || phase === 'done' ? centre.clone().lerp(aurora.group.position, 0.4) : centre, Math.min(1, dt * 2));
      }
      camera.lookAt(camLook);
    },
  };
}
