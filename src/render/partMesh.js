import * as THREE from 'three';
import { MAT } from './materials.js';
import { DIAMETER } from '../data/catalog.js';
import { getModel } from './models.js';

// Primitive stand-ins for every part, sized from parts.json (CLAUDE.md §2, §3).
// Stack parts: origin at the centre of the bottom ring, growing up +Y.
// Radial parts: origin at the hull attach point, centred on y = 0, pointing out along +X.

const geoCache = new Map();
/** Reuse identical geometries across meshes. */
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

const cyl = (rTop, rBottom, h, seg = 32) =>
  geo(`cyl:${rTop}:${rBottom}:${h}:${seg}`, () => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    g.translate(0, h / 2, 0);
    return g;
  });

const box = (x, y, z) => geo(`box:${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));

const mesh = (g, m, y = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.y = y;
  return o;
};

const radius = (size) => (DIAMETER[size] ?? 2.5) / 2;

/** Height the part takes up in the stack (an engine mount adds its hanging engines). */
export function stackHeight(part, entry, parts) {
  const eng = entry?.engines && parts.get(entry.engines.part);
  return part.height + (eng ? eng.height : 0);
}

/** Engine bell + small thrust block. Vacuum engines get a much wider bell. */
function engine(part) {
  const g = new THREE.Group();
  const h = part.height;
  const bellH = h * 0.75;
  const exit = part.vacuumOnly ? 1.05 : 0.45;
  const throat = 0.22;
  g.add(mesh(cyl(throat, exit, bellH, 24), MAT.bell));
  g.add(mesh(cyl(0.35, 0.3, h - bellH, 16), MAT.metal, bellH));
  return g;
}

/** Engine positions under a mount: 1 in the centre, or a ring, or 1 + ring of 8 (like an octaweb). */
export function engineLayout(count, mountRadius) {
  if (count <= 1) return [[0, 0]];
  const ringR = mountRadius * 0.68;
  const ring = count === 9 ? 8 : count;
  const pts = [];
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2;
    pts.push([Math.cos(a) * ringR, Math.sin(a) * ringR]);
  }
  if (count === 9) pts.unshift([0, 0]);
  return pts;
}

/** Build one stack part (with any engines hung under it). */
function stackPart(part, entry, parts) {
  const g = new THREE.Group();
  const rB = radius(part.sizeBottom ?? part.sizeTop);
  const rT = radius(part.sizeTop ?? part.sizeBottom);
  const h = part.height;

  switch (part.category === 'tanks' ? 'tank' : part.id.replace(/-[SML]$/, '')) {
    case 'tank':
      g.add(mesh(cyl(rT, rB, h), MAT.hull));
      g.add(mesh(cyl(rT * 1.01, rB * 1.01, 0.3), MAT.metal, h * 0.5 - 0.15));
      break;
    case 'capsule-2': {
      g.add(mesh(cyl(rT, rB, h), MAT.capsule));
      const win = mesh(box(0.5, 0.35, 0.05), MAT.metal, h * 0.62);
      win.position.z = (rT + rB) / 2 - 0.05;
      g.add(win);
      break;
    }
    case 'cargo-module':
      g.add(mesh(cyl(rT, rB, h), MAT.gold));
      break;
    case 'heat-shield':
      g.add(mesh(cyl(rT * 1.02, rB * 1.02, h), MAT.heatShield));
      break;
    case 'parachutes':
      g.add(mesh(cyl(rT * 0.95, rB, h), MAT.chute));
      break;
    case 'docking-port':
      g.add(mesh(cyl(rT * 0.8, rB, h * 0.6), MAT.metal));
      g.add(mesh(cyl(rT * 0.85, rT * 0.85, h * 0.4), MAT.fin, h * 0.6));
      break;
    case 'decoupler':
      g.add(mesh(cyl(rT, rB, h), MAT.decoupler));
      break;
    case 'adapter':
      g.add(mesh(cyl(rT, rB, h), MAT.hull));
      break;
    case 'nose-cone':
      g.add(mesh(cyl(0.05, rB, h), MAT.hull));
      break;
    case 'fairing':
      g.add(mesh(cyl(rB, rB, h * 0.55), MAT.hull));
      g.add(mesh(cyl(0.1, rB, h * 0.45), MAT.hull, h * 0.55));
      break;
    case 'debris-shield':
      g.add(mesh(cyl(rT * 1.06, rB * 1.06, h), MAT.shield));
      break;
    case 'engine-mount': {
      const eng = entry?.engines && parts.get(entry.engines.part);
      const eh = eng ? eng.height : 0;
      g.add(mesh(cyl(rT, rT * 0.95, h), MAT.metal, eh));
      if (eng) {
        for (const [x, z] of engineLayout(entry.engines.count, rT)) {
          const e = engine(eng);
          e.position.set(x, 0, z);
          g.add(e);
        }
      }
      break;
    }
    default:
      if (part.category === 'engines') return engine(part);
      g.add(mesh(cyl(rT, rB, h), MAT.hull));
  }
  return g;
}

/** Build one radial part pointing out along +X from the hull. */
function radialPart(part) {
  const g = new THREE.Group();
  const h = part.height;
  switch (part.id) {
    case 'fin': {
      const f = mesh(box(1.2, h, 0.08), MAT.fin);
      f.position.x = 0.6;
      g.add(f);
      break;
    }
    case 'rcs': {
      const b = mesh(box(0.3, h, 0.3), MAT.metal);
      b.position.x = 0.15;
      g.add(b);
      break;
    }
    case 'solar-panel': {
      // Folded panel flat against the hull; unfolds in flight later.
      const p = mesh(box(0.06, h, 1.2), MAT.solar);
      p.position.x = 0.1;
      g.add(p);
      break;
    }
    case 'antenna-hg': {
      const stick = mesh(box(0.4, 0.06, 0.06), MAT.metal);
      stick.position.x = 0.2;
      const dish = new THREE.Mesh(geo('dish', () => new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3)), MAT.fin);
      dish.rotation.z = -Math.PI / 2;
      dish.position.x = 0.75;
      g.add(stick, dish);
      break;
    }
    case 'battery': {
      const b = mesh(box(0.25, h, 0.5), MAT.metal);
      b.position.x = 0.125;
      g.add(b);
      break;
    }
    case 'srb': {
      const r = 0.625;
      const body = mesh(cyl(r, r, h * 0.9), MAT.srb, -h / 2);
      const nose = mesh(cyl(0.05, r, h * 0.1), MAT.srb, h * 0.4);
      body.position.x = nose.position.x = r + 0.1;
      g.add(body, nose);
      break;
    }
    default: {
      const b = mesh(box(0.4, h, 0.4), MAT.metal);
      b.position.x = 0.2;
      g.add(b);
    }
  }
  return g;
}

/** Return the GLB if the human has dropped one into /public/models/, else the primitive. */
export function createPartMesh(part, entry, parts, { locked = false } = {}) {
  // Engine mounts stay procedural because their engine count changes per design.
  const model = entry?.engines ? null : getModel(part.id);
  const obj = model ?? (part.radial ? radialPart(part) : stackPart(part, entry, parts));
  if (locked) obj.traverse((o) => { if (o.isMesh) o.material = MAT.locked; });
  return obj;
}
