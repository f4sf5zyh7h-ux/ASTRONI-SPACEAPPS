import * as THREE from 'three';
import { getModel, hasModel } from './models.js';

// Launch pad with service tower, stairs and crew access arm. Uses public/models/launch-pad.glb
// when it exists, otherwise builds a basic lattice tower from boxes (placeholder).
// The tower stands on +X; the access arm reaches the capsule's side hatch (also on +X).

const PLACEHOLDER_MOUNT_H = 4; // basic pad: launch table height
const MODEL_MOUNT_H = 9.1; // launch-pad.glb: top of the mount rails
const TOWER_X0 = 7; // tower face nearest the rocket
const TOWER_W = 4;
const LEVEL = 3; // metres per stair flight

/** Height the rocket's base stands at (depends on whether the human's pad model is loaded). */
export const padBase = () => (hasModel('launch-pad') ? MODEL_MOUNT_H : PLACEHOLDER_MOUNT_H);
/** @deprecated use padBase(); kept for the placeholder pad. */
export const MOUNT_H = PLACEHOLDER_MOUNT_H;

const mat = (color, roughness = 0.8, metalness = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

/**
 * @param scene
 * @param armY     height of the access-arm walkway (floor level at the hatch)
 * @param armTipX  x where the walkway ends at the rocket hull
 * @param towerH   total tower height (placeholder only)
 * @param radiusAt (optional) hull radius at a world height, to fit arms and clamps to the rocket
 * Returns { towerX, startX, lights, update(dt, phase) } — phase: 'pad' | 'arm-away' | 'release'.
 */
export function createLaunchPad(scene, { armY, armTipX, towerH, radiusAt = () => 1.25 }) {
  const model = getModel('launch-pad');
  if (model) return fitModelPad(scene, model, { armY, radiusAt });

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
  // (The surrounding land comes from padSetting.js.)
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

  // Floodlight masts (lamps off in daylight).
  const lights = [];
  const lamp = mat(0xe8e8e0, 0.4, 0.2);
  for (const [x, z] of [[-26, -18], [-26, 18], [24, 26]]) {
    add(new THREE.CylinderGeometry(0.25, 0.35, 30, 8), grey, x, 15, z);
    const head = add(new THREE.BoxGeometry(2, 1, 0.5), lamp, x, 30, z);
    head.lookAt(0, 20, 0);
  }
  return { towerX: cx, startX: cx, walkMaxX: cx + 1.6, lights, update() {} };
}

/**
 * launch-pad.glb (human-made): rocket on the mount at 9.1 m, tower on +X (x 10–14).
 * Moving parts per the modeller's nodes:
 *  - crew-access-arm-carriage slides up the tower rails (y 6–66); its y = walkway floor.
 *    The tip's seal sits at x = 1.15 when crew-access-arm-tip.x = −6.25, so we slide the tip
 *    until the white room meets the hull. The arm swings away on its hinge before launch.
 *  - umbilical-arm-1/2: same geometry, tips fitted to the hull at their heights.
 *  - holddown-1..4 (like the rocket stand clamps): radius = hull radius at the jaw, open at liftoff.
 */
function fitModelPad(scene, model, { armY, radiusAt }) {
  scene.add(model);
  const node = (n) => model.getObjectByName(n);

  // The tower is modelled 6–66 m. Taller rockets put the hatch above that, so stretch the
  // lattice upwards (and lift the roof, beacons and rod) until the crew arm reaches the hatch.
  const TOWER_BASE = 6;
  const TOWER_TOP = 66;
  const needTop = armY + 3;
  if (needTop > TOWER_TOP) {
    const k = (needTop - TOWER_BASE) / (TOWER_TOP - TOWER_BASE);
    for (const n of ['tower-columns', 'tower-bracing', 'tower-girts', 'tower-arm-rails', 'umbilical-lines']) {
      const o = node(n);
      if (o) { o.scale.y = k; o.position.y = TOWER_BASE * (1 - k); }
    }
    for (const n of ['tower-roof', 'tower-beacons', 'tower-lightning-rod']) {
      const o = node(n);
      if (o) o.position.y += needTop - TOWER_TOP;
    }
  }
  // Match the model's grass to the surrounding scrubland (padSetting.js).
  const grass = node('grass');
  if (grass?.material) {
    grass.material = grass.material.clone();
    grass.material.color.set(0x6d7a45);
  }
  const fitTip = (tipName, seal, y) => {
    const tip = node(tipName);
    if (tip) tip.position.x = -6.25 + (Math.max(0.3, radiusAt(y)) - seal);
  };

  const crewCarriage = node('crew-access-arm-carriage');
  const crewArm = node('crew-access-arm');
  if (crewCarriage) crewCarriage.position.y = Math.max(6, armY);
  fitTip('crew-access-arm-tip', 1.15, armY + 1.4);
  for (const k of [1, 2]) {
    const c = node(`umbilical-arm-${k}-carriage`);
    if (c) fitTip(`umbilical-arm-${k}-tip`, 1.2, c.position.y);
  }

  // Hold-downs: jaw pads at the clamp origin pointing inward; clamp base at 9.1 m.
  const holds = [1, 2, 3, 4].map((i) => {
    const c = node(`holddown-${i}`);
    if (!c) return null;
    const dir = new THREE.Vector3(c.position.x, 0, c.position.z).normalize();
    return { c, dir };
  }).filter(Boolean);
  const jawY = MODEL_MOUNT_H + 2.3 + 0.1;
  const gripR = Math.max(0.6, radiusAt(jawY));
  let holdR = gripR;
  for (const { c, dir } of holds) c.position.set(dir.x * holdR, c.position.y, dir.z * holdR);

  let armAngle = 0;
  return {
    towerX: 12,
    startX: 9.3, // on the arm carriage at the tower
    walkMaxX: 9.6, // the tower has no floor inside
    lights: [],
    /** phase: 'pad' (everything attached), 'arm-away' (crew arm swings clear), 'release' (hold-downs open). */
    update(dt, phase) {
      const k = Math.min(1, dt * 1.5);
      const armTarget = phase === 'pad' ? 0 : -1.5;
      armAngle += (armTarget - armAngle) * k * 0.6;
      if (crewArm) crewArm.rotation.y = armAngle;
      const rTarget = phase === 'release' ? gripR + 1.2 : gripR;
      holdR += (rTarget - holdR) * Math.min(1, dt * 4);
      for (const { c, dir } of holds) c.position.set(dir.x * holdR, c.position.y, dir.z * holdR);
    },
  };
}

/**
 * Ground vehicles (human-modelled) around the pad, on the 300 m pad model's hardstand.
 * 'boarding': the crew van that brought the astronauts, fire truck on standby, fuel truck at
 * the propellant farm, command truck, crawler parked on the crawlerway.
 * 'launch': the pad is cleared; only the far-off command truck and crawler remain.
 */
export function addPadVehicles(scene, mode = 'boarding') {
  const spots = [
    ['crawler-transporter', -2, -96, Math.PI / 2, true],
    ['command-truck', -52, 26, 0.6, true],
    ['crew-van', -22, 48, -0.4, false],
    ['fire-truck', -40, -30, 1.2, false],
    ['fuel-truck', 46, 38, Math.PI / 2, false],
  ];
  for (const [id, x, z, ry, staysForLaunch] of spots) {
    if (mode === 'launch' && !staysForLaunch) continue;
    const v = getModel(id);
    if (!v) continue;
    v.position.set(x, 0, z);
    v.rotation.y = ry;
    scene.add(v);
  }
}
