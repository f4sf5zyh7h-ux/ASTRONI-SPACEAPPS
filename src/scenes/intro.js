import * as THREE from 'three';
import { addSpaceLighting, createStarfield, createEarth } from '../render/space.js';
import { createAurora, createShatter, createSparks, createDebrisFragment } from '../render/aurora.js';
import { createNarrator } from '../ui/narrator.js';
import { transition, flash } from '../ui/fade.js';
import { missionLegs } from '../physics/mission.js';
import { kms, tonnes } from '../ui/format.js';
import { state } from '../state.js';
import missionData from '../data/missions.json';

const IMPACT_T = 14;
const BRIEF_T = 26.5;
const DEBRIS_TRAVEL = 4.5; // seconds of (slow-motion) approach on screen

// Commentary. The ~10 km/s figure is from the NASA Orbital Debris Program Office (see DATA_SOURCES.md).
const LINES = [
  [2.0, 'Mission Control', 'AURORA-7, telemetry looks good. Science downlink at one hundred percent.'],
  [6.5, 'Mission Control', 'Hold on. Tracking shows a debris fragment on a crossing path.'],
  [9.5, 'Mission Control', 'Debris hits at around ten kilometres per second. That’s about ten times faster than a rifle bullet.'],
  [15.0, 'Mission Control', 'Impact! Solar array B is gone. AURORA-7 is running on battery.'],
  [20.0, 'Mission Control', 'The battery lasts seventy-two hours. Then the instruments shut down, and the data on board is lost.'],
];

// Camera keyframes [time, position, look target]; eased between.
const KEYS = [
  // From the front so both wings spread across the screen.
  [0, [-6, 7, 26], [0, 1.5, 0]],
  [6.5, [-3, 4, 21], [0, 1.5, 0]],
  // Swing left to see the fragment coming in from behind-right.
  [9.5, [-8, 3, 16], [4, 1.5, -4]],
  [IMPACT_T, [-7, 3, 14], [3, 1.5, -1]],
  [20, [-10, 7, 24], [1, 1.5, 0]],
  [BRIEF_T, [-14, 10, 32], [2, 0, 0]],
];

const ease = (u) => u * u * (3 - 2 * u);

function cameraAt(time, pos, look) {
  let i = 0;
  while (i < KEYS.length - 2 && time > KEYS[i + 1][0]) i++;
  const [t0, p0, l0] = KEYS[i];
  const [t1, p1, l1] = KEYS[i + 1];
  const u = ease(THREE.MathUtils.clamp((time - t0) / (t1 - t0), 0, 1));
  pos.set(...p0).lerp(new THREE.Vector3(...p1), u);
  look.set(...l0).lerp(new THREE.Vector3(...l1), u);
}

