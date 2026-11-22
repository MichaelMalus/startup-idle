# Startup Idle

A somewhat cynical idle game about building a startup: hire people into teams, write SLoC, ship services,
raise money on hype, and exit before the runway runs out.

Play: https://michaelmalus.github.io/startup-idle/

## Develop

```bash
npm install
npm run dev
```

`npm run build` type-checks and builds to `dist/`. Pushes to `main` deploy to GitHub Pages.

Balance numbers live in `src/data.ts`; the simulation is in `src/game.ts` and the UI in `src/ui.ts`.
Design notes are in `docs/DESIGN.md` and project decisions in `docs/DECISIONS.md`.
