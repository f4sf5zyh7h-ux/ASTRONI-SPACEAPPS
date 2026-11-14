import * as THREE from 'three';
import { getModel } from './models.js';

// The workshop's surroundings: the human's factory.glb (hangar with crane) and rocket-stand.glb
// (turntable with clamps, tower with work platform). Moving parts follow the node names and
// ranges the modeller documented. Falls back to a plain launch pad if the models are missing.

const TROLLEY_Y = 42.02; // crane trolley height above the floor (bridge 40.12 + 1.9)
const CABLE_LEN = 17.02; // modelled cable length (hook at 25 m)
const DECK_Y = 1.0; // top of the turntable's centre pad
const ROOF_CUT = 42.9; // keep everything below this when the roof is lifted off (crane stays)
const CUT_KEEP = 6; // cutaway: keep the building up to this far in front of the rocket

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Build the site. Returns { base, update(dt, ctx) } where `base` is the height the rocket
 * stands on and ctx = { camera, rocketHeight, radiusAt(y), grip: {y, r} | null, carry: Object3D | null }.
 */
export function createWorkshopSite(scene) {
  const factory = getModel('factory');
  const stand = getModel('rocket-stand');
  if (!factory) buildPad(scene);
  else {
    // Ground outside the hangar (seen through the open cutaway).
    const ground = new THREE.Mesh(new THREE.CircleGeometry(800, 48), new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.32;
    scene.add(ground);
  }

  // ---- factory + cutaway clipping ----
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);
  const roofPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  let crane = null;
  if (factory) {
    scene.add(factory);
    // The floor stays whole; everything else can be cut away to see the rocket.
    const keepWhole = new Set(['floor', 'floor-markings', 'apron']);
    const clipped = new Map();
    factory.traverse((o) => {
      if (!o.isMesh || keepWhole.has(o.name) || keepWhole.has(o.parent?.name)) return;
      if (!clipped.has(o.material)) {
        const m = o.material.clone();
        m.clippingPlanes = [cutPlane, roofPlane];
        m.side = THREE.DoubleSide; // show the inside of sliced walls instead of holes
        clipped.set(o.material, m);
      }
      o.material = clipped.get(o.material);
    });
    crane = {
      bridge: factory.getObjectByName('crane-bridge'),
      trolley: factory.getObjectByName('crane-trolley'),
      hook: factory.getObjectByName('crane-hook'),
      cable: factory.getObjectByName('crane-cable'),
      x: -18, z: 10, h: 25, // current (smoothed) crane position
    };
  }

  // ---- rocket stand ----
  let rig = null;
  if (stand) {
    scene.add(stand);
    const clamps = [1, 2, 3, 4].map((i) => {
      const c = stand.getObjectByName(`clamp-${i}`);
      const dir = new THREE.Vector3(c.position.x, 0, c.position.z).normalize();
      return { c, jaw: stand.getObjectByName(`clamp-${i}-jaw`), dir };
    });
    rig = {
      clamps,
      platform: stand.getObjectByName('work-platform'),
      ext: stand.getObjectByName('arm-extension'),
      r: 2.6, jawY: 1.5, platY: 12, reach: 1.875,
    };
  }

  const base = stand ? DECK_Y : 0;

  return {
    base,
    update(dt, { camera, rocketHeight, radiusAt, grip, carry }) {
      const k = Math.min(1, dt * 3);

      // Clamps: grip the lowest tank/module (radius 0.31–1.875 m, jaw 1.5–5.3 m high), else open wide.
      if (rig) {
        const targetR = grip ? clamp(grip.r, 0.31, 2.6) : 2.6;
        const targetJaw = grip ? clamp(grip.y, 1.5, 5.3) : 1.5;
        rig.r = lerp(rig.r, targetR, k);
        rig.jawY = lerp(rig.jawY, targetJaw, k);
        for (const { c, jaw, dir } of rig.clamps) {
          c.position.x = dir.x * rig.r;
          c.position.z = dir.z * rig.r;
          jaw.position.y = rig.jawY - 1.1; // clamp base sits 1.1 m above the floor
        }
        // Work platform rides to the top of the rocket (1.5–35 m); the arm reaches the hull there.
        const top = base + rocketHeight;
        const platTarget = clamp(top - 2, 1.5, 35);
        rig.platY = lerp(rig.platY, platTarget, k);
        rig.platform.position.y = rig.platY;
        const r = rocketHeight > 0 ? radiusAt(rig.platY - base) : 0;
        // Bumper tip x = 3 + ext.x − 1.05 (stand space); touch the hull at radius r, or retract.
        const reachTarget = r > 0 ? r : 1.875;
        rig.reach = lerp(rig.reach, reachTarget, k);
        rig.ext.position.x = Math.min(0, rig.reach - 1.95);
      }

      // Crane: carries the part being dragged; otherwise parks over the rocket's top.
      if (crane) {
        const tx = carry ? clamp(carry.position.x, -27, 27) : 0;
        const tz = carry ? clamp(carry.position.z, -21, 21) : 0;
        const carryTop = carry ? carry.position.y + (carry.userData.height ?? 1) : base + rocketHeight;
        const th = clamp(carryTop + 2.4, 3, 39);
        const ck = Math.min(1, dt * (carry ? 8 : 2));
        crane.x = lerp(crane.x, tx, ck);
        crane.z = lerp(crane.z, tz, ck);
        crane.h = lerp(crane.h, th, ck);
        crane.bridge.position.x = crane.x;
        crane.trolley.position.z = crane.z;
        crane.hook.position.y = crane.h - TROLLEY_Y;
        crane.cable.scale.y = (TROLLEY_Y - crane.h) / CABLE_LEN;
      }

      // Cutaway: slice off the building between the camera and the rocket, and lift the roof
      // when the rocket or the camera is above it. Nothing is cut while the camera is inside.
      if (factory) {
        const flat = new THREE.Vector3(camera.position.x, 0, camera.position.z);
        const dist = flat.length();
        const outside = dist > 24 || camera.position.y > 44;
        if (outside && dist > 0.01) {
          const d = flat.divideScalar(dist); // unit vector towards the camera
          cutPlane.normal.set(-d.x, 0, -d.z); // keep points with d·p ≤ CUT_KEEP
          cutPlane.constant = CUT_KEEP;
        } else {
          cutPlane.constant = 1e6;
        }
        roofPlane.constant = base + rocketHeight > 40 || camera.position.y > 44 ? ROOF_CUT : 1e6;
      }
    },
  };
}

/** Fallback when factory.glb is missing: concrete pad with markings. */
function buildPad(scene) {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  scene.add(ground);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 30), new THREE.MeshStandardMaterial({ color: 0x4a505a, roughness: 0.95 }));
  pad.position.y = -0.5;
  scene.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.2, 6.7, 64), new THREE.MeshStandardMaterial({ color: 0xf2c230 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
}
