import * as THREE from 'three';
import { getModel } from './models.js';

// AURORA-7 (fictional Earth-observation satellite), debris, and the Mission 3 wreck.
// Uses public/models/aurora-7.glb when present, primitives otherwise.
// Node names follow CLAUDE.md §15: bus, array_intact, array_broken, hotspot_*.

const std = (color, roughness = 0.5, metalness = 0.2, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

let cellTexture;
/** Blue solar-cell grid drawn on a canvas once. */
function solarTexture() {
  if (cellTexture) return cellTexture;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0d2357';
  g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 8; y++) {
      g.fillStyle = `hsl(222, 70%, ${18 + Math.random() * 8}%)`;
      g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
    }
  }
  cellTexture = new THREE.CanvasTexture(c);
  cellTexture.colorSpace = THREE.SRGBColorSpace;
  return cellTexture;
}

const MATS = {
  foil: std(0xe0b030, 0.35, 0.45),
  white: std(0xdfe4ea, 0.6, 0.1),
  dark: std(0x22262d, 0.5, 0.6),
  boom: std(0x9aa3ad, 0.4, 0.7),
  data: std(0xff7a1a, 0.5, 0.2, { emissive: 0x401800 }),
};
const panelMat = () => std(0xffffff, 0.3, 0.4, { map: solarTexture(), side: THREE.DoubleSide });

/** One solar wing pointing along +X from the bus side (x = 1). length/width in metres. */
function solarWing(length = 7, width = 2.4) {
  const wing = new THREE.Group();
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), MATS.boom);
  boom.rotation.z = Math.PI / 2;
  boom.position.x = 0.6;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, width), panelMat());
  panel.position.x = 1.2 + length / 2;
  panel.name = 'panel';
  wing.add(boom, panel);
  return wing;
}

function brokenStub() {
  const g = new THREE.Group();
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), MATS.boom);
  boom.rotation.z = Math.PI / 2 - 0.25;
  boom.position.set(0.6, 0.12, 0);
  const shard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.4), panelMat());
  shard.position.set(1.7, 0.35, 0.3);
  shard.rotation.set(0.4, 0.3, -0.5);
  g.add(boom, shard);
  return g;
}

function primitiveAurora() {
  const sat = new THREE.Group();
  const bus = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 2), MATS.foil);
  bus.name = 'bus';
  bus.position.y = 1.3;
  sat.add(bus);
  // Instrument (camera) on the Earth-facing end, dish on top.
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.6, 24), MATS.dark);
  lens.position.y = -0.3;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), MATS.white);
  dish.position.y = 2.9;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), MATS.boom);
  mast.position.y = 2.9;
  sat.add(lens, dish, mast);

  const intact = solarWing();
  intact.name = 'array_intact';
  intact.rotation.y = Math.PI; // points along −X
  intact.position.set(-0, 1.6, 0);
  const broken = brokenStub();
  broken.name = 'array_broken';
  broken.position.set(0, 1.6, 0);
  sat.add(intact, broken);

  const data = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), MATS.data);
  data.name = 'data_module';
  data.position.set(0, 1.6, 1.15);
  sat.add(data);

  // EVA hotspots (empties), matching the GLB spec.
  const spots = {
    hotspot_bolt_1: [1.05, 2.2, 0.6], hotspot_bolt_2: [1.05, 2.2, -0.6],
    hotspot_bolt_3: [1.05, 1.0, 0.6], hotspot_bolt_4: [1.05, 1.0, -0.6],
    hotspot_cable: [1.05, 1.6, 0], hotspot_mount: [1.6, 1.6, 0], hotspot_data: [0, 1.6, 1.3],
  };
  for (const [name, p] of Object.entries(spots)) {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(...p);
    sat.add(o);
  }
  return sat;
}

/**
 * AURORA-7. Returns { group, setBroken(b), wingToShatter }.
 * Intact state shows a full wing where array_broken sits (mirrored copy of array_intact).
 */
