// Adds the casing + internals parts (human-modelled 2026-11-14) to parts.json and marks the old
// all-in-one tanks / engine mount as legacy (hidden from the catalogue, kept for old saves/tests).
// Safe to re-run: existing ids are replaced. Run: node scripts/add-casing-parts.mjs
//
// Sizing (CLAUDE.md §3 tank rule): propellant = interior volume × fill 0.95 × bulk density
// (kerolox 1000 kg/m³, hydrolox 360 kg/m³). Inner-tank dry mass = 2.5 % of propellant (thin walls:
// the casing carries the structural loads).
// Casing shell mass ≈ 50 kg per m² of (diameter × height). Representative values.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/data/parts.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));

const D = { S: 1.25, M: 2.5, L: 3.75 };
const INNER = { S: 1.15, M: 2.4, L: 3.65 }; // usable inside diameter of a casing
const r1 = (x) => Math.round(x * 10) / 10;

const casings = [];
for (const [size, lens] of Object.entries({ S: [['short', 2.0], ['med', 3.5], ['long', 6.0]], M: [['short', 3.2], ['med', 5.5], ['long', 7.9]], L: [['short', 5.0], ['med', 10.2], ['long', 14.0]] })) {
  for (const [len, h] of lens) {
    const area = D[size] * h;
    casings.push({
      id: `casing-${size.toLowerCase()}-${len}`, model: `tank-${size.toLowerCase()}-${len}`,
      name: `Casing ${size} (${len})`, category: 'casings', sizeTop: size, sizeBottom: size, height: h,
      mass: Math.round(area * 50), cost: Math.max(1, Math.round(area / 10)), interior: { size, height: h },
    });
  }
}

const tank = (size, len, h, fuel = 'kerolox', density = 1000) => {
  const prop = Math.round((Math.PI * (INNER[size] / 2) ** 2 * h * 0.95 * density) / 10) * 10;
  return {
    id: fuel === 'kerolox' ? `inner-tank-${size.toLowerCase()}-${len}` : `inner-tank-h2-${size.toLowerCase()}`,
    name: fuel === 'kerolox' ? `Fuel tank ${size} (${len})` : `Hydrogen tank ${size}`,
    category: 'internals', size, height: h, fuel, propellant: prop,
    mass: Math.round(prop * (fuel === 'kerolox' ? 0.025 : 0.18)), cost: Math.max(1, Math.round(prop / 40000)),
  };
};
const internals = [
  tank('S', 'short', 1.5), tank('S', 'long', 3.0),
  tank('M', 'short', 2.5), tank('M', 'long', 5.0),
  tank('L', 'short', 4.0), tank('L', 'long', 8.0),
  { ...tank('M', 'h2', 4.0, 'hydrolox', 360), cost: 6, lockedUntil: 2 },
  { id: 'inner-tank-rcs', name: 'RCS fuel sphere', category: 'internals', size: 'S', height: 0.86, mass: 40, monoprop: 300, cost: 2, role: 'rcs-tank' },
  { id: 'rack-m', name: 'Avionics + battery rack M', category: 'internals', size: 'M', height: 0.6, mass: 300, cost: 3, role: 'battery' },
  { id: 'rack-l', name: 'Avionics + battery rack L', category: 'internals', size: 'L', height: 0.8, mass: 450, cost: 4, role: 'battery' },
  { id: 'thrust-plate-s', name: 'Thrust plate S (1 engine)', category: 'internals', size: 'S', height: 0.19, mass: 150, cost: 1, role: 'thrust-plate', engineCapacity: 1 },
  { id: 'thrust-plate-m', name: 'Thrust plate M (3 engines)', category: 'internals', size: 'M', height: 0.28, mass: 400, cost: 2, role: 'thrust-plate', engineCapacity: 3 },
  { id: 'thrust-plate-l', name: 'Thrust plate L (9 engines)', category: 'internals', size: 'L', height: 0.35, mass: 900, cost: 2, role: 'thrust-plate', engineCapacity: 9 },
];
const structure = [
  { id: 'interstage-s', name: 'Interstage S', category: 'structure', sizeTop: 'S', sizeBottom: 'S', height: 1.5, mass: 150, cost: 2, role: 'decoupler', sleeve: true },
  { id: 'interstage-m', name: 'Interstage M', category: 'structure', sizeTop: 'M', sizeBottom: 'M', height: 3.6, mass: 400, cost: 2, role: 'decoupler', sleeve: true },
  { id: 'interstage-l', name: 'Interstage L', category: 'structure', sizeTop: 'L', sizeBottom: 'L', height: 4.0, mass: 700, cost: 2, role: 'decoupler', sleeve: true },
  { id: 'skirt-m', name: 'Engine skirt M', category: 'structure', sizeTop: 'M', sizeBottom: 'M', height: 2.0, mass: 300, cost: 1, sleeve: true },
  { id: 'skirt-l', name: 'Engine skirt L', category: 'structure', sizeTop: 'L', sizeBottom: 'L', height: 2.8, mass: 500, cost: 1, sleeve: true },
];

const added = [...casings, ...internals, ...structure];
const ids = new Set(added.map((p) => p.id));
data.parts = data.parts.filter((p) => !ids.has(p.id));
for (const p of data.parts) {
  if (['tank-s', 'tank-m-short', 'tank-m-long', 'tank-l', 'tank-m-hydrolox', 'engine-mount-L'].includes(p.id)) p.legacy = true;
}
data.parts.push(...added);

// Keep the one-part-per-line layout so diffs stay readable.
const lines = data.parts.map((p) => '    ' + JSON.stringify(p).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }'));
const items = data.items.map((p) => '    ' + JSON.stringify(p).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }'));
const out = `{\n  "_note": ${JSON.stringify(data._note)},\n  "parts": [\n${lines.join(',\n')}\n  ],\n  "items": [\n${items.join(',\n')}\n  ]\n}\n`;
JSON.parse(out);
writeFileSync(file, out);
console.log(`added ${added.length} parts`);
for (const p of internals) if (p.propellant) console.log(`  ${p.id}: ${r1(p.propellant / 1000)} t ${p.fuel}, dry ${p.mass} kg`);
for (const p of casings) console.log(`  ${p.id}: shell ${p.mass} kg, $${p.cost}M`);
