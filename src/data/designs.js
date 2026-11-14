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

/** Naive single-stage rocket: everything in one stage. Must fail (teaches staging). */
export function naiveSingleStage({ tanks = 4, engines = 9 } = {}) {
  const stack = upperStack().slice(0, 7); // crew section + cargo module + adapter
  for (let i = 0; i < tanks; i++) {
    stack.push(i === tanks - 1 ? { part: 'tank-l', radial: [{ part: 'fin', count: 4 }] } : { part: 'tank-l' });
  }
  stack.push({ part: 'engine-mount-L', engines: { part: 'engine-booster', count: engines } });
  return { stack, cargo: standardCargo() };
}
