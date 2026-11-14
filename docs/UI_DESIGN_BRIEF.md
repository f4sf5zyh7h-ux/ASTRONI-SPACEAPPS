# ASTRONI: UI design brief

A complete description of the game's interface, screen by screen, for designing the UI. Every screen, panel, HUD, in-world control screen, popup and state is listed, including the parts not built yet.

---

## 1. What the game is

**ASTRONI** is a browser game for the NASA Space Apps Challenge 2026 ("Space Mission Design Game").

You run a small space company that wins an emergency contract. A science satellite, **AURORA-7**, has been hit by space debris at 700 km. You must:
1. design and build a rocket from parts on a budget,
2. board it in first person,
3. launch and fly to the satellite,
4. spacewalk out to replace its broken solar panel and take its data module,
5. fly the crew and the data home.

Real rocket physics (the rocket equation, staging, orbits) decides whether your design works. Random failures happen mid-mission, and your design choices make them better or worse. At the end, a debrief explains in plain English, with numbers, why you succeeded or failed.

- **Tagline:** "Build it. Fly it. Fix it. Bring them home."
- **Audience:** secondary-school / A-level physics students aged 14–18, plus judges and the curious public. Most players have never seen a rocket equation, so every number needs a plain-English "why".
- **Platform:** desktop browser with mouse and keyboard. Target 1920×1080, and it must still work at 1366×768. Mobile is not supported (show a "best on a computer" note).
- **Session length:** about 15–25 minutes for one full mission.
- **Tech constraint:** the game is a full-screen 3D scene (Three.js). All 2D UI is HTML/CSS layered on top of it, so the 3D scene is always visible behind. Some screens are **in-world**: drawn as screens inside the 3D cockpit, not as an overlay (see §7). Design those as flat images at a fixed resolution.

---

## 2. Visual direction (current)

The current look is **retro arcade meets mission control**: pixel fonts, square corners, thin glowing cyan lines, dark translucent panels over space scenes. Please refine and extend it rather than replace it, though improvements are welcome.

| Token | Value | Use |
|---|---|---|
| Background | `#05070d` (near-black blue) | page, space |
| Panel | `rgba(12, 18, 32, 0.85)` + 2px border `rgba(79,195,247,0.25)`, square corners | all panels |
| Accent | `#4fc3f7` (cyan) | headings, highlights, active states, glows |
| Text | `#e6ecf5` | body |
| Muted | `#8a97ad` | secondary text, hints |
| OK / good | `#66bb6a` (green) | ✔, passing values |
| Bad / danger | `#ef5350` (red) | ✘, failures, alarms |
| Warning | `#ffcc66` (amber) | caution, warnings, toasts |
| Hazard yellow | `#f2c230` | launch-pad markings |

- **Fonts (Google Fonts):**
  - **Press Start 2P**, the arcade pixel font, for the logo, headings, buttons, tags and HUD labels. Use it small (8–14px), except the logo.
  - **VT323**, a pixel terminal font, for everything you read: body text, captions, numbers in tables. It runs small, so use 17–30px.
- **Buttons:**
  - Secondary: square, 2px cyan border, translucent cyan fill, pixel font.
  - Primary "CTA": bigger, with a cyan glow.
- **Motion:** fades and short slide-ups. Alarms blink. Screen transitions are fade-to-black (0.6 s).
- **Mood references:** 80s/90s arcade cabinets, NASA mission-control consoles, CRT terminals. A scanline/CRT effect would be welcome as an optional touch.
- **Rules:**
  - **No NASA logos or branding anywhere.** NASA is credited in text only, as a data and image source.
  - The company and AURORA-7 are fictional.
  - AI-generated images must carry a visible "AI-generated" watermark.

---

## 3. Whole-game flow

