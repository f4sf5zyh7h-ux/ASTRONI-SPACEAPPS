# ASTRONI — Space Mission Design Game (NASA Space Apps 2026)

This file is the single source of truth for the project. Read it fully at the start of every session.
Build in small, testable steps. Never rebuild the whole game in one go. If a request conflicts with this file, ask first.

> **Section 14 (Agreed decisions) overrides anything above it that it contradicts.**

## 1. The pitch

A browser game where you are a small space contractor. You win a contract, design and build a spacecraft from parts, pack the crew pod, launch, fly to a damaged science satellite, send an astronaut out to repair it, and bring the crew home — all on a budget, with real rocket physics and mid-mission failures that your design choices make better or worse.

- **Tagline:** "Build it. Fly it. Fix it. Bring them home."
- **Audience:** secondary-school / A-level physics students (and anyone curious). Every number shown must have a plain-English "why".
- **Core idea:** design decisions in the workshop decide what happens in space. Every part is a trade-off.

### NASA Space Apps challenge alignment (Space Mission Design Game)

The brief asks players to: define the mission objective → design spacecraft & payload → choose launch vehicle & orbit → manage budget / mass / power / comms / data / duration → simulate and evaluate. It rewards mission performance, scientific value, efficient resource use, decision quality and collaboration, with clear feedback on why a mission succeeded or failed, the ability to redesign and re-run, random events, a dashboard, a final report.

| Brief item | Our feature |
|---|---|
| Mission objective & requirements | Contract briefing screen |
| Spacecraft & payload design | Block-by-block workshop + pod loadout |
| Launch vehicle & orbit | You build the launcher; choose an approach orbit |
| Resource constraints | Live budget, mass, Δv, TWR, power, life-support bars |
| Simulate & evaluate | Flight phases, failures, debrief with causes |
| Scientific value | Satellite is an Earth-observation science satellite; score = science restored |
| Random events | Failure pool (fuel leak, solar flare, debris graze, stuck bolt) |
| Redesign & re-run | "Back to workshop" from debrief keeps your design |
| 1–4 players / roles | Stretch goal: co-op stations (Engineer, Comms, Resources, Commander) |

## 2. Tech stack & conventions

- Vite + Three.js + vanilla JavaScript (ES modules). No React. Keep dependencies minimal.
- UI = HTML/CSS overlay on top of the Three.js canvas (simpler than 3D UI).
- Camera: OrbitControls in the workshop; PointerLockControls-style first-person for cockpit/EVA.
- Models: GLB files in `/public/models/`. Until a GLB exists, render the part as a primitive (cylinder/cone/box) using its dimensions from parts.json. **The game must always work with primitives only.**
- Units internally: SI (metres, kilograms, seconds, newtons, m/s). Convert only for display (t, km/s, kN).
- Y axis = up.
- Physics lives in one pure module (`src/physics/`) with no Three.js imports, so it can be unit-tested with Vitest.
- Keep files small and focused. Comment any formula with its source/assumption.
- Performance: target 60 fps on a mid-range laptop. One scene active at a time. Reuse geometries/materials. Show an FPS counter in dev mode.

### Folder structure

```
/public/models/          GLB part models
/src/main.js             boot + scene manager
/src/scenes/             intro, menu, briefing, workshop, loadout, flight, rendezvous, eva, debrief
/src/physics/            rocket.js (Δv, TWR, staging), orbits.js, tests
/src/data/parts.json     ALL part stats (single source of truth)
/src/data/missions.json  mission definitions
/src/data/events.json    failure/random event definitions
/src/ui/                 HUD, panels, tooltips
/src/state.js            game state (current design, loadout, mission progress)
```

### Git workflow

- After each feature works: commit with a clear message and push (e.g. `workshop: parts snap to attach nodes`).
- Never commit node_modules or build output.
- Keep `AI_USAGE.md` updated: a short log of what AI generated vs what the human designed/validated (needed for the Space Apps "Use of AI" field).

## 3. Part standards (ALL parts must follow)

