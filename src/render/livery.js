import * as THREE from 'three';

// Paint scheme for the part models. The Fusion exports use one default "SteelSatin" metal for
// almost everything, which reads as an all-silver rocket. Here each part gets real-looking
// finishes: white paint on structure, black interstages, dark heat-tinted engines, ablative
// heat shield, a cream-and-navy cabin. Special materials (glass, solar cells, LEDs, foam,
// yellow/red paint) are left as modelled. One shared material per finish (performance).

const finish = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const PAINT = {
  white: finish(0xf1f2f0, 0.42, 0.02),
  offWhite: finish(0xe6e4dc, 0.55, 0.02),
  black: finish(0x1c1e22, 0.55, 0.1),
  carbon: finish(0x26282d, 0.38, 0.25),
  charcoal: finish(0x34373d, 0.6, 0.15),
  engine: finish(0x3b3e44, 0.38, 0.8),
  nozzleHot: finish(0x4a3a30, 0.45, 0.75), // heat-tinted niobium bell
  copper: finish(0xa8643a, 0.35, 0.85),
  ablative: finish(0x3a2c22, 0.92, 0.0),
  chuteCan: finish(0xd8d5cc, 0.6, 0.05),
  steel: finish(0xb8bcc2, 0.3, 0.85),
  navy: finish(0x1f3358, 0.85, 0.0),
  cabin: finish(0xe9e3d3, 0.75, 0.0),
  panelDark: finish(0x22262c, 0.5, 0.2),
  locker: finish(0xc7ccd2, 0.6, 0.1),
};

// What replaces the default metal, per part id prefix. First match wins.
const RULES = [
  [/^capsule/, 'white'],
  [/^(cargo-module|hab-module|airlock)/, 'white'],
  [/^heat-shield/, 'ablative'],
  [/^parachutes/, 'chuteCan'],
  [/^docking-port/, 'steel'],
  [/^(tank-|casing-)/, 'white'],
  [/^interstage/, 'carbon'],
  [/^skirt/, 'charcoal'],
  [/^decoupler/, 'black'],
  [/^adapter/, 'white'],
  [/^(nose|fairing)/, 'white'],
  [/^engine-m-vacuum|engine-s-hydrolox/, 'nozzleHot'],
  [/^engine/, 'engine'],
  [/^srb/, 'white'],
  [/^thrust-plate/, 'engine'],
  [/^fin-grid/, 'steel'],
  [/^fin/, 'charcoal'],
  [/^rcs/, 'offWhite'],
  [/^(battery|spare-battery)/, 'charcoal'],
  [/^antenna/, 'offWhite'],
  [/^debris-shield/, 'offWhite'],
];

// Capsule interior pieces (node names in capsule-*.glb) get their own finishes.
const CABIN_NODES = [
  [/^seat/, 'navy'],
  [/^(control-panel|panel-bracket)/, 'panelDark'],
  [/^lockers/, 'locker'],
  [/^hatch/, 'white'],
];

const isDefaultMetal = (m) => /SteelSatin|AluminumSatin|AluminumBeadBlasted/.test(m?.name ?? '');

/** Repaint a part model in place. `modelId` is the GLB file name (e.g. "engine-m-booster"). */
export function applyLivery(model, modelId) {
  const rule = RULES.find(([re]) => re.test(modelId));
  if (!rule) return model;
  const base = PAINT[rule[1]];
  const isCapsule = /^capsule/.test(modelId);
  model.traverse((o) => {
    if (!o.isMesh) return;
    // Inner tanks keep their bare aluminium; only default metal is repainted.
    if (!isDefaultMetal(o.material)) return;
    let paint = base;
    if (isCapsule) {
      const name = nameChain(o);
      const hit = CABIN_NODES.find(([re]) => name.some((n) => re.test(n)));
      if (hit) paint = PAINT[hit[1]];
    }
    o.material = paint;
  });
  return model;
}

/** Names of the mesh and its parents (interior pieces are often a child mesh of a named node). */
function nameChain(o) {
  const names = [];
  for (let p = o; p; p = p.parent) if (p.name) names.push(p.name);
  return names;
}
