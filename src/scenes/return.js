import * as THREE from 'three';
import { parts } from '../data/catalog.js';
import { exampleDesign } from '../data/catalog.js';
import { simulateMission } from '../physics/mission.js';
import { buildRocket } from '../render/rocketMesh.js';
import { createPadSetting } from '../render/padSetting.js';
import { createEarthLayer } from '../render/earthLayer.js';
import { createNarrator } from '../ui/narrator.js';
import { transition, flash } from '../ui/fade.js';
import { state } from '../state.js';
import missionData from '../data/missions.json';

// Return (CLAUDE.md §16.10–11): de-orbit burn → capsule separates → re-entry fireball →
// parachutes → splashdown, then the debrief with score (§9) and plain-English causes.
// Missing heat shield / parachutes / de-orbit Δv each produce their own, explained failure.

const ease = (u) => u * u * (3 - 2 * u);
const OCEAN_X = 12000; // splash down in the ocean east of the coast (padSetting.js)

export function createReturnScene() {
  const mission = missionData.missions.find((m) => m.id === state.missionId) ?? missionData.missions[0];
  const design = state.design?.stack.some((e) => e.part === 'capsule-2') ? state.design : exampleDesign();
  const approach = mission.approaches.find((a) => a.id === state.approach) ?? mission.approaches[0];
  const sim = simulateMission(design, parts, mission, approach.id);
  const report = sim.report;
  const eva = state.eva ?? { repaired: true, dataModule: true, minutes: 50, injured: false, outcome: 'ok' };

  // What happens on the way down, from the physics + checklist.
  const fate = sim.failedAt === 'deorbit' ? 'stranded'
    : !report.checks.capsuleSeparates || !report.checks.heatShield ? 'burnup'
      : !report.checks.parachutes ? 'crash' : 'splash';

  const scene = new THREE.Scene();
  scene.userData.envIntensity = 0.4;
  const camera = new THREE.PerspectiveCamera(55, 1, 4, 400000); // camera stays ~40 m off: a far near-plane stops the sea flickering
  const setting = createPadSetting(scene);
  const layer = createEarthLayer();

  // The capsule section: everything above the decoupler under the heat shield.
  const capIdx = design.stack.findIndex((e) => e.part === 'capsule-2');
  let end = capIdx + 1;
  while (end < design.stack.length && parts.get(design.stack[end].part)?.role !== 'decoupler') end++;
  const capDesign = { stack: design.stack.slice(0, Math.min(end, design.stack.length)), cargo: [] };
  const capsule = buildRocket(capDesign, parts).group;
  const pod = new THREE.Group();
  pod.add(capsule);
  scene.add(pod);

  // Plasma sheath under the heat shield (grows and fades with the heating).
  const plasmaMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const plasma = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 24, 1, true).translate(0, -4.5, 0), plasmaMat);
  plasma.rotation.x = Math.PI; // wide end hugs the heat shield, tail streams above
  plasma.position.y = 0;
  pod.add(plasma);
  const glow = new THREE.PointLight(0xff8a3a, 0, 60, 1.5);
  pod.add(glow);

  // Parachutes: three domes on lines.
  const chutes = new THREE.Group();
  const chuteMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8, side: THREE.DoubleSide });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.8, side: THREE.DoubleSide });
  const top = Math.max(4, new THREE.Box3().setFromObject(capsule).max.y);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), k % 2 ? stripeMat : chuteMat);
    dome.position.set(Math.cos(a) * 4.2, top + 26, Math.sin(a) * 4.2);
    dome.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    chutes.add(dome);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, top, 0), dome.position]), new THREE.LineBasicMaterial({ color: 0xdddddd }));
    chutes.add(line);
  }
  chutes.scale.setScalar(0.01);
  chutes.visible = false;
  pod.add(chutes);

  // Splash ring.
  const splash = new THREE.Mesh(new THREE.RingGeometry(1, 3, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  splash.rotation.x = -Math.PI / 2;
  scene.add(splash);

  let phase = 'burn'; // burn → reentry → chutes → landed | burnup | crash | stranded → debrief
  let t = 0;
  let altKm = 700;
  let speed = 7.5;
  let ui;
  let manager;
  let narrator;
  let hud;
  const said = new Set();
  const say = (id, text) => { if (!said.has(id)) { said.add(id); narrator.say(text); } };

  const setHud = (label, extra = '') => {
    hud.innerHTML = `
      <div class="lh-clock">RETURN</div>
      <div class="lh-row"><span>ALT</span><b>${altKm >= 10 ? Math.round(altKm) : altKm.toFixed(1)} km</b></div>
      <div class="lh-row"><span>SPEED</span><b>${speed >= 1 ? speed.toFixed(2) + ' km/s' : Math.round(speed * 1000) + ' m/s'}</b></div>
      ${extra}
      <div class="lh-phase">${label}</div>`;
  };

  const debrief = () => {
    phase = 'debrief';
    const crewHome = fate === 'splash';
    const crewInjury = eva.injured || !crewHome ? 1 : 0;
    const success = crewHome && eva.repaired;
    const hoursUsed = approach.hours + eva.minutes / 60 + 3;
    // Science counts only if the data module came home (§16.11): 100% within 24 h → 40% at 72 h.
    const sciRaw = hoursUsed <= 24 ? 1 : Math.max(0.4, 1 - (0.6 * (hoursUsed - 24)) / 48);
    const science = crewHome && eva.dataModule && eva.repaired ? sciRaw : 0;
    const budgetLeft = Math.max(0, mission.budget - report.cost);
    const timeBonus = crewHome ? Math.round(200 * Math.max(0, mission.deadlineH - hoursUsed) / mission.deadlineH) : 0;
    const rows = [
      ['Mission success', success ? 1000 : 0, `1000 × ${success ? 1 : 0}`],
      ['Science restored', Math.round(500 * science), `500 × ${science.toFixed(2)}`],
      ['Budget left', Math.round(2 * budgetLeft), `2 × $${budgetLeft.toFixed(0)}M`],
      ['Time bonus', timeBonus, `${Math.round(mission.deadlineH - hoursUsed)} h of life support unused`],
      ['Crew injury', -300 * crewInjury, `−300 × ${crewInjury}`],
    ];
    const score = rows.reduce((s, r) => s + r[1], 0);
    const grade = !crewHome ? 'F' : score >= 1800 ? 'S' : score >= 1600 ? 'A' : score >= 1350 ? 'B' : score >= 1000 ? 'C' : 'F';

    // The main cause, in plain English with numbers.
    const deorbit = sim.legs.find((l) => l.id === 'deorbit');
    const causes = [];
    if (fate === 'stranded') causes.push(`You needed ${Math.round(deorbit?.required ?? 183)} m/s for the de-orbit burn but only had ${Math.round(deorbit?.delivered ?? 0)} m/s left. Add fuel to the upper stage or make the crew section lighter.`);
    if (fate === 'burnup') causes.push(report.checks.capsuleSeparates ? 'There was no heat shield under the capsule. Re-entering at 7.5 km/s heats the air in front of it to thousands of degrees.' : 'The capsule could not separate from the rocket, so its heat shield was blocked. Put a decoupler directly below the heat shield.');
    if (fate === 'crash') causes.push('There were no parachutes. The capsule hit the sea at around 150 m/s instead of about 8 m/s.');
    if (!eva.repaired) causes.push('The solar panel was not fixed, so AURORA-7 stays on battery and its science ends.');
    else if (!eva.dataModule) causes.push('The data module was left behind, so none of the stored science came home.');
    if (eva.outcome === 'o2') causes.push('The Specialist ran out of oxygen on the spacewalk. Pack spare O₂ and a toolkit for stuck bolts.');
    if (eva.outcome === 'drift') causes.push('With no tether, the Specialist drifted away from the ship. Always pack a tether for each spacewalker.');
    if (!causes.length) causes.push(`Clean mission. The rocket had ${Math.round(sim.spareDv)} m/s of Δv to spare. ${sim.spareDv > 400 ? 'You could save money with a smaller rocket.' : 'A well-sized rocket.'}`);
    if (success && !state.unlocked?.includes('robotic-arm')) state.unlocked = [...(state.unlocked ?? []), 'robotic-arm'];

    const card = document.createElement('div');
    card.className = 'brief debrief';
    card.innerHTML = `
      <div class="brief-tag">MISSION REPORT · ${mission.name.toUpperCase()}</div>
      <div class="db-head">
        <div class="db-grade g-${grade}">${grade}</div>
        <div>
          <blockquote class="${success ? 'good' : 'bad'}">${success ? 'MISSION SUCCESS' : crewHome ? 'CREW HOME, REPAIR INCOMPLETE' : 'MISSION FAILED'}</blockquote>
          <div class="db-nums">
            <div><b>${Math.round(science * 100)}%</b><span>science restored</span></div>
            <div><b>$${budgetLeft.toFixed(0)}M</b><span>budget left</span></div>
            <div><b>${Math.round(hoursUsed)} h</b><span>of ${mission.deadlineH} h used</span></div>
            <div><b class="${crewInjury ? 'bad' : 'good'}">${crewHome ? (crewInjury ? 'Injured' : 'Safe') : 'Lost'}</b><span>crew</span></div>
          </div>
        </div>
      </div>
      <h3>What happened</h3>
      <ul class="db-causes">${causes.map((c, i) => `<li class="${i === 0 ? 'main' : ''}">${c}</li>`).join('')}</ul>
      <h3>Score <span class="muted">= 1000·success + 500·science + 2·budget left + time bonus − 300·injury</span></h3>
      <table class="leg-table">${rows.map(([k, v, why]) => `<tr><td>${k}</td><td class="muted">${why}</td><td style="text-align:right">${v >= 0 ? '+' : ''}${v}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td></td><td style="text-align:right"><b>${score}</b></td></tr></table>
      <h3>Speed change (Δv) per leg</h3>
      <table class="leg-table">${sim.legs.map((l) => `<tr class="${l.ok ? 'good' : 'bad'}"><td>${l.id}</td><td>needed ${Math.round(l.required)} m/s</td><td>got ${Math.round(l.delivered)} m/s</td><td>${l.ok ? '✔' : '✘'}</td></tr>`).join('')}</table>
      <div class="db-real"><b>Real world:</b> NASA astronauts did repairs like this five times on the Hubble Space Telescope (1993–2009), including replacing its solar arrays on spacewalks.</div>
      ${success ? '<div class="db-unlock">🔓 Robotic Arm unlocked for Mission 2</div>' : ''}
      <div class="brief-actions">
        <button data-act="missions">Mission select</button>
        <button data-act="launch">↺ Fly again</button>
        <button class="cta" data-act="workshop">Back to workshop (keep design)</button>
      </div>`;
    card.addEventListener('click', (e) => {
      const a = e.target.dataset.act;
      if (a) transition(manager, a);
    });
    ui.appendChild(card);
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
      skip.onclick = () => { skip.remove(); narrator.stop(); if (phase !== 'debrief') debrief(); };
      ui.appendChild(skip);
      pod.position.set(OCEAN_X, altKm * 1000, 0);
      pod.rotation.z = Math.PI / 2;
    },
    exit() { narrator?.stop(); },
    render(renderer) {
      layer.follow(camera, altKm);
      layer.render(renderer, scene, camera);
    },
    update(dt) {
      t += dt;
      layer.tick(dt);
      setting.update(camera, altKm);

      if (phase === 'burn') {
        setHud('DE-ORBIT BURN');
        say('burn', fate === 'stranded' ? 'De-orbit burn… engine cutoff. We are short. Not enough fuel to come home.' : `De-orbit burn: slowing by ${Math.round(sim.need.deorbit)} metres per second.`);
        if (t > 5) {
          if (fate === 'stranded') { phase = 'stranded'; t = 0; }
          else { phase = 'reentry'; t = 0; say('sep', 'Capsule separation. Heat shield forward. Entry interface in a few minutes.'); }
        }
      } else if (phase === 'stranded') {
        setHud('STRANDED IN ORBIT');
        if (t > 4) debrief();
      } else if (phase === 'reentry') {
        // 700 km → 8 km over ~16 s of screen time; heating peaks around 60–80 km.
        const u = Math.min(1, t / 16);
        altKm = 700 - 692 * ease(u);
        pod.rotation.z += (0 - pod.rotation.z) * Math.min(1, dt * 1.5); // heat shield turns to face down
        const heat = Math.max(0, 1 - Math.abs(altKm - 70) / 60);
        speed = altKm > 90 ? 7.5 : 7.5 * Math.max(0.03, (altKm - 8) / 82);
        plasmaMat.opacity = heat * 0.75;
        plasma.scale.set(1 + heat * 0.4, 0.4 + heat * 1.6, 1 + heat * 0.4);
        glow.intensity = heat * 600;
        const temp = Math.round(300 + heat * 1350);
        setHud('RE-ENTRY', `<div class="lh-row"><span>SHIELD</span><b class="${fate === 'burnup' && heat > 0.4 ? 'bad' : ''}">${temp} °C</b></div>`);
        if (heat > 0.3) say('plasma', 'Plasma blackout. The air in front of the shield is hotter than the surface of the Sun.');
        if (fate === 'burnup' && heat > 0.85) {
          flash(700);
          pod.visible = false;
          phase = 'burnup';
          t = 0;
          say('lost', report.checks.capsuleSeparates ? 'We have lost the signal. No heat shield.' : 'We have lost the signal. The capsule never separated.');
        }
        if (u >= 1) { phase = 'chutes'; t = 0; }
      } else if (phase === 'burnup') {
        setHud('SIGNAL LOST');
        if (t > 4) debrief();
      } else if (phase === 'chutes') {
        plasmaMat.opacity = 0;
        glow.intensity = 0;
        const fall = fate === 'crash' ? 0.15 : 0.008; // km/s
        altKm = Math.max(0, altKm - fall * dt * (fate === 'crash' ? 8 : 60));
        speed = fate === 'crash' ? 0.15 : Math.max(0.008, speed - dt * 0.05);
        if (fate !== 'crash') {
          chutes.visible = true;
          chutes.scale.setScalar(Math.min(1, chutes.scale.x + dt * 0.8));
          say('chutes', 'Main chutes deployed. Three good chutes.');
          pod.rotation.x = Math.sin(t * 0.8) * 0.06;
        } else say('nochute', 'Chutes… no chutes! There are no parachutes on board!');
        setHud(fate === 'crash' ? 'NO PARACHUTES' : 'PARACHUTES');
        if (altKm <= 0) {
          altKm = 0;
          splash.position.set(OCEAN_X, 0, 0);
          splash.material.opacity = 1;
          if (fate === 'crash') { flash(500); pod.visible = false; say('crash', 'Impact. Recovery teams are on their way.'); }
          else say('splash', `Splashdown! Welcome home${eva.dataModule ? ', and the data is home too' : ''}.`);
          phase = 'landed';
          t = 0;
        }
      } else if (phase === 'landed') {
        setHud(fate === 'crash' ? 'IMPACT' : 'SPLASHDOWN');
        splash.scale.setScalar(1 + t * 6);
        splash.material.opacity = Math.max(0, 1 - t / 3);
        if (pod.visible) pod.position.y = Math.sin(t * 1.4) * 0.3 - 1;
        if (t > 4.5) debrief();
      }

      if (phase !== 'landed' || fate !== 'crash') pod.position.y = Math.max(phase === 'landed' ? pod.position.y : 0, altKm * 1000);
      // Camera: off to the side and a little below, so the plasma and Earth/sky are in view.
      const c = pod.position;
      const chuteView = chutes.visible;
      camera.position.set(c.x - (chuteView ? 40 : 20), c.y + (chuteView ? 6 : 9), c.z + (chuteView ? 75 : 26)); // Earth fills the lower view
      camera.lookAt(c.x, c.y + (chuteView ? 16 : 2), c.z);
    },
  };
}