- Origin: centre of the bottom connection ring.
- Top attach node: (0, height, 0). Bottom node: (0, 0, 0).
- Side (radial) nodes: on the outer surface at mid-height, every 90°.
- Standard diameters: S = 1.25 m, M = 2.5 m, L = 3.75 m. Parts only stack onto the same size; adapters join sizes.
- Model files: `/public/models/<part-id>.glb`. Low-poly (aim < 5k triangles per part).
- The game reads sizes, nodes and stats from parts.json, never from the mesh.

### Tank sizing rule (real physics)

Tank height ≈ propellant volume / cross-section area, where volume = propellant mass / bulk density.

- Kerosene/LOX (kerolox) bulk density ≈ 1,000 kg/m³
- Hydrogen/LOX (hydrolox) bulk density ≈ 360 kg/m³ (≈3× bulkier → fatter, taller tanks)

## 4. Parts catalogue (starter parts.json values)

All values are rounded, realistic hardware-class figures for gameplay. Costs in $M. Mass in tonnes here (store kg in code).

### Crew, cargo & recovery

| id | size | height m | mass t | cost | key stats / notes |
|---|---|---|---|---|---|
| capsule-2 | M | 3.5 | 8.0 | 60 | 2 seats, 4 storage slots, life support 72 h, has hatch, top docking port optional |
| cargo-module | M | 3.0 | 1.5 | 8 | 6 storage slots |
| heat-shield | M | 0.4 | 1.2 | 10 | required to survive re-entry |
| parachutes | S/M | 0.6 | 0.4 | 3 | required for safe landing |
| docking-port | S | 0.5 | 0.3 | 3 | lets you hold station at the satellite; without it EVA is harder |

### Engines

| id | size | mass t | thrust kN (SL / vac) | Isp s (SL / vac) | cost | notes |
|---|---|---|---|---|---|---|
| engine-booster | M | 0.47 | 850 / 914 | 282 / 311 | 6 | cheap, strong, poor in vacuum |
| engine-vacuum | M | 0.50 | — / 980 | — / 348 | 15 | upper stage only; useless at launch (cannot be used below 50 km) |
| engine-hydrolox | S | 0.30 | — / 110 | — / 450 | 25 | most efficient, low thrust, needs hydrolox fuel |
| srb | S (radial) | 40 total (34 propellant) | 1500 / 1600 | 250 / 268 | 10 | cannot throttle or shut down; burn ≈ 55–60 s |
| rcs | radial | 0.2 | 4 total | 230 | 4 | required for rendezvous; carries 0.3 t monoprop |

### Tanks

| id | size | height m | propellant t | dry t | cost | fuel |
|---|---|---|---|---|---|---|
| tank-s | S | 3.5 | 4 | 0.4 | 2 | kerolox |
| tank-m-short | M | 3.2 | 15 | 1.0 | 3 | kerolox |
| tank-m-long | M | 7.9 | 37.5 | 2.5 | 6 | kerolox |
| tank-l | L | 10.2 | 110 | 6.0 | 12 | kerolox |
| tank-m-hydrolox | M | 6.8 | 12 | 2.0 | 10 | hydrolox |

### Structure

| id | mass t | cost | notes |
|---|---|---|---|
| decoupler-S / -M / -L | 0.1 / 0.3 / 0.5 | 2 | splits stages; also breaks fuel flow |
| radial-decoupler | 0.1 | 2 | for side boosters/tanks |
| adapter-M-S, adapter-L-M | 0.2 / 0.4 | 1 | joins sizes |
| fin | 0.1 | 1 | adds stability; ≥3 needed (or 4) on the bottom stage |
| nose-cone / fairing-M | 0.3 / 1.0 | 1 / 4 | fairing protects cargo during launch |
| fuel-line | 0.01 | 0.5 | connects a radial tank to the core (crossfeed) |

### Systems (tie into failures)

| id | mass t | cost | effect |
|---|---|---|---|
| solar-panel | 0.3 | 3 | power generation; without power, mission time limit drops |
| battery | 0.2 | 2 | backup power; protects during solar flare / panel damage |
| antenna-hg | 0.15 | 2 | shortens comms blackout |
| debris-shield | 0.6 | 5 | reduces debris-graze damage |
| robotic-arm | 0.8 | 15 | makes EVA repair easier (locked in Mission 1 → unlock reward) |

### Pod loadout items (go in storage slots)

