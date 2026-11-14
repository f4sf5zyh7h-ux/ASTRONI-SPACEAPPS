// Rocket design analysis: mass, cost, stages, Δv, TWR. Pure JS, no Three.js.
//
// A design is a vertical stack listed TOP → BOTTOM:
//   { stack: [ { part, radial?: [{ part, count }], engines?: { part, count } } ],
//     cargo: [ { item, count } ] }
// `radial` = side-mounted parts on that stack part (symmetry count).
// `engines` = engines hung under an engine mount.

/** Standard gravity, used by the rocket equation (exact by definition). */
export const G0 = 9.80665;

/** Build an id → part/item lookup from parts.json. */
export function indexParts(data) {
  const map = new Map();
  for (const p of data.parts) map.set(p.id, p);
  for (const it of data.items) map.set(it.id, { ...it, isItem: true });
  return map;
}

/** Tsiolkovsky rocket equation: Δv = Isp · g0 · ln(m0 / mf). */
export function rocketEquation(isp, m0, mf) {
  return isp * G0 * Math.log(m0 / mf);
}

/** Every physical part in one stack entry, as { part, count }. */
function entryContents(entry, parts) {
  const out = [{ part: parts.get(entry.part), count: 1 }];
  for (const r of entry.radial ?? []) out.push({ part: parts.get(r.part), count: r.count });
  if (entry.engines) out.push({ part: parts.get(entry.engines.part), count: entry.engines.count });
  return out;
}

/** Stacking rules: neighbours share a diameter, nothing hangs below an engine, mounts have room. */
export function validateStack(design, parts) {
  const errors = [];
  const stack = design.stack;
  for (const [i, entry] of stack.entries()) {
    const p = parts.get(entry.part);
    if (!p) { errors.push(`Unknown part "${entry.part}"`); continue; }
    if (p.radial) errors.push(`${p.name} is a side-mounted part and can't go in the main stack`);

    const below = stack[i + 1] && parts.get(stack[i + 1].part);
    if (below) {
      if (p.sizeBottom === null) {
        errors.push(`Nothing can attach below the ${p.name}`);
      } else if (below.sizeTop !== p.sizeBottom) {
        errors.push(`${p.name} (${p.sizeBottom}) doesn't fit on top of ${below.name} (${below.sizeTop}) — use an adapter`);
      }
    }

    if (entry.engines) {
      const eng = parts.get(entry.engines.part);
      if (!p.engineCapacity) errors.push(`${p.name} can't hold extra engines`);
      else if (entry.engines.count > p.engineCapacity) errors.push(`${p.name} holds at most ${p.engineCapacity} engines`);
      if (eng && p.engineSize && eng.sizeTop !== p.engineSize) errors.push(`${eng.name} doesn't fit the ${p.name}`);
    }
  }
  return errors;
}

/**
 * Split the stack into stages at decouplers. Returns sections BOTTOM → TOP.
 * A decoupler is dropped with the section below it (like a real interstage).
 */
export function splitStages(design, parts) {
  const sections = [];
  let current = [];
  for (let i = design.stack.length - 1; i >= 0; i--) {
    const entry = design.stack[i];
    current.push(entry);
    if (parts.get(entry.part)?.role === 'decoupler' && i > 0) {
      sections.push(current.reverse());
      current = [];
    }
  }
  if (current.length) sections.push(current.reverse());
  return sections.map((entries) => summariseSection(entries, parts));
}

function summariseSection(entries, parts) {
  const s = {
    entries,
    dry: 0, // everything except usable propellant and monoprop
    propellant: 0, // usable by this section's engines
    unusable: 0, // propellant whose fuel type no engine here burns (still dead mass)
    monoprop: 0,
    cost: 0,
    engines: [],
    fins: 0,
    roles: new Set(),
    ids: new Set(),
    slots: 0,
    seats: 0,
  };
  const tanks = [];
  for (const entry of entries) {
    for (const { part, count } of entryContents(entry, parts)) {
      if (!part) continue;
      s.dry += part.mass * count;
      s.cost += part.cost * count;
      s.monoprop += (part.monoprop ?? 0) * count;
      s.slots += (part.slots ?? 0) * count;
      s.seats += (part.seats ?? 0) * count;
      s.ids.add(part.id);
      if (part.role) s.roles.add(part.role);
      if (part.role === 'fin') s.fins += count;
      if (part.thrustVac && part.role !== 'rcs') s.engines.push({ part, count });
      if (part.propellant) tanks.push({ part, count });
    }
  }
  const fuels = new Set(s.engines.map((e) => e.part.fuel));
  for (const { part, count } of tanks) {
    if (fuels.has(part.fuel)) s.propellant += part.propellant * count;
    else s.unusable += part.propellant * count;
  }
  s.dry += s.unusable;
  s.thrustSL = sum(s.engines, (e) => e.part.thrustSL * e.count);
  s.thrustVac = sum(s.engines, (e) => e.part.thrustVac * e.count);
  s.ispVac = effectiveIsp(s.engines, (p) => p.ispVac, (p) => p.thrustVac);
  // First-stage simplification (CLAUDE.md §5): average of sea-level and vacuum Isp.
  s.ispLaunch = effectiveIsp(s.engines, (p) => (p.ispSL + p.ispVac) / 2, (p) => p.thrustSL);
  s.vacuumOnly = s.engines.some((e) => e.part.vacuumOnly);
  return s;
}

