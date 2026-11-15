import * as THREE from 'three';

// Drives the robotic-arm model (joint names from the human's GLB):
// base (swivel about Y) → shoulder (Z) → upper_boom → elbow (Z) → lower_boom → wrist_pitch (Z)
// → wrist_roll → grabber (jaw_1..3, cam_wrist, grip_point). The player steers the grip point;
// two-link inverse kinematics turns that into joint angles.

const L1 = 3.2; // shoulder → elbow
const WRIST = 0.13 + 0.2 + 0.36; // wrist_pitch → grip point (wrist_roll + grabber + grip)
const L2 = 3.2 + WRIST; // elbow → grip point, wrist held straight
const SIDE = 0.45; // the lower boom sits 0.45 m to the side of the upper one (local +Z)
const SHOULDER_X = 0.28 + 0.32; // root → shoulder pivot along +X
export const REACH = L1 + L2 - 0.05;

export const STOWED = { yaw: 0, sh: -Math.PI / 2, el: Math.PI, wr: 0 };

export function rigArm(model) {
  const j = (n) => model.getObjectByName(n);
  const base = j('base');
  const shoulder = j('shoulder');
  const elbow = j('elbow');
  const wrist = j('wrist_pitch');
  const grabber = j('grabber');
  const jaws = [j('jaw_1'), j('jaw_2'), j('jaw_3')].filter(Boolean);
  const jawRest = jaws.map((o) => o.quaternion.clone());
  const cam = j('cam_wrist');
  const grip = j('grip_point');
  const pose = { ...STOWED };
  let closed = 0; // 0 open … 1 closed

  const apply = () => {
    base.rotation.set(0, pose.yaw, 0);
    shoulder.rotation.set(0, 0, pose.sh);
    elbow.rotation.set(0, 0, pose.el);
    wrist.rotation.set(0, 0, pose.wr);
    jaws.forEach((o, k) => o.quaternion.copy(jawRest[k]).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.45 * closed)));
  };
  apply();

  /** Joint angles that put the grip point at `p` (arm-root space). Returns null if out of reach. */
  const solve = (p) => {
    const rho = Math.hypot(p.x, p.z);
    if (rho <= SIDE + 0.05) return null;
    const R = Math.sqrt(rho * rho - SIDE * SIDE);
    const yaw = Math.atan2(-p.z, p.x) + Math.atan2(SIDE, R);
    const X = R - SHOULDER_X;
    const Y = p.y;
    const d = Math.hypot(X, Y);
    if (d > REACH || d < 0.8) return null;
    const c = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    const q2 = -Math.acos(Math.max(-1, Math.min(1, c))); // elbow bends "up"
    const sh = Math.atan2(Y, X) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    return { yaw, sh, el: q2, wr: 0 };
  };

  return {
    model, grabber, cam, grip, pose,
    set(p) { Object.assign(pose, p); apply(); },
    /** Blend the current pose towards `to` by k (0…1). */
    blend(from, to, k) { for (const key of ['yaw', 'sh', 'el', 'wr']) pose[key] = from[key] + (to[key] - from[key]) * k; apply(); },
    solve,
    /** Try to move the grip to `world`; returns false (and doesn't move) if it can't reach. */
    reach(world) {
      const local = model.worldToLocal(world.clone());
      const s = solve(local);
      if (!s) return false;
      Object.assign(pose, s);
      apply();
      return true;
    },
    setGrip(k) { closed = k; apply(); },
    gripWorld: () => grip.getWorldPosition(new THREE.Vector3()),
    /** Point a camera along the grabber, from the wrist camera. */
    aimCamera(camera) {
      cam.getWorldPosition(camera.position);
      const q = grabber.getWorldQuaternion(new THREE.Quaternion());
      camera.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
    },
  };
}
