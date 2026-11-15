import * as THREE from 'three';
import { DIAMETER } from '../data/catalog.js';
import { radialSlots, sizesOf } from '../physics/rocket.js';
import { createPartMesh, stackHeight, hangBelow } from './partMesh.js';

/** Angle of side slot s (8 slots around the hull; slot 0 at 45°, matching the old ×4 layout). */
export const slotAngle = (s) => (s * Math.PI) / 4 + Math.PI / 4;

/**
 * How much of a part's top is open for the engines of the stage above to sit in: the whole of an
 * interstage/skirt, or the empty top of a hollow casing (its interior minus what's packed inside).
 */
export function openTop(entry, parts) {
  const p = entry && parts.get(entry.part);
  if (!p) return 0;
  if (p.sleeve) return p.height;
  if (p.interior) {
    const used = (entry.inside ?? []).reduce((t, c) => t + (parts.get(c.part)?.height ?? 0), 0);
    return Math.max(0, p.interior.height - used);
  }
  return 0;
}

/**
 * Room for the engines of stack entry i to hang into: decoupler rings are hollow, so the engines
 * pass straight through them into the open top of the casing (or interstage) underneath.
 */
export function roomBelow(design, i, parts) {
  let room = 0;
  for (let k = i + 1; k < design.stack.length; k++) {
    const e = design.stack[k];
    const p = parts.get(e.part);
    if (p?.role === 'decoupler' && !p.sleeve && !p.interior) { room += p.height; continue; }
    return room + openTop(e, parts);
  }
  return room;
}

/**
 * Assemble a design (stack listed top → bottom) into one Three.js group,
 * standing on y = 0. Each stack entry's object has userData.index = its stack index.
 */
export function buildRocket(design, parts) {
  const group = new THREE.Group();
  const objects = [];
  // The bottom stage's engines hang below it: lift the whole rocket so they clear the ground.
  let y = design.stack.length ? hangBelow(design.stack[design.stack.length - 1], parts) : 0;

  for (let i = design.stack.length - 1; i >= 0; i--) {
    const entry = design.stack[i];
    const part = parts.get(entry.part);
    const h = stackHeight(part, entry, parts);

    // Engines hanging out of a casing sit inside the open top of what's below (interstage, skirt
    // or a hollow casing's free space); whatever doesn't fit becomes a gap.
    const hang = i < design.stack.length - 1 ? hangBelow(entry, parts) : 0;
    if (hang > 0) y += Math.max(0, hang - roomBelow(design, i, parts));

    // The heat shield's domed underside nests down into the ring below it (no floating gap).
    if (part.role === 'heat-shield' && i < design.stack.length - 1) y -= Math.min(0.3, part.height * 0.7);

    const obj = createPartMesh(part, entry, parts);
    if (entry.flip) {
      // Upside-down adapter: rotate about its middle so it still spans y … y + h.
      const pivot = new THREE.Group();
      obj.rotation.x = Math.PI;
      obj.position.y = h;
      pivot.add(obj);
      pivot.position.y = y;
      pivot.userData.index = i;
      group.add(pivot);
      objects[i] = pivot;
    } else {
      obj.position.y = y;
      obj.userData.index = i;
      group.add(obj);
      objects[i] = obj;
    }

    const sz = sizesOf(entry, part);
    const hullR = Math.max(DIAMETER[sz.top] ?? 0, DIAMETER[sz.bottom] ?? 0) / 2;
    const layout = radialSlots(entry.radial, parts);
    (entry.radial ?? []).forEach((r, gi) => {
      const rp = parts.get(r.part);
      // Side nodes sit at mid-height (CLAUDE.md §3); fins go low on the tank for stability.
      const ry = rp.role === 'fin' ? y + rp.height / 2 + 0.3 : y + h / 2;
      const slots = layout?.[gi]?.slots ?? Array.from({ length: r.count }, (_, k) => (k * 8) / r.count);
      for (const s of slots) {
        const a = slotAngle(s);
        const ro = createPartMesh(rp, null, parts);
        ro.rotation.y = a;
        ro.position.set(Math.cos(a) * hullR, ry, -Math.sin(a) * hullR);
        ro.userData.index = i;
        ro.userData.radial = r.part; // so the workshop can remove this side part
        ro.userData.group = gi;
        group.add(ro);
      }
    });
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
    const sz = sizesOf(entry, p);
    const rB = (DIAMETER[sz.bottom] ?? DIAMETER[sz.top] ?? 0) / 2;
    const rT = (DIAMETER[sz.top] ?? 0) / 2;
    return rB + (rT - rB) * Math.min(1, (y - y0) / p.height);
  }
  return 0;
}
