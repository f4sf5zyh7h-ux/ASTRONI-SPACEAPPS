import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { addSpaceLighting, createStarfield, createEarth, createMoon, createSpeedDust } from '../render/space.js';
import { createAurora, createDebrisCloud } from '../render/aurora.js';
import { transition } from '../ui/fade.js';
import { state } from '../state.js';
import missionData from '../data/missions.json';

const FLIGHT_TIME = 3.2; // seconds between missions
const BASE_FOV = 50;

// Card text per mission. Mission 1 numbers come from missions.json.
const m1 = missionData.missions[0];
const CARDS = [
  {
    id: 'mission-1', title: m1.name, tag: 'MISSION 1',
    text: `${m1.satellite}, an Earth-observation science satellite, has been hit by space debris at 700 km. Fly up, fix it and bring its data home.`,
    meta: [`Budget $${m1.budget}M`, `${m1.deadlineH} h`, `Crew ${m1.crew}`],
  },
  {
    id: 'mission-2', title: 'Lunar Cargo Run', tag: 'MISSION 2', locked: 'Complete Mission 1 to unlock',
    text: 'Deliver supplies to a lander on the Moon. You will need efficient hydrogen engines and a lot more Δv.',
    meta: ['Hydrogen engines', 'Moon transfer'],
  },
  {
    id: 'mission-3', title: 'Debris Cleanup', tag: 'MISSION 3', locked: 'Complete Mission 2 to unlock',
    text: 'A dead satellite is shedding a cloud of fragments. Capture it before the cloud spreads into busy orbits.',
    meta: ['Robotic arm', 'Precise rendezvous'],
  },
];

