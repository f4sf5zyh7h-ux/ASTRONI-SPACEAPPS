# NASA data sources

Every NASA-derived value in the game is listed here, with the file it lives in and the date it was checked. This list feeds the Space Apps "NASA Data" field.

A row is only marked **verified** after the value has been checked against the source page. Until then it is **planned**.

| Data | Source (URL) | Used in | Date accessed | Status |
|---|---|---|---|---|
| Earth GM, radius, g | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html | `src/data/nasa/earth.json` → `src/physics/orbits.js` | — | in use, not yet verified (site unreachable 2026-11-14) |
| Debris impact speed (avg ≈ 10 km/s), tracked > 10 cm | https://orbitaldebris.jsc.nasa.gov/faq/ | `src/data/nasa/debris.json` → intro cutscene commentary, debris-graze event | 2026-11-14 | **verified** (km/s figure; the page's mph conversion is a typo, not used) |
| Whipple shield concept | NASA ODPO / hypervelocity impact pages | debris-shield tooltip | — | planned |
| Solar flares (FLR) | NASA DONKI | `src/data/nasa/solar_flares.json` → solar-flare event | — | planned |
| Earth imagery | NASA Visible Earth / Blue Marble | `public/textures/earth_*.jpg` | — | planned |
| Hubble servicing missions | NASA Hubble mission pages | `src/data/nasa/eva.json` → briefing/debrief "Real world" card | — | planned |
| Rocket equation, thrust, staging | NASA Glenn "Beginner's Guide to Rockets" | "Learn more" links in tooltips | — | planned |
| Challenge resources | Space Mission Design Game challenge page, Resources tab | TBD | — | planned |
