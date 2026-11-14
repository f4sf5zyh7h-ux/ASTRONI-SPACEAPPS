import * as THREE from 'three';
import { parts } from '../data/catalog.js';
import { casingDesign } from '../data/designs.js';
import { simulateMission, missionLegs } from '../physics/mission.js';
import { buildRocket, hullRadiusAt } from '../render/rocketMesh.js';
import { createAurora } from '../render/aurora.js';
import { createLaunchPad, padBase, addPadVehicles } from '../render/launchPad.js';
import { createPadSetting } from '../render/padSetting.js';
import { createEarthLayer } from '../render/earthLayer.js';
import { createNarrator } from '../ui/narrator.js';
import { transition, fadeTo } from '../ui/fade.js';
import { state } from '../state.js';
import missionData from '../data/missions.json';

// Launch cutscene, driven by the leg-by-leg physics result (CLAUDE.md §5, §16.7):
// countdown → liftoff → the player's own stages separating → orbit → transfer → time warp
// (map view of the whole Earth) → arrival at AURORA-7. Cinematic, not a flight simulation:
// screen time is compressed, outcomes come from simulateMission(). Altitude is true scale:
// the rocket climbs in metres and a full-size Earth layer (km) is drawn behind it.

const COUNTDOWN = 10; // seconds
const ASCENT_TIME = 26; // seconds of screen time for the launch leg
const PARKING_KM = 400;
const TARGET_KM = 700;
const ORBIT_KMS = 7.67; // circular speed at 400 km
const DOWNRANGE_KM = 260; // how far east the ascent travels (for the look of the curve)
const MAP_FAR_KM = 24000; // map view distance: the whole Earth fits in view

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
  const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius * 1.6, 1, 20, 1, true).translate(0, -0.5, 0), mat(0xff8a2a, 0.55));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.25, 1, 16, 1, true).translate(0, -0.5, 0), mat(0xcfe8ff, 0.8));
  g.add(outer, core);
  const light = new THREE.PointLight(0xffa04a, 0, 150, 1.2);
  light.position.y = -3;
  g.add(light);
  g.userData = { outer, core, light };
  g.visible = false;
  return g;
}