| id | mass kg | slots | notes |
|---|---|---|---|
| replacement-panel | 800 | 3 | mission-critical |
| toolkit | 50 | 1 | required for repair |
| tether | 10 | 1 | per astronaut on EVA; no tether = drift risk |
| spare-battery | 60 | 1 | optional power backup |
| spare-o2 | 40 | 1 | extends EVA timer |

### Mission 1 unlocked parts

capsule-2, cargo-module, heat-shield, parachutes, docking-port, engine-booster, engine-vacuum, rcs, tank-s, tank-m-short, tank-m-long, tank-l, decoupler-*, adapters, fin, nose-cone, fairing-M, solar-panel, battery, antenna-hg, debris-shield.

Locked (shown greyed with "Unlocks in Mission 2/3"): engine-hydrolox, tank-m-hydrolox, srb, radial-decoupler, fuel-line, robotic-arm.

## 5. Physics model (keep it simple, honest, testable)

- Tsiolkovsky: Δv = Isp · g0 · ln(m0 / mf), g0 = 9.80665.
- Stages: split the part tree at decouplers. Compute Δv per stage from the bottom up; each stage carries everything above it as payload.
- Isp for the first stage: use the average of SL and vac Isp (simplification — document in tooltip). Upper stages use vac Isp.
- TWR = total thrust / (m0 · g0). Launch requires TWR ≥ 1.2 on the first stage (else "won't clear the tower").
- Gravity & drag losses are folded into the 9.4 km/s launch figure (state this in the tooltip).
- Stability: bottom stage needs ≥3 fins or the flight gets a wobble penalty (+5% Δv loss) and a visual wobble.
- Fuel flow: stacked tanks feed the engine below them in the same stage. Radial tanks need a fuel line (later missions). Engine fuel type must match tank fuel type.
- Burn time = propellant mass · Isp · g0 / thrust (used for flight timeline animations).

### Mission 1 Δv budget (show as a segmented bar)

| Leg | Δv (km/s) | Source/assumption |
|---|---|---|
| Launch to 400 km parking orbit | 9.40 | typical LEO requirement incl. losses |
| Transfer 400 → 700 km (Hohmann) | 0.17 | computed: ≈0.083 + 0.082 |
| Rendezvous & station-keeping (RCS) | 0.05 | from RCS monoprop, separate pool |
| De-orbit burn from 700 km | 0.18 | lowers perigee to ~50 km |
| **Total (main propulsion)** | **≈ 9.75** | + RCS separately |

Orbital constants: μ_Earth = 3.986e14 m³/s², R_Earth = 6,371 km. Write orbits.js with `circularVelocity(r)` and `hohmann(r1, r2)` and unit-test them against the numbers above.

### Balancing reference design (must be achievable and fit budget)

Payload (capsule + cargo module + panel + shield + chutes + RCS + docking + antenna + toolkit/tethers) ≈ 13 t. *(See §14 — honest payload is ≈ 15 t.)*

- Upper stage: 1× tank-l + 1× engine-vacuum + decoupler-L → ≈ 6.4 km/s
- First stage: 3× tank-l + 8× engine-booster + 4 fins → ≈ 3.4 km/s, TWR ≈ 1.45
- Total ≈ 9.8 km/s, gross mass ≈ 480 t, cost ≈ $207M
- Mission 1 budget: $250M. A naive single-stage design must fail (teaches staging).

Write a Vitest test that builds this design from parts.json and asserts Δv ≥ 9.75 km/s and cost ≤ 250.

## 6. Mission 1 — "Debris Strike"

**Story:** Earth-observation science satellite AURORA-7 (fictional) at 700 km has been hit by a debris fragment. One solar array is shattered; it's on battery and will lose its science instruments (and eventually be lost) in 72 hours. Your company has won the emergency repair contract.

- **Objectives:** reach AURORA-7 · repair (replace the solar panel) · return crew safely.
- **Crew:** 2 (Commander stays inside, Specialist does the EVA).
- **Cargo:** replacement panel (800 kg, 3 slots) + toolkit.
- **Budget:** $250M. **Deadline:** 72 h mission time (life support also 72 h).
- **Approach choices** (orbit decision, before launch), each with a one-line plain-English explanation:
  - **Standard Hohmann** — 0.17 km/s, ~1 day incl. phasing. Balanced.
  - **Fast intercept** — 0.35 km/s, arrives in ~4 h. Costs fuel, saves life support/time.
  - **Patient phasing** — 0.17 km/s, ~2 days. Cheapest risk on Δv, but long exposure to random events and life support.