/** Combined Isp of several engines firing together: ΣF / Σ(F / Isp). */
function effectiveIsp(engines, isp, thrust) {
  let f = 0;
  let flow = 0;
  for (const e of engines) {
    const F = thrust(e.part) * e.count;
    const I = isp(e.part);
    if (F > 0 && I > 0) { f += F; flow += F / I; }
  }
  return flow > 0 ? f / flow : 0;
}

const sum = (arr, fn) => arr.reduce((t, x) => t + fn(x), 0);

/** Mass of the cargo items packed in the pod. */
export function cargoMass(design, parts) {
  return sum(design.cargo ?? [], (c) => parts.get(c.item).mass * c.count);
}

export function cargoSlots(design, parts) {
  return sum(design.cargo ?? [], (c) => parts.get(c.item).slots * c.count);
}

/**
 * Full design report: per-stage Δv/TWR (bottom-up, each stage carrying everything above),
 * total mass and cost, rule errors, and the mission checklist.
 */
export function analyzeDesign(design, parts) {
  const errors = validateStack(design, parts);
  const sections = splitStages(design, parts);
  const cargo = cargoMass(design, parts);
  const wet = sections.map((s) => s.dry + s.propellant + s.monoprop);
  const totalMass = sum(wet, (m) => m) + cargo;

  const stages = sections.map((s, i) => {
    const m0 = sum(wet.slice(i), (m) => m) + cargo;
    const mf = m0 - s.propellant;
    const isp = i === 0 ? s.ispLaunch : s.ispVac;
    const thrust = i === 0 ? s.thrustSL : s.thrustVac;
    const dv = s.engines.length && isp > 0 ? rocketEquation(isp, m0, mf) : 0;
    const twr = thrust / (m0 * G0);
    // Burn time = propellant mass · Isp · g0 / thrust.
    const burnTime = thrust > 0 ? (s.propellant * isp * G0) / thrust : 0;
    return { index: i, m0, mf, dv, twr, isp, thrust, burnTime, section: s };
  });

  const first = stages[0];
  if (first?.section.vacuumOnly) errors.push('A vacuum engine is on the first stage — it cannot fire below 50 km');
  for (const s of sections) {
    if (s.unusable > 0) errors.push(`A tank holds fuel that no engine in its stage can burn (${(s.unusable / 1000).toFixed(1)} t wasted)`);
  }

  const crew = sections.find((s) => s.ids.has('capsule-2'));
  const all = (role) => sections.some((s) => s.roles.has(role));
  const has = (id) => (design.cargo ?? []).some((c) => c.item === id && c.count > 0);
  const slotsUsed = cargoSlots(design, parts);
  const slotsTotal = sum(sections, (s) => s.slots);
  const checks = {
    crewSeats: (crew?.seats ?? 0) >= 2,
    heatShield: !!crew?.roles.has('heat-shield'),
    parachutes: !!crew?.roles.has('parachutes'),
    docking: all('docking'),
    rcs: all('rcs'),
    toolkit: has('toolkit'),
    replacementPanel: has('replacement-panel'),
    tether: has('tether'),
    cargoFits: slotsUsed <= slotsTotal,
    capsuleSeparates: !!crew && crew.engines.length === 0 && crew.propellant === 0 && sections.length > 1,
    fins: (first?.section.fins ?? 0) >= 3,
    liftoff: (first?.twr ?? 0) >= 1.2,
  };

  return {
    sections,
    stages,
    totalDv: sum(stages, (s) => s.dv),
    totalMass,
    cost: sum(sections, (s) => s.cost),
    cargoMass: cargo,
    slotsUsed,
    slotsTotal,
    errors,
    checks,
  };
}
