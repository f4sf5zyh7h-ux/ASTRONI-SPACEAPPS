import * as THREE from 'three';
import partsData from '../data/parts.json';
import { parts } from '../data/catalog.js';
import { analyzeDesign } from '../physics/rocket.js';
import { simulateMission, missionLegs } from '../physics/mission.js';

// The cockpit control pad: an in-world 1024×640 touchscreen drawn on a canvas and used as a
// texture on the capsule's control panel. Click with the mouse (raycast → uv → canvas pixel).
// Pages follow docs/UI_DESIGN_BRIEF.md §7.2.

const W = 1024;
const H = 640;
const C = {
  bg: '#04101c', panel: '#0a1a2c', line: '#1f4a6b', accent: '#4fc3f7', text: '#e6ecf5',
  muted: '#7f8ea6', ok: '#66bb6a', bad: '#ef5350', warn: '#ffcc66',
};
const PIXEL = '"Press Start 2P", monospace';
const TERM = '"VT323", monospace';

const PAGES = [
  ['status', 'STATUS'],
  ['checklist', 'CHECKLIST'],
  ['approach', 'APPROACH'],
  ['cargo', 'CARGO'],
  ['launch', 'LAUNCH'],
  ['deorbit', 'DEORBIT'],
];

const CHECKS = [
  ['crewSeats', 'Crew seats (2)'],
  ['heatShield', 'Heat shield'],
  ['parachutes', 'Parachutes'],
  ['capsuleSeparates', 'Capsule separation'],
  ['rcs', 'RCS thrusters'],
  ['fins', 'Fins (3+)'],
  ['liftoff', 'Liftoff TWR ≥ 1.2'],
  ['toolkit', 'Toolkit packed'],
  ['replacementPanel', 'Replacement panel packed'],
  ['tether', 'Tether packed'],
  ['cargoFits', 'Cargo fits'],
];

/** Names short enough for the cargo table. */
const shortName = (it) => ({ 'replacement-panel': 'New solar panel', 'spare-battery': 'Spare battery', tether: 'Safety tether' })[it.id] ?? it.name;

const ITEM_COLORS = { 'replacement-panel': '#4fc3f7', toolkit: '#ffcc66', tether: '#66bb6a', 'spare-battery': '#ce93d8', 'spare-o2': '#90caf9' };

/**
 * @param design   the rocket design (its cargo list is edited in place)
 * @param mission  mission definition (missions.json)
 * @param state    shared game state (approach is read/written here)
 * @param onLaunch called when the player presses LAUNCH while armed
 */