/** Intro cutscene: AURORA-7 is hit by debris, then the contract briefing. */
export function createIntroScene() {
  const mission = missionData.missions.find((m) => m.id === state.missionId) ?? missionData.missions[0];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.userData.envIntensity = 0.2; // space: little reflected light
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20000);
  addSpaceLighting(scene);
  const stars = createStarfield();
  scene.add(stars);
  const earth = createEarth(400);
  earth.position.set(0, -430, -120);
  scene.add(earth);

  const aurora = createAurora();
  aurora.setBroken(false);
  aurora.group.rotation.y = -0.3;
  scene.add(aurora.group);

  // Impact point = centre of the healthy wing (world space).
  scene.updateMatrixWorld(true);
  const impactPoint = new THREE.Box3().setFromObject(aurora.wingToShatter ?? aurora.group).getCenter(new THREE.Vector3());
  const debrisDir = new THREE.Vector3(-1, -0.08, 1.3).normalize(); // direction of travel
  const debrisStart = impactPoint.clone().addScaledVector(debrisDir, -90);
  const debris = createDebrisFragment(0.35);
  debris.visible = false;
  scene.add(debris);
  // Glowing streak behind the fragment.
  const trail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.02, 6, 8, 1, true).translate(0, -3, 0).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  debris.add(trail);
  debris.lookAt(debris.position.clone().add(debrisDir));

  const effects = [];
  const spin = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let t = 0;
  let next = 0; // next commentary line
  let impacted = false;
  let briefed = false;
  let shake = 0;
  let narrator;
  let hud;
  let loc;
  let ui;
  let manager;
  let onKey;

  const impact = () => {
    impacted = true;
    debris.visible = false;
    aurora.setBroken(true);
    const sparks = createSparks(impactPoint);
    const shards = createShatter(impactPoint, debrisDir);
    scene.add(sparks, shards);
    effects.push(sparks, shards);
    spin.set(0.05, 0.12, 0.09); // slow tumble, rad/s
    shake = 1.2;
    flash(450);
    hud.className = 'intro-hud alarm';
    hud.innerHTML = '⚠ IMPACT · SOLAR ARRAY B LOST · POWER 50%';
    loc.innerHTML = `<b>${mission.satellite}</b><br>Earth-observation science satellite<br>Altitude ${mission.targetAltitude / 1000} km · <span class="bad">Status: DAMAGED · on battery</span>`;
  };

  const showBrief = () => {
    if (briefed) return;
    briefed = true;
    if (!impacted) impact();
    t = Math.max(t, BRIEF_T);
    narrator.hide();
    hud.remove();
    loc.remove();
    skip.remove();
    const quote = 'We depend on its data getting back to Earth. Go up, retrieve the data, fix the satellite, fly home.';
    narrator.say(quote, 'Mission Control', 'intro-6');
    narrator.hide();

    const legs = missionLegs(mission, 'standard');
    const total = legs.launch + legs.transfer + legs.deorbit;
    // `width` is the drawn width (small legs exaggerated); the label always shows the real value.
    const seg = (v, width, cls, name) => `<div class="dv-seg ${cls}" style="flex:${width}" title="${name}: ${kms(v)}"><span>${name}<br>${kms(v)}</span></div>`;

    const brief = document.createElement('div');
    brief.className = 'brief';
    brief.innerHTML = `
      <div class="brief-tag">CONTRACT AWARDED · ${mission.name.toUpperCase()}</div>
      <blockquote>“${quote}”</blockquote>
      <div class="brief-cols">
        <div>
          <h3>Objectives</h3>
          <ol>
            <li>Reach ${mission.satellite} at ${mission.targetAltitude / 1000} km</li>
            <li>Spacewalk: replace the shattered solar panel</li>
            <li>Retrieve the data module</li>
            <li>Bring the crew and the data home</li>
          </ol>
        </div>
        <div>
          <h3>Constraints</h3>
          <ul class="brief-facts">
            <li><b>$${mission.budget}M</b> budget</li>
            <li><b>${mission.deadlineH} h</b> before the battery dies</li>
            <li><b>${mission.crew}</b> crew: Commander + Specialist</li>
            <li><b>${tonnes(mission.panelDelivered, 1)}</b> replacement panel + toolkit</li>
          </ul>
        </div>
      </div>
      <h3>Speed change (Δv) your rocket must deliver <span class="muted">· standard approach</span></h3>
      <div class="dv-bar">${seg(legs.launch, legs.launch, 'launch', 'Launch')}${seg(legs.transfer, legs.transfer * 8, 'transfer', 'Transfer')}${seg(legs.deorbit, legs.deorbit * 8, 'deorbit', 'De-orbit')}</div>
      <p class="muted">Total ≈ ${kms(total)} plus ${legs.rendezvous} m/s from the RCS thrusters. Small legs drawn 8× wider so you can see them.
      Launch figure includes gravity and drag losses (representative).</p>
      <div class="brief-actions">
        <button data-act="replay">↺ Watch again</button>
        <button class="cta" data-act="workshop">Go to workshop</button>
      </div>`;
    brief.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (act === 'workshop') transition(manager, 'workshop');
      if (act === 'replay') transition(manager, 'intro');
    });
    ui.appendChild(brief);
  };

  let skip;
  return {
    scene,
    camera,
    enter(ctx) {
      ui = ctx.ui;
      manager = ctx.manager;
      narrator = createNarrator(ui);

      loc = document.createElement('div');
      loc.className = 'intro-loc';
      loc.innerHTML = `<b>${mission.satellite}</b><br>Earth-observation science satellite<br>Altitude ${mission.targetAltitude / 1000} km · Status: nominal`;
      ui.appendChild(loc);

      hud = document.createElement('div');
      hud.className = 'intro-hud';
      ui.appendChild(hud);

      skip = document.createElement('button');
      skip.className = 'skip';
      skip.textContent = 'Skip ›';
      skip.onclick = showBrief;
      ui.appendChild(skip);
      onKey = (e) => (e.key === 'Escape' || e.key === ' ') && showBrief();
      window.addEventListener('keydown', onKey);
    },
    exit() {
      narrator?.stop();
      window.removeEventListener('keydown', onKey);
    },
    update(dt) {
      t += dt;
      earth.userData.tick(dt);

      while (!briefed && next < LINES.length && t >= LINES[next][0]) {
        const [, who, text] = LINES[next++];
        narrator.say(text, who, `intro-${next}`); // recorded clip public/audio/intro-N.mp3 if present
        if (next === 2) {
          hud.className = 'intro-hud warn';
          hud.textContent = '⚠ COLLISION WARNING · DEBRIS ON CROSSING PATH';
        }
      }

      // Debris approach (slow motion) and impact.
      const dStart = IMPACT_T - DEBRIS_TRAVEL;
      if (!impacted && t >= dStart) {
        const u = (t - dStart) / DEBRIS_TRAVEL;
        debris.visible = true;
        debris.position.lerpVectors(debrisStart, impactPoint, u);
        debris.rotateX(dt * 3);
        trail.lookAt(trail.getWorldPosition(new THREE.Vector3()).sub(debrisDir));
        if (u >= 1) impact();
      }
      for (const e of effects) e.userData.tick(dt);

      if (impacted) {
        aurora.group.rotation.x += spin.x * dt;
        aurora.group.rotation.y += spin.y * dt;
        aurora.group.rotation.z += spin.z * dt;
      } else {
        aurora.group.rotation.y += dt * 0.02;
      }

      cameraAt(Math.min(t, BRIEF_T), camPos, look);
      if (shake > 0) {
        shake = Math.max(0, shake - dt);
        camPos.add(new THREE.Vector3().randomDirection().multiplyScalar(shake * 0.25));
      }
      camera.position.copy(camPos);
      camera.lookAt(look);
      stars.position.copy(camera.position);

      if (!briefed && t >= BRIEF_T) showBrief();
    },
  };
}