```
Loading → Title → Mission select (3D) → Intro cutscene → Contract briefing
→ Workshop (build rocket) → Boarding (walk in, first person) → Cockpit (control pad: checks, approach, cargo, LAUNCH)
→ Launch cutscene (outside view, countdown, staging) → Fast-forward to satellite (random events appear here)
→ Suit-up (inside ship) → EVA spacewalk (repair panel, take data module) → Back inside
→ De-orbit burn (control pad) → Re-entry + landing cutscene → Debrief / final report
→ (Back to workshop keeping the design | Retry | Mission select)
```

A global **mission clock** runs from launch: 72 hours of life support. A global **pause menu** (Esc) works everywhere after the title screen.

**Status of each screen:**
- **BUILT:** Title, Mission select, Intro, Briefing, Workshop.
- **PLANNED:** everything else. Design all of it.

---

## 4. Shared components (design these as a kit)

1. **Panel:** dark translucent box with a 2px cyan border.
2. **Buttons:** primary (CTA with glow), secondary, toggle (on/off state, e.g. ×1/×2/×4), disabled, icon button (arrows ‹ ›).
3. **Tabs:** for categories and control-pad pages.
4. **Part card:** square thumbnail of a 3D part, name, cost. States: normal, hover, dragging, locked (greyed, 🔒 "Mission 2").
5. **Info popover:** part name, one-line explanation, stats table, "Representative values" note.
6. **"?" tooltip:** every stat has one, showing what it is, why it matters, and the formula in words. It needs a "Learn more" link slot (NASA Glenn "Beginner's Guide to Rockets").
7. **Meter bar:** e.g. cost vs budget. Turns red when over.
8. **Segmented Δv bar:** mission legs Launch / Transfer / RCS / De-orbit.
   - Each segment is green (enough), red (short, with "short by N m/s") or grey (not reached).
   - The small legs are drawn wider than their true size so they're visible; say so in a caption.
9. **Checklist row:** ✔ green / ✘ red, label, and a hover explanation.
10. **Problem row:** ⚠ with a plain-English fix ("…doesn't fit on top of … use an adapter").
11. **Toast:** short amber message at bottom centre for 2.5 s ("Drop it on a glowing spot to attach it.").
12. **Alarm banner:** top centre and blinking. Amber for warnings ("⚠ COLLISION WARNING"), red for emergencies ("⚠ IMPACT · POWER 50%").
13. **Decision prompt:** an alarm plus 2–3 choice buttons, an optional countdown bar for quick decisions, and a consequence hint on hover.
14. **Caption / subtitle:** speaker label (small, cyan, pixel font) above one or two lines of large text, bottom centre. Used for Mission Control and crew voice lines.
15. **Voice toggle:** "🔊 Voice on / 🔇 Voice off", bottom right during cutscenes.
16. **Skip button:** top right during cutscenes ("Skip ›", also Esc/Space).
17. **Badges:**
    - "NASA data" (small, clickable, opens the source)
    - "Locked"
    - "Representative values"
    - "AI-generated"
18. **Key hint chip:** a keyboard key drawn as a key, e.g. `[E] Enter`, `[WASD] Move`.
19. **Crosshair + interaction prompt (first person):**
    - a small dot in the centre;
    - when looking at something usable: its name plus `[E] action`, with a hold-progress ring for "hold E" actions.
20. **Objective tracker:** top left in first-person scenes. Current objective plus sub-steps with ticks.
21. **Mission clock:** "MET 12:34:56" (mission elapsed time) plus life-support hours left, which turns amber below 24 h and red below 6 h.
22. **Fade / flash:** full-screen black fade between scenes, white flash on impacts.
23. **Loading bar:** for the initial download (about 6 MB of 3D models).

---

## 5. Screens before the mission

### 5.1 Loading (PLANNED, needed)
- The game downloads 74 3D models (~6 MB) before anything shows, which currently looks like a black screen.
- Show: the ASTRONI logo, a progress bar with "Loading parts 34 / 74", and a rotating tip ("Tip: every 1 t you save on the upper stage gives about 130 m/s more Δv").

### 5.2 Title (BUILT)
- 3D background: the curve of the Earth at the bottom of the screen, stars, a slow camera drift.
- Centre:
  - big **ASTRONI** logo (pixel font, letter-spaced, glow; animates in from blur and wide spacing),
  - tagline "Build it. Fly it. Fix it. Bring them home.",
  - **CONTINUE** button (appears after the logo), with "or press Enter" under it.
