// Casing + internals system: internals add to their stage, rules catch bad fits,
// and the casing-based example rocket keeps the agreed balance (CLAUDE.md §14.3, §17).
import { describe, it, expect } from 'vitest';
import data from '../data/parts.json' with { type: 'json' };
import missions from '../data/missions.json' with { type: 'json' };
import { indexParts, analyzeDesign, validateInside } from './rocket.js';
import { simulateMission } from './mission.js';
import { casingDesign } from '../data/designs.js';

const parts = indexParts(data);
const mission = missions.missions[0];

describe('casings and internals', () => {
  it('counts internal tanks, plates and engines in the stage mass', () => {
    const design = { stack: [{ part: 'casing-l-med', inside: [{ part: 'thrust-plate-l', engines: { part: 'engine-booster', count: 5 } }, { part: 'inner-tank-l-long' }] }], cargo: [] };
    const a = analyzeDesign(design, parts);
    const g = (id) => parts.get(id);
    const expected = g('casing-l-med').mass + g('thrust-plate-l').mass + 5 * g('engine-booster').mass + g('inner-tank-l-long').mass + g('inner-tank-l-long').propellant;
    expect(a.totalMass).toBeCloseTo(expected, 3);
    expect(a.stages[0].dv).toBeGreaterThan(0);
  });

  it('rejects internals that are too tall, too wide, or a plate not at the bottom', () => {
    const tall = validateInside(parts.get('casing-l-short'), [{ part: 'inner-tank-l-long' }], parts);
    expect(tall.join(' ')).toMatch(/contents are 8.0 m tall/);
    const wide = validateInside(parts.get('casing-m-long'), [{ part: 'inner-tank-l-short' }], parts);
    expect(wide.join(' ')).toMatch(/too wide/);
    const plate = validateInside(parts.get('casing-l-long'), [{ part: 'inner-tank-l-short' }, { part: 'thrust-plate-l' }], parts);
    expect(plate.join(' ')).toMatch(/bottom of its casing/);
    const ok = validateInside(parts.get('casing-l-long'), [{ part: 'thrust-plate-l', engines: { part: 'engine-booster', count: 5 } }, { part: 'inner-tank-l-long' }], parts);
    expect(ok).toEqual([]);
  });

  it('example casing rocket: valid, within budget, passes Standard, fails Fast', () => {
    const d = casingDesign();
    const a = analyzeDesign(d, parts);
    expect(a.errors).toEqual([]);
    expect(a.cost).toBeLessThanOrEqual(mission.budget);
    expect(a.stages[0].twr).toBeGreaterThanOrEqual(1.2);
    expect(Object.values(a.checks).every(Boolean)).toBe(true);
    const std = simulateMission(d, parts, mission, 'standard');
    expect(std.success).toBe(true);
    expect(std.spareDv).toBeGreaterThan(50);
    expect(simulateMission(d, parts, mission, 'fast').success).toBe(false);
  });
});

describe('arcade physics', () => {
  it('compact example: valid, passes Standard, still fails Fast', async () => {
    const { arcadeData } = await import('../data/physicsMode.js');
    const { compactDesign } = await import('../data/designs.js');
    const arcade = indexParts(arcadeData(data));
    const d = compactDesign();
    const a = analyzeDesign(d, arcade);
    expect(a.errors).toEqual([]);
    expect(a.cost).toBeLessThanOrEqual(mission.budget);
    expect(Object.values(a.checks).every(Boolean)).toBe(true);
    expect(simulateMission(d, arcade, mission, 'standard').success).toBe(true);
    expect(simulateMission(d, arcade, mission, 'fast').success).toBe(false);
    // Real values: the same rocket can't reach orbit.
    expect(simulateMission(d, parts, mission, 'standard').success).toBe(false);
  });
});
