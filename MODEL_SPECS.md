# Model specs

Generated from `src/data/parts.json` by `node scripts/model-specs.mjs`. Don't edit by hand.

## Export rules (all models)

- Format: **glTF Binary (.glb)**. In Blender: File → Export → glTF 2.0, format "glTF Binary".
- **+Y up**, **1 unit = 1 metre**, apply all transforms before export.
- **Origin = centre of the bottom connection ring** (stack parts). The part grows upward from there.
- **Side-mounted parts:** origin at the point that touches the rocket's hull, centred vertically, pointing out along **+X**.
- Keep it low-poly: aim for **under 5,000 triangles** per part.
- Name the file exactly as in the first column and drop it into `public/models/`. The game picks it up automatically; parts without a model use simple shapes.
- The game reads sizes from parts.json, not from the model, so match the sizes below.

## Parts

| File | Part | Diameter | Height | Needed for |
|---|---|---|---|---|
| `capsule-2.glb` | Crew Capsule (2 seats) | 1.25 m top, 2.5 m bottom | 3.5 m | Mission 1 |
| `cargo-module.glb` | Cargo Module | 2.5 m | 3 m | Mission 1 |
| `heat-shield.glb` | Heat Shield | 2.5 m | 0.4 m | Mission 1 |
| `parachutes.glb` | Parachutes | 1.25 m | 0.6 m | Mission 1 |
| `docking-port.glb` | Docking Port | 1.25 m | 0.5 m | Mission 1 |
| `engine-booster.glb` | Booster Engine | 2.5 m | 2.4 m | Mission 1 |
| `engine-vacuum.glb` | Vacuum Engine | 2.5 m | 3 m | Mission 1 |
| `engine-hydrolox.glb` | Hydrolox Engine | 1.25 m | 2 m | later (Mission 2) |
| `srb.glb` | Solid Rocket Booster | side-mounted | 16 m | later (Mission 2) |
| `rcs.glb` | RCS Thruster Block | side-mounted | 0.4 m | Mission 1 |
| `engine-mount-L.glb` | Engine Mount (L, up to 9 engines) | 3.75 m | 1 m | Mission 1 |
| `tank-s.glb` | Fuel Tank S | 1.25 m | 3.5 m | Mission 1 |
| `tank-m-short.glb` | Fuel Tank M (short) | 2.5 m | 3.2 m | Mission 1 |
| `tank-m-long.glb` | Fuel Tank M (long) | 2.5 m | 7.9 m | Mission 1 |
| `tank-l.glb` | Fuel Tank L | 3.75 m | 10.2 m | Mission 1 |
| `tank-m-hydrolox.glb` | Hydrolox Tank M | 2.5 m | 6.8 m | later (Mission 2) |
| `decoupler-S.glb` | Decoupler S | 1.25 m | 0.4 m | Mission 1 |
| `decoupler-M.glb` | Decoupler M | 2.5 m | 0.4 m | Mission 1 |
| `decoupler-L.glb` | Decoupler L | 3.75 m | 0.5 m | Mission 1 |
| `radial-decoupler.glb` | Radial Decoupler | side-mounted | 0.8 m | later (Mission 2) |
| `adapter-M-S.glb` | Adapter M→S | 1.25 m top, 2.5 m bottom | 1 m | Mission 1 |
| `adapter-L-M.glb` | Adapter L→M | 2.5 m top, 3.75 m bottom | 1 m | Mission 1 |
| `fin.glb` | Fin | side-mounted | 2 m | Mission 1 |
| `nose-cone.glb` | Nose Cone | 2.5 m bottom, pointed top | 2 m | Mission 1 |
| `fairing-M.glb` | Fairing M | 2.5 m bottom, pointed top | 5 m | Mission 1 |
| `fuel-line.glb` | Fuel Line | side-mounted | 0.5 m | later (Mission 3) |
| `solar-panel.glb` | Solar Panel | side-mounted | 1.5 m | Mission 1 |
| `battery.glb` | Battery Pack | side-mounted | 0.4 m | Mission 1 |
| `antenna-hg.glb` | High-Gain Antenna | side-mounted | 0.8 m | Mission 1 |
| `debris-shield.glb` | Debris Shield (Whipple) | 2.5 m | 0.5 m | Mission 1 |
| `robotic-arm.glb` | Robotic Arm | side-mounted | 3 m | later (Mission 2) |

Notes:
- **Engine mount:** the game draws the engines under the mount itself (the engine count changes per design), so model the mount plate only.
- **Engines:** height includes the nozzle (bell). The bell's widest point should be no wider than the diameter.

## Scene models (not parts)

| File | What | Notes |
|---|---|---|
| `aurora-7.glb` | The damaged satellite | **Top priority.** Named objects: `bus`, `array_intact`, `array_broken`; empties `hotspot_bolt_1`…`hotspot_bolt_4`, `hotspot_cable`, `hotspot_mount`, `hotspot_data` (the data module). Rough size: 2 × 2 × 3 m body, solar arrays about 2.5 × 8 m. |
| `replacement-panel.glb` | New solar panel (folded) | Must fit inside the 2.5 m cargo module. |
| `data-module.glb` | Data module the astronaut carries home | Shoebox-to-suitcase size. |
| `launch-pad.glb` | Pad + service tower with stairs | Tower about 70 m tall. Include a walkway at capsule-hatch height (about 62 m above the pad). |
| `capsule-interior.glb` | Inside the capsule | 2 seats, control pad (screen) in front of the seats, window, hatch. |
| `debris-fragment.glb` | The piece of debris that hits the satellite | Fist-to-football size, jagged. |
| `moon.glb` / `dead-satellite.glb` | Mission 2 and 3 objects on the mission-select screen | Optional; simple shapes are fine. |