- Footer: "NASA Space Apps Challenge 2026 · Space Mission Design Game".
- Wanted extras: a small **Settings** and **Credits** link, and a "Best on a computer with a mouse" note on small screens.

### 5.3 Mission select in 3D space (BUILT)
- The camera floats near each mission's object in space:

  | Mission | Object | Status | Card text |
  |---|---|---|---|
  | Mission 1 · **Debris Strike** | the damaged AURORA-7 satellite above Earth | playable | Budget $250M, 72 h, Crew 2 |
  | Mission 2 · **Lunar Cargo Run** | the Moon | 🔒 "Complete Mission 1 to unlock" | Hydrogen engines, Moon transfer |
  | Mission 3 · **Debris Cleanup** | a dead satellite in a cloud of fragments | 🔒 "Complete Mission 2 to unlock" | Robotic arm, precise rendezvous |

- **Next ›** / **‹ Prev** (big side arrows, or the arrow keys) fly the camera a long way through space to the next object. During the 3.2 s flight, dust streaks past, the field of view widens and the card hides.
- A floating tag sits above the object ("MISSION 1", or "🔒 MISSION 2").
- **Mission card** (bottom centre):
  - "MISSION 1 · 1 / 3",
  - title,
  - two-line description,
  - chips (Budget $250M · 72 h · Crew 2),
  - **START MISSION** button, or a lock message for locked missions,
  - progress dots.
- Header: "ASTRONI · SELECT MISSION".
- Wanted: completed missions show a grade badge ("Best: A").

### 5.4 Intro cutscene (BUILT, about 27 s, skippable)
- The camera circles AURORA-7 above Earth.
- Top left, a location card in terminal style:
  - "AURORA-7 / Earth-observation science satellite / Altitude 700 km · Status: nominal",
  - which later changes to red "Status: DAMAGED · on battery".
- Mission Control lines are shown as **captions** and read aloud (natural voice, radio beep before each line). The next line never starts before the previous one finishes:
  1. "AURORA-7, telemetry looks good. Science downlink at one hundred percent."
  2. "Hold on. Tracking shows a debris fragment on a crossing path." The amber banner **⚠ COLLISION WARNING · DEBRIS ON CROSSING PATH** appears.
  3. "Debris hits at around ten kilometres per second. That's about ten times faster than a rifle bullet." *(The 10 km/s is real NASA data, so it needs a "NASA data" badge.)*
  4. Impact: a white flash, camera shake, sparks, and one solar array shatters into pieces. The red banner **⚠ IMPACT · SOLAR ARRAY B LOST · POWER 50%** appears. "Impact! Solar array B is gone. AURORA-7 is running on battery."
  5. "The battery lasts seventy-two hours. Then the instruments shut down, and the data on board is lost."
- Controls: **Skip ›** (top right) and the voice toggle (bottom right).

### 5.5 Contract briefing (BUILT; overlay after the intro)
- Tag: "CONTRACT AWARDED · DEBRIS STRIKE".
- Quote (spoken): "We depend on its data getting back to Earth. Go up, retrieve the data, fix the satellite, fly home."
- **Objectives:**
  1. Reach AURORA-7 at 700 km
  2. Spacewalk: replace the shattered solar panel
  3. Retrieve the data module
  4. Bring the crew and the data home
- **Constraints:** $250M budget · 72 h before the battery dies · 2 crew (Commander + Specialist) · 0.8 t replacement panel + toolkit.
- **Δv bar** ("Speed change your rocket must deliver · standard approach"): Launch 9.40 km/s | Transfer 0.16 km/s | De-orbit 0.18 km/s. Note: "Total ≈ 9.75 km/s plus 50 m/s from the RCS thrusters. Launch figure includes gravity and drag losses (representative)."
- Buttons: **↺ Watch again** and **GO TO WORKSHOP**.
- Wanted: a "Real world" card ("NASA astronauts did repairs like this on the Hubble Space Telescope"), with a NASA data badge.