export function createAurora() {
  const group = getModel('aurora-7') ?? primitiveAurora();
  const intact = group.getObjectByName('array_intact');
  const broken = group.getObjectByName('array_broken');

  // Healthy right wing for the intro: mirror of the intact one.
  let healthy = null;
  if (intact) {
    healthy = intact.clone(true);
    healthy.name = 'array_healthy';
    healthy.position.x *= -1;
    healthy.rotateY(Math.PI); // local half-turn: the copy points the other way
    group.add(healthy);
  }
  const setBroken = (b) => {
    if (broken) broken.visible = b;
    if (healthy) healthy.visible = !b;
  };
  setBroken(true);
  return { group, setBroken, wingToShatter: healthy };
}

/** Pieces of a solar panel flung out from `origin` (world). Call tick(dt) each frame. */
export function createShatter(origin, impactDir, count = 18) {
  const group = new THREE.Group();
  const mat = panelMat();
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const s = 0.2 + Math.random() * 0.9;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, 0.03, s * (0.4 + Math.random())), mat);
    m.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.3) * 6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 2));
    const v = impactDir.clone().multiplyScalar(2 + Math.random() * 4).add(new THREE.Vector3().randomDirection().multiplyScalar(2.5));
    const spin = new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 6);
    pieces.push({ m, v, spin });
    group.add(m);
  }
  group.userData.tick = (dt) => {
    for (const p of pieces) {
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.spin.x * dt;
      p.m.rotation.y += p.spin.y * dt;
      p.m.rotation.z += p.spin.z * dt;
    }
  };
  return group;
}

/** Spark burst: additive points that fly out and fade over ~1.5 s. */
export function createSparks(origin, count = 300) {
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos.set([origin.x, origin.y, origin.z], i * 3);
    vel.push(new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 14));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffc070, size: 0.12, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  let age = 0;
  pts.userData.tick = (dt) => {
    age += dt;
    const a = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      vel[i].multiplyScalar(1 - dt * 0.8);
      a.setXYZ(i, a.getX(i) + vel[i].x * dt, a.getY(i) + vel[i].y * dt, a.getZ(i) + vel[i].z * dt);
    }
    a.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - age / 1.8);
    mat.color.setHSL(0.09, 1, 0.5 + Math.max(0, 0.5 - age));
  };
  return pts;
}

/** Jagged rock-like debris fragment (radius in metres). */
export function createDebrisFragment(radius = 0.35) {
  const model = getModel('debris-fragment');
  if (model) return model;
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.7 + Math.random() * 0.6;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, std(0x5a5550, 0.9, 0.3, { flatShading: true }));
}

/** Mission 3: a dead satellite inside a slowly turning cloud of fragments. */
export function createDebrisCloud() {
  const group = new THREE.Group();
  const wreck = getModel('dead-satellite') ?? (() => {
    const g = new THREE.Group();
    const bus = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), std(0x7a7068, 0.9, 0.3));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 2.5), panelMat());
    wing.position.set(4.5, 0.6, 0);
    wing.rotation.set(0.5, 0.2, -0.4);
    g.add(bus, wing);
    g.rotation.set(0.4, 0.3, 0.6);
    return g;
  })();
  group.add(wreck);

  const count = 400;
  const geo = new THREE.TetrahedronGeometry(0.35);
  const mesh = new THREE.InstancedMesh(geo, std(0xb8b0a6, 0.8, 0.3, { flatShading: true }), count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 26;
    const p = new THREE.Vector3(Math.cos(ang) * r, (Math.random() - 0.5) * 8 * (r / 30), Math.sin(ang) * r);
    q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    s.setScalar(0.4 + Math.random() * 1.8);
    mesh.setMatrixAt(i, m.compose(p, q, s));
  }
  const cloud = new THREE.Group();
  cloud.add(mesh);
  cloud.rotation.x = 0.35;
  group.add(cloud);
  group.userData.tick = (dt) => {
    mesh.rotation.y += dt * 0.04;
    wreck.rotation.y += dt * 0.05;
  };
  return group;
}
