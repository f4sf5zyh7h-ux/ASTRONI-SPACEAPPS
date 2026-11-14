// Writes MODEL_SPECS.md: exact dimensions for every part, generated from parts.json.
// Run: node scripts/model-specs.mjs
import { writeFileSync } from 'node:fs';
import data from '../src/data/parts.json' with { type: 'json' };

const D = { S: 1.25, M: 2.5, L: 3.75 };
function dia(p) {
  if (p.radial) return 'side-mounted';
  const top = p.sizeTop && D[p.sizeTop];
  const bottom = p.sizeBottom && D[p.sizeBottom];
  if (top && bottom && top !== bottom) return `${top} m top, ${bottom} m bottom`;
  if (!top) return `${bottom} m bottom, pointed top`;
  return `${top ?? bottom} m`;
}

const rows = data.parts.map((p) => `| \`${p.id}.glb\` | ${p.name} | ${dia(p)} | ${p.height} m | ${p.lockedUntil ? `later (Mission ${p.lockedUntil})` : 'Mission 1'} |`);

const md = `# Model specs

Generated from \`src/data/parts.json\` by \`node scripts/model-specs.mjs\`. Don't edit by hand.

## Export rules (all models)

- Format: **glTF Binary (.glb)**. In Blender: File → Export → glTF 2.0, format "glTF Binary".
- **+Y up**, **1 unit = 1 metre**, apply all transforms before export.
- **Origin = centre of the bottom connection ring** (stack parts). The part grows upward from there.
- **Side-mounted parts:** origin at the point that touches the rocket's hull, centred vertically, pointing out along **+X**.
- Keep it low-poly: aim for **under 5,000 triangles** per part.
- Name the file exactly as in the first column and drop it into \`public/models/\`. The game picks it up automatically; parts without a model use simple shapes.
- The game reads sizes from parts.json, not from the model, so match the sizes below.

## Parts

| File | Part | Diameter | Height | Needed for |
|---|---|---|---|---|
${rows.join('\n')}

Notes:
- **Engine mount:** the game draws the engines under the mount itself (the engine count changes per design), so model the mount plate only.
- **Engines:** height includes the nozzle (bell). The bell's widest point should be no wider than the diameter.

## Scene models (not parts)

| File | What | Notes |
|---|---|---|
| \`aurora-7.glb\` | The damaged satellite | **Top priority.** Named objects: \`bus\`, \`array_intact\`, \`array_broken\`; empties \`hotspot_bolt_1\`…\`hotspot_bolt_4\`, \`hotspot_cable\`, \`hotspot_mount\`, \`hotspot_data\` (the data module). Rough size: 2 × 2 × 3 m body, solar arrays about 2.5 × 8 m. |
| \`replacement-panel.glb\` | New solar panel (folded) | Must fit inside the 2.5 m cargo module. |
| \`data-module.glb\` | Data module the astronaut carries home | Shoebox-to-suitcase size. |
| \`launch-pad.glb\` | Pad + service tower with stairs | Tower about 70 m tall. Include a walkway at capsule-hatch height (about 62 m above the pad). |
| \`capsule-interior.glb\` | Inside the capsule | 2 seats, control pad (screen) in front of the seats, window, hatch. |
| \`debris-fragment.glb\` | The piece of debris that hits the satellite | Fist-to-football size, jagged. |
| \`moon.glb\` / \`dead-satellite.glb\` | Mission 2 and 3 objects on the mission-select screen | Optional; simple shapes are fine. |
`;

writeFileSync(new URL('../MODEL_SPECS.md', import.meta.url), md);
console.log('MODEL_SPECS.md written');