---

## 6. Workshop: build the rocket (BUILT; needs the most design love)

**Setting:** a night-time concrete launch pad with yellow hazard markings, a flame hole and floodlight masts. The camera orbits it (drag to rotate, scroll to zoom). The rocket appears on the pad at real size; a full rocket is about 68 m tall. The pad starts **empty**.

**Layout (desktop):** left catalogue (300px) | centre 3D build area | right stats (300px) | bottom toolbar. Header top left: "WORKSHOP · DEBRIS STRIKE".

### 6.1 Left: parts catalogue
- Tabs: **Crew · Tanks · Engines · Structure · Systems**.
- Grid of part cards: a thumbnail rendered from the real 3D model, name and cost. Locked parts are greyed with 🔒 "Mission 2".
- **Hover → info popover** beside the card. Example: *Fuel Tank L: "Large tank holding 110 t of fuel. The backbone of a big first stage."* Its stats table:
  - Size: 3.75 m · 10.2 m tall
  - Mass: 6 t + 110 t fuel
  - Cost: $10M
  - Footer: "Representative values for this class of hardware."
- Footer hint: "Drag a part onto a glowing spot. Right-click a part to remove it."

**Part list (Mission 1).** These are the parts currently in the game; the human has modelled about 40 more variants that will be added.

| Category | Parts |
|---|---|
| Crew | Crew Capsule (2 seats) $60M · Cargo Module $8M · Heat Shield $10M · Parachutes $3M · Docking Port $3M |
| Tanks | Fuel Tank S / M short / M long / L · Hydrolox Tank M (locked) |
| Engines | Booster Engine (first stage) · Vacuum Engine (upper stage only) · Hydrolox Engine (locked) · Solid Rocket Booster (locked) · RCS Thruster Block · Engine Mount L (holds up to 9 engines) |
| Structure | Decouplers S/M/L · Radial Decoupler (locked) · Adapters M→S, L→M · Fin · Nose Cone · Fairing M · Fuel Line (locked) |
| Systems | Solar Panel · Battery Pack · High-Gain Antenna · Debris Shield (Whipple) · Robotic Arm (locked, the reward for Mission 1) |

### 6.2 Centre: building by drag and drop
- Drag a card out and a **translucent blue "ghost"** of the part follows the cursor.
- **Glowing snap points** appear wherever that part can legally go, pulsing cyan; the nearest one turns **yellow** and the ghost snaps to it:
  - **Rings** at stack joints: the top, the bottom, or between any two parts, so parts can be inserted anywhere.
  - **Dots on the side** of tanks and modules, for fins, RCS, solar panels, antennas and batteries. Added in symmetry ×1/×2/×4.
  - **A dot under an engine mount:** each drop adds one engine to the cluster, up to 9.
- Parts only fit where the diameters match (S 1.25 m / M 2.5 m / L 3.75 m); adapters join sizes.
- Release on a snap point to attach. Release elsewhere to cancel, with the toast "Drop it on a glowing spot to attach it."
- **Hover a placed part:** a small tag with its name ("+ 9× Booster Engine" on mounts) and "Right-click to remove".
- **Right-click** removes. Engine mounts lose one engine per click.
- **Empty state:** centre text "Drag a part from the left onto the glowing ring on the pad. Tip: start with a tank and engines, or load the example rocket."
- The camera re-centres and zooms out as the rocket grows.
- **Wanted:** 4 first-time tutorial hints:
  1. place a capsule,
  2. add a tank,
  3. add an engine,
  4. watch the Δv bar.

  Also: a "plumbing view" toggle (later) and a symmetry indicator on the ghost.

### 6.3 Right: live stats (updates on every change)
- **Your rocket:**
  - Cost "$233M / $250M" with a meter that turns red when over budget.
  - Mass (602.4 t).
  - Liftoff TWR (1.30, green if ≥ 1.2).
  - Total Δv (9.90 km/s).
