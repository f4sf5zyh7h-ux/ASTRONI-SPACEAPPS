import { describe, it, expect } from 'vitest';
import { circularVelocity, hohmann, deorbitBurn, radiusAt } from './orbits.js';

describe('orbits', () => {
  it('circular speed at 400 km is about 7.67 km/s', () => {
    expect(circularVelocity(radiusAt(400e3))).toBeCloseTo(7673, -1);
  });

  it('Hohmann 400 → 700 km matches the design doc (≈ 0.083 + 0.082 km/s)', () => {
    const h = hohmann(radiusAt(400e3), radiusAt(700e3));
    expect(h.dv1).toBeCloseTo(83, -0.5);
    expect(h.dv2).toBeCloseTo(82, -0.5);
    expect(h.total / 1000).toBeCloseTo(0.17, 1);
    // Half an orbit between 400 and 700 km: roughly 47 minutes.
    expect(h.time / 60).toBeGreaterThan(45);
    expect(h.time / 60).toBeLessThan(50);
  });

  it('de-orbit from 700 km to a 50 km perigee costs ≈ 0.18 km/s', () => {
    expect(deorbitBurn(radiusAt(700e3), radiusAt(50e3)) / 1000).toBeCloseTo(0.18, 2);
  });
});
