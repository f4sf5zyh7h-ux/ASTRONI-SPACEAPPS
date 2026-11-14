import { describe, it, expect } from 'vitest';
import partsData from '../data/parts.json' with { type: 'json' };
import missionsData from '../data/missions.json' with { type: 'json' };
import { indexParts, analyzeDesign, rocketEquation, splitStages, validateStack, G0 } from './rocket.js';
import { simulateMission } from './mission.js';
import { referenceDesign, naiveSingleStage } from '../data/designs.js';

const parts = indexParts(partsData);
const mission = missionsData.missions[0];

describe('rocket equation', () => {
  it('Δv = Isp·g0·ln(m0/mf)', () => {
    expect(rocketEquation(300, Math.E, 1)).toBeCloseTo(300 * G0);
  });
});

describe('stacking rules', () => {
  it('rejects mismatched diameters', () => {
    const errors = validateStack({ stack: [{ part: 'capsule-2' }, { part: 'tank-l' }] }, parts);
    expect(errors.join()).toMatch(/adapter/);
  });

  it('rejects a vacuum engine on the first stage', () => {
    const design = { stack: [{ part: 'capsule-2' }, { part: 'tank-m-long' }, { part: 'engine-vacuum' }], cargo: [] };
    expect(analyzeDesign(design, parts).errors.join()).toMatch(/vacuum engine/i);
  });

  it('splits stages at decouplers, decoupler drops with the stage below', () => {
    const stages = splitStages(referenceDesign(), parts);
    expect(stages).toHaveLength(3); // first stage, upper stage, crew capsule
    expect(stages[0].ids.has('decoupler-L')).toBe(true);
    expect(stages[2].ids.has('capsule-2')).toBe(true);
  });
});

describe('reference design (CLAUDE.md §5, §14)', () => {
  const ref = referenceDesign();
  const a = analyzeDesign(ref, parts);

  it('is a valid build with every checklist item ticked', () => {
    expect(a.errors).toEqual([]);
    expect(Object.values(a.checks).every(Boolean)).toBe(true);
  });

  it('clears the tower (TWR ≥ 1.2) and has ≥ 9.75 km/s', () => {
    expect(a.stages[0].twr).toBeGreaterThanOrEqual(1.2);
    expect(a.totalDv).toBeGreaterThanOrEqual(9750);
  });

  it('fits the $250M budget', () => {
    expect(a.cost).toBeLessThanOrEqual(mission.budget);
  });

  it('completes Standard and Patient, but is just short for Fast intercept', () => {
    expect(simulateMission(ref, parts, mission, 'standard').success).toBe(true);
    expect(simulateMission(ref, parts, mission, 'patient').success).toBe(true);
    expect(simulateMission(ref, parts, mission, 'fast').success).toBe(false);
  });
});

describe('teaching failures', () => {
  it('a naive single-stage rocket cannot reach orbit', () => {
    const r = simulateMission(naiveSingleStage(), parts, mission, 'standard');
    expect(r.success).toBe(false);
    expect(r.failedAt).toBe('launch');
  });

  it('forgetting the heat shield fails at re-entry', () => {
    const design = referenceDesign();
    design.stack = design.stack.filter((e) => e.part !== 'heat-shield');
    // Without the M-size shield the capsule sits directly on the decoupler; sizes still match.
    const r = simulateMission(design, parts, mission, 'standard');
    expect(r.failedAt).toBe('reentry');
  });

  it('no RCS means no rendezvous', () => {
    const design = referenceDesign();
    const cargo = design.stack.find((e) => e.part === 'cargo-module');
    cargo.radial = cargo.radial.filter((r) => r.part !== 'rcs');
    expect(simulateMission(design, parts, mission, 'standard').failedAt).toBe('rendezvous');
  });

  it('too much rocket for the engines will not clear the tower', () => {
    const r = simulateMission(referenceDesign({ tanks: 5, engines: 9 }), parts, mission, 'standard');
    expect(r.failedAt).toBe('launch');
    expect(r.reason).toMatch(/1\.2/);
  });
});
