import * as THREE from 'three';
import { DIAMETER } from '../data/catalog.js';
import { createPartMesh, stackHeight } from './partMesh.js';

/**
 * Assemble a design (stack listed top → bottom) into one Three.js group,
 * standing on y = 0. Each stack entry's object has userData.index = its stack index.
 */
export function buildRocket(design, parts) {
  const group = new THREE.Group();
  const objects = [];
  let y = 0;

  for (let i = design.stack.length - 1; i >= 0; i--) {
    const entry = design.stack[i];
    const part = parts.get(entry.part);
    const h = stackHeight(part, entry, parts);

    const obj = createPartMesh(part, entry, parts);
    obj.position.y = y;
    obj.userData.index = i;
    group.add(obj);
    objects[i] = obj;

    const hullR = Math.max(DIAMETER[part.sizeTop] ?? 0, DIAMETER[part.sizeBottom] ?? 0) / 2;
    for (const r of entry.radial ?? []) {
      const rp = parts.get(r.part);
      // Side nodes sit at mid-height (CLAUDE.md §3); fins go low on the tank for stability.
      const ry = rp.role === 'fin' ? y + rp.height / 2 + 0.3 : y + h / 2;
      for (let k = 0; k < r.count; k++) {
        const a = (k / r.count) * Math.PI * 2 + Math.PI / 4;
        const ro = createPartMesh(rp, null, parts);
        ro.rotation.y = a;
        ro.position.set(Math.cos(a) * hullR, ry, -Math.sin(a) * hullR);
        ro.userData.index = i;
        ro.userData.radial = r.part; // so the workshop can remove this side part
        group.add(ro);
      }
    }
    y += h;
  }

  return { group, objects, height: y };
}

/**
 * Hull radius of a built rocket at height y (rocket-local, metres), 0 outside it.
 * Tapered parts (capsule, adapters) are interpolated between their bottom and top sizes.
 */
export function hullRadiusAt(design, parts, rocket, y) {
  for (let i = 0; i < design.stack.length; i++) {
    const entry = design.stack[i];
    const p = parts.get(entry.part);
    const y0 = rocket.objects[i].position.y;
    const h = stackHeight(p, entry, parts);
    if (y < y0 || y > y0 + h) continue;
    const rB = (DIAMETER[p.sizeBottom] ?? DIAMETER[p.sizeTop] ?? 0) / 2;
    const rT = (DIAMETER[p.sizeTop] ?? 0) / 2;
    return rB + (rT - rB) * Math.min(1, (y - y0) / p.height);
  }
  return 0;
}