- **Science value:** satellite science output = 100% if repaired within 24 h, falling linearly to 40% at 72 h; 0% if not repaired.

## 7. Game flow (scenes)

1. **Intro cinematic** (in-engine, ~20 s, skippable): Earth, debris streak, impact sparks, tumbling satellite with broken array; mission-control text overlay.
2. **Mission select:** Mission 1 playable; Missions 2–3 visible but locked ("Lunar cargo run", "Debris cleanup").
3. **Briefing:** story, objectives, constraints, required Δv bar, budget. Button: "Go to workshop".
4. **Workshop** (third person, orbit camera):
   - Left: parts catalogue by category (locked parts greyed). Hover shows stats + plain-English tooltip.
   - Centre: build area. Drag a part → valid attach nodes glow → snaps on release. Right-click removes (and anything attached above/below asks to confirm). Symmetry toggle (×1/×2/×3/×4) for radial parts.
   - Right: live stats — cost vs budget, total mass, TWR, Δv per stage + segmented mission Δv bar (green/red per leg), checklist (heat shield ✔, docking ✔, crew seats ✔, toolkit ✔ …).
   - "Plumbing view" toggle (stretch): fuel networks in colour, disconnected tanks flash red.
5. **Pod loadout:** grid of storage slots (capsule + cargo module). Drag items in. Shows mass impact on Δv.
6. **Pre-launch check:** approach choice + final readiness list. Player may launch a failing design (funny failures are allowed), but warnings are clear.
7. **Flight** (first person in cockpit; press C for external chase camera):
   - Launch → staging events → parking orbit → transfer → arrival. Time-accelerated, cinematic, driven by the physics results (not a full simulation).
   - Cockpit screens: fuel, Δv remaining, power, life support, comms status, alarms.
   - Decision prompts at events (e.g. "Fuel leak in stage 2 — Abort / Push on / Transfer fuel").
8. **Rendezvous mini-game:** timing ring — fire RCS when markers align; each miss costs RCS fuel. No RCS = cannot rendezvous.
9. **EVA repair** (first person): move along the tether line between highlighted hotspots; O₂ timer; steps: unbolt broken panel → detach → fit new panel → connect cable. Without tether: drift risk. Without docking port: timer runs faster. Stuck-bolt event adds a step.
10. **Return:** de-orbit burn (needs Δv), re-entry (needs heat shield), parachutes (needs chutes). Missing parts = dramatic, explained failure.
11. **Debrief / final report:**
    - Outcome, science restored %, budget left, time used, crew safety.
    - Causes in plain English with numbers: e.g. "You needed 0.18 km/s for the de-orbit burn but had 0.06 km/s left. Add ~4 t of fuel to the upper stage or remove the spare battery."
    - Grade (S/A/B/C/F) + "Back to workshop (keep design)" + "Retry".
    - Unlock reward on success (robotic arm).

## 8. Events & failures (events.json)

Exactly one scripted event + one random event per run.

| id | phase | effect | mitigated by |
|---|---|---|---|
| comms-blackout (scripted) | approach | cockpit screens go to static; no guidance for 90 s (no antenna) or 30 s (antenna-hg) | antenna-hg |
| fuel-leak | transfer | lose 10% of current stage propellant unless player chooses "isolate tank" quickly | quick decision |
| solar-flare | any coast | crew must shelter; mission timer +6 h; power drain | battery / spare-battery |
| debris-graze | coast | random system damaged (panel/antenna) | debris-shield |
| stuck-bolt | EVA | extra EVA step, O₂ cost | spare-o2 / toolkit |

Solar flare text can reference real NASA space-weather records (DONKI) as "inspired by" — never invent fake real-world facts.

## 9. Scoring

```
score = 1000·missionSuccess + 500·science% + 2·budgetLeft($M) + timeBonus − 300·crewInjury
```

Crew must return for a passing grade. Show the formula breakdown on the debrief (education).

## 10. Education layer (target audience: school physics)