export function createControlPad({ design, mission, state, onLaunch }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  let page = 'status';
  let armed = false;
  let hits = []; // clickable regions drawn this frame: { x, y, w, h, act }
  let hover = null;
  let calc = null;

  /** Recompute physics for the current design / cargo / approach. */
  const recalc = () => {
    const report = analyzeDesign(design, parts);
    const sims = Object.fromEntries(mission.approaches.map((a) => [a.id, safeSim(a.id)]));
    calc = { report, sims, sim: sims[state.approach], need: missionLegs(mission, state.approach) };
  };
  const safeSim = (id) => {
    try { return simulateMission(design, parts, mission, id); } catch { return null; }
  };

  // ---------- drawing helpers ----------
  const font = (size, pixel = false) => (g.font = `${size}px ${pixel ? PIXEL : TERM}`);
  const text = (s, x, y, color = C.text, size = 30, pixel = false, align = 'left') => {
    font(size, pixel);
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillText(s, x, y);
  };
  const box = (x, y, w, h, fill, stroke) => {
    if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); }
  };
  const button = (label, x, y, w, h, act, { on = false, disabled = false, color = C.accent, size = 14 } = {}) => {
    const isHover = hover === act && !disabled;
    box(x, y, w, h, on ? color : isHover ? 'rgba(79,195,247,.25)' : 'rgba(79,195,247,.08)', disabled ? C.line : color);
    text(label, x + w / 2, y + h / 2 - size / 2, on ? C.bg : disabled ? C.muted : C.text, size, true, 'center');
    if (!disabled) hits.push({ x, y, w, h, act });
  };
  const wrap = (s, x, y, maxW, size = 26, color = C.text, lineH = size * 0.95) => {
    font(size);
    const words = s.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) {
        text(line, x, y, color, size);
        y += lineH;
        line = w;
      } else line = test;
    }
    if (line) text(line, x, y, color, size);
    return y + lineH;
  };
  const pill = (ok, x, y, okText = 'GO', badText = 'NO-GO') => {
    const label = ok ? okText : badText;
    box(x, y, 104, 30, ok ? 'rgba(102,187,106,.2)' : 'rgba(239,83,80,.2)', ok ? C.ok : C.bad);
    text(label, x + 52, y + 9, ok ? C.ok : C.bad, 11, true, 'center');
  };
  const bar = (x, y, w, h, frac, color) => {
    box(x, y, w, h, '#0d2236', C.line);
    box(x + 3, y + 3, Math.max(0, (w - 6) * Math.min(1, frac)), h - 6, color);
  };
  const kms = (v) => `${(v / 1000).toFixed(2)} km/s`;

  // ---------- pages ----------
  const drawStatus = () => {
    const { report, sim, need } = calc;
    text('PROPELLANT', 40, 96, C.accent, 13, true);
    let y = 128;
    report.stages.forEach((s, i) => {
      if (!s.section.engines.length && !s.section.monoprop) return;
      const label = s.section.engines.length ? `STAGE ${i + 1}` : 'CAPSULE';
      text(label, 40, y, C.muted, 26);
      bar(170, y + 2, 270, 26, 1, C.accent);
      text(`${(s.section.propellant / 1000).toFixed(1)} t`, 450, y, C.text, 26);
      y += 40;
    });
    const mono = report.sections.reduce((t, s) => t + s.monoprop, 0);
    text('RCS FUEL', 40, y, C.muted, 26);
    bar(170, y + 2, 270, 26, mono > 0 ? 1 : 0, mono > 0 ? C.ok : C.bad);
    text(`${mono.toFixed(0)} kg`, 450, y, C.text, 26);

    const total = need.launch + need.transfer + need.deorbit;
    const rows = [
      ['Δv AVAILABLE', kms(report.totalDv), C.text],
      ['Δv NEEDED', `${kms(total)} + ${need.rendezvous} m/s RCS`, C.text],
      ['RESULT', sim?.success ? `OK · ${Math.round(sim.spareDv)} m/s spare` : 'SHORT', sim?.success ? C.ok : C.bad],
      ['MASS', `${(report.totalMass / 1000).toFixed(1)} t`, C.text],
      ['POWER', powerText(report), report.sections.some((s) => s.roles.has('power')) ? C.ok : C.warn],
      ['LIFE SUPPORT', `${mission.deadlineH} h`, C.ok],
      ['COMMS', report.sections.some((s) => s.roles.has('antenna')) ? 'High-gain · blackout 30 s' : 'Low-gain · blackout 90 s', report.sections.some((s) => s.roles.has('antenna')) ? C.ok : C.warn],
      ['CREW', 'CDR ✔  SPC ✔', C.ok],
    ];
    y = 96;
    for (const [k, v, col] of rows) {
      text(k, 560, y, C.muted, 13, true);
      text(v, 560, y + 18, col, 28);
      y += 60;
    }
  };
  const powerText = (report) => {
    const solar = report.sections.some((s) => s.roles.has('power'));
    const battery = report.sections.some((s) => s.roles.has('battery'));
    return `${solar ? 'Solar ✔' : 'NO SOLAR'} · ${battery ? 'Battery ✔' : 'no battery'}`;
  };

  const drawChecklist = () => {
    const { report, sim } = calc;
    const items = CHECKS.map(([k, label]) => [label, !!report.checks[k]]);
    items.push([`Δv for ${approachName()}`, !!sim?.success]);
    items.forEach(([label, ok], i) => {
      const col = i < 7 ? 0 : 1;
      const row = i % 7;
      const x = 40 + col * 480;
      const y = 92 + row * 62;
      text(label, x, y + 2, C.text, 28);
      pill(ok, x + 330, y);
    });
    const bad = items.filter(([, ok]) => !ok).length;
    const ok = bad === 0;
    box(40, 538, 944, 50, ok ? 'rgba(102,187,106,.18)' : 'rgba(255,204,102,.12)', ok ? C.ok : C.warn);
    text(ok ? 'FLIGHT DIRECTOR: GO FOR LAUNCH' : `HOLD · ${bad} ITEM${bad > 1 ? 'S' : ''} NO-GO · YOU MAY STILL LAUNCH`, 512, 556, ok ? C.ok : C.warn, 14, true, 'center');
  };
  const approachName = () => mission.approaches.find((a) => a.id === state.approach)?.name ?? '';

  const drawApproach = () => {
    const { sims } = calc;
    mission.approaches.forEach((a, i) => {
      const x = 40 + i * 320;
      const y = 92;
      const sel = a.id === state.approach;
      const s = sims[a.id];
      const legs = missionLegs(mission, a.id);
      box(x, y, 300, 330, sel ? 'rgba(79,195,247,.14)' : C.panel, sel ? C.accent : C.line);
      hits.push({ x, y, w: 300, h: 330, act: `approach:${a.id}` });
      text(a.name.toUpperCase(), x + 16, y + 18, sel ? C.accent : C.text, 12, true);
      text(`Δv ${(legs.transfer / 1000).toFixed(2)} km/s`, x + 16, y + 52, C.text, 30);
      text(`about ${a.hours} h`, x + 16, y + 84, C.muted, 28);
      wrap(a.blurb, x + 16, y + 124, 268, 25, C.text);
      const ok = !!s?.success;
      const failLeg = s?.legs.find((l) => !l.ok);
      text(ok ? '✔ YOUR ROCKET CAN DO THIS' : '✘ NOT ENOUGH', x + 16, y + 262, ok ? C.ok : C.bad, 10, true);
      if (!ok && failLeg) text(`short by ${Math.round(failLeg.shortfall)} m/s (${failLeg.id})`, x + 16, y + 284, C.bad, 24);
      if (ok) text(`${Math.round(s.spareDv)} m/s spare`, x + 16, y + 284, C.muted, 24);
      if (sel) text('SELECTED', x + 284, y + 18, C.accent, 9, true, 'right');
    });
    drawOrbits(40, 440);
  };
  /** Little diagram: Earth, 400 km parking orbit, 700 km target orbit, transfer arc. */
  const drawOrbits = (x, y) => {
    box(x, y, 944, 148, C.panel, C.line);
    const cx = x + 120;
    const cy = y + 74;
    g.fillStyle = '#1e5a8c';
    g.beginPath(); g.arc(cx, cy, 40, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.muted; g.setLineDash([4, 4]);
    g.beginPath(); g.arc(cx, cy, 52, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = C.accent; g.setLineDash([]);
    g.beginPath(); g.arc(cx, cy, 64, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = C.warn; g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx + 6, cy, 58, 56, 0, Math.PI * 0.05, Math.PI * 1.0); g.stroke();
    g.lineWidth = 2;
    text('Earth', cx, cy - 8, C.text, 20, false, 'center');
    wrap('Dashed: parking orbit (400 km). Blue: AURORA-7 at 700 km. Yellow: your transfer path. A Hohmann transfer uses two short burns: one to stretch the orbit up to 700 km, one at the top to round it off.', x + 220, y + 14, 700, 24, C.text);
  };

  const drawCargo = () => {
    const { report, sim } = calc;
    const total = report.slotsTotal;
    // Slot grid: fill with packed items in order.
    text(`STORAGE · ${report.slotsUsed} / ${total} SLOTS`, 40, 92, report.slotsUsed > total ? C.bad : C.accent, 12, true);
    const fills = [];
    for (const c of design.cargo) {
      const it = parts.get(c.item);
      for (let k = 0; k < c.count; k++) for (let s = 0; s < it.slots; s++) fills.push(c.item);
    }
    const cols = 5;
    for (let i = 0; i < Math.max(total, fills.length); i++) {
      const x = 40 + (i % cols) * 86;
      const y = 124 + Math.floor(i / cols) * 86;
      const item = fills[i];
      const over = i >= total;
      box(x, y, 78, 78, item ? ITEM_COLORS[item] + '55' : C.panel, over ? C.bad : item ? ITEM_COLORS[item] : C.line);
      if (item && (i === 0 || fills[i - 1] !== item || i % cols === 0)) text(shortName(parts.get(item)).split(' ')[0].slice(0, 7), x + 6, y + 6, C.text, 20);
    }
    // Item list with − / + buttons.
    let y = 92;
    text('ITEM', 500, y, C.muted, 11, true);
    text('KG', 760, y, C.muted, 11, true);
    text('SLOTS', 820, y, C.muted, 11, true);
    y += 30;
    for (const it of partsData.items) {
      const entry = design.cargo.find((c) => c.item === it.id);
      const n = entry?.count ?? 0;
      box(500, y + 8, 14, 14, ITEM_COLORS[it.id]);
      text(shortName(it) + (it.required ? ' *' : ''), 524, y, n ? C.text : C.muted, 27);
      text(String(it.mass), 760, y, C.muted, 27);
      text(String(it.slots), 840, y, C.muted, 27);
      button('−', 880, y - 2, 36, 34, `cargo:-:${it.id}`, { size: 14, disabled: n === 0 });
      text(String(n), 932, y, C.text, 28, false, 'center');
      button('+', 948, y - 2, 36, 34, `cargo:+:${it.id}`, { size: 14 });
      y += 52;
    }
    text('* required for the repair', 500, y + 4, C.muted, 22);
    const kg = design.cargo.reduce((t, c) => t + parts.get(c.item).mass * c.count, 0);
    box(40, 538, 944, 50, C.panel, C.line);
    text(`CARGO ${kg} kg`, 60, 552, C.text, 13, true);
    text(sim?.success ? `Mission Δv OK · ${Math.round(sim.spareDv)} m/s spare` : 'Mission Δv SHORT: lighten the load or rebuild', 964, 548, sim?.success ? C.ok : C.bad, 28, false, 'right');
  };

  const drawLaunch = (t) => {
    const { report, sim } = calc;
    const issues = CHECKS.filter(([k]) => !report.checks[k]).map(([, l]) => l);
    if (!sim?.success) issues.push(`Not enough Δv for ${approachName()}`);
    text('MASTER ARM', 40, 96, C.muted, 12, true);
    // Guarded toggle switch.
    box(40, 124, 300, 120, C.panel, armed ? C.warn : C.line);
    box(60, 150, 120, 68, armed ? C.warn : '#0d2236', C.line);
    box(armed ? 124 : 64, 154, 52, 60, armed ? '#3a2a00' : C.muted);
    text(armed ? 'ARMED' : 'SAFE', 200, 168, armed ? C.warn : C.muted, 18, true);
    hits.push({ x: 40, y: 124, w: 300, h: 120, act: 'arm' });
    text('Click the switch to arm.', 40, 256, C.muted, 24);

    // Launch button blinks when armed.
    const blink = armed && Math.floor(t * 2) % 2 === 0;
    button('LAUNCH', 400, 124, 584, 120, 'launch', { on: blink, disabled: !armed, color: armed ? C.bad : C.line, size: 30 });

    text(issues.length ? 'WARNINGS' : 'ALL SYSTEMS GO', 40, 310, issues.length ? C.warn : C.ok, 12, true);
    issues.slice(0, 8).forEach((s, i) => text(`⚠ ${s}`, 40 + (i >= 4 ? 480 : 0), 340 + (i % 4) * 36, C.warn, 27));
    if (issues.length) wrap('You can launch anyway. Real engineers would hold, but this is a simulator: launching a flawed design shows exactly what goes wrong.', 40, 500, 944, 24, C.muted);
  };

  const drawDeorbit = () => {
    text('DE-ORBIT BURN', 40, 96, C.accent, 13, true);
    wrap('Available after the repair. Here you will fire the engine to slow down so the orbit dips into the atmosphere and the capsule comes home.', 40, 136, 900, 28, C.muted);
  };

  /** Redraw the whole screen. Call when something changes (and a few times a second for blinking). */
  const draw = (t = 0) => {
    if (!calc) recalc();
    hits = [];
    box(0, 0, W, H, C.bg);
    // Scanlines for the CRT feel.
    g.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
    // Tabs.
    PAGES.forEach(([id, label], i) => {
      const disabled = id === 'deorbit';
      button(`${i + 1} ${label}`, 8 + i * 168, 8, 160, 54, `page:${id}`, { on: page === id, disabled: disabled && page !== id, size: 11 });
    });
    box(0, 70, W, 2, C.line);
    ({ status: drawStatus, checklist: drawChecklist, approach: drawApproach, cargo: drawCargo, launch: drawLaunch, deorbit: drawDeorbit })[page](t);
    // Footer.
    box(0, 600, W, 40, '#020a12');
    text(`${mission.name.toUpperCase()} · ${approachName().toUpperCase()} · ${armed ? 'ARMED' : 'SAFE'}`, 16, 612, C.muted, 10, true);
    text('Keys 1–6 switch pages', W - 16, 606, C.muted, 24, false, 'right');
    texture.needsUpdate = true;
  };

  const act = (a) => {
    if (!a) return;
    const [kind, x, y] = a.split(':');
    if (kind === 'page') page = x;
    if (kind === 'approach') { state.approach = x; recalc(); }
    if (kind === 'cargo') {
      let entry = design.cargo.find((c) => c.item === y);
      if (!entry) { entry = { item: y, count: 0 }; design.cargo.push(entry); }
      entry.count = Math.max(0, Math.min(6, entry.count + (x === '+' ? 1 : -1)));
      design.cargo = design.cargo.filter((c) => c.count > 0);
      recalc();
    }
    if (kind === 'arm') armed = !armed;
    if (kind === 'launch' && armed) onLaunch?.();
    draw();
  };

  const hitAt = (uv) => {
    const px = uv.x * W;
    const py = (1 - uv.y) * H;
    return hits.find((h) => px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h)?.act ?? null;
  };

  // Redraw once the pixel fonts are ready (canvas can't wait for them by itself).
  document.fonts?.load(`20px ${PIXEL}`).then(() => document.fonts.load(`20px ${TERM}`)).then(() => draw());
  draw();

  return {
    texture,
    draw,
    /** uv from a raycast hit; returns true if something was clicked. */
    click(uv) {
      const a = hitAt(uv);
      act(a);
      return !!a;
    },
    hover(uv) {
      const a = uv ? hitAt(uv) : null;
      if (a !== hover) { hover = a; draw(); }
      return !!a;
    },
    key(n) {
      const p = PAGES[n - 1];
      if (p && p[0] !== 'deorbit') act(`page:${p[0]}`);
    },
    get armed() { return armed; },
  };
}
