// Workshop HTML panels: parts catalogue (left), live stats + checklist (right).
import { partList, itemList, parts, DIAMETER, isLocked } from '../data/catalog.js';
import { state } from '../state.js';
import { PART_INFO } from '../data/partInfo.js';
import { partThumbnails } from '../render/thumbnails.js';
import { tonnes, kms, kN, money } from './format.js';

const TABS = [
  ['crew', 'Crew'],
  ['casings', 'Casings'],
  ['internals', 'Inside'],
  ['engines', 'Engines'],
  ['structure', 'Structure'],
  ['systems', 'Systems'],
  ['cargo', 'Cargo'],
];

/** Cargo items: a picture (emoji) and why you'd pack it. */
const ITEM_INFO = {
  'replacement-panel': ['🛰️', 'The new solar panel for AURORA-7. The whole point of the mission: without it there is nothing to repair.'],
  toolkit: ['🧰', 'Tools to unbolt the broken panel. Also frees a stuck bolt on the spacewalk.'],
  tether: ['🪢', 'Safety rope for the Specialist. Without one, a slip means drifting away from the ship.'],
  'spare-battery': ['🔋', 'Backup power if a solar flare or debris knocks out the ship\'s panels.'],
  'spare-o2': ['💨', 'Extra oxygen: a longer spacewalk before the suit runs low.'],
};