- **Stage list,** top to bottom:
  - "Capsule section: no engine, rides on the stage below"
  - "Stage 2: 6.09 km/s · TWR 0.76"
  - "Stage 1: 3.81 km/s · TWR 1.30"
- **Mission check:** an approach dropdown (Standard Hohmann / Fast intercept / Patient phasing), then the segmented leg bar (Launch / Transfer / RCS / De-orbit, green/red/grey), then a verdict:
  - "✔ Mission possible · 171 m/s spare", or
  - "✘ Ran out of fuel before reaching orbit."
- **Checklist (✔/✘ with hover explanations):**
  - Seats for 2 crew
  - Heat shield under the capsule
  - Parachutes
  - Capsule can separate (needs a decoupler below the heat shield)
  - Docking port
  - RCS thrusters
  - Fins on the bottom stage (3+)
  - Liftoff thrust-to-weight ≥ 1.2
  - Cargo fits in storage
- **Problems list (⚠), for example:**
  - "Booster Engine (M) doesn't fit on top of Fuel Tank L (L) — use an adapter"
  - "A vacuum engine is on the first stage — it cannot fire below 50 km"
  - "A tank holds fuel that no engine in its stage can burn"
- **"?" tooltips:**
  - Δv: "how much the rocket can change its speed; rocket equation Δv = Isp × g₀ × ln(full mass ÷ empty mass), stage by stage"
  - TWR: "engine thrust ÷ rocket weight; needs ≥ 1.2 to clear the tower"
  - Cost and mass also get tooltips.

### 6.4 Bottom toolbar
- ↶ Undo (Ctrl+Z) · Clear · Example (loads a working reference rocket)
- "Side parts: ×1 ×2 ×4" toggles
- **BOARD ROCKET ▶** (primary). It can be pressed even if the design fails, because failing is part of learning, but then show a confirm dialog listing the ✘ items.

---

## 7. In the mission: first person, cockpit and control pad (PLANNED)

### 7.1 Boarding (first person, playable)
- You start at the top of the service tower stairs at the open hatch, about 62 m up, with the pad lights and the rocket beside you.
- HUD:
  - crosshair,
  - objective tracker "Board the capsule",
  - key chips `[WASD] Move · [Mouse] Look · [E] Interact` (fade after 5 s),
  - looking at the hatch shows "Hatch · [E] Enter".
- Inside: look at the seat → "Commander's seat · [E] Sit down", then a smooth transition into the cockpit view.
- Pause (Esc) shows the pause menu (§9).

### 7.2 Cockpit and the in-world CONTROL PAD
You sit in the seat. In front of you is a **control pad**: a large touchscreen built into the capsule's 3D model, plus a few physical controls. The pad is **in-world** (rendered onto the 3D screen), so **design it as a flat 1024×640 px screen** that we map onto the model. The player interacts by looking at it and clicking, or with keyboard shortcuts 1–6.

**Physical controls around the screen** (design these as 3D-prop ideas or icons):
- **MASTER ARM** guarded switch (flip the cover, then the switch) to arm the launch.
- Big **ABORT** T-handle (striped yellow/black).
- **Caution & warning panel:** a row of small labelled lights (FUEL, PWR, O₂, COMMS, PRESS, HEAT) that light amber or red during events.
- **Mission clock** strip: MET and life support remaining.
- **Window** to the outside.

**Control pad pages** (tabs along the top of the screen):

1. **STATUS (ship systems):**
   - Fuel per stage (bars, tonnes)
   - Δv remaining (and needed for the remaining legs)
   - Power (% and trend; solar input vs battery)
   - Life support (hours left of 72)
   - Comms (signal bars; "BLACKOUT" state)
   - Cabin pressure
   - Crew status (2 portraits: Commander, Specialist; OK / injured)
   - Current phase
2. **CHECKLIST (pre-launch GO / NO-GO):**
   - Rows: heat shield ✔, parachutes ✔, docking port ✔, RCS ✔, toolkit ✔, replacement panel ✔, tethers ✔, crew seats ✔, liftoff TWR ✔, Δv for chosen approach ✔/✘.
   - Each row has GO (green) or NO-GO (red), with tap-for-reason.
   - "Flight director: GO for launch" when everything is green.
