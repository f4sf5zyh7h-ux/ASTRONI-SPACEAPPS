// Fetch a snapshot of real solar flares from NASA DONKI (CCMC web service) for the solar-flare event.
// Run once: `node scripts/fetch-flares.mjs`. The game never calls the API live (CLAUDE.md §11).
// Writes src/data/nasa/solar_flares.json with each flare's ID, times, class, region and DONKI link.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR';
const WINDOWS = [
  ['2024-05-01', '2024-05-20'], // the May 2024 storms (active region 13664)
  ['2024-10-01', '2024-10-10'], // early October 2024 (includes a very strong X-class flare)
];

const rank = (c) => ({ X: 3, M: 2, C: 1 }[c[0]] ?? 0) * 100 + parseFloat(c.slice(1));
const all = [];
for (const [start, end] of WINDOWS) {
  const url = `${BASE}?startDate=${start}&endDate=${end}`;
  // curl: the CCMC server is slow to accept connections and Node's fetch times out first.
  const body = execFileSync('curl', ['-s', '-L', '--fail', '-m', '120', url], { encoding: 'utf8' });
  for (const f of JSON.parse(body)) all.push({ ...f, queryUrl: url });
}
all.sort((a, b) => rank(b.classType) - rank(a.classType));
const pick = [
  ...all.filter((f) => f.classType.startsWith('X')).slice(0, 3),
  ...all.filter((f) => f.classType.startsWith('M')).slice(0, 2),
  ...all.filter((f) => f.classType.startsWith('C')).slice(0, 1),
];
const flares = pick.map((f) => ({
  id: f.flrID,
  classType: f.classType,
  beginTime: f.beginTime,
  peakTime: f.peakTime,
  endTime: f.endTime,
  activeRegion: f.activeRegionNum,
  sourceLocation: f.sourceLocation,
  link: f.link,
  queryUrl: f.queryUrl,
}));
const out = {
  source: 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information), CCMC web service',
  url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
  fetched: new Date().toISOString().slice(0, 10),
  verified: true,
  note: 'Snapshot of real flare records. Flare class (C/M/X) sets the in-game shelter time and power drain; those game effects are ours, not NASA figures.',
  flares,
};
writeFileSync(new URL('../src/data/nasa/solar_flares.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(flares.map((f) => `${f.classType}  ${f.peakTime}  AR${f.activeRegion}`).join('\n'));
