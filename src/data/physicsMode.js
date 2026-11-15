// Arcade vs Real physics (human's design decision, 2026-11-15).
// Real: representative real-world values (a rocket to orbit is big: think Falcon 9).
// Arcade: fuel is 5× denser than real and solid boosters carry 4× the fuel with 2.5× the thrust,
// so compact rockets that look right on screen can still reach orbit. Clearly labelled in-game.
// Pure data, no Three.js: the tests use it too.

export const ARCADE = { fuel: 5, srbProp: 4, srbThrust: 2.5 };

/** Fields that Arcade mode changes on a part (taken from its real values), or {} if none. */
export function arcadePatch(p) {
  if (p.category === 'internals' && p.propellant) return { propellant: p.propellant * ARCADE.fuel };
  if (p.fuel === 'solid') {
    return {
      propellant: p.propellant * ARCADE.srbProp,
      thrustSL: p.thrustSL * ARCADE.srbThrust,
      thrustVac: p.thrustVac * ARCADE.srbThrust,
    };
  }
  return {};
}

/** A parts.json-shaped copy with Arcade values applied (for tests and scripts). */
export function arcadeData(data) {
  return { ...data, parts: data.parts.map((p) => ({ ...p, ...arcadePatch(p) })) };
}
