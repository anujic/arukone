# Arukone

A mobile-first web app for **Arukone**, the path-drawing logic puzzle. Connect each pair of matching letters with a path. Paths may not cross, and every cell of the grid ends up filled.

- Unlimited puzzles, generated on your device, each with exactly one solution
- 7×7, 9×9 (default) and 11×11 grids
- Timer, archive of every puzzle you've played, and per-size stats
- Installable as a Progressive Web App (PWA), works offline, no account, no backend: all data stays in your browser

> Inspired by the Arukone game in the NZZ app. This project is not affiliated with, endorsed by, or connected to NZZ (Neue Zürcher Zeitung) in any way.

## How to play

- **Drag from a letter** to draw a path to its partner, one cell at a time (up, down, left, right).
- **Drag back** over your path to undo the last cells.
- **Drag from the loose end** of an unfinished path to continue it.
- **Tap a path** to clear it.
- Paths can't cross each other or pass through other letters.
- The puzzle is solved when all pairs are connected.

Every puzzle is built so that there is only one way to connect all pairs. That one way fills the whole grid, so you never have to "snake" a path to fill empty space.

## Development

All tooling runs in Docker; you don't need Node installed locally.

```bash
docker compose up dev                 # dev server with hot reload → http://localhost:5173
docker compose run --rm test          # unit tests (Vitest)
docker compose run --rm build         # production build → dist/
docker compose up preview             # serve the production build → http://localhost:4173
```

On a phone on the same Wi-Fi, open `http://<your-computer's-LAN-IP>:5173`. Installing to the home screen and offline mode need HTTPS. Use a deployed copy for that, or run `HTTPS=1 docker compose up preview` for a self-signed certificate (browsers may refuse service workers with it).

Other useful commands:

```bash
docker compose run --rm dev npm install <pkg>                  # add a dependency
docker compose run --rm dev npx vite-node scripts/bench.ts 9 20  # benchmark the generator
```

## Deployment

`dist/` is a static site. Host it anywhere that serves static files over HTTPS (GitHub Pages, Netlify, Vercel, …).

## How it works

| Area | Where |
|---|---|
| Rules and validation | `src/core/rules.ts` |
| Puzzle generator | `src/core/generator.ts`: random Hamiltonian path → cut into paths that never touch themselves → uniqueness check → split paths until unique |
| Solver | `src/core/solver.ts`: counts solutions *with empty cells allowed*, which is how the "no snaking" guarantee is enforced |
| Drawing logic | `src/game/board.ts` |
| UI | `src/ui/` (vanilla TypeScript, SVG board, no framework) |
| Background generation | `src/worker/generator.worker.ts`, `src/game/source.ts` |
| Storage | `src/storage/store.ts` (localStorage) |

Every puzzle is deterministic from `(size, seed)`, so the archive stores only the seed and your progress.

See [`SPEC.md`](SPEC.md) for the full specification.

## Tech

TypeScript · Vite · vite-plugin-pwa · Vitest · Docker
