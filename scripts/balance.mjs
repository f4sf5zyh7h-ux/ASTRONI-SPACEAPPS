// Balancing report: how reference designs fare on each Mission 1 approach.
// Run: node scripts/balance.mjs
import partsData from '../src/data/parts.json' with { type: 'json' };
import missionsData from '../src/data/missions.json' with { type: 'json' };
import { indexParts, analyzeDesign } from '../src/physics/rocket.js';
import { simulateMission, missionLegs } from '../src/physics/mission.js';
import { referenceDesign, naiveSingleStage } from '../src/data/designs.js';

const mission = missionsData.missions[0];

/** Parts lookup with some stats overridden, e.g. { 'tank-l': { mass: 5000 } }. */
function partsWith(overrides = {}) {
  const data = structuredClone(partsData);
  for (const p of data.parts) Object.assign(p, overrides[p.id] ?? {});
  return indexParts(data);
}

function row(label, design, parts) {
  const a = analyzeDesign(design, parts);
  const res = Object.fromEntries(
    mission.approaches.map((ap) => {
      const r = simulateMission(design, parts, mission, ap.id);
      if (r.success) return [ap.id, `OK +${r.spareDv.toFixed(0)} m/s`];
      const short = r.legs.at(-1)?.shortfall;
      return [ap.id, `FAIL ${r.failedAt}${short ? ` −${short.toFixed(0)}` : ''}`];
    }),
  );
  console.log(
    label.padEnd(34),
    `${(a.totalDv / 1000).toFixed(2)} km/s`.padEnd(11),
    `$${a.cost}M`.padEnd(7),
    `${(a.totalMass / 1000).toFixed(0)} t`.padEnd(7),
    `TWR ${a.stages[0].twr.toFixed(2)}`.padEnd(10),
    `stage Δv ${a.stages.map((s) => (s.dv / 1000).toFixed(2)).join(' / ')}`.padEnd(30),
    `std ${res.standard}`.padEnd(20),
    `fast ${res.fast}`.padEnd(20),
    `pat ${res.patient}`,
  );
  if (a.errors.length) console.log('   errors:', a.errors.join('; '));
}

const legs = missionLegs(mission, 'standard');
const fast = missionLegs(mission, 'fast');
console.log('Mission legs (m/s):', Object.fromEntries(Object.entries(legs).map(([k, v]) => [k, Math.round(v)])), '| fast transfer', fast.transfer);
console.log('Needed main-engine Δv: standard', Math.round(legs.launch + legs.transfer + legs.deorbit), '| fast', Math.round(fast.launch + fast.transfer + fast.deorbit));
console.log();

const sets = {
  'CURRENT parts.json': {},
  'PROPOSED': JSON.parse(process.argv[2] ?? '{}'),
};
for (const [name, overrides] of Object.entries(sets)) {
  console.log(`== ${name} ${JSON.stringify(overrides)}`);
  const parts = partsWith(overrides);
  row("doc ref (3 tanks, 8 engines)", referenceDesign({ tanks: 3, engines: 8 }), parts);
  row('3 tanks, 9 engines', referenceDesign({ tanks: 3, engines: 9 }), parts);
  row('4 tanks, 9 engines', referenceDesign({ tanks: 4, engines: 9 }), parts);
  row('naive single stage (4 tanks)', naiveSingleStage(), parts);
  console.log();
}
