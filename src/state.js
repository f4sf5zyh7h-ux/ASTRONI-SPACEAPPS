/**
 * Game state shared between scenes: current design, loadout, mission progress.
 * Filled in from Phase 3 (workshop) onwards.
 */
export const state = {
  missionId: 'mission-1',
  design: null,
  loadout: [],
  approach: 'standard',
  physics: 'arcade', // 'arcade' (boosted fuel + boosters) or 'real' (see data/physicsMode.js)
};
