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
  // Casings: internals listed bottom → top; a thrust plate carries its own engines.
  for (const c of entry.inside ?? []) {
    out.push({ part: parts.get(c.part), count: 1 });
    if (c.engines) out.push({ part: parts.get(c.engines.part), count: c.engines.count });
  }
  return out;
}

const SIZE_RANK = { S: 1, M: 2, L: 3 };

/** Internals must fit the casing: size class, total height, thrust plate at the bottom, plate capacity. */
export function validateInside(casing, inside, parts) {
  const errors = [];
  if (!casing.interior) return [`${casing.name} has no room inside: internals go in casings`];
  let height = 0;
  inside.forEach((c, k) => {
    const ip = parts.get(c.part);
    if (!ip) return errors.push(`Unknown part "${c.part}"`);
    height += ip.height;
    if (SIZE_RANK[ip.size] > SIZE_RANK[casing.interior.size]) errors.push(`${ip.name} is too wide for the ${casing.name}`);
    if (ip.role === 'thrust-plate' && k !== 0) errors.push(`The ${ip.name} must be at the bottom of its casing so the engines can hang out`);
    if (c.engines) {
      const eng = parts.get(c.engines.part);
      // Fixed engine sets keep the thrust centred: S plate 1, M plate 3, L plate 5.
      if (c.engines.count !== ip.engineCapacity) errors.push(`${ip.name} needs exactly ${ip.engineCapacity} engine${ip.engineCapacity > 1 ? 's' : ''} so the thrust stays centred`);
      if (eng && SIZE_RANK[eng.sizeTop] > SIZE_RANK[ip.size]) errors.push(`${eng.name} is too big for the ${ip.name}`);
    }
  });
  if (height > casing.interior.height + 1e-6) errors.push(`${casing.name} holds ${casing.interior.height} m but its contents are ${height.toFixed(1)} m tall`);
  return errors;
}

/** Top/bottom size of a stack entry. Adapters can be flipped (entry.flip) to join a big part on top of a small one. */
export function sizesOf(entry, part) {
  return entry?.flip ? { top: part.sizeBottom, bottom: part.sizeTop } : { top: part.sizeTop, bottom: part.sizeBottom };
}

const SLOTS = 8; // side positions around each body part, per height band

/**
 * Where each side-part group sits around its body part, without overlaps: 8 slots in a ring,
 * fins on a low ring, everything else at mid height. A group of n parts takes n evenly spaced
 * slots. Returns [{ band, slots: [...] }] per group, or null if something doesn't fit.
 */
export function radialSlots(radial, parts) {
  const used = { low: new Set(), mid: new Set() };
  const out = [];
  for (const g of radial ?? []) {
    const band = parts.get(g.part)?.role === 'fin' ? 'low' : 'mid';
    const step = Math.max(1, Math.floor(SLOTS / g.count));
    let found = null;
    for (let i = 0; i < step && !found; i++) {
      // Fins start one slot round, so they sit between side boosters rather than on top of them.
      const o = band === 'low' ? (i + 1) % step : i;
      const s = Array.from({ length: g.count }, (_, k) => (o + k * step) % SLOTS);
      if (s.every((x) => !used[band].has(x)) && new Set(s).size === s.length) found = s;
    }
    if (!found) return null;
    found.forEach((x) => used[band].add(x));
    out.push({ band, slots: found });
  }
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
    if (entry.radial?.length && !radialSlots(entry.radial, parts)) errors.push(`Too many side parts on the ${p.name}: they would overlap`);
    if (entry.radial?.length && p.sizeTop !== p.sizeBottom) errors.push(`Side parts can't go on the ${p.name}: its sides taper, so they would float`);

    const belowEntry = stack[i + 1];
    const below = belowEntry && parts.get(belowEntry.part);
    if (below) {
      const me = sizesOf(entry, p);
      const them = sizesOf(belowEntry, below);
      if (me.bottom === null) {
        errors.push(`Nothing can attach below the ${p.name}`);
      } else if (them.top !== me.bottom) {
        errors.push(`${p.name} (${me.bottom}) doesn't fit on top of ${below.name} (${them.top}) — use an adapter`);
      }
    }

    if (entry.inside?.length) errors.push(...validateInside(p, entry.inside, parts));
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
