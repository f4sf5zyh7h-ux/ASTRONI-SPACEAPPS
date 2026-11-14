import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { parts, partList, DIAMETER, isLocked } from '../data/catalog.js';
import { referenceDesign } from '../data/designs.js';
import { analyzeDesign } from '../physics/rocket.js';
import { buildRocket } from '../render/rocketMesh.js';
import { createPartMesh } from '../render/partMesh.js';
import { tonnes, kms, metres, money } from '../ui/format.js';

const ROWS = [
  ['crew', 'Crew, cargo & recovery'],
  ['engines', 'Engines'],
  ['tanks', 'Tanks'],
  ['structure', 'Structure'],
  ['systems', 'Systems'],
];

const VIEWS = {
  rocket: { pos: [80, 40, 80], target: [0, 33, 0] },
  parts: { pos: [0, 10, -6], target: [0, 3, -24] },
};

/**
 * Phase 2 showroom: the reference rocket on the pad at real size, plus every
 * part in labelled rows so models can be built to the exact dimensions.
 */
export function createShowroomScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);

  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x303030, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 80, 30);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  scene.add(ground);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 24), new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95 }));
  pad.position.y = -0.5;
  scene.add(pad);

  const design = referenceDesign();
  const rocket = buildRocket(design, parts);
  scene.add(rocket.group);

  // [label, max camera distance]: far labels hide so they don't pile up on screen.
  const labels = [];
  const addLabel = (html, x, y, z, cls = 'label', maxDist = 30) => {
    const div = document.createElement('div');
    div.className = cls;
    div.innerHTML = html;
    const obj = new CSS2DObject(div);
    obj.position.set(x, y, z);
    scene.add(obj);
    labels.push([obj, maxDist]);
  };

  addLabel(`Reference rocket · ${metres(rocket.height)} tall`, 0, rocket.height + 3, 0, 'label label-big', Infinity);
  layoutParts(addLabel, scene);

  let controls;
  let labelRenderer;
  const setView = (name) => {
    const v = VIEWS[name];
    camera.position.set(...v.pos);
    controls.target.set(...v.target);
    controls.update();
  };

  return {
    scene,
    camera,
    enter({ renderer, ui }) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI * 0.49;
      setView('rocket');

      labelRenderer = new CSS2DRenderer();
      labelRenderer.domElement.className = 'labels';
      ui.appendChild(labelRenderer.domElement);
      labelRenderer.setSize(window.innerWidth, window.innerHeight);

      ui.appendChild(statsPanel(analyzeDesign(design, parts)));

      const bar = document.createElement('div');
      bar.className = 'panel view-bar';
      bar.innerHTML = `<button data-v="rocket">Rocket</button><button data-v="parts">All parts</button>`;
      bar.addEventListener('click', (e) => e.target.dataset.v && setView(e.target.dataset.v));
      ui.appendChild(bar);
    },
    exit() {
      controls?.dispose();
    },
    update() {
      controls?.update();
    },
    afterRender() {
      for (const [obj, max] of labels) obj.visible = camera.position.distanceTo(obj.position) < max;
      labelRenderer?.render(scene, camera);
    },
    resize(w, h) {
      labelRenderer?.setSize(w, h);
    },
  };
}

/** One row per category behind the pad; each part gets a dimensions label. */
function layoutParts(addLabel, scene) {
  ROWS.forEach(([cat, title], row) => {
    const z = -24 - row * 16;
    const items = partList.filter((p) => p.category === cat);
    // Leave enough room between parts that their labels don't overlap.
    const widths = items.map((p) => Math.max(DIAMETER[p.sizeBottom] ?? DIAMETER[p.sizeTop] ?? 0, 2.5) + 5);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = -total / 2;

    addLabel(title, x - 5, 1, z, 'label label-row', 60);
    items.forEach((p, i) => {
      x += widths[i] / 2;
      const locked = isLocked(p);
      const obj = createPartMesh(p, null, parts, { locked });
      obj.position.set(x, p.radial ? p.height / 2 : 0, z);
      scene.add(obj);
      addLabel(partLabel(p, locked), x, (p.radial ? p.height : p.height) + 0.8, z);
      x += widths[i] / 2;
    });
  });
}

function partLabel(p, locked) {
  const size = p.radial ? 'side-mounted' : `Ø ${[p.sizeTop, p.sizeBottom].filter(Boolean).map((s) => DIAMETER[s] + ' m').join(' → ')}`;
  const fuel = p.propellant ? ` + ${tonnes(p.propellant, 0)} fuel` : p.monoprop ? ` + ${tonnes(p.monoprop, 2)} monoprop` : '';
  return `<b>${p.name}</b><br>${p.id}<br>${size} · ${metres(p.height)} tall<br>${tonnes(p.mass, 2)}${fuel} · ${money(p.cost)}${locked ? `<br><i>Locked — Mission ${p.lockedUntil}</i>` : ''}`;
}

function statsPanel(a) {
  const el = document.createElement('div');
  el.className = 'panel stats';
  const stages = a.stages
    .filter((s) => s.dv > 0)
    .map((s, i) => `<li>Stage ${i + 1}: ${kms(s.dv)} · TWR ${s.twr.toFixed(2)} · burns ${Math.round(s.burnTime)} s</li>`)
    .join('');
  el.innerHTML = `
    <strong>Reference rocket</strong>
    <div class="big">${kms(a.totalDv)} Δv</div>
    <div>${money(a.cost)} of $250M · ${tonnes(a.totalMass, 0)}</div>
    <ul>${stages}</ul>
    <div class="muted">Drag to orbit · scroll to zoom · right-drag to pan</div>`;
  return el;
}
