import { describe, it, expect } from 'vitest';
import data from '../data/parts.json';
import missions from '../data/missions.json';
import { indexParts } from './rocket.js';
import { simulateMission } from './mission.js';
import { compactDesign } from '../data/designs.js';
import { arcadeData } from '../data/physicsMode.js';
import { rng, rollEvents, eventCard, addEffects, shipTraits, engineOutPenalty, flares } from './events.js';

const parts = indexParts(arcadeData(data));
const mission = missions.missions[0];
const traits = { antenna: true, battery: true, shield: false, bottomEngines: 3 };

describe('random events', () => {
  it('the same seed gives the same events', () => {
    expect(rollEvents(4417, { approachId: 'standard', traits })).toEqual(rollEvents(4417, { approachId: 'standard', traits }));
    expect(rng(1)()).toBe(rng(1)());
  });

  it('exactly one random event plus the scripted comms blackout, on every approach', () => {
    for (let seed = 1000; seed < 1050; seed++) {
      for (const approachId of ['fast', 'standard', 'patient']) {
        const ev = rollEvents(seed, { approachId, traits });
        expect(ev).toHaveLength(2);
        expect(ev.filter((e) => e.id === 'comms-blackout')).toHaveLength(1);
      }
    }
  });

  it('solar flares are real DONKI records, at least one X-class', () => {
    expect(flares.length).toBeGreaterThanOrEqual(3);
    expect(flares.some((f) => f.classType.startsWith('X'))).toBe(true);
    for (const f of flares) expect(f.link).toMatch(/nasa\.gov/);
  });

  it('more engines make an engine-out cheaper', () => {
    expect(engineOutPenalty(1)).toBeGreaterThan(engineOutPenalty(3));
    expect(engineOutPenalty(9)).toBeLessThan(15);
  });

  it('a debris shield turns a hit into no damage', () => {
    const ev = { id: 'debris', hitRoll: 0 };
    expect(eventCard(ev, { ...traits, shield: false }).choices[1].outcome().hours).toBe(4);
    expect(eventCard(ev, { ...traits, shield: true }).choices[1].outcome().hours ?? 0).toBe(0);
  });

  it('the example rocket survives the quick choices on every event, but a slow leak costs Δv', () => {
    const d = compactDesign();
    const base = simulateMission(d, parts, mission, 'standard');
    const t = shipTraits(d, base.report);
    let e = {};
    for (const id of ['engine-out', 'debris', 'fuel-leak']) {
      const c = eventCard({ id, hitRoll: 1 }, t);
      e = addEffects(e, c.auto ? c.outcome() : c.choices[0].outcome());
    }
    expect(simulateMission(d, parts, mission, 'standard', e).success).toBe(true);
    const slow = simulateMission(d, parts, mission, 'standard', { leakFrac: 0.1 });
    expect(slow.spareDv ?? 0).toBeLessThan(base.spareDv);
  });
});
