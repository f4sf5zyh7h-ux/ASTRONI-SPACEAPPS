import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parts, DIAMETER } from '../data/catalog.js';
import { casingDesign, standardCargo } from '../data/designs.js';
import { analyzeDesign } from '../physics/rocket.js';
import { simulateMission, missionLegs } from '../physics/mission.js';
import { buildRocket } from '../render/rocketMesh.js';
import { createPartMesh } from '../render/partMesh.js';
import { createCatalog, renderStats } from '../ui/workshopUi.js';
import { createWorkshopSite } from '../render/workshopSite.js';
import { state } from '../state.js';
import { transition } from '../ui/fade.js';
import missionData from '../data/missions.json';

const SNAP_PX = 80; // how close (on screen) the cursor must be to a node to snap
const RADIAL_ANGLE = Math.PI / 4; // first side part sits here (matches rocketMesh)

const hullRadius = (p) => Math.max(DIAMETER[p.sizeTop] ?? 0, DIAMETER[p.sizeBottom] ?? 0) / 2 || 0.6;
/** Stack parts big enough to carry side parts. */
const SIZE_RANK = { S: 1, M: 2, L: 3 };
const isBody = (p) =>
  !p.radial && p.sizeTop && p.sizeBottom && p.height >= 1 && p.category !== 'engines' && p.role !== 'decoupler' && !p.id.startsWith('adapter');

