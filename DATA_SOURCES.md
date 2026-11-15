# NASA data sources

Every NASA-derived value in the game is listed here, with the file it lives in and the date it was checked. This list feeds the Space Apps "NASA Data" field.

A row is only marked **verified** after the value has been checked against the source page. Until then it is **planned**.

| Data | Source (URL) | Used in | Date accessed | Status |
|---|---|---|---|---|
| Earth GM, radius, g | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html | `src/data/nasa/earth.json` → `src/physics/orbits.js` | — | in use, not yet verified (site unreachable 2026-11-14) |
| Debris impact speed (avg ≈ 10 km/s), tracked > 10 cm | https://orbitaldebris.jsc.nasa.gov/faq/ | `src/data/nasa/debris.json` → intro cutscene commentary; debris-warning event links here | 2026-11-14 | **verified** (km/s figure; the page's mph conversion is a typo, not used) |
| Whipple shield concept | NASA ODPO / hypervelocity impact pages | debris-shield tooltip | — | planned |
| Solar flares (FLR): 6 real flares from May and Oct 2024 (X9.0, X8.7, X7.1, M9.8, M9.1, C8.8) | https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR (DONKI web service; fetched by `scripts/fetch-flares.mjs`) | `src/data/nasa/solar_flares.json` → solar-flare event (`src/physics/events.js`); in-game card shows class, date and a NASA data link to the flare record | 2026-11-15 | **verified** (snapshot of the API response). Shelter hours and power drain per class are game rules, not NASA figures |
| Earth imagery | NASA Visible Earth / Blue Marble | `public/textures/earth_*.jpg` | — | planned |
| Hubble servicing missions (5 missions 1993–2009, solar arrays replaced on spacewalks) | NASA Hubble mission pages | debrief "Real world" card (`src/scenes/return.js`) | — | in use, not yet verified against the source |
| Rocket equation, thrust, staging | NASA Glenn "Beginner's Guide to Rockets" | "Learn more" links in tooltips | — | planned |
| Challenge resources | Space Mission Design Game challenge page, Resources tab | TBD | — | planned |
