// One-off: link parts.json entries to the human's GLB files and match heights to the models.
// Run: node scripts/link-models.mjs   (safe to re-run)
import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('../src/data/parts.json', import.meta.url);
// id: [model file, model height in metres]
const MAP = {
  'capsule-2': ['capsule-2', 3.5], 'cargo-module': ['cargo-module-m', 3.0], 'heat-shield': ['heat-shield-m', 0.4],
  'parachutes': ['parachutes-s', 0.5], 'docking-port': ['docking-port-s', 0.5],
  'engine-booster': ['engine-m-booster', 2.0], 'engine-vacuum': ['engine-m-vacuum', 3.5], 'engine-hydrolox': ['engine-s-hydrolox', 2.5],
  'srb': ['srb-s', 16.0], 'rcs': ['rcs-block', 0.4],
  'tank-s': ['tank-s-med', 3.5], 'tank-m-short': ['tank-m-short', 3.2], 'tank-m-long': ['tank-m-long', 7.9],
  'tank-l': ['tank-l-med', 10.2], 'tank-m-hydrolox': ['tank-m-hydrolox', 6.8],
  'decoupler-S': ['decoupler-s', 0.3], 'decoupler-M': ['decoupler-m', 0.3], 'decoupler-L': ['decoupler-l', 0.4],
  'radial-decoupler': ['decoupler-radial', 0.6], 'adapter-M-S': ['adapter-m-s', 1.0], 'adapter-L-M': ['adapter-l-m', 1.2],
  'fin': ['fin-delta', 2.0], 'nose-cone': ['nose-ogive-m', 2.5], 'fairing-M': ['fairing-m', 4.0],
  'solar-panel': ['solar-panel', 0.3], 'battery': ['battery', 0.6], 'antenna-hg': ['antenna-hg', 1.0], 'robotic-arm': ['robotic-arm', 0.4],
};
let text = readFileSync(file, 'utf8');
for (const [id, [model, h]] of Object.entries(MAP)) {
  const re = new RegExp(`(\{ "id": "${id}",)( "model": "[^"]*",)?([^\n]*?"height": )[0-9.]+`);
  if (!re.test(text)) throw new Error('not found: ' + id);
  text = text.replace(re, `$1 "model": "${model}",$3${h.toFixed(1)}`);
}
JSON.parse(text); // still valid?
writeFileSync(file, text);
console.log('linked', Object.keys(MAP).length, 'parts');