export function createLaunchScene() {
  const mission = missionData.missions.find((m) => m.id === state.missionId) ?? missionData.missions[0];
  const design = state.design?.stack.some((e) => e.part === 'capsule-2') ? state.design : casingDesign();
  const approach = mission.approaches.find((a) => a.id === state.approach) ?? mission.approaches[0];
  const sim = simulateMission(design, parts, mission, approach.id);
  const report = sim.report;
  const need = missionLegs(mission, approach.id);

  const scene = new THREE.Scene(); // no background: the Earth layer is drawn behind it
  scene.userData.envIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 400000);
  const setting = createPadSetting(scene);
  const layer = createEarthLayer();

  // ---- the ship, split into separable sections ----
  const rocket = buildRocket(design, parts);
  const { map, count } = sectionMap(design);
  const ship = new THREE.Group();
  const sections = Array.from({ length: count }, () => new THREE.Group());
  sections.forEach((s) => ship.add(s));
  for (const child of [...rocket.group.children]) sections[map[child.userData.index]].add(child);
  const bottoms = sections.map((s) => Math.min(...s.children.map((c) => c.position.y)));
  const BASE = padBase(); // rocket base height on the launch mount
  ship.position.y = BASE;
  scene.add(ship);

  const capIndex = design.stack.findIndex((e) => e.part === 'capsule-2');
  const capY = BASE + rocket.objects[capIndex].position.y;
  const padObjects = new THREE.Group();
  scene.add(padObjects);
  addPadVehicles(padObjects, 'launch');
  const pad = createLaunchPad(padObjects, {
    armY: capY + 0.9, armTipX: 1.25, towerH: capY + 9.9,
    radiusAt: (y) => hullRadiusAt(design, parts, rocket, y - BASE),
  });

  // Which sections separate during launch, and when (fraction of the launch leg).
  const launchLeg = sim.legs.find((l) => l.id === 'launch');
  const launchNeed = launchLeg?.required ?? need.launch;
  const launchGot = launchLeg?.delivered ?? 0;
  const staging = [];
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

  // AURORA-7 for the arrival.
  const aurora = createAurora();
  aurora.group.visible = false;
  scene.add(aurora.group);

  // ---- runtime state ----
  let phase = 'countdown'; // countdown → ascent|stuck → orbit → warp → arrive → done | failed
  let t = 0;
  let progress = 0;
  let altKm = 0;
  let active = 0; // lowest attached section
  const dropped = [];
  const smoke = [];
  const groundCam = new THREE.Vector3(-22, 9, -95); // side-on: the tower (+X) stands clear to the right
  const camLook = new THREE.Vector3(0, 40, 0);
  const camOffset = new THREE.Vector3(45, 30, 85); // chase offset (smoothed)
  let mapMode = false;
  let ui;
  let manager;
  let narrator;
  let hud;
  const said = new Set();
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

  /** World centre of the sections still attached (the camera follows this): midway up the remaining stack. */
  const shipCentre = () => {
    ship.updateMatrixWorld(true);
    return ship.localToWorld(new THREE.Vector3(0, (bottoms[active] + rocket.height) / 2, 0));
  };

  const shipVel = new THREE.Vector3();
  const lastPos = new THREE.Vector3();

  const separate = (k) => {
    const sec = sections[k];
    flames[k].visible = false;
    scene.attach(sec); // keeps its world position, stops following the ship
    dropped.push({ obj: sec, v: shipVel.clone().multiplyScalar(0.97), spin: new THREE.Vector3(0.25, 0.1, 0.4) });
    active = k + 1;
    flames[active].visible = true;
    say(`sep${k}`, 'Stage separation confirmed. Upper stage ignition.');
  };

  const puff = () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.55, depthWrite: false }));
    m.position.set((Math.random() - 0.5) * 6, Math.max(1, BASE - 6), (Math.random() - 0.5) * 6);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 16, Math.random() * 4, (Math.random() - 0.5) * 16), age: 0 };
    scene.add(m);
    smoke.push(m);
  };

  const endCard = (ok, title, body) => {
    const card = document.createElement('div');
    card.className = 'brief';
    card.innerHTML = `
      <div class="brief-tag">${ok ? 'FLIGHT REPORT' : 'MISSION FAILED'}</div>
      <blockquote class="${ok ? 'good' : 'bad'}">${title}</blockquote>
      ${body}
      <div class="brief-actions">
        <button data-act="retry">↺ Launch again</button>
        ${ok ? '<button data-act="workshop">Workshop</button><button class="cta" data-act="eva">Suit up ▶</button>'
    : '<button class="cta" data-act="workshop">Back to workshop (keep design)</button>'}
      </div>`;
    card.addEventListener('click', (e) => {
      if (e.target.dataset.act === 'eva') transition(manager, 'eva');
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

  /** Re-centre the world on the ship when it reaches orbit (keeps numbers small). */
  const recentre = () => {
    const shift = ship.position.clone();
    ship.position.sub(shift);
    camera.position.sub(shift);
    camLook.sub(shift);
    lastPos.sub(shift);
    padObjects.visible = false;
    for (const d of dropped) d.obj.visible = false;
    for (const s of smoke) s.visible = false;
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
      camera.position.copy(groundCam);
      camera.lookAt(camLook);
      lastPos.copy(ship.position);
    },
    exit() {
      narrator?.stop();
    },
    render(renderer) {
      if (!mapMode) layer.follow(camera, altKm);
      layer.render(renderer, scene, camera);
    },
    update(dt) {
      t += dt;
      layer.tick(dt * (phase === 'warp' ? 60 : 1));
      setting.update(camera, altKm);
      // Crew arm swings clear during the countdown; hold-downs open at liftoff.
      pad.update(dt, phase === 'countdown' ? (t < COUNTDOWN - 7 ? 'pad' : 'arm-away') : phase === 'stuck' ? 'arm-away' : 'release');

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
          if (Math.random() < 0.7) puff();
        }
        if (left <= 0) {
          phase = report.checks.liftoff ? 'ascent' : 'stuck';
          t = 0;
          if (phase === 'ascent') say('lift', 'Liftoff! We have liftoff.');
        }
      } else if (phase === 'stuck') {
        ship.position.x = (Math.random() - 0.5) * 0.15;
        if (Math.random() < 0.8) puff();
        setHud({ clock: met(t), alt: '0 km', speed: '0 km/s', stage: `1 / ${engineStages}`, label: 'NO LIFTOFF' });
        if (t > 5) fail(`The rocket couldn't lift off: thrust-to-weight ${report.stages[0].twr.toFixed(2)}, needs at least 1.2.`);
      } else if (phase === 'ascent') {
        const limit = launchGot / launchNeed; // < 1 if the launch leg is short
        // Slow at first (you watch it clear the tower), faster as it climbs.
        progress = Math.min(limit, (t / ASCENT_TIME) ** 1.5);
        const p = progress;
        altKm = PARKING_KM * p ** 2.2; // slow off the pad, fast at the end
        ship.position.set(DOWNRANGE_KM * 1000 * p ** 2.2, BASE + altKm * 1000, 0);
        ship.rotation.z = -1.3 * ease(Math.min(1, p * 1.3)); // pitch over towards orbit
        for (const st of staging) if (p >= st.at && active <= st.k) separate(st.k);
        const f = flames[active];
        f.visible = true;
        const vac = vacuumFlame(active);
        // Plume widens as the air thins.
        const wide = vac ? 1.8 + p : 1 + p * 1.5;
        f.scale.set(wide, (vac ? 10 : 18) * (1 + p) * (0.9 + Math.random() * 0.2), wide);
        f.userData.outer.material.opacity = vac ? 0.3 : 0.55 - p * 0.25;
        if (t < 5 && Math.random() < 0.7) puff();
        setHud({
          clock: met(t * 20), alt: `${Math.round(altKm)} km`, speed: `${(ORBIT_KMS * p).toFixed(2)} km/s`,
          stage: `${Math.min(engineStages, staging.filter((s) => s.k < active).length + 1)} / ${engineStages}`, label: 'ASCENT',
        });
        if (altKm > 100) say('space', 'Passing one hundred kilometres. Welcome to space.');
        if (p >= limit && limit < 1) {
          f.visible = false;
          say('cut', 'Main engine cutoff. We are short of orbit.');
          if (t > ASCENT_TIME * limit ** (1 / 1.5) + 3) fail('Fell short of orbit: the rocket ran out of fuel during launch.');
        } else if (p >= 1) {
          say('orbit', 'Orbit insertion. Parking orbit, four hundred kilometres.');
          recentre();
          phase = 'orbit';
          t = 0;
        }
      } else if (phase === 'orbit') {
        altKm = PARKING_KM;
        ship.rotation.z += (-Math.PI / 2 - ship.rotation.z) * Math.min(1, dt); // level out
        const f = flames[active];
        f.visible = t > 2 && t < 4.5;
        f.scale.set(2, 8, 2);
        setHud({ clock: met(540 + t * 60), alt: '400 km', speed: `${ORBIT_KMS.toFixed(2)} km/s`, stage: 'UPPER', label: 'TRANSFER BURN' });
        if (t > 2) say('xfer', `Transfer burn, ${Math.round(need.transfer)} metres per second, ${approach.name}.`);
        if (t > 5.5) {
          if (sim.failedAt === 'transfer') return fail('Ran out of fuel on the transfer burn.');
          phase = 'warp';
          t = 0;
          say('warp', `Coasting up to AURORA-7. About ${approach.hours} hours.`);
          fadeTo(1, 400).then(() => { mapMode = true; ship.visible = false; fadeTo(0, 400); });
        }
      } else if (phase === 'warp') {
        // Map view: pull out until the whole Earth fits, follow the transfer, zoom back in.
        const W = 9; // seconds
        const u = Math.min(1, t / W);
        const zoom = u < 0.3 ? ease(u / 0.3) : u > 0.75 ? 1 - ease((u - 0.75) / 0.25) : 1;
        const dist = PARKING_KM + (MAP_FAR_KM - PARKING_KM) * zoom;
        const shipAlt = PARKING_KM + (TARGET_KM - PARKING_KM) * ease(Math.min(1, u * 1.4));
        if (mapMode) layer.mapView(dist, camera.aspect, 0.4 + u * Math.PI * 1.2, 0.6 + u * Math.PI * 1.15, shipAlt);
        const hours = approach.hours * u;
        setHud({ clock: met(600 + hours * 3600), alt: `${Math.round(shipAlt)} km`, speed: `${(7.67 - 0.17 * u).toFixed(2)} km/s`, stage: 'UPPER', label: '⏩ TIME WARP' });
        if (u >= 1 && mapMode) {
          mapMode = null; // switching (render() treats null like "not following")
          fadeTo(1, 400).then(() => {
            mapMode = false;
            ship.visible = true;
            aurora.group.visible = true;
            aurora.group.position.set(-260, 4, -40);
            phase = 'arrive';
            t = 0;
            say('see', 'AURORA-7 in sight. Closing in on thrusters.');
            fadeTo(0, 400);
          });
        }
      } else if (phase === 'arrive') {
        altKm = TARGET_KM;
        const u = ease(Math.min(1, t / 7));
        aurora.group.position.lerpVectors(new THREE.Vector3(-260, 4, -40), new THREE.Vector3(-34, 2, -8), u);
        aurora.group.rotation.y += dt * 0.05;
        setHud({ clock: met(600 + approach.hours * 3600 + t * 60), alt: '700 km', speed: '7.50 km/s', stage: 'RCS', label: 'RENDEZVOUS' });
        if (t > 7.5) {
          phase = 'done';
          if (sim.failedAt === 'rendezvous') return fail('Not enough RCS fuel to line up with the satellite.');
          narrator.say('Holding position next to AURORA-7. Time to suit up.');
          endCard(true, 'Arrived at AURORA-7', `<p>You're holding position next to AURORA-7. The Specialist suits up to spacewalk: replace the broken solar panel and bring the data module back.</p>${legTable()}`);
        }
      }

      // Velocity (for separated stages to carry on with).
      if (dt > 0) shipVel.copy(ship.position).sub(lastPos).divideScalar(dt);
      lastPos.copy(ship.position);

      for (const d of dropped) {
        d.v.multiplyScalar(1 - dt * 0.6); // falls behind the still-accelerating rocket
        d.v.y -= 9.8 * dt;
        d.obj.position.addScaledVector(d.v, dt);
        d.obj.rotation.x += d.spin.x * dt;
        d.obj.rotation.z += d.spin.z * dt;
      }
      for (const s of smoke) {
        s.userData.age += dt;
        s.position.addScaledVector(s.userData.v, dt);
        s.scale.setScalar(1 + s.userData.age * 3);
        s.material.opacity = Math.max(0, 0.5 - s.userData.age * 0.07);
      }

      // Camera: from the ground at first, then locked behind and above the ship so Earth is in view.
      const centre = shipCentre();
      if (phase === 'countdown' || phase === 'stuck' || (phase === 'ascent' && t < 4)) {
        camLook.lerp(centre, Math.min(1, dt * 2));
        const shake = flames[0].visible && altKm < 1 ? 0.25 : 0;
        camera.position.copy(groundCam).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake));
        camera.lookAt(camLook);
      } else {
        const close = phase === 'arrive' || phase === 'done';
        camOffset.lerp(close ? new THREE.Vector3(30, 16, 75) : new THREE.Vector3(45, 30, 85), Math.min(1, dt));
        camera.position.copy(centre).add(camOffset); // rigid: keeps up at orbital speed
        const target = close ? centre.clone().lerp(aurora.group.position, 0.35) : centre;
        // Snap if the target jumped far (first chase frame), otherwise ease.
        if (camLook.distanceTo(target) > 200) camLook.copy(target);
        else camLook.lerp(target, Math.min(1, dt * 3));
        camera.lookAt(camLook);
      }
    },
  };
}
