// Random events (CLAUDE.md §8). Pure JS: no Three.js, so it can be unit-tested.
// Each run rolls its events from a seed, so the same seed replays the same events.
// Events are softened by parts and cargo the player chose, and most ask for a quick decision.
// Their effects feed simulateMission() (Δv, fuel) and the debrief (hours, crew health, score).
import flareData from '../data/nasa/solar_flares.json';

/** Small fast seeded RNG (mulberry32). Returns () => number in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => 1000 + Math.floor(Math.random() * 9000);
export const seedName = (seed) => `AURORA-${seed}`;
export const flares = flareData.flares;

/** What the player brought that matters for events. */
export function shipTraits(design, report) {
  const cargo = (id) => (design.cargo ?? []).some((c) => c.item === id && c.count > 0);
  const role = (r) => report.sections.some((s) => s.roles.has(r));
  const bottom = report.sections[0];
  const liquid = (bottom?.engines ?? []).filter((e) => e.part.fuel !== 'solid').reduce((n, e) => n + e.count, 0);
  return {
    antenna: role('antenna'),
    battery: role('battery') || cargo('spare-battery'),
    shield: role('debris-shield'),
    bottomEngines: liquid,
  };
}

/**
 * Roll this run's events. Fast intercept = less time in orbit, fewer events; Patient phasing = more.
 * Returns [{ id, ...details }] in the order they happen. The comms blackout always happens (scripted).
 */
export function rollEvents(seed, { approachId, traits }) {
  const r = rng(seed);
  const pool = ['solar-flare', 'debris', 'fuel-leak'];
  if (traits.bottomEngines > 0) pool.push('engine-out');
  const n = approachId === 'fast' ? 1 : approachId === 'patient' ? 3 : 2;
  const chosen = [];
  while (chosen.length < Math.min(n, pool.length)) {
    const id = pool[Math.floor(r() * pool.length)];
    if (!chosen.includes(id)) chosen.push(id);
  }
  const events = chosen.map((id) => {
    if (id === 'solar-flare') return { id, flare: flares[Math.floor(r() * flares.length)], at: 0.25 + r() * 0.2 };
    if (id === 'debris') return { id, hitRoll: r(), at: 0.5 + r() * 0.15 };
    if (id === 'fuel-leak') return { id, at: 0.15 + r() * 0.15 };
    return { id, at: 0.3 + r() * 0.2 }; // engine-out during the climb
  });
  events.push({ id: 'comms-blackout', at: 0.85 });
  // Launch events first, then coast events in time order.
  return events.sort((a, b) => (a.id === 'engine-out' ? -1 : b.id === 'engine-out' ? 1 : a.at - b.at));
}

const flareLevel = (cls) => cls[0]; // 'X' | 'M' | 'C'
const SHELTER_H = { X: 6, M: 3, C: 1 };

/** Extra launch Δv when one engine shuts down: the others must burn longer (more gravity loss). */
export function engineOutPenalty(bottomEngines) {
  // One engine of N lost for part of the climb: extra gravity loss ~90 m/s × 1/N (representative, tuned for play:
  // the example rocket survives an engine-out plus the quick choices on the other events).
  return Math.round(90 / Math.max(1, bottomEngines));
}

/**
 * The decision card for an event: title, text and choices. `choose(i)` returns the outcome:
 * { log, hours, injury, score, effects } where effects are added to the mission simulation.
 */
