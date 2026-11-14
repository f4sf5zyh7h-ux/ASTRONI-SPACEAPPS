# ASTRONI

**Build it. Fly it. Fix it. Bring them home.**

A browser game for NASA Space Apps 2026 (Space Mission Design Game). You run a small space contractor: design a rocket from parts on a budget, fly to a damaged Earth-observation satellite, repair it on a spacewalk, and bring the crew home. Real rocket physics decide whether your design works.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```
npm install
npm run dev
```

Then open the link it prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | Start the game locally; the page reloads as files change |
| `npm test` | Run the physics checks |
| `npm run build` | Build the hostable version into `dist/` |

## Project docs

- `CLAUDE.md`: full design doc and decisions
- `DATA_SOURCES.md`: NASA data used and where
- `AI_USAGE.md`: how AI was used