- Every stat has a "?" tooltip: what it is, why it matters, the formula in words.
- First play: 4 short tutorial hints (place capsule, add tank, add engine, watch Δv bar).
- Debrief always explains the main cause of failure/success with numbers.
- Plain English first, numbers second.

## 11. NASA data — where it is used (required for Global Award eligibility)

**Rule:** every NASA-derived value lives in a data file with its source next to it, and every place it appears in-game shows a small "NASA data" badge that opens the source. Log everything in `DATA_SOURCES.md` (this list is what goes into the submission's "NASA Data" field).

### Data files

```
/src/data/nasa/earth.json          Earth constants (+ source URL)
/src/data/nasa/debris.json         debris facts used in story/events (+ source URL)
/src/data/nasa/solar_flares.json   real flare records snapshot from DONKI (+ query URL + date fetched)
/src/data/nasa/eva.json            EVA/servicing-mission facts (+ source URL)
/public/textures/earth_*.jpg       NASA Blue Marble / Visible Earth imagery (public domain, credit NASA)
```

### Where NASA data appears in the game

| # | Game feature | NASA source | How it's used |
|---|---|---|---|
| 1 | Orbit physics (Δv bar, Hohmann transfer, de-orbit, orbital speed shown in cockpit) | NASA Earth Fact Sheet (NSSDCA): GM, equatorial radius, surface gravity | orbits.js reads earth.json; tooltip shows "Earth GM = … (NASA Earth Fact Sheet)" |
| 2 | Opening cinematic + debris-graze event | NASA Orbital Debris Program Office (ODPO) FAQ: average impact speed ≈ 10 km/s (up to ~15 km/s); >10 cm objects tracked, far more 1–10 cm pieces untracked | Mission-control text: "Impact at ~10 km/s — more than 10× a bullet"; debris-graze probability higher with no shield; debrief explains why shielding protects only against small debris |
| 3 | Debris shielding part | ODPO / NASA hypervelocity impact (Whipple shield) concept | Part tooltip: how a Whipple shield works and why it adds mass |
| 4 | Solar-flare random event | NASA DONKI solar flare (FLR) records | At build time, fetch real flares into solar_flares.json. In-game the event replays a real one: "Replaying real X-class flare of <date> (NASA DONKI)". Flare class (C/M/X) sets shelter duration and power drain |
| 5 | Earth visuals (cinematic, cockpit window, orbital map) | NASA Blue Marble / Visible Earth imagery | Earth texture with "Image: NASA" credit in the credits screen |
| 6 | EVA repair mission design | NASA Hubble Space Telescope servicing missions | Briefing + debrief "Real world" card: how NASA crews replaced instruments/solar arrays on Hubble; EVA steps and O₂ timer inspired by real EVA practice |
| 7 | Education layer | NASA Glenn "Beginner's Guide to Rockets" (rocket equation, thrust, staging) | "Learn more" links in tooltips |
| 8 | Challenge resources | Datasets/resources listed on the Space Mission Design Game challenge page | Check the Resources tab; use at least one directly and cite it |

### Implementation notes

- **DONKI:** do NOT call the API live in the game (rate limits, outages, endpoint changes). Fetch once with a small script (`scripts/fetch-flares.mjs`), save the JSON snapshot, commit it with the date fetched. Pick 3–5 notable flares (include at least one X-class). Try `https://api.nasa.gov/DONKI/FLR?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&api_key=DEMO_KEY`; if that fails, use the CCMC DONKI web service. Store: flare ID, peak time, class, source URL.
- Never invent a "real" fact. If a value isn't verified from the source, label it "representative" instead of attributing it to NASA.
- Part stats are representative approximations of real hardware classes; say so in-game ("Representative values").
- No NASA logos or branding anywhere. AURORA-7 and the contractor are fictional. Credit "NASA" as a data/image source in text only.
- AI-generated images/video must carry a visible "AI-generated" watermark.

## 12. Build order & scope tiers

**Tier 1 — must ship (Saturday):**
1. Vite + Three.js scaffold, scene manager, orbit camera, FPS counter
2. parts.json + primitive rendering of parts
3. Workshop: vertical stacking with snapping, remove parts, live cost/mass
4. Physics module + tests (Δv per stage, TWR, mission Δv bar)
5. Briefing → workshop → pre-launch → simple flight timeline → debrief (end-to-end loop working)
6. Heat shield / chutes / docking / RCS checks + debrief causes

**Tier 2 — should ship (Saturday evening):**
7. Cockpit first-person flight view + scripted comms blackout
8. Pod loadout screen
9. Rendezvous mini-game
10. EVA repair mini-game
11. Approach-orbit choice
12. One random event from the pool
13. Swap primitives for GLB models as they arrive

**Tier 3 — if time allows:**
14. Intro cinematic, mission select with locked missions
15. Radial attachments + symmetry, fins stability *(basic radial ×4 moved to Tier 1 — see §14)*
16. Plumbing view, fuel lines
17. Co-op "stations" mode (same screen), leaderboard (local)

**Feature freeze: Saturday 22:00.** Sunday morning = bug fixes, deploy, demo video, submission.

## 13. Deployment

- Deploy early (Saturday afternoon) to Vercel or GitHub Pages; redeploy after each tier.
- Final project link must be public, no login.

## 14. Agreed decisions (2026-11-14) — these override earlier sections

1. **Engine cluster mount.** Add an engine-mount part (thrust plate with several bottom engine nodes) so multiple engines can sit under one tank. Eight 2.5 m engines cannot physically fit under a 3.75 m tank as plain stacked parts.
2. **Basic radial attachment is Tier 1.** Fins, RCS, solar panels and antennas are radial parts that Tier 1 checks need. Tier 1 = radial nodes with fixed ×4 symmetry. The full ×1/×2/×3/×4 toggle stays Tier 3.
3. **Balancing targets.** The reference design passes the **Standard** approach with ~2–3% Δv margin at ~$220–235M (budget $250M). **Fast intercept** needs a noticeably bigger rocket (~$20–30M more). **Patient phasing** = cheap Δv, more random-event and life-support risk. A naive single-stage design must fail.
4. **Honest payload ≈ 15 t, not 13 t.** Summing the checklist parts gives ≈ 15 t, which takes the doc's reference design to ≈ 9.44 km/s. Rebalance with a script (`scripts/balance.mjs`) by nudging a few part stats within realistic ranges. Show before/after numbers to the human before changing parts.json.
5. **RCS mass includes its monoprop.** Each rcs unit's listed mass covers the unit plus its 0.3 t monoprop. One unit gives ≈ 34 m/s on a ~20 t ship, so the reference design needs ≥ 2 units (use 4).
6. **Stack order for return.** The capsule has no engine, so the upper stage stays attached through transfer, rendezvous and de-orbit, then separates. The reference stack (top → bottom) is: docking-port → capsule-2 → heat-shield → decoupler-M → cargo-module → adapter → upper stage → decoupler-L → first stage.
7. **Δv is spent leg by leg.** Simulate each burn in order with the ship's current mass: stages drop, and the 800 kg panel leaves the ship at the satellite. The debrief reports the actual shortfall per leg.
8. **Validation:** engine-vacuum on the first stage is an error ("cannot fire below 50 km"). Engine and tank fuel types must match.
9. **Earth radius:** use the Fact Sheet *volumetric mean* radius 6,371 km and label it as such (not "equatorial", which is 6,378 km).
10. **Scoring details to define in Phase 4:** science% is 0–1 in the formula; timeBonus = up to 200 for unused life-support hours; crewInjury = 0 or 1.
11. **Hosting:** Vercel (auto-deploy from GitHub `main`). Repo: https://github.com/f4sf5zyh7h-ux/ASTRONI-SPACEAPPS
12. **Missing part heights** (engines, decouplers, adapters, fins, nose cone, mount): estimated from real hardware in parts.json; the human models to match.

## 15. Working agreement

- Talk through each phase before building it; after each phase, stop and tell the human what to check in the browser.
- The human builds GLB models (AURORA-7 satellite is top priority) in parallel. AURORA-7 GLB should contain named nodes: `bus`, `array_intact`, `array_broken`, empties `hotspot_bolt_1..4`, `hotspot_cable`, `hotspot_mount`. Export: glTF binary, +Y up, 1 unit = 1 m, transforms applied, origin at bottom centre.
