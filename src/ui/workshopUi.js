// Workshop HTML panels: parts catalogue (left), live stats + checklist (right).
import { partList, parts, DIAMETER, isLocked } from '../data/catalog.js';
import { PART_INFO } from '../data/partInfo.js';
import { partThumbnails } from '../render/thumbnails.js';
import { tonnes, kms, kN, money } from './format.js';

const TABS = [
  ['crew', 'Crew'],
  ['tanks', 'Tanks'],
  ['engines', 'Engines'],
  ['structure', 'Structure'],
  ['systems', 'Systems'],
];

/** Left panel. `onGrab(part, event)` starts a drag. */
export function createCatalog(ui, onGrab) {
  const el = document.createElement('div');
  el.className = 'ws-catalog panel';
  const thumbs = partThumbnails(partList, parts);
  let tab = 'crew';

  const info = document.createElement('div');
  info.className = 'ws-info panel';
  ui.appendChild(info);

  const render = () => {
    el.innerHTML = `
      <div class="ws-tabs">${TABS.map(([id, label]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${label}</button>`).join('')}</div>
      <div class="ws-grid">${partList
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
      <div class="muted ws-help">Drag a part onto a glowing spot. Right-click a part to remove it.</div>`;
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
  const rows = [];
  const size = p.radial ? 'Side-mounted' : [p.sizeBottom, p.sizeTop].filter(Boolean).map((s) => `${DIAMETER[s]} m`).join(' → ');
  rows.push(['Size', `${size} · ${p.height} m tall`]);
  rows.push(['Mass', tonnes(p.mass, 2) + (p.propellant ? ` + ${tonnes(p.propellant, 1)} fuel` : '') + (p.monoprop ? ` + ${tonnes(p.monoprop, 2)} RCS fuel` : '')]);
  if (p.thrustVac) rows.push(['Thrust', p.thrustSL ? `${kN(p.thrustSL)} at sea level / ${kN(p.thrustVac)} in space` : `${kN(p.thrustVac)} (space only)`]);
  if (p.ispVac) rows.push(['Efficiency (Isp)', p.ispSL ? `${p.ispSL} s sea level / ${p.ispVac} s space` : `${p.ispVac} s`]);
  if (p.seats) rows.push(['Seats', p.seats]);
  if (p.slots) rows.push(['Storage', `${p.slots} slots`]);
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
  ['docking', 'Docking port', 'Lets you hold on to the satellite during the repair.'],
  ['rcs', 'RCS thrusters', 'Needed to line up with the satellite (4 recommended).'],
  ['fins', 'Fins on the bottom stage (3+)', 'Without fins the rocket wobbles and wastes 5% of its launch Δv.'],
  ['liftoff', 'Liftoff thrust-to-weight ≥ 1.2', 'Engines must push harder than the rocket weighs, with margin, to clear the tower.'],
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

    <h3>Checklist</h3>
    <ul class="ws-checks">${CHECKS.map(([k, label, why]) => `<li class="${report.checks[k] ? 'good' : 'bad'}" title="${why}">${report.checks[k] ? '✔' : '✘'} ${label}</li>`).join('')}</ul>
    ${report.errors.length ? `<h3>Problems</h3><ul class="ws-errors">${report.errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
    <p class="muted">Hover any item for an explanation.</p>`;
}