/** Left panel. `onGrab(part, event)` starts a drag. */
export function createCatalog(ui, onGrab) {
  const el = document.createElement('div');
  el.className = 'ws-catalog panel';
  const shown = partList.filter((p) => !p.legacy); // old all-in-one tanks stay out of the catalogue
  const thumbs = partThumbnails(shown, parts);
  let tab = 'crew';

  const info = document.createElement('div');
  info.className = 'ws-info panel';
  ui.appendChild(info);

  const render = () => {
    el.innerHTML = `
      <div class="ws-tabs">${TABS.map(([id, label]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${label}</button>`).join('')}</div>
      <div class="ws-grid">${tab === 'cargo' ? itemList.map((it) => `<div class="ws-card ws-item" data-id="${it.id}">
            <div class="ws-emoji">${ITEM_INFO[it.id]?.[0] ?? '📦'}</div>
            <div class="ws-name">${it.name}</div>
            <div class="ws-cost">${it.slots} slot${it.slots > 1 ? 's' : ''} · ${tonnes(it.mass, 2)}</div>
          </div>`).join('') : ''}${shown
        .filter((p) => p.category === tab)
        .map((p) => {
          const locked = isLocked(p);
          return `<div class="ws-card${locked ? ' locked' : ''}" data-id="${p.id}">
            <img src="${thumbs.get(p.id)}" alt="" draggable="false">
            <div class="ws-name">${p.name}</div>
            <div class="ws-cost">${locked ? `🔒 Mission ${p.lockedUntil}` : money(p.cost)}</div>
          </div>`;
        })
        .join('')}</div>
      <div class="muted ws-help">${tab === 'cargo' ? 'Drag cargo onto the capsule or cargo module.' : 'Drag a part onto a glowing spot. Right-click a part to remove it.'}</div>`;
  };
  render();

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; render(); }
  });
  el.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.ws-card');
    if (!card || card.classList.contains('locked') || e.button !== 0) return;
    e.preventDefault();
    info.classList.remove('show');
    onGrab(parts.get(card.dataset.id), e);
  });
  el.addEventListener('pointerover', (e) => {
    const card = e.target.closest('.ws-card');
    if (!card) return info.classList.remove('show');
    const p = parts.get(card.dataset.id);
    info.innerHTML = partDetails(p);
    const r = card.getBoundingClientRect();
    info.style.top = `${Math.min(r.top, window.innerHeight - 260)}px`;
    info.classList.add('show');
  });
  el.addEventListener('pointerleave', () => info.classList.remove('show'));
  ui.appendChild(el);
  return el;
}

function partDetails(p) {
  if (p.isItem) {
    return `<b>${p.name}</b><p>${ITEM_INFO[p.id]?.[1] ?? ''}</p>
      <table><tr><td>Mass</td><td>${tonnes(p.mass, 2)}</td></tr><tr><td>Storage</td><td>${p.slots} slot${p.slots > 1 ? 's' : ''} (capsule 4, cargo module 6)</td></tr></table>
      ${p.required ? '<p class="bad">Needed for the mission</p>' : ''}`;
  }
  const rows = [];
  const size = p.radial ? 'Side-mounted'
    : p.category === 'internals' ? `Fits casings ${p.size} and up`
    : [p.sizeBottom, p.sizeTop].filter(Boolean).map((s) => `${DIAMETER[s]} m`).join(' → ');
  rows.push(['Size', `${size} · ${p.height} m tall`]);
  rows.push(['Mass', tonnes(p.mass, 2) + (p.propellant ? ` + ${tonnes(p.propellant, 1)} fuel` : '') + (p.monoprop ? ` + ${tonnes(p.monoprop, 2)} RCS fuel` : '')]);
  if (p.thrustVac) rows.push(['Thrust', p.thrustSL ? `${kN(p.thrustSL)} at sea level / ${kN(p.thrustVac)} in space` : `${kN(p.thrustVac)} (space only)`]);
  if (p.ispVac) rows.push(['Efficiency (Isp)', p.ispSL ? `${p.ispSL} s sea level / ${p.ispVac} s space` : `${p.ispVac} s`]);
  if (p.seats) rows.push(['Seats', p.seats]);
  if (p.slots) rows.push(['Storage', `${p.slots} slots`]);
  if (p.interior) rows.push(['Room inside', `${p.interior.height} m tall, ${DIAMETER[p.interior.size]} m wide`]);
  if (p.sleeve) rows.push(['Engine room', `nozzles up to ${p.height} m long fit inside`]);
  if (p.engineCapacity) rows.push(['Holds', `up to ${p.engineCapacity} engines`]);
  rows.push(['Cost', money(p.cost)]);
  return `<b>${p.name}</b><p>${PART_INFO[p.id] ?? ''}</p>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    ${isLocked(p) ? `<p class="bad">Unlocks in Mission ${p.lockedUntil}</p>` : ''}
    <p class="muted">Representative values for this class of hardware.</p>`;
}

const CHECKS = [
  ['crewSeats', 'Seats for 2 crew', 'Add the Crew Capsule.'],
  ['heatShield', 'Heat shield under the capsule', 'Without it the capsule burns up coming home.'],
  ['parachutes', 'Parachutes', 'Needed for a soft landing.'],
  ['capsuleSeparates', 'Capsule can separate', 'Put a decoupler below the heat shield so the capsule can leave the rocket to come home.'],
  ['rcs', 'RCS thrusters', 'Needed to line up with the satellite (4 recommended).'],
  ['fins', 'Fins on the bottom stage (3+)', 'Without fins the rocket wobbles and wastes 5% of its launch Δv.'],
  ['liftoff', 'Liftoff thrust-to-weight ≥ 1.2', 'Engines must push harder than the rocket weighs, with margin, to clear the tower.'],
  ['replacementPanel', 'New solar panel packed', 'Cargo tab: drag it into the capsule or cargo module.'],
  ['toolkit', 'Toolkit packed', 'Cargo tab: needed to unbolt the broken panel.'],
  ['tether', 'Safety tether packed', 'Cargo tab: keeps the Specialist attached on the spacewalk.'],
  ['cargoFits', 'Cargo fits in storage', 'The 800 kg panel needs 3 slots; the capsule has 4.'],
];

const LEGS = [
  ['launch', 'Launch', 'Reach a 400 km parking orbit. Includes gravity and air-drag losses (representative).'],
  ['transfer', 'Transfer', 'Two burns to climb from 400 km to the satellite at 700 km (Hohmann transfer).'],
  ['rendezvous', 'RCS', 'Fine steering to meet the satellite. Paid from the RCS thrusters’ own fuel.'],
  ['deorbit', 'De-orbit', 'Slow down so the orbit dips into the air and you come home.'],
];

/** Right panel contents. */
export function renderStats(el, { design, report, sim, need, mission, approach, approaches }) {
  if (!design.stack.length) {
    el.innerHTML = `<h3>Your rocket</h3><p class="muted">Nothing built yet. Drag a part from the left onto the glowing ring on the stand.</p>`;
    return;
  }
  if (!report) {
    el.innerHTML = `<h3>Your rocket</h3><p class="bad">Couldn't work out the numbers for this design. Try undoing the last change.</p>`;
    return;
  }
  const over = report.cost > mission.budget;
  const first = report.stages[0];
  const stages = report.stages
    .map((s, i) => (s.section.engines.length
      ? `<li>Stage ${i + 1}: <b>${kms(s.dv)}</b> · TWR ${s.twr.toFixed(2)}</li>`
      : `<li title="A section with no engine is carried by the stage below (e.g. the capsule, which separates to come home).">${s.section.seats ? 'Capsule section' : `Section ${i + 1}`}: <span class="muted">no engine, rides on the stage below</span></li>`))
    .reverse()
    .join('');

  const legBar = LEGS.map(([id, label, why]) => {
    const leg = sim?.legs.find((l) => l.id === id);
    const status = !leg ? 'none' : leg.ok ? 'ok' : 'bad';
    const v = need[id];
    const w = id === 'launch' ? v : v * 8;
    const short = leg && !leg.ok ? ` — short by ${Math.round(leg.shortfall)} m/s` : '';
    return `<div class="dv-seg ${status}" style="flex:${w}" title="${label}: needs ${Math.round(v)} m/s${short}. ${why}"><span>${label}</span></div>`;
  }).join('');

  const verdict = sim?.success
    ? `<p class="good">✔ Mission possible · ${Math.round(sim.spareDv)} m/s spare</p>`
    : `<p class="bad">✘ ${sim?.reason ?? 'Not flyable yet.'}</p>`;

  el.innerHTML = `
    <h3>Your rocket</h3>
    <div class="ws-row"><span title="Total price of all parts. Mission budget is $${mission.budget}M.">Cost ?</span><b class="${over ? 'bad' : ''}">${money(Math.round(report.cost * 10) / 10)} / $${mission.budget}M</b></div>
    <div class="ws-meter"><i style="width:${Math.min(100, (report.cost / mission.budget) * 100)}%" class="${over ? 'bad' : ''}"></i></div>
    <div class="ws-row"><span title="Everything including fuel and cargo.">Mass ?</span><b>${tonnes(report.totalMass, 1)}</b></div>
    <div class="ws-row"><span title="Thrust-to-weight at liftoff = engine thrust ÷ rocket weight. Needs at least 1.2 to climb away from the tower.">Liftoff TWR ?</span><b class="${first && first.twr >= 1.2 ? 'good' : 'bad'}">${first ? first.twr.toFixed(2) : '—'}</b></div>
    <div class="ws-row"><span title="Δv (delta-v) = how much the rocket can change its speed. Tsiolkovsky rocket equation: Δv = Isp × g₀ × ln(full mass ÷ empty mass), stage by stage. First stage uses the average of sea-level and vacuum Isp.">Total Δv ?</span><b>${kms(report.totalDv)}</b></div>
    <ul class="ws-stages">${stages}</ul>

    <h3>Mission check
      <select class="ws-approach">${approaches.map((a) => `<option value="${a.id}" ${a.id === approach ? 'selected' : ''}>${a.name}</option>`).join('')}</select>
    </h3>
    <div class="dv-bar ws-legs">${legBar}</div>
    ${verdict}

    <h3>Cargo <span class="muted">· ${report.slotsUsed} / ${report.slotsTotal} slots</span></h3>
    ${design.cargo?.length
    ? `<ul class="ws-cargo">${design.cargo.map((c) => `<li>${ITEM_INFO[c.item]?.[0] ?? '📦'} ${parts.get(c.item).name}${c.count > 1 ? ` ×${c.count}` : ''} <button data-unpack="${c.item}" title="Unpack one">×</button></li>`).join('')}</ul>`
    : '<p class="muted">Nothing packed. Use the Cargo tab.</p>'}

    <h3>Checklist</h3>
    <ul class="ws-checks">${CHECKS.map(([k, label, why]) => `<li class="${report.checks[k] ? 'good' : 'bad'}" title="${why}">${report.checks[k] ? '✔' : '✘'} ${label}</li>`).join('')}</ul>
    ${report.errors.length ? `<h3>Problems</h3><ul class="ws-errors">${report.errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
    <p class="muted">Hover any item for an explanation.</p>`;
}

/** Controls and build order, shown under the guide's ? button. */
export const HELP_HTML = `<ul>
  <li><b>Drag</b> parts from the left onto the glowing spots. <b>Right-click</b> a part to remove it. <b>Ctrl+Z</b> undoes.</li>
  <li><b>Left-drag</b> to look around, <b>scroll</b> to zoom. <b>X-ray</b> shows inside the casings.</li>
  <li>Build from the bottom up: casing → fuel tank inside → engines under it → decoupler → upper stage → capsule on top.</li>
  <li>Upper engines tuck into the casing below, so leave free space at its top.</li>
  <li>Hover anything with <b>?</b> for an explanation. Stuck? Press <b>Example</b>.</li>
</ul>`;

/** One short "what to do next" line for the guide box, from the design's state. */
export function guideText(design, report, sim) {
  const st = design.stack;
  if (!st.length) return 'Drag a <b>casing</b> (Casings tab) onto the stand. It is the body of your first stage.';
  const empty = st.map((e) => ({ e, p: parts.get(e.part) }))
    .find(({ e, p }) => p.interior && !(e.inside ?? []).some((c) => parts.get(c.part).propellant));
  if (empty) return `Fill the <b>${empty.p.name}</b>: drag a fuel tank from the <b>Inside</b> tab into it.`;
  if (!report) return 'Something is wrong with this design. Try <b>Undo</b>.';
  if (report.sections.some((s) => s.unusable > 0)) return 'Some fuel has no engine to burn it. Drag an engine set (<b>Engines</b> tab) under that casing.';
  if (report.stages.filter((s) => s.section.engines.length).length < 2) {
    return 'One stage can\'t reach orbit. Add a <b>decoupler</b> on top, then a second casing with a tank and engines. Leave free space at the top of the lower casing for the upper engines.';
  }
  const c = report.checks;
  if (!c.crewSeats) return 'Put the <b>Crew Capsule</b> on top (Crew tab), with a heat shield and decoupler under it.';
  if (!c.heatShield) return 'Add a <b>heat shield</b> under the capsule, or it burns up coming home.';
  if (!c.capsuleSeparates) return 'Put a <b>decoupler</b> under the heat shield so the capsule can come home on its own.';
  if (!c.parachutes) return 'Add <b>parachutes</b> on top of the capsule for a soft landing.';
  if (!c.liftoff) return 'Too heavy to lift off. Add <b>solid boosters</b> (Engines tab) on the bottom casing, or use less fuel.';
  if (!c.fins) return 'Add <b>fins</b> (Structure tab) to the bottom casing so it flies straight.';
  if (!c.rcs) return 'Add <b>RCS thrusters</b> (Systems tab) so you can line up with the satellite.';
  if (!c.replacementPanel || !c.toolkit || !c.tether) return 'Pack the cargo: <b>Cargo</b> tab → drag the new solar panel, toolkit and a tether into the capsule or cargo module.';
  if (!c.cargoFits) return 'Too much cargo. Add a <b>Cargo Module</b> (Crew tab) for more room, or unpack something.';
  if (report.errors.length) return 'Fix the <b>problems</b> listed on the right.';
  if (!sim?.success) return 'The mission check is red: read the reason on the right, then change the design.';
  return 'Ready to fly! Press <b>Board rocket</b>.';
}
