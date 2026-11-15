// Leg-by-leg mission simulation. Each burn spends propellant from the lowest
// stage that still has fuel, using the ship's mass at that moment; empty stages drop.
// Pure JS, no Three.js.
import { G0, analyzeDesign } from './rocket.js';
import { radiusAt, hohmann, deorbitBurn } from './orbits.js';

/** Δv each leg needs for this mission and approach choice, in m/s. */
export function missionLegs(mission, approachId) {
  const approach = mission.approaches.find((a) => a.id === approachId);
  const r1 = radiusAt(mission.parkingAltitude);
  const r2 = radiusAt(mission.targetAltitude);
  const transfer = approach.transferDv ?? hohmann(r1, r2).total;
  const deorbit = deorbitBurn(r2, radiusAt(mission.deorbitPerigeeAltitude));
  return { launch: mission.launchDv, transfer, rendezvous: mission.rendezvousDv, deorbit };
}

/**
 * Fly the mission with physics only (no player decisions or random events yet).
 * Returns each leg's need vs what the ship delivered, and the first failure.
 */
export function simulateMission(design, parts, mission, approachId) {
  const report = analyzeDesign(design, parts);
  const need = missionLegs(mission, approachId);
  const legs = [];
  const result = { report, need, legs, failedAt: null, success: false };

  // Live ship state: stages bottom → top with fuel remaining.
  const stages = report.sections.map((s, i) => ({ ...s, fuel: s.propellant, rcsFuel: s.monoprop, first: i === 0 }));
  let cargo = report.cargoMass;
  const mass = () => stages.reduce((t, s) => t + s.dry + s.fuel + s.rcsFuel, 0) + cargo;

  const fail = (id, reason) => { result.failedAt = id; result.reason = reason; return result; };

  /** Burn main engines for `dv` m/s. Returns the Δv that could NOT be delivered. */
  const burn = (dv, atLaunch) => {
    let left = dv;
    while (left > 1e-6) {
      const s = stages.find((st) => st.fuel > 0 && st.engines.length);
      if (!s) return left;
      const isp = atLaunch && s.first ? s.ispLaunch : s.ispVac;
      if (!(isp > 0)) return left;
      const m = mass();
      const avail = isp * G0 * Math.log(m / (m - s.fuel));
      if (avail >= left) {
        // Propellant for exactly `left`: m · (1 − e^(−Δv / (Isp·g0))).
        s.fuel -= m * (1 - Math.exp(-left / (isp * G0)));
        left = 0;
      } else {
        s.fuel = 0;
        left -= avail;
        // Drop the empty stage if something sits above it to separate from.
        if (stages.indexOf(s) < stages.length - 1) stages.splice(0, stages.indexOf(s) + 1);
      }
    }
    return 0;
  };

  const leg = (id, required, shortfall, note) => {
    legs.push({ id, required, delivered: required - shortfall, shortfall, ok: shortfall <= 1e-6, note });
    return shortfall <= 1e-6;
  };

  // 1. Launch: must clear the tower, then reach the parking orbit.
  const first = report.stages[0];
  if (!report.checks.liftoff) {
    leg('launch', need.launch, need.launch, 'Thrust-to-weight below 1.2 at liftoff');
    return fail('launch', `Thrust-to-weight is ${first?.twr.toFixed(2) ?? 0} — the rocket needs at least 1.2 to climb away from the tower.`);
  }
  const launchNeed = need.launch * (report.checks.fins ? 1 : 1 + mission.finWobblePenalty);
  const fuelledStages = report.stages.filter((s) => s.dv > 0).length;
  if (!leg('launch', launchNeed, burn(launchNeed, true))) {
    const got = (legs[legs.length - 1].delivered / 1000).toFixed(2);
    const needKm = (launchNeed / 1000).toFixed(2);
    // Name the real cause first: fuel that can't be burned, or engines that can't fire, before "add a stage".
    const stuck = report.sections.reduce((t, s) => t + (s.unusable ?? 0), 0);
    const tip = report.stages[0]?.section.vacuumOnly
      ? ' Your bottom engines are vacuum engines, which can\'t fire in thick air. Use Booster engines at the bottom and keep the vacuum engine for the upper stage.'
      : stuck > 0
        ? ` ${(stuck / 1000).toFixed(1)} t of your fuel sits in a section with no engines, so it is dead weight. Drag an engine set under that casing to turn it into a real stage.`
        : fuelledStages < 2
          ? ' A single stage can never get there: more fuel also means more weight to lift. Add a second stage on top (interstage + casing with its own engines).'
          : ' Add fuel to the lower stage, or make the upper part of the rocket lighter.';
    return fail('launch', `Ran out of fuel before reaching orbit: launch needs ${needKm} km/s, your rocket had ${got} km/s.${tip}`);
  }

  // 2. Transfer up to the satellite's orbit.
  if (!leg('transfer', need.transfer, burn(need.transfer, false))) return fail('transfer', 'Ran out of fuel on the way up to AURORA-7.');

  // 3. Rendezvous on RCS monoprop (separate pool, Isp from the thrusters).
  const rcsIsp = 230;
  const mono = stages.reduce((t, s) => t + s.rcsFuel, 0);
  const m = mass();
  const rcsAvail = mono > 0 ? rcsIsp * G0 * Math.log(m / (m - mono)) : 0;
  const rcsShort = Math.max(0, need.rendezvous - rcsAvail);
  const used = mono > 0 ? m * (1 - Math.exp(-Math.min(need.rendezvous, rcsAvail) / (rcsIsp * G0))) : 0;
  let take = used;
  for (const s of stages) { const d = Math.min(s.rcsFuel, take); s.rcsFuel -= d; take -= d; }
  if (!leg('rendezvous', need.rendezvous, rcsShort, mono > 0 ? '' : 'No RCS thrusters')) return fail('rendezvous', 'Not enough RCS fuel to line up with the satellite.');

  // 4. Repair: the new panel leaves the ship, the data module comes aboard.
  cargo += mission.dataModuleMass - mission.panelDelivered;

  // 5. De-orbit burn.
  if (!leg('deorbit', need.deorbit, burn(need.deorbit, false))) return fail('deorbit', 'Not enough fuel left to slow down and come home.');

  // 6. Re-entry and landing need the capsule to separate with its shield and chutes.
  if (!report.checks.capsuleSeparates) return fail('reentry', 'The capsule could not separate from the rocket stage, so the heat shield was blocked.');
  if (!report.checks.heatShield) return fail('reentry', 'No heat shield on the capsule.');
  if (!report.checks.parachutes) return fail('landing', 'No parachutes to slow the capsule for landing.');

  // Spare Δv the ship still had after the de-orbit burn (burn everything that's left).
  const huge = 1e9;
  result.spareDv = huge - burn(huge, false);
  result.success = true;
  return result;
}