/** Workshop: an empty launch pad; drag parts from the catalogue to build the rocket. */
export function createWorkshopScene() {
  const mission = missionData.missions.find((m) => m.id === state.missionId) ?? missionData.missions[0];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  scene.userData.envIntensity = 0.35; // indoor hangar: softer reflections
  scene.fog = new THREE.Fog(0x0b1220, 120, 420);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);

  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x2a2f38, 0.7));
  const sun = new THREE.DirectionalLight(0xfff1dd, 1.3);
  sun.position.set(40, 90, 30);
  scene.add(sun);
  const site = createWorkshopSite(scene);

  // ---------- design state ----------
  let design = state.design ? structuredClone(state.design) : { stack: [], cargo: standardCargo() };
  const history = [];
  let symmetry = 4;
  let rocket = null;
  let statsEl;
  let hint;

  const commit = (mutate) => {
    history.push(JSON.stringify(design));
    if (history.length > 100) history.shift();
    mutate();
    rebuild();
  };

  const rebuild = () => {
    if (rocket) scene.remove(rocket.group);
    rocket = buildRocket(design, parts);
    rocket.group.position.y = site.base; // stands on the turntable
    scene.add(rocket.group);
    state.design = structuredClone(design);
    targetY = site.base + Math.max(3, rocket.height * 0.45);
    if (statsEl) refreshStats();
    if (hint) hint.style.display = design.stack.length ? 'none' : '';
    setXray(xrayToggle);
  };

  const refreshStats = () => {
    let report = null;
    let sim = null;
    try {
      report = analyzeDesign(design, parts);
      sim = simulateMission(design, parts, mission, state.approach);
    } catch (err) {
      console.warn('[workshop] analysis failed', err);
    }
    renderStats(statsEl, {
      design, report, sim, mission,
      need: missionLegs(mission, state.approach),
      approach: state.approach, approaches: mission.approaches,
    });
  };

  /** Hull radius at height y (rocket-local), 0 above the top. */
  const radiusAt = (y) => {
    for (let i = 0; i < design.stack.length; i++) {
      const o = rocket.objects[i];
      const p = parts.get(design.stack[i].part);
      if (y >= o.position.y && y <= o.position.y + p.height + (design.stack[i].engines ? parts.get(design.stack[i].engines.part).height : 0)) return hullRadius(p);
    }
    return 0;
  };
  /** Clamps grip the lowest tank or module, about 1 m above its bottom. */
  const gripPoint = () => {
    for (let i = design.stack.length - 1; i >= 0; i--) {
      const p = parts.get(design.stack[i].part);
      if (!isBody(p)) continue;
      const y = Math.min(rocket.objects[i].position.y + 1, rocket.objects[i].position.y + p.height / 2);
      const jaw = Math.min(5.3, Math.max(1.5, site.base + y));
      return { y: jaw, r: radiusAt(jaw - site.base) || hullRadius(p) };
    }
    return null;
  };

  // ---------- nodes (where a dragged part may attach) ----------
  /** World-space attach points valid for `part`, each with an apply() that changes the design. */
  const nodesFor = (part) => {
    const nodes = [];
    const st = design.stack;
    const objs = rocket.objects;
    // Internals go inside casings with room for them (thrust plates only into the bottom slot).
    if (part.category === 'internals') {
      st.forEach((e, i) => {
        const p = parts.get(e.part);
        if (!p.interior || SIZE_RANK[part.size] > SIZE_RANK[p.interior.size]) return;
        const inside = e.inside ?? [];
        const used = inside.reduce((t, c) => t + parts.get(c.part).height, 0);
        const isPlate = part.role === 'thrust-plate';
        if (isPlate && inside[0] && parts.get(inside[0].part).role === 'thrust-plate') return;
        if (used + part.height > p.interior.height + 1e-6) return;
        const y = site.base + objs[i].position.y + (isPlate ? 0 : used);
        nodes.push({
          kind: 'inside', r: (DIAMETER[p.interior.size] ?? 2.5) / 2 - 0.1, h: part.height,
          pos: new THREE.Vector3(0, y + part.height / 2, 0), base: y,
          apply: () => { e.inside = isPlate ? [{ part: part.id }, ...inside] : [...inside, { part: part.id }]; },
        });
      });
      return nodes;
    }
    if (part.radial) {
      st.forEach((e, i) => {
        const p = parts.get(e.part);
        if (!isBody(p)) return;
        const r = hullRadius(p);
        const y = site.base + objs[i].position.y + p.height / 2;
        nodes.push({
          kind: 'radial', r, angle: RADIAL_ANGLE,
          pos: new THREE.Vector3(Math.cos(RADIAL_ANGLE) * r, y, -Math.sin(RADIAL_ANGLE) * r),
          apply: () => {
            e.radial ??= [];
            const same = e.radial.find((g) => g.part === part.id);
            if (same) same.count = Math.min(8, same.count + symmetry);
            else e.radial.push({ part: part.id, count: symmetry });
          },
        });
      });
      return nodes;
    }
    // Stack joints: above the top, between every pair, below the bottom.
    const n = st.length;
    if (n === 0) {
      nodes.push({ kind: 'stack', r: (DIAMETER[part.sizeBottom] ?? 2.5) / 2, pos: new THREE.Vector3(0, site.base, 0), apply: () => st.push({ part: part.id }) });
    }
    for (let k = 0; k <= n && n > 0; k++) {
      const above = k > 0 ? parts.get(st[k - 1].part) : null;
      const below = k < n ? parts.get(st[k].part) : null;
      const fitsAbove = !above || (above.sizeBottom && above.sizeBottom === part.sizeTop);
      const fitsBelow = !below || (below.sizeTop && part.sizeBottom === below.sizeTop);
      if (!fitsAbove || !fitsBelow) continue;
      const y = site.base + (k === 0 ? rocket.height : objs[k - 1].position.y);
      const r = Math.max(above ? hullRadius(above) : 0, below ? hullRadius(below) : 0);
      nodes.push({ kind: 'stack', r, pos: new THREE.Vector3(0, y, 0), apply: () => st.splice(k, 0, { part: part.id }) });
    }
    // Engines can also go into an engine mount's cluster.
    if (part.category === 'engines') {
      st.forEach((e, i) => {
        const p = parts.get(e.part);
        if (!p.engineCapacity || p.engineSize !== part.sizeTop) return;
        if (e.engines && (e.engines.part !== part.id || e.engines.count >= p.engineCapacity)) return;
        nodes.push({
          kind: 'engine', r: 0.6,
          pos: new THREE.Vector3(0, site.base + objs[i].position.y + (e.engines ? 0 : -0.2), 0),
          apply: () => { e.engines = e.engines ? { ...e.engines, count: e.engines.count + 1 } : { part: part.id, count: 1 }; },
        });
      });
      // …or onto a casing's thrust plate (any engine no bigger than the plate).
      st.forEach((e, i) => {
        const plate = e.inside?.[0];
        const pp = plate && parts.get(plate.part);
        if (pp?.role !== 'thrust-plate' || SIZE_RANK[part.sizeTop] > SIZE_RANK[pp.size]) return;
        if (plate.engines && (plate.engines.part !== part.id || plate.engines.count >= pp.engineCapacity)) return;
        nodes.push({
          kind: 'engine', r: 0.6,
          pos: new THREE.Vector3(0, site.base + objs[i].position.y - 0.4, 0),
          apply: () => { plate.engines = plate.engines ? { ...plate.engines, count: plate.engines.count + 1 } : { part: part.id, count: 1 }; },
        });
      });
    }
    return nodes;
  };

  /** Plain-English reason a part has nowhere to attach, naming the adapter that would help. */
  const SIZE_NAME = { S: 'small (1.25 m)', M: 'medium (2.5 m)', L: 'large (3.75 m)' };
  const whyNoFit = (part) => {
    if (part.radial) return `Side parts go on tanks or modules. Add a tank or module first.`;
    const top = parts.get(design.stack[0]?.part);
    if (!top) return `Nowhere for the ${part.name} to fit yet.`;
    if (!top.sizeTop) return `Nothing can go on top of the ${top.name}. Remove it or insert below it.`;
    const want = part.sizeBottom;
    const have = top.sizeTop;
    const adapter = { 'L>M': 'Adapter L→M', 'M>S': 'Adapter M→S' }[`${have}>${want}`];
    return `The ${part.name} needs a ${SIZE_NAME[want]} part under it, but your rocket's top is ${SIZE_NAME[have]}.` +
      (adapter ? ` Add an ${adapter} (Structure tab) first.` : ' Try a different size of part.');
  };

  // ---------- drag & drop ----------
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const activeMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0x7fd6ff, emissive: 0x1a4a66, transparent: true, opacity: 0.55, depthWrite: false });
  let drag = null; // { part, ghost, nodes, markers, snapped }
  const plane = new THREE.Plane();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const startDrag = (part, e) => {
    const ghost = createPartMesh(part, null, parts);
    ghost.traverse((o) => { if (o.isMesh) o.material = ghostMat; });
    ghost.userData.height = part.height; // the crane hook hangs just above it
    scene.add(ghost);
    const nodes = nodesFor(part);
    const markers = new THREE.Group();
    for (const node of nodes) {
      const m = node.kind === 'stack'
        ? new THREE.Mesh(new THREE.TorusGeometry(node.r + 0.25, 0.12, 8, 48), markerMat)
        : node.kind === 'inside'
          ? new THREE.Mesh(new THREE.CylinderGeometry(node.r, node.r, node.h, 32, 1, true), markerMat) // the free space it would fill
          : new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), markerMat);
      if (node.kind === 'stack') m.rotation.x = Math.PI / 2;
      m.position.copy(node.pos);
      node.marker = m;
      markers.add(m);
    }
    scene.add(markers);
    drag = { part, ghost, nodes, markers, snapped: null };
    if (part.category === 'internals' || part.category === 'engines') setXray(true);
    controls.enabled = false;
    document.body.classList.add('dragging');
    if (!nodes.length) toast(whyNoFit(part));
    moveDrag(e);
  };

  const moveDrag = (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Nearest node on screen.
    let best = null;
    let bestD = SNAP_PX;
    for (const node of drag.nodes) {
      const s = node.pos.clone().project(camera);
      const sx = (s.x * 0.5 + 0.5) * rect.width;
      const sy = (-s.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD && s.z < 1) { best = node; bestD = d; }
    }
    for (const node of drag.nodes) node.marker.material = node === best ? activeMat : markerMat;
    drag.snapped = best;
    const g = drag.ghost;
    g.rotation.set(0, 0, 0);
    if (best?.kind === 'inside') {
      g.position.set(0, best.base, 0);
    } else if (best) {
      g.position.copy(best.kind === 'radial' ? best.pos : new THREE.Vector3(0, best.pos.y, 0));
      if (best.kind === 'radial') g.rotation.y = best.angle;
    } else {
      // Follow the cursor on a vertical plane through the rocket, facing the camera.
      const n = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate();
      plane.setFromNormalAndCoplanarPoint(n, controls.target);
      ndc.set((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      raycaster.ray.intersectPlane(plane, g.position);
    }
  };

  const endDrag = () => {
    if (!drag) return;
    scene.remove(drag.ghost, drag.markers);
    drag.markers.traverse((o) => o.geometry?.dispose());
    const node = drag.snapped;
    const part = drag.part;
    drag = null;
    controls.enabled = true;
    document.body.classList.remove('dragging');
    setXray(xrayToggle);
    if (node) commit(node.apply);
    else if (part) toast('Drop it on a glowing spot to attach it.');
  };

  // ---------- remove (right-click) and hover name ----------
  const pick = (e) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(rocket.group, true)[0];
    let o = hit?.object;
    let engineHit = false;
    while (o && o.userData.index === undefined) {
      if (o.userData.engine) engineHit = true;
      o = o.parent;
    }
    if (o) o.userData.hitEngine = engineHit;
    return o ?? null;
  };

  const removeAt = (e) => {
    e.preventDefault();
    const o = pick(e);
    if (!o) return;
    const entry = design.stack[o.userData.index];
    commit(() => {
      if (o.userData.radial) {
        entry.radial = entry.radial.filter((g) => g.part !== o.userData.radial);
        if (!entry.radial.length) delete entry.radial;
      } else if (entry.engines) {
        // Engine mounts lose one engine per click, then the mount itself.
        entry.engines.count -= 1;
        if (entry.engines.count <= 0) delete entry.engines;
      } else if (entry.inside?.length) {
        // Casings empty out first: engines one at a time, then internals from the top down.
        const plate = entry.inside[0];
        if (o.userData.hitEngine && plate.engines) {
          plate.engines.count -= 1;
          if (plate.engines.count <= 0) delete plate.engines;
        } else {
          const top = entry.inside[entry.inside.length - 1];
          if (top === plate && plate.engines) {
            plate.engines.count -= 1;
            if (plate.engines.count <= 0) delete plate.engines;
          } else entry.inside.pop();
        }
        if (!entry.inside.length) delete entry.inside;
      } else {
        design.stack.splice(o.userData.index, 1);
      }
    });
  };

  // ---------- X-ray: fade casing shells to see the internals ----------
  let xrayToggle = false;
  const xrayMats = new Map();
  const setXray = (on) => {
    rocket.group.traverse((o) => {
      if (!o.isMesh || !o.userData.shell) return;
      if (on) {
        if (!o.userData.solidMat) o.userData.solidMat = o.material;
        const base = o.userData.solidMat;
        if (!xrayMats.has(base)) {
          const m = base.clone();
          m.transparent = true;
          m.opacity = 0.18;
          m.depthWrite = false;
          xrayMats.set(base, m);
        }
        o.material = xrayMats.get(base);
      } else if (o.userData.solidMat) {
        o.material = o.userData.solidMat;
      }
    });
  };

  // ---------- UI glue ----------
  let controls;
  let canvas;
  let ui;
  let tip;
  let toastEl;
  let toastTimer;
  let targetY = 3;
  const listeners = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn, opts));
  };

  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000 + msg.length * 40); // longer messages stay longer
  };

  const hover = (e) => {
    if (drag || e.target !== canvas) return tip.classList.remove('show');
    const o = pick(e);
    if (!o) return tip.classList.remove('show');
    const entry = design.stack[o.userData.index];
    const p = parts.get(o.userData.radial ?? entry.part);
    const extra = o.userData.radial ? '' : entry.engines ? ` + ${entry.engines.count}× ${parts.get(entry.engines.part).name}` : '';
    let body = '';
    let action = 'Right-click to remove' + (entry.engines && !o.userData.radial ? ' one engine' : '');
    if (p.interior && !o.userData.radial) {
      // Casing readout: what's inside and how full it is.
      const inside = entry.inside ?? [];
      const used = inside.reduce((t, c) => t + parts.get(c.part).height, 0);
      const list = inside.slice().reverse().map((c) => `${parts.get(c.part).name}${c.engines ? ` + ${c.engines.count}× ${parts.get(c.engines.part).name}` : ''}`);
      body = `<div class="tip-fill"><i style="width:${Math.min(100, (used / p.interior.height) * 100)}%"></i></div>` +
        `<span class="muted">${used.toFixed(1)} / ${p.interior.height} m used</span><br>${list.length ? list.join('<br>') : '<span class="muted">Empty: drag internals in</span>'}<br>`;
      if (inside.length) action = 'Right-click to take out the top item';
    }
    tip.innerHTML = `<b>${p.name}</b>${extra}<br>${body}<span class="muted">${action}</span>`;
    tip.style.left = `${e.clientX + 16}px`;
    tip.style.top = `${e.clientY + 12}px`;
    tip.classList.add('show');
  };

  return {
    scene,
    camera,
    enter(ctx) {
      ui = ctx.ui;
      canvas = ctx.renderer.domElement;
      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.minDistance = 6;
      controls.maxDistance = 260;
      ctx.renderer.localClippingEnabled = true; // factory cutaway
      camera.position.set(14, 9, 19);
      controls.target.set(0, 3, 0);

      const head = document.createElement('div');
      head.className = 'screen-head';
      head.innerHTML = `<span>WORKSHOP</span> · ${mission.name}`;
      ui.appendChild(head);

      createCatalog(ui, startDrag);
      statsEl = document.createElement('div');
      statsEl.className = 'ws-stats panel';
      ui.appendChild(statsEl);

      const bar = document.createElement('div');
      bar.className = 'ws-toolbar panel';
      bar.innerHTML = `
        <button data-act="undo" title="Undo the last change (Ctrl+Z)">↶ Undo</button>
        <button data-act="clear" title="Remove everything">Clear</button>
        <button data-act="reference" title="Load a working example rocket">Example</button>
        <button data-act="xray" title="See inside the casings">X-ray</button>
        <span class="ws-sym" title="How many copies of a side part are added at once">Side parts:
          ${[1, 2, 4].map((s) => `<button data-sym="${s}" class="${s === symmetry ? 'on' : ''}">×${s}</button>`).join('')}
        </span>
        <button class="cta" data-act="next">Board rocket ▶</button>`;
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.sym) {
          symmetry = Number(b.dataset.sym);
          bar.querySelectorAll('[data-sym]').forEach((x) => x.classList.toggle('on', x === b));
        }
        if (b.dataset.act === 'undo') undo();
        if (b.dataset.act === 'xray') { xrayToggle = !xrayToggle; b.classList.toggle('on', xrayToggle); setXray(xrayToggle); }
        if (b.dataset.act === 'clear' && design.stack.length) commit(() => (design.stack = []));
        if (b.dataset.act === 'reference') commit(() => (design = casingDesign()));
        if (b.dataset.act === 'next') board();
      });
      ui.appendChild(bar);

      hint = document.createElement('div');
      hint.className = 'ws-hint';
      hint.innerHTML = 'Drag a part from the left onto the glowing ring on the stand.<br><span class="muted">Tip: start with a tank and engines, or load the example rocket.</span>';
      ui.appendChild(hint);

      tip = document.createElement('div');
      tip.className = 'ws-tip';
      ui.appendChild(tip);
      toastEl = document.createElement('div');
      toastEl.className = 'ws-toast';
      ui.appendChild(toastEl);

      statsEl.addEventListener('change', (e) => {
        if (e.target.classList.contains('ws-approach')) {
          state.approach = e.target.value;
          refreshStats();
        }
      });

      // Board: needs a capsule. Failing checks are allowed (failing teaches), but warn first.
      let armed = 0;
      const board = () => {
        if (!design.stack.some((e) => e.part === 'capsule-2')) return toast('Add a Crew Capsule first: the crew needs somewhere to sit.');
        let report;
        try { report = analyzeDesign(design, parts); } catch { report = null; }
        const failing = report ? Object.values(report.checks).filter((ok) => !ok).length : 1;
        if (failing && performance.now() - armed > 4000) {
          armed = performance.now();
          return toast(`${failing} checklist item${failing > 1 ? 's are' : ' is'} not ready. Click Board again to go anyway.`);
        }
        transition(ctx.manager, 'boarding', {}, 700);
      };
      const undo = () => {
        if (!history.length) return toast('Nothing to undo.');
        design = JSON.parse(history.pop());
        rebuild();
      };
      on(window, 'pointermove', (e) => { moveDrag(e); hover(e); });
      on(window, 'pointerup', endDrag);
      on(canvas, 'contextmenu', removeAt);
      on(window, 'keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
        if (e.key === 'Escape' && drag) { drag.snapped = null; drag.part = null; endDrag(); }
      });

      rebuild();
      // Showing the empty pad's first node right away teaches where to drop.
    },
    exit() {
      listeners.forEach((off) => off());
      controls?.dispose();
      document.body.classList.remove('dragging');
    },
    update(dt) {
      // Keep the camera looking at the middle of the rocket as it grows.
      controls.target.y += (targetY - controls.target.y) * Math.min(1, dt * 3);
      // Back off far enough to fit the whole rocket in view (45° field of view).
      const minDist = Math.max(14, (rocket?.height ?? 0) * 1.3 + 8);
      const dist = camera.position.distanceTo(controls.target);
      if (dist < minDist * 0.9 && !drag) {
        const dir = camera.position.clone().sub(controls.target).normalize();
        camera.position.addScaledVector(dir, (minDist - dist) * Math.min(1, dt * 5));
      }
      if (drag) {
        const pulse = 0.45 + Math.sin(performance.now() / 180) * 0.25;
        markerMat.opacity = pulse;
      }
      site.update(dt, { camera, rocketHeight: rocket.height, radiusAt, grip: gripPoint(), carry: drag?.ghost ?? null });
      controls.update();
    },
  };
}