export function eventCard(ev, traits) {
  switch (ev.id) {
    case 'engine-out': {
      const dv = engineOutPenalty(traits.bottomEngines);
      const single = traits.bottomEngines <= 1;
      return {
        title: 'ENGINE OUT',
        say: single ? 'Engine flame-out! It relit, but we lost speed.' : 'Engine out! The other engines are burning longer to cover it.',
        text: single
          ? 'Your only main engine lost power for a few seconds. The rocket sagged before it relit, losing speed to gravity.'
          : `One of your ${traits.bottomEngines} main engines shut down. The others burn longer to make up for it.`,
        auto: true,
        outcome: () => ({ log: `Engine out at launch: cost ${dv} m/s extra.${single ? ' With more engines, losing one costs much less.' : ''}`, effects: { launchExtra: dv } }),
      };
    }
    case 'solar-flare': {
      const f = ev.flare;
      const lvl = flareLevel(f.classType);
      const h = SHELTER_H[lvl] + (traits.battery ? 0 : 2);
      return {
        title: `SOLAR FLARE · CLASS ${f.classType}`,
        text: `Replaying a real ${f.classType} flare from ${f.peakTime.slice(0, 10)} (NASA DONKI). Radiation is rising. Shelter in the capsule's shielded corner, or keep going?`
          + (traits.battery ? '' : ' No battery on board: the panels must be turned away and power runs low while you shelter.'),
        nasa: { label: 'DONKI', href: f.link },
        say: `Solar flare! A class ${f.classType.replace('.', ' point ')} flare. Shelter, or keep going?`,
        choices: [
          { label: `Shelter (+${h} h)`, outcome: () => ({ log: `${f.classType} flare: sheltered for ${h} h${traits.battery ? '' : ' (no battery: 2 h longer)'}.`, hours: h }) },
          {
            label: 'Keep going',
            outcome: () => (lvl === 'X'
              ? { log: `${f.classType} flare: kept going through an X-class flare. The crew took a radiation dose.`, injury: 1 }
              : lvl === 'M'
                ? { log: `${f.classType} flare: kept going. Small radiation dose (−100 points).`, score: -100 }
                : { log: `${f.classType} flare: a weak flare, kept going safely.` }),
          },
        ],
      };
    }
    case 'debris': {
      const hit = ev.hitRoll < (traits.shield ? 0.5 : 0.6);
      return {
        title: 'DEBRIS WARNING',
        text: 'Tracking reports a fragment crossing your path in 90 seconds. Most debris is too small to track, so the warning is rough. Dodge with a short engine burn, or hold course?'
          + (traits.shield ? ' Your Whipple debris shield can stop small fragments.' : ''),
        nasa: { label: 'Orbital Debris Office', href: 'https://orbitaldebris.jsc.nasa.gov/faq/' },
        say: 'Debris warning! A fragment is crossing our path in ninety seconds. Dodge, or hold course?',
        choices: [
          { label: 'Dodge (15 m/s)', outcome: () => ({ log: 'Debris: dodged with a 15 m/s burn (fuel you will miss on the way home if the rocket is tight).', effects: { coastDv: 15 } }) },
          {
            label: 'Hold course',
            outcome: () => (!hit
              ? { log: 'Debris: held course and it missed.' }
              : traits.shield
                ? { log: 'Debris: hit! The Whipple shield broke the fragment up. No damage.' }
                : { log: 'Debris: hit a solar panel. Less power: the mission runs 4 h slower. A debris shield would have stopped it.', hours: 4 }),
          },
        ],
      };
    }
    case 'fuel-leak':
      return {
        title: 'FUEL LEAK',
        say: 'Fuel leak in the upper stage! Isolate the tank, now!',
        text: 'Pressure is dropping in the upper-stage tank. Close the valves to isolate the leak, quickly!',
        timer: 6,
        choices: [
          { label: 'Isolate tank', outcome: () => ({ log: 'Fuel leak: isolated quickly, lost 2% of the stage fuel.', effects: { leakFrac: 0.02 } }) },
        ],
        timeout: () => ({ log: 'Fuel leak: too slow to isolate it, lost 10% of the stage fuel.', effects: { leakFrac: 0.1 } }),
      };
    case 'comms-blackout':
    default: {
      const s = traits.antenna ? 30 : 90;
      return {
        title: 'COMMS BLACKOUT',
        say: 'Losing signal… no guidance until we reacquire.',
        text: `Signal lost while passing out of ground-station range. No guidance for ${s} s${traits.antenna ? ' (the high-gain antenna picks the link back up quickly).' : '. A high-gain antenna would shorten this.'}`,
        auto: true,
        blackout: traits.antenna ? 2.5 : 6,
        outcome: () => ({ log: `Comms blackout: ${s} s with no guidance${traits.antenna ? '' : ' (no high-gain antenna): +1 h to line up'}.`, hours: traits.antenna ? 0 : 1 }),
      };
    }
  }
}

/** Add an outcome's effects into the running total. */
export function addEffects(total, o) {
  const e = o.effects ?? {};
  return {
    launchExtra: (total.launchExtra ?? 0) + (e.launchExtra ?? 0),
    coastDv: (total.coastDv ?? 0) + (e.coastDv ?? 0),
    leakFrac: Math.min(0.5, (total.leakFrac ?? 0) + (e.leakFrac ?? 0)),
  };
}