3. **APPROACH (orbit choice, before launch).** Three option cards, each with Δv cost, travel time, risk level and a one-line explanation:

   | Option | Δv | Time | Explanation |
   |---|---|---|---|
   | **Standard Hohmann** | 0.17 km/s | ~1 day | "Two efficient burns and some waiting to line up. Balanced." |
   | **Fast intercept** | 0.35 km/s | ~4 h | "Burn harder to arrive in about 4 hours. Costs fuel, saves life support." |
   | **Patient phasing** | 0.17 km/s | ~2 days | "Same cheap burns but wait two days to line up. More time for things to go wrong." |

   Each card shows ✔ or ✘ "your rocket can / can't afford this", using the leg-by-leg simulation. Include a small orbit diagram (Earth, the 400 km parking orbit, the 700 km target orbit, the transfer arc).
4. **CARGO (replaces a separate loadout screen):**
   - A slot grid: capsule 4 slots + cargo module 6 slots.
   - Items to drag in:

     | Item | Mass | Slots | Notes |
     |---|---|---|---|
     | Replacement panel | 800 kg | 3 | required |
     | Toolkit | 50 kg | 1 | required |
     | Tether | 10 kg | 1 each | one per spacewalker; without = drift risk |
     | Spare battery | 60 kg | 1 | protects power in a solar flare |
     | Spare O₂ | 40 kg | 1 | longer spacewalk |

   - Shows total cargo mass and its **effect on Δv** ("−12 m/s").
5. **LAUNCH:**
   - Big "ARM" state, then a **LAUNCH** button that only works when MASTER ARM is on.
   - Countdown preview.
   - Final warnings if any ✘ remain ("You can launch, but: no parachutes").
6. **DEORBIT** (only after the repair):
   - Burn button.
   - "Need 0.18 km/s · Have 0.31 km/s".
   - A burn progress bar.
   - The predicted landing zone.

States the pad needs:
- normal;
- **comms blackout** (static/noise, "NO SIGNAL", data greyed out for 30 s with the antenna or 90 s without);
- **alarm** (red border flashing, alarm page forced to front);
- **power low** (dimmed, some pages unavailable).

### 7.3 Launch cutscene (outside camera) + flight HUD
- The camera cuts outside: countdown "T−10 … 3, 2, 1, LIFTOFF" (large centre numbers), engine flames, then the player's own stages separating in the order they designed.
- Minimal HUD overlay:
  - MET clock
  - altitude (km)
  - speed (km/s)
  - current stage "STAGE 1 / 2"
  - mini Δv bar filling as legs are used
  - event ticker at the bottom: "Max Q", "Stage 1 separation", "Upper stage ignition", "Parking orbit reached · 400 km"
- **Fast-forward** to the satellite with a "⏩ ×1000" time-warp indicator and the clock racing; a **[C]** key cuts to the cockpit view.
- **Failure states** (launch can fail):
  - TWR below 1.2: the rocket sits and shakes ("won't clear the tower").
  - Ran out of Δv: "Fell short of orbit".
  - No fins: visible wobble plus "−5% Δv lost to wobble".
  - These lead to the debrief.

### 7.4 Random events (during the fast-forward; one scripted plus one random per run)
Each event: the time warp stops, an alarm sounds, the **alarm banner** appears, the caution light comes on, and a **decision prompt** shows (on the control pad, mirrored as an overlay).

