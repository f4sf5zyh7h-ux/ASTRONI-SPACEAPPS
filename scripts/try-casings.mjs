// Quick balancing check for casing-based designs. Run: node scripts/try-casings.mjs ['{"firstN":2}']
import data from '../src/data/parts.json' with { type: 'json' };
import missions from '../src/data/missions.json' with { type: 'json' };
import { indexParts, analyzeDesign } from '../src/physics/rocket.js';
import { simulateMission } from '../src/physics/mission.js';
import { casingDesign } from '../src/data/designs.js';

const parts = indexParts(data);
const mission = missions.missions[0];
const show = (label, opts) => {
  const d = casingDesign(opts);
  const a = analyzeDesign(d, parts);
  const res = Object.fromEntries(['standard', 'fast'].map((id) => {
    const s = simulateMission(d, parts, mission, id);
    return [id, s.success ? `+${Math.round(s.spareDv)}` : `x ${s.failedAt}`];
  }));
  console.log(label.padEnd(30), `dv ${(a.totalDv / 1000).toFixed(2)}`, `$${Math.round(a.cost)}M`, `${(a.totalMass / 1000).toFixed(0)} t`,
    `TWR ${a.stages[0].twr.toFixed(2)}`, JSON.stringify(res), a.errors.length ? a.errors : '');
};
const opt = JSON.parse(process.argv[2] ?? '{}');
show('default', opt);
show('srb x2', { ...opt, srbs: { part: 'srb', count: 2 } });
show('no top-up', { ...opt, topUp: null });
show('first 2', { ...opt, firstN: 2 });
show('first 2 no topup', { ...opt, firstN: 2, topUp: null });
show('upper vacuum', { ...opt, upperEngine: 'engine-vacuum' });
