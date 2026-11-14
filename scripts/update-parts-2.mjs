// Parts update 2 (human feedback 2026-11-14): fixed engine counts per thrust plate (S 1, M 3, L 5),
// solid boosters unlocked (+ a small one), a small kerolox engine for clusters, nose cones and
// fairings in S and L. Safe to re-run. Run: node scripts/update-parts-2.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/data/parts.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(data.parts.map((p) => [p.id, p]));

byId.get('thrust-plate-l').engineCapacity = 5;
byId.get('thrust-plate-l').name = 'Thrust plate L (5 engines)';
delete byId.get('srb').lockedUntil;
byId.get('srb').name = 'Solid Booster (large)';

// Representative values. Small solid booster: 0.625 m × 6 m, ~1.7 t of solid propellant
// (volume × 1,800 kg/m³ × 0.85 fill). Small kerolox engine: about a quarter of a booster.
const add = [
  { id: 'srb-xs', model: 'srb-xs', name: 'Solid Booster (small)', category: 'engines', radial: true, height: 6.0, diameter: 0.625, mass: 400, propellant: 1700, cost: 2, fuel: 'solid', thrustSL: 160000, thrustVac: 172000, ispSL: 245, ispVac: 265 },
  { id: 'engine-s', model: 'engine-s', name: 'Small Engine', category: 'engines', sizeTop: 'S', sizeBottom: 'S', height: 1.4, mass: 180, cost: 3, fuel: 'kerolox', thrustSL: 190000, thrustVac: 215000, ispSL: 285, ispVac: 330 },
  { id: 'nose-cone-s', model: 'nose-ogive-s', name: 'Nose Cone S', category: 'structure', sizeTop: null, sizeBottom: 'S', height: 1.25, mass: 100, cost: 1 },
  { id: 'nose-cone-l', model: 'nose-ogive-l', name: 'Nose Cone L', category: 'structure', sizeTop: null, sizeBottom: 'L', height: 3.75, mass: 600, cost: 2 },
  { id: 'fairing-s', model: 'fairing-s', name: 'Fairing S', category: 'structure', sizeTop: null, sizeBottom: 'S', height: 2.5, mass: 400, cost: 2, role: 'fairing' },
  { id: 'fairing-l', name: 'Fairing L', category: 'structure', sizeTop: null, sizeBottom: 'L', height: 6.0, mass: 2000, cost: 6, role: 'fairing' },
];
const ids = new Set(add.map((p) => p.id));
data.parts = data.parts.filter((p) => !ids.has(p.id)).concat(add);
byId.get('nose-cone').name = 'Nose Cone M';
byId.get('fairing-M').name = 'Fairing M';

const fmt = (p) => '    ' + JSON.stringify(p).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }');
const out = `{\n  "_note": ${JSON.stringify(data._note)},\n  "parts": [\n${data.parts.map(fmt).join(',\n')}\n  ],\n  "items": [\n${data.items.map(fmt).join(',\n')}\n  ]\n}\n`;
JSON.parse(out);
writeFileSync(file, out);
console.log('parts updated:', data.parts.length);
