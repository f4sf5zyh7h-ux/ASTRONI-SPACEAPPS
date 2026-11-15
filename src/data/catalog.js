// Shared, ready-to-use part catalogue for the game (not used by the pure physics tests).
import partsData from './parts.json' with { type: 'json' };
import { indexParts } from '../physics/rocket.js';
import { arcadePatch } from './physicsMode.js';
import { casingDesign, compactDesign } from './designs.js';
import { state } from '../state.js';

export const parts = indexParts(partsData);
export const partList = partsData.parts;
export const itemList = partsData.items; // cargo for the storage slots

/** Standard diameters in metres (CLAUDE.md §3). */
export const DIAMETER = { S: 1.25, M: 2.5, L: 3.75 };

/** Mission 1 lock check: parts with lockedUntil > current mission are greyed out. */
export const isLocked = (part, missionNumber = 1) => (part.lockedUntil ?? 0) > missionNumber;

// Physics mode: the part objects are shared by `parts` and `partList`, so patch them in place.
const REAL = new Map(partsData.parts.map((p) => [p.id, { ...p }]));
/** Switch between 'arcade' (boosted fuel and boosters) and 'real' values. */
export function setPhysicsMode(mode) {
  for (const p of partsData.parts) {
    const real = REAL.get(p.id);
    Object.assign(p, real, mode === 'arcade' ? arcadePatch(real) : {});
  }
  state.physics = mode;
}
setPhysicsMode(state.physics);

/** The real value of a part (for "boosted from …" labels). */
export const realPart = (id) => REAL.get(id);

/** The working example rocket for the current physics mode. */
export const exampleDesign = () => (state.physics === 'real' ? casingDesign() : compactDesign());
