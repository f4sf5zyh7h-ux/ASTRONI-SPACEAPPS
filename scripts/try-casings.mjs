// Quick balancing check for casing-based designs. Run: node scripts/try-casings.mjs
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
  const res = Object.fromEntries(['standard', 'fast', 'patient'].map((id) => {
    const s = simulateMission(d, parts, mission, id);
    return [id, s.success ? `+${Math.round(s.spareDv)}` : `x ${s.failedAt}`];
  }));
  console.log(label.padEnd(34), `dv ${(a.totalDv / 1000).toFixed(2)}`, `$${Math.round(a.cost)}M`, `${(a.totalMass / 1000).toFixed(0)} t`,
    `TWR ${a.stages[0].twr.toFixed(2)}`, `h ${a.sections.length}`, JSON.stringify(res), a.errors.length ? a.errors : '');
};

show('default (3 + L-short top-up)', {});
show('no top-up', { topUp: null });
show('top-up M? L-short + rack', { topUp: { part: 'casing-l-short', tanks: ['inner-tank-l-short', 'rack-l'] } });
show('upper long only (L-med)', { upperCasing: 'casing-l-med', upper: ['inner-tank-l-long'] });
show('top-up L-med long', { topUp: { part: 'casing-l-med', tanks: ['inner-tank-l-long'] } });
