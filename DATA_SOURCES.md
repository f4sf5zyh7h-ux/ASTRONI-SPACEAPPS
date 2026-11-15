# NASA data sources

Every NASA-derived value in the game is listed here, with the file it lives in and the date it was checked. This list feeds the Space Apps "NASA Data" field.

A row is only marked **verified** after the value has been checked against the source page. Until then it is **planned**.

| Data | Source (URL) | Used in | Date accessed | Status |
|---|---|---|---|---|
| Earth GM (0.39860 × 10⁶ km³/s²), volumetric mean radius (6371.000 km), mean surface gravity (9.820 m/s²), standard gravity g₀ = 9.80665 m/s² | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html | `src/data/nasa/earth.json` → `src/physics/orbits.js` (Hohmann transfer, de-orbit burn); NASA data badge in the workshop help | 2026-11-15 | **verified** |
| Debris impact speed (avg ≈ 10 km/s), tracked > 10 cm | https://orbitaldebris.jsc.nasa.gov/faq/ | `src/data/nasa/debris.json` → intro cutscene commentary; debris-warning event links here | 2026-11-14 | **verified** (km/s figure; the page's mph conversion is a typo, not used) |
| Debris warning event and shield: average debris impact speed, most debris too small to track | https://orbitaldebris.jsc.nasa.gov/faq/ | debris-warning alarm (`src/physics/events.js`) with NASA data badge; briefing "Mission details" | 2026-11-15 | **verified** (same FAQ as above). Whipple-shield behaviour in the game (stops small fragments) is representative, not a NASA figure |
| Solar flares (FLR): 6 real flares from May and Oct 2024 (X9.0, X8.7, X7.1, M9.8, M9.1, C8.8) | https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR (DONKI web service; fetched by `scripts/fetch-flares.mjs`) | `src/data/nasa/solar_flares.json` → solar-flare event (`src/physics/events.js`); in-game card shows class, date and a NASA data link to the flare record | 2026-11-15 | **verified** (snapshot of the API response). Shelter hours and power drain per class are game rules, not NASA figures |
| Earth imagery | — | Not used: the Earth is drawn procedurally by our own shader | — | not used |
| Hubble servicing missions: 5 missions (Dec 1993 – May 2009); SM1 replaced the solar arrays; SM3B (2002) replaced a solar array in a seven-hour spacewalk | https://science.nasa.gov/mission/hubble/observatory/missions-to-hubble/ (+ SM1 and SM3B pages) | `src/data/nasa/eva.json` → debrief "Real world" card with NASA data badge; the arm → spacewalk → system test sequence is inspired by it | 2026-11-15 | **verified** |
| Rocket equation, staging, specific impulse | https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/ · …/stage/ · …/specific-impulse/ (NASA Glenn Beginner's Guide) | `src/data/nasa/education.json` → "Learn the physics" links in the workshop help | 2026-11-15 | **verified** (links checked) |
| Challenge resources | Space Mission Design Game challenge page, Resources tab | TBD | — | planned |
