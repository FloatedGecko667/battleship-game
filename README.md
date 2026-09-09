# Firing Solution

A terminal-flavoured battleship game that runs entirely offline as a PWA.

A *firing solution* is the data a gun needs to hit something it cannot see
directly. That is the whole game: every shot is a guess refined by the last
one, until the enemy fleet's position falls out of the evidence.

- **Stack**: SvelteKit (Svelte 5 runes) + `adapter-static` SPA + `@vite-pwa/sveltekit`
- **Look**: black ground, white rules, neon blue (friendly) and neon red (hostile), JetBrains Mono
- **Opponent**: CPU only, three difficulty levels
- **Editions**:
  - `CLASSIC` — the familiar 10×10 game
  - `DELUXE` — a 10×14 board with per-ship advanced weapons, carrier aircraft and sonar

Play it: <https://firing-solution-a469twq4m-koutarou-soga-s-projects.vercel.app>

See [PLAN.md](./PLAN.md) for the full design, rule breakdown and implementation order.

## Development

```bash
npm install
npm run dev
```

```bash
npm run test:unit -- --run   # engine unit tests
npm run build && npm run preview
```

## Rulebook

The DELUXE rules were transcribed from the official Hasbro rulebook for the 2012
tie-in edition. That PDF is copyrighted, so it is kept out of version control
(`docs/*.pdf` is gitignored) — place your own copy at
`docs/38194_en-us_deluxe-battleship-movie-edition-game.pdf` if you need to check
a rule or re-run the deployment-formation extractor.

This project uses the *rules* (not protected by copyright) but none of the
BATTLESHIP / Hasbro / Universal names, logos, artwork, ship names or voice lines.

## Deploying

The build is entirely static, so `adapter-static` stays in place and nothing is
tied to one host. [vercel.json](./vercel.json) only points Vercel at `build/`
and adds an SPA rewrite; `sw.js` and the manifest are served must-revalidate so
an update is picked up rather than cached indefinitely.

```bash
vercel deploy --prod
```

## Licence

Apache License 2.0 — see [LICENSE](./LICENSE).
