// Reference designs used by tests and the balancing script.

/** Crew section + upper stage shared by the reference designs (top → bottom). */
export function upperStack() {
  return [
    { part: 'docking-port' },
    { part: 'parachutes' },
    { part: 'capsule-2' },
    { part: 'heat-shield' },
    { part: 'decoupler-M' },
    {
      part: 'cargo-module',
      radial: [
        { part: 'rcs', count: 4 },
        { part: 'solar-panel', count: 2 },
        { part: 'antenna-hg', count: 1 },
        { part: 'battery', count: 1 },
      ],
    },
    { part: 'adapter-L-M' },
    { part: 'tank-l' },
    { part: 'engine-mount-L', engines: { part: 'engine-vacuum', count: 1 } },
  ];
}

export const standardCargo = () => [
  { item: 'replacement-panel', count: 1 },
  { item: 'toolkit', count: 1 },
  { item: 'tether', count: 2 },
];

/** Two-stage reference rocket: upper stage + first stage of `tanks` × tank-l and `engines` boosters. */
export function referenceDesign({ tanks = 4, engines = 9, fins = 4 } = {}) {
  const firstStage = [];
  for (let i = 0; i < tanks; i++) {
    const bottom = i === tanks - 1;
    firstStage.push(bottom && fins ? { part: 'tank-l', radial: [{ part: 'fin', count: fins }] } : { part: 'tank-l' });
  }
  return {
    stack: [
      ...upperStack(),
      { part: 'decoupler-L' },
      ...firstStage,
      { part: 'engine-mount-L', engines: { part: 'engine-booster', count: engines } },
    ],
    cargo: standardCargo(),
  };
}

/**
 * Casing-based rocket (the workshop's "Example"): crew section on top, an upper stage casing
 * with a thrust plate + vacuum engine + inner tanks, an interstage ring the nozzle sits in,
 * first-stage casings (the bottom one has the 9-engine thrust plate and fins), engine skirt.
 */
export function casingDesign({
  upperCasing = 'casing-l-long', upper = ['inner-tank-l-long', 'inner-tank-l-short'],
  firstN = 3, first = ['inner-tank-l-long', 'inner-tank-l-short'], booster = 'engine-booster', fins = 4,
  upperEngine = 'engine-s', srbs = { part: 'srb', count: 4 }, // side boosters on the bottom casing, or null
  topUp = { part: 'casing-l-long', tanks: ['inner-tank-l-long', 'inner-tank-l-short'] }, // extra first-stage fuel, or null
} = {}) {
  const crew = upperStack().filter((e) => !['tank-l', 'engine-mount-L'].includes(e.part));
  const stack = [
    ...crew,
    { part: upperCasing, inside: [{ part: 'thrust-plate-l', engines: { part: upperEngine, count: 5 } }, ...upper.map((part) => ({ part }))] },
    { part: 'interstage-l' },
  ];
  if (topUp) stack.push({ part: topUp.part, inside: topUp.tanks.map((part) => ({ part })) });
  for (let i = 0; i < firstN; i++) {
    const bottom = i === firstN - 1;
    const plate = bottom ? [{ part: 'thrust-plate-l', engines: { part: booster, count: 5 } }] : [];
    stack.push({
      part: 'casing-l-long',
      inside: [...plate, ...first.map((part) => ({ part }))],
      ...(bottom ? { radial: [...(fins ? [{ part: 'fin', count: fins }] : []), ...(srbs ? [srbs] : [])] } : {}),
    });
  }
  stack.push({ part: 'skirt-l' });
  return { stack, cargo: standardCargo() };
}

/** Naive single-stage rocket: everything in one stage. Must fail (teaches staging). */
export function naiveSingleStage({ tanks = 4, engines = 9 } = {}) {
  const stack = upperStack().slice(0, 7); // crew section + cargo module + adapter
  for (let i = 0; i < tanks; i++) {
    stack.push(i === tanks - 1 ? { part: 'tank-l', radial: [{ part: 'fin', count: 4 }] } : { part: 'tank-l' });
  }
  stack.push({ part: 'engine-mount-L', engines: { part: 'engine-booster', count: engines } });
  return { stack, cargo: standardCargo() };
}