| Event | When | What the player sees / chooses | Mitigated by |
|---|---|---|---|
| **Comms blackout** (scripted) | approach | Screens go to static, "NO SIGNAL"; no guidance for 90 s (30 s with the antenna). Counter "Signal returns in 0:42". | High-gain antenna |
| **Fuel leak** | transfer | "⚠ FUEL LEAK · STAGE 2". Choices: **Isolate tank** (quick, small loss) / **Push on** (lose 10%) / **Transfer fuel**. A **countdown bar** (10 s) for the decision. | quick decision |
| **Solar flare** | any coast | "⚠ SOLAR FLARE · X-CLASS". Crew must shelter; mission clock +6 h; power drain. Shows a **"Replaying real flare of <date> (NASA DONKI)"** card with a NASA data badge and the flare class (C/M/X). | battery / spare battery |
| **Debris graze** | coast | "⚠ DEBRIS STRIKE". A random system is damaged (solar panel or antenna); shows which system and its new %. | debris shield |
| **Stuck bolt** | spacewalk | An extra step on the spacewalk; costs O₂. | spare O₂ / toolkit |

Each prompt shows the consequence of each choice on hover, e.g. "Isolate: lose 2% fuel, 30 s".

### 7.5 Arrival (rendezvous mini-game, OPTIONAL / later)
A timing ring: fire RCS when the markers line up; each miss costs RCS fuel (bar). Needs a simple 2D overlay design.

### 7.6 Suit-up (inside the ship, interactive)
A first-person checklist done by looking at things and pressing E. The objective tracker shows these steps:
1. Put on the suit (look at the suit rack, `[E] Suit up`)
2. Helmet seal check (a mini gauge shows the seal pressure holding)
3. O₂ check (tank 100%)
4. Clip on the tether (`[E] Attach tether`; skip if no tether was packed, which shows a warning)
5. **Depressurise** the airlock: a big gauge drops from 101 kPa to 0 with a hiss, a red "DO NOT OPEN" light turns green
6. Open the hatch (`hold [E]`)

### 7.7 EVA spacewalk (first person, manual)
- A **helmet HUD** with a slight curved-visor frame and a faint reflection.
  - **O₂ ring** (minutes left; amber < 5 min, red < 2 min, alarm beeps)
  - suit pressure
  - **tether** status (attached ✔ / length used / "NO TETHER — drift risk")
  - heart rate (flavour)
  - distance to hatch
- **Objective tracker:**
  1. Move to the broken array (along the tether line)
  2. Unbolt the broken panel: 4 bolts (`hold [E]` each, progress ring); a stuck bolt adds "use the toolkit"
  3. Detach the broken panel (push it away safely)
  4. Fit the new panel
  5. Connect the power cable
  6. **Remove the data module** and carry it ("Carrying: Data module" chip)
  7. Return to the hatch
- **Hotspot markers** on the satellite: glowing brackets with labels ("Bolt 2 / 4").
- Controls:
  - `[WASD]` thrust/move along handrails
  - `[Space]/[Ctrl]` up/down
  - `[Mouse]` look
  - `[E]` interact
  - `[Q]` grab/release
- Warnings:
  - "⚠ DRIFTING" with a direction arrow back to the ship (no tether)
  - "⚠ O₂ LOW"
  - Without a docking port, the O₂ timer runs faster; say so ("No docking port: holding position costs extra O₂").
- On success: "AURORA-7 POWER RESTORED", with the satellite's science-% meter jumping up.

### 7.8 Return and landing
- Back in the cockpit. The control pad DEORBIT page shows the burn (§7.2).
- **Re-entry cutscene,** outside: the capsule separates, plasma glow, HUD with heat-shield temperature (°C bar), g-force, altitude; then the parachutes deploy (drogue, then mains); then splashdown or landing.
- **Failure versions** (dramatic, but always explained):
  - no heat shield: the capsule burns up;
  - no chutes: a hard impact;
  - not enough Δv: stranded in orbit as the life-support clock runs out.

---

## 8. Debrief / final report (PLANNED)

A full-screen report over a calm 3D background (the capsule on its parachutes, or Earth from orbit for a failure).

- **Headline:**
  - "MISSION SUCCESS", or
  - "MISSION FAILED — Re-entry" (with the phase).
- **Grade:** a big letter **S / A / B / C / F**.
- **Key results (big numbers):**
  - Science restored % (the data module must get home)
  - Budget left ($M)
  - Time used (h of 72)
  - Crew safety (✔ both home safe / injured)
