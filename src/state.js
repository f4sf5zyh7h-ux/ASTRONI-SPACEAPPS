/**
 * Game state shared between scenes: current design, loadout, mission progress.
 * Filled in from Phase 3 (workshop) onwards.
 */
export const state = {
  missionId: 'mission-1',
  design: null,
  loadout: [],
  approach: 'standard',
  flight: null, // this run's events: { seed, log, hours, injury, score, effects } (physics/events.js)
  replaySeed: null, // set by "Fly again (same events)"
  physics: 'arcade', // 'arcade' (boosted fuel + boosters) or 'real' (see data/physicsMode.js)
};