/** Mission select: each mission is an object floating in space; Next/Prev fly the camera between them. */
export function createMissionSelectScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 20000);
  addSpaceLighting(scene);
  const stars = createStarfield();
  scene.add(stars);

  // Mission 1: AURORA-7 above Earth.
  const earth = createEarth(400);
  earth.position.set(0, -460, -180);
  scene.add(earth);
  const aurora = createAurora();
  aurora.group.rotation.set(0.15, -0.6, 0.1);
  scene.add(aurora.group);

  // Mission 2: the Moon, far away.
  const moon = createMoon(60);
  moon.position.set(-40, -10, -3000);
  scene.add(moon);

  // Mission 3: debris cloud around a dead satellite.
  const cloud = createDebrisCloud();
  cloud.position.set(30, 10, -6000);
  scene.add(cloud);

  const dust = createSpeedDust([0, 0, 200], [0, 0, -6200]);
  scene.add(dust);

  // Where the camera sits for each mission (position, look target).
  const views = [
    { pos: new THREE.Vector3(7, 3.5, 12), target: new THREE.Vector3(0, -0.8, 0), orbit: 1.5 },
    { pos: new THREE.Vector3(70, 30, -2810), target: new THREE.Vector3(-40, -10, -3000), orbit: 10 },
    { pos: new THREE.Vector3(70, 30, -5940), target: new THREE.Vector3(30, 8, -6000), orbit: 6 },
  ];
  const anchors = [aurora.group, moon, cloud];
  const tagHeights = [5, 72, 16];
  const tags = [];

  let index = 0;
  let flight = null; // { from, to, t }
  let t = 0;
  let card;
  let labelRenderer;
  let onKey;
  let leaving = false;
  const lookAt = new THREE.Vector3();

  const placeCamera = (v, time) => {
    // Gentle idle sway around the resting view.
    const s = Math.sin(time * 0.3) * v.orbit;
    camera.position.copy(v.pos).add(new THREE.Vector3(s, Math.sin(time * 0.21) * v.orbit * 0.3, 0));
    lookAt.copy(v.target);
    camera.lookAt(lookAt);
  };

  const showCard = () => {
    const c = CARDS[index];
    card.className = 'mission-card show' + (c.locked ? ' locked' : '');
    card.innerHTML = `
      <div class="mc-tag">${c.tag} · ${index + 1} / ${CARDS.length}</div>
      <h2>${c.title}</h2>
      <p>${c.text}</p>
      <div class="mc-meta">${c.meta.map((m) => `<span>${m}</span>`).join('')}</div>
      ${c.locked ? `<div class="mc-lock">🔒 ${c.locked}</div>` : '<button class="cta" data-act="start">Start mission</button>'}
      <div class="mc-dots">${CARDS.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>`;
  };

  const fly = (dir) => {
    const next = index + dir;
    if (flight || next < 0 || next >= CARDS.length) return;
    flight = { from: index, to: next, t: 0, start: camera.position.clone(), startLook: lookAt.clone() };
    index = next;
    card.classList.remove('show');
  };

  return {
    scene,
    camera,
    enter({ ui, manager }) {
      labelRenderer = new CSS2DRenderer();
      labelRenderer.domElement.className = 'labels';
      ui.appendChild(labelRenderer.domElement);
      labelRenderer.setSize(window.innerWidth, window.innerHeight);
      CARDS.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'mission-tag' + (c.locked ? ' locked' : '');
        div.textContent = `${c.locked ? '🔒 ' : ''}${c.tag}`;
        const tag = new CSS2DObject(div);
        tag.position.y = tagHeights[i];
        // Attach to the scene (not the spinning object) so the tag stays put.
        tag.position.add(anchors[i].position);
        scene.add(tag);
        tags.push(tag);
      });

      const head = document.createElement('div');
      head.className = 'screen-head';
      head.innerHTML = '<span>ASTRONI</span> · Select mission';
      ui.appendChild(head);

      const prev = document.createElement('button');
      prev.className = 'nav-arrow left';
      prev.textContent = '‹';
      prev.onclick = () => fly(-1);
      const next = document.createElement('button');
      next.className = 'nav-arrow right';
      next.textContent = '›';
      next.onclick = () => fly(1);
      ui.append(prev, next);

      card = document.createElement('div');
      ui.appendChild(card);
      const start = () => {
        if (leaving || flight || CARDS[index].locked) return;
        leaving = true;
        state.missionId = CARDS[index].id;
        transition(manager, 'intro', {}, 900);
      };
      card.addEventListener('click', (e) => e.target.dataset.act === 'start' && start());
      showCard();

      const update = () => {
        prev.disabled = index === 0;
        next.disabled = index === CARDS.length - 1;
        requestAnimationFrame(() => !leaving && update());
      };
      update();

      onKey = (e) => {
        if (e.key === 'ArrowRight') fly(1);
        if (e.key === 'ArrowLeft') fly(-1);
        if (e.key === 'Enter') start();
      };
      window.addEventListener('keydown', onKey);
    },
    exit() {
      window.removeEventListener('keydown', onKey);
      leaving = true;
    },
    update(dt) {
      t += dt;
      earth.userData.tick(dt);
      cloud.userData.tick(dt);
      aurora.group.rotation.y += dt * 0.08;
      moon.rotation.y += dt * 0.01;

      if (flight) {
        flight.t += dt / FLIGHT_TIME;
        const u = Math.min(flight.t, 1);
        const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; // easeInOutCubic
        const to = views[flight.to];
        // Arc sideways and up during the trip so it reads as a flight, not a zoom.
        const arc = Math.sin(Math.PI * u);
        camera.position.lerpVectors(flight.start, to.pos, e).add(new THREE.Vector3(arc * 120, arc * 60, 0));
        lookAt.lerpVectors(flight.startLook, to.target, Math.min(1, e * 1.3));
        camera.lookAt(lookAt);
        camera.fov = BASE_FOV + arc * 30;
        camera.updateProjectionMatrix();
        dust.material.opacity = arc * 0.9;
        if (u >= 1) {
          flight = null;
          t = 0;
          camera.fov = BASE_FOV;
          camera.updateProjectionMatrix();
          dust.material.opacity = 0;
          showCard();
        }
      } else {
        placeCamera(views[index], t);
      }
      stars.position.copy(camera.position);
    },
    afterRender() {
      // Only the mission we're at (or flying to) shows its tag.
      tags.forEach((tag, i) => (tag.visible = i === index && !flight));
      labelRenderer?.render(scene, camera);
    },
    resize(w, h) {
      labelRenderer?.setSize(w, h);
    },
  };
}
