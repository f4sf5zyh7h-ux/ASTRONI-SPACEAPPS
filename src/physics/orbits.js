// Orbital mechanics for circular Earth orbits. Pure JS, no Three.js.
// Constants come from the NASA Earth Fact Sheet (see src/data/nasa/earth.json).
import earth from '../data/nasa/earth.json' with { type: 'json' };

export const MU_EARTH = earth.GM_km3_s2 * 1e9; // km³/s² → m³/s²
export const R_EARTH = earth.volumetricMeanRadius_km * 1000; // mean radius, m

/** Orbital radius (from Earth's centre) for an altitude above the surface, in metres. */
export const radiusAt = (altitude) => R_EARTH + altitude;

/** Speed of a circular orbit: v = √(μ / r). */
export function circularVelocity(r) {
  return Math.sqrt(MU_EARTH / r);
}

/** Vis-viva equation: speed at radius r on an orbit with semi-major axis a. v = √(μ(2/r − 1/a)). */
export function visViva(r, a) {
  return Math.sqrt(MU_EARTH * (2 / r - 1 / a));
}

/**
 * Hohmann transfer between two circular orbits (radii r1 → r2).
 * Burn 1 raises the far side of the orbit to r2; burn 2 circularises there.
 */
export function hohmann(r1, r2) {
  const a = (r1 + r2) / 2;
  const dv1 = Math.abs(visViva(r1, a) - circularVelocity(r1));
  const dv2 = Math.abs(circularVelocity(r2) - visViva(r2, a));
  // Transfer takes half an ellipse: T/2 = π√(a³/μ).
  const time = Math.PI * Math.sqrt(a ** 3 / MU_EARTH);
  return { dv1, dv2, total: dv1 + dv2, time };
}

/**
 * De-orbit burn: slow down at circular radius r so the lowest point of the
 * new orbit (perigee) dips to rPerigee, deep enough for the air to finish the job.
 */
export function deorbitBurn(r, rPerigee) {
  const a = (r + rPerigee) / 2;
  return circularVelocity(r) - visViva(r, a);
}