- **Score breakdown** (an education feature: show the formula):

  `score = 1000 × missionSuccess + 500 × science% + 2 × budgetLeft($M) + timeBonus − 300 × crewInjury`

  Each term appears as a row with its value, adding up to the total. timeBonus = up to 200 for unused life-support hours.
- **What happened (plain English with numbers).** The main cause comes first, highlighted. Example: *"You needed 0.18 km/s for the de-orbit burn but had 0.06 km/s left. Add about 4 t of fuel to the upper stage or remove the spare battery."*
- **Leg-by-leg Δv chart:** needed vs delivered per leg (Launch, Transfer, RCS, De-orbit) as bars, with the shortfall marked.
- **Events encountered:** each event with what you chose and the result.
- **Science value rule:** 100% if repaired within 24 h, falling linearly to 40% at 72 h; 0% if not repaired or the data didn't come home.
- **"Real world" card:** how NASA astronauts replaced solar arrays and instruments on Hubble (NASA data badge).
- **Unlock reward** on success: "🔓 Robotic Arm unlocked for Mission 2" with the part card.
- **Buttons:** **Back to workshop (keep design)** (primary) · Retry · Mission select.
- **Data sources:** a footer listing the NASA sources used, with links.

---

## 9. System screens

- **Pause menu (Esc):** Resume · Settings · Controls · Restart mission · Quit to title. It also shows the current objective.
- **Settings:**
  - voice on/off
  - volume (master, voice, effects)
  - subtitle size
  - mouse sensitivity
  - invert Y
  - CRT/scanline effect on/off
  - reduce motion (no camera shake or flashes; accessibility)
- **Controls reference:** a keyboard diagram with all keys per phase.
- **Credits:**
  - team
  - "Earth data and imagery: NASA" (text only)
  - NASA sources list
  - fonts (Press Start 2P, VT323, SIL Open Font License)
  - AI usage statement ("Built with help from Claude Code; see AI_USAGE")
  - "Representative values" disclaimer

---

## 10. Controls summary

| Context | Controls |
|---|---|
| Menus | Mouse, Enter = confirm, ← → = previous/next mission, Esc = back/pause |
| Cutscenes | Esc/Space = skip, voice toggle |
| Workshop | Drag from catalogue to build, right-click = remove, Ctrl+Z = undo, drag on scene = rotate camera, scroll = zoom |
| First person | WASD move, mouse look (pointer lock), E interact (hold for long actions), Esc pause |
| Cockpit | Click the control pad, 1–6 = pad pages, C = outside camera |
| EVA | WASD + Space/Ctrl to move, Q grab/release, E interact |

---

## 11. Education and NASA-data rules (affect the UI everywhere)

- **Plain English first, numbers second.** Every stat gets a "?" with what / why / formula-in-words.
- **Units shown:** t (tonnes), km/s for Δv, m/s for small amounts, kN for thrust, km for altitude, $M for money. Show 2 decimals for km/s.
- **"NASA data" badge** wherever a real NASA value appears; clicking it opens the source:
  - Earth constants (orbit maths)
  - the debris speed of about 10 km/s (NASA Orbital Debris Program Office)
  - real solar-flare records (NASA DONKI)
  - Earth imagery (NASA Blue Marble)
  - Hubble servicing facts
- **"Representative values"** label on part stats: they're approximate, not real products.

---

## 12. What I'd like back from the design

1. A **component kit** (§4) in the retro mission-control style.
2. **Every screen** in §5–§9 at 1920×1080, plus the workshop and the EVA HUD at 1366×768.
3. The **control pad** as flat 1024×640 screens: each page (STATUS, CHECKLIST, APPROACH, CARGO, LAUNCH, DEORBIT) plus the blackout, alarm and low-power states.
4. **Alarm / decision prompt** designs for each event in §7.4.
5. The **debrief** for one success and one failure.
6. Optional: a loading screen, the CRT effect, an icon set (fuel, power, O₂, comms, pressure, heat, crew, cargo, lock, NASA-data badge).
