import * as THREE from 'three';
import { getModel } from './models.js';

// Launch pad with service tower, stairs and crew access arm. Uses public/models/launch-pad.glb
// when it exists, otherwise builds a basic lattice tower from boxes (placeholder).
// The tower stands on +X; the access arm reaches the capsule's side hatch (also on +X).

export const MOUNT_H = 4; // the rocket stands on a launch table this high (flame trench below)
const TOWER_X0 = 7; // tower face nearest the rocket
const TOWER_W = 4;
const LEVEL = 3; // metres per stair flight

const mat = (color, roughness = 0.8, metalness = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

/**
 * @param scene
 * @param armY   height of the access-arm walkway (floor level at the hatch)
 * @param armTipX x where the walkway ends at the rocket hull
 * @param towerH  total tower height
 */
export function createLaunchPad(scene, { armY, armTipX, towerH }) {
  const model = getModel('launch-pad');
  if (model) {
    scene.add(model);
    return { towerX: TOWER_X0 + TOWER_W / 2, lights: [] };
  }

  const concrete = mat(0x6d727a, 0.95, 0);
  const dark = mat(0x22252b, 1, 0);
  const steel = mat(0xb0423a, 0.6, 0.5); // classic red service-tower paint
  const grey = mat(0x9aa3ad, 0.5, 0.6);
  const yellow = mat(0xf2c230, 0.7, 0.1);

  const add = (geo, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    scene.add(o);
    return o;
  };

  // Ground, pad, flame trench.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 48), mat(0x1c2418, 1, 0));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  scene.add(ground);
  add(new THREE.BoxGeometry(46, 0.6, 46), concrete, 0, -0.3, 0);
  add(new THREE.BoxGeometry(5, 0.05, 30), dark, -1, 0.01, -8);

  // Launch table: four legs and a square deck with a hole for the exhaust.
  for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) add(new THREE.BoxGeometry(1.2, MOUNT_H, 1.2), concrete, x, MOUNT_H / 2, z);
  for (const [w, d, x, z] of [[8, 2, 0, -3], [8, 2, 0, 3], [2, 4, -3, 0], [2, 4, 3, 0]]) add(new THREE.BoxGeometry(w, 0.6, d), concrete, x, MOUNT_H - 0.3, z);

  // Lattice tower: 4 columns, girts every level, a diagonal brace per face per level.
  const cx = TOWER_X0 + TOWER_W / 2;
  const half = TOWER_W / 2;
  const col = new THREE.BoxGeometry(0.35, towerH, 0.35);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(col, steel, cx + dx * half, towerH / 2, dz * half);
  const girtX = new THREE.BoxGeometry(TOWER_W, 0.2, 0.2);
  const girtZ = new THREE.BoxGeometry(0.2, 0.2, TOWER_W);
  const braceLen = Math.hypot(TOWER_W, LEVEL);
  const brace = new THREE.BoxGeometry(0.12, braceLen, 0.12);
  const tilt = Math.atan2(TOWER_W, LEVEL);
  for (let y = LEVEL; y <= towerH; y += LEVEL) {
    add(girtX, steel, cx, y, -half);
    add(girtX, steel, cx, y, half);
    // Leave the rocket-facing face open where the access arm passes through.
    if (y < armY - 0.3 || y > armY + 2.6) add(girtZ, steel, cx - half, y, 0);
    add(girtZ, steel, cx + half, y, 0);
    // Diagonals on the two side faces (±z), alternating direction each level.
    const s = (y / LEVEL) % 2 ? 1 : -1;
    for (const z of [-half, half]) {
      const b = add(brace, steel, cx, y - LEVEL / 2, z);
      b.rotation.z = s * tilt;
    }
  }

  // Zig-zag stairs inside the tower: one flight per level, with landings.
  const flightLen = Math.hypot(TOWER_W - 1, LEVEL);
  const flight = new THREE.BoxGeometry(1.1, 0.15, flightLen);
  const landing = new THREE.BoxGeometry(1.4, 0.15, 1.2);
  for (let y = 0, i = 0; y < armY; y += LEVEL, i++) {
    const dir = i % 2 ? 1 : -1;
    const f = add(flight, grey, cx + 1.1, y + LEVEL / 2, 0);
    f.rotation.x = dir * Math.atan2(LEVEL, TOWER_W - 1);
    add(landing, grey, cx + 1.1, y + LEVEL, dir * -(half - 0.6));
  }

  // Top platform at arm level + the crew access arm with railings and a yellow edge.
  const deck = add(new THREE.BoxGeometry(TOWER_W, 0.2, TOWER_W), grey, cx, armY - 0.1, 0);
  deck.name = 'tower-deck';
  const armLen = TOWER_X0 - armTipX;
  add(new THREE.BoxGeometry(armLen, 0.2, 1.6), grey, armTipX + armLen / 2, armY - 0.1, 0);
  add(new THREE.BoxGeometry(armLen, 0.04, 0.12), yellow, armTipX + armLen / 2, armY + 0.01, 0.74);
  add(new THREE.BoxGeometry(armLen, 0.04, 0.12), yellow, armTipX + armLen / 2, armY + 0.01, -0.74);
  for (const z of [-0.8, 0.8]) {
    add(new THREE.BoxGeometry(armLen, 0.06, 0.06), steel, armTipX + armLen / 2, armY + 1.05, z);
    for (let x = armTipX + 0.2; x < TOWER_X0; x += 1.2) add(new THREE.BoxGeometry(0.06, 1.05, 0.06), steel, x, armY + 0.52, z);
  }
  // Truss under the arm.
  add(new THREE.BoxGeometry(armLen, 0.8, 0.2), steel, armTipX + armLen / 2, armY - 0.6, 0);

  // Floodlights on masts pointing at the rocket.
  const lights = [];
  const lamp = mat(0xffffff, 0.3, 0, { emissive: 0xfff2c0, emissiveIntensity: 3 });
  for (const [x, z] of [[-26, -18], [-26, 18], [24, 26]]) {
    add(new THREE.CylinderGeometry(0.25, 0.35, 30, 8), grey, x, 15, z);
    const head = add(new THREE.BoxGeometry(2, 1, 0.5), lamp, x, 30, z);
    head.lookAt(0, 20, 0);
    const spot = new THREE.SpotLight(0xfff0d0, 900, 120, 0.5, 0.6, 1.6);
    spot.position.set(x, 30, z);
    spot.target.position.set(0, 25, 0);
    scene.add(spot, spot.target);
    lights.push(spot);
  }
  return { towerX: cx, lights };
}
