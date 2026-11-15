// Shared, ready-to-use part catalogue for the game (not used by the pure physics tests).
import partsData from './parts.json' with { type: 'json' };
import { indexParts } from '../physics/rocket.js';

export const parts = indexParts(partsData);
export const partList = partsData.parts;
export const itemList = partsData.items; // cargo for the storage slots

/** Standard diameters in metres (CLAUDE.md §3). */
export const DIAMETER = { S: 1.25, M: 2.5, L: 3.75 };

/** Mission 1 lock check: parts with lockedUntil > current mission are greyed out. */
export const isLocked = (part, missionNumber = 1) => (part.lockedUntil ?? 0) > missionNumber;
