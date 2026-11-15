import * as THREE from 'three';

/**
 * First-person mouse look that starts straight away, no click needed.
 * Asks for pointer lock at once (allowed right after the button click that opened the scene); until
 * the browser grants it, plain mouse movement turns the view so the camera already follows the mouse.
 * `enabled()` switches it off (e.g. while seated at the control pad).
 */
export function autoLook(controls, { enabled = () => true, speed = 0.002 } = {}) {
  const cam = controls.object ?? controls.camera;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const tryLock = () => {
    if (!enabled() || controls.isLocked) return;
    try {
      const p = controls.domElement.requestPointerLock();
      if (p?.catch) p.catch(() => {}); // refused without a recent click: the fallback below still works
    } catch { /* not allowed yet */ }
  };
  const onMove = (e) => {
    if (controls.isLocked || !enabled()) return;
    euler.setFromQuaternion(cam.quaternion);
    euler.y -= e.movementX * speed * (controls.pointerSpeed ?? 1);
    euler.x -= e.movementY * speed * (controls.pointerSpeed ?? 1);
    euler.x = Math.max(-1.5, Math.min(1.5, euler.x));
    cam.quaternion.setFromEuler(euler);
  };
  window.addEventListener('mousemove', onMove);
  tryLock();
  return { tryLock, dispose: () => window.removeEventListener('mousemove', onMove) };
}
