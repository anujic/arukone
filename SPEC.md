# Arukone — Web App Specification (v0.2, approved; implemented in v0.1)

A mobile-first, installable web app for the Arukone path puzzle, visually modelled on the NZZ Arukone game. Puzzles are generated on the device, without limit, and every puzzle has exactly one solution.

---

## 1. Game Rules

### 1.1 Board
- A square grid of cells. The default is 9 × 9; other sizes can be chosen (§2.6).
- Some cells hold a **letter**. Each letter appears **exactly twice** on the board; together the two form a **pair**.
- Each pair has its own colour. The letter is shown inside a filled circle of that colour.
- Letters come from A–Z plus **Ä, Ö, Ü** (29 symbols).

### 1.2 Paths
- A **path** connects the two letters of one pair.
- A path is a chain of cells, each orthogonally adjacent to the next (up, down, left, right; never diagonal).
- A path may **not**:
  - cross or share a cell with another path,
  - pass through a cell containing any letter other than its own two endpoints,
  - branch, or visit the same cell twice.

### 1.3 Puzzle guarantee: strict uniqueness
Each generated puzzle satisfies the **strict** condition:

> There is **exactly one** way to connect all pairs under the rules in §1.2, **even when empty cells are allowed**. In that one solution, **every cell is covered**.

What this means:
- Players never need to "snake" a path to fill leftover space. Each path is forced by the paths around it.
- It is impossible to connect every pair and still have empty cells. If every pair is connected, the board is full and the puzzle is solved.
- This is stricter than "unique once every cell must be filled". The generator checks it with a solver that **allows empty cells** (§3.5).

### 1.4 Solved condition
- The puzzle is solved when **every pair is connected by a valid path**. Because of §1.3, this means the grid is full.
- As a safety check, the app also confirms that no cell is empty before declaring a solve.

### 1.5 Feedback
| State | Message in status pill |
|---|---|
| Playing | muted info: "#12 · 9×9 · 10 pairs" |
| Generating | spinner + "Generating puzzle…" |
| Replay | muted "Replay of #12 · not counted" |
| Solved | "All pairs correctly connected. Fantastic!" |

---

## 2. App Features

### 2.1 Screens
1. **Game screen** (main screen, opens on launch)
2. **Results sheet** (after a solve, or from the "Show results" button)
3. **Archive screen**
4. **Stats screen**

There is no help screen.

### 2.2 Game screen layout (top to bottom, matching the NZZ design)
- **Header:** archive button on the left, title **"Arukone"** in the centre, stats icon (bar chart) on the right.
- **Timer:** `m:ss` (or `h:mm:ss`), centred under the title.
- **Status pill:** a rounded grey bar showing feedback (§1.5).
- **Board:**
  - Square cells on a black background, thin grey grid lines, outer border.
  - The board fills the screen width minus a 16 px side margin.
- **Size selector:** a compact segmented control below the board (`7×7 · 9×9 · 11×11`).
  - It sets the size used by the **next** "New puzzle".
  - It does not change the puzzle currently being played.
  - The chosen size is remembered.
- **Footer buttons:** full-width, outlined, pill-shaped:
  - **"New puzzle"**: generates a new puzzle at the selected size. If the current puzzle is in progress, it is saved to the archive first and can be resumed later.
  - **"Show results"**: opens the results sheet. Enabled only once the puzzle is solved.

### 2.3 Visual style
- Dark theme only: black background, white text, grey grid (`#3a3a3a`-ish).
- **Endpoints:** a filled circle about 70% of the cell size, in the pair colour, with a bold white or dark letter (whichever contrasts better).
- **Paths:**
  - Stroke in the pair colour, about 60% of the cell width, drawn through cell centres.
  - Round line caps and joins.
  - Drawn underneath the endpoint circles.
- **Palette:** 16+ distinct colours similar to NZZ: tan, slate-lavender, green, orange, teal, periwinkle, deep navy, yellow, steel blue, magenta, cream, emerald and so on. 11 × 11 boards need up to about 16 pairs.
- **Solve animation:** a short highlight on the board, the status message changes, and the timer stops.

### 2.4 Touch controls
| Gesture | Effect |
|---|---|
| **Drag starting on a letter** | Starts drawing that pair's path from that letter. If the pair already had a path, it is cleared and redrawn from this letter. |
| Drag onto an adjacent **free** cell | Extends the path into that cell. |
| Drag back onto the previous cell | Retracts the path by one cell (backtracking). Dragging back further retracts further. |
| Drag onto the matching letter | Completes the path. Further movement is ignored until the finger lifts. |
| Drag onto a cell used by **another path** | **Blocked.** The current path does not enter the cell, and the other path is not changed. |
| Drag onto a **different letter**, or a non-adjacent cell | Blocked or ignored. Fast swipes that skip cells are filled in step by step, and the walk stops at the first blocked cell. |
| Lift finger before reaching the partner | The unfinished path stays on the board. |
| Drag starting on the **loose end** of an unfinished path | **Continues** that path from its end (no need to restart from the letter). A tap on the loose end without moving still clears the path. |
| **Tap on a path** (any of its cells or either of its letters) | Clears that whole path. |

Implementation notes:
- A "tap" is a pointer down and up with less than about 8 px of movement and no cell change.
- Pressing a letter and dragging away starts a new drawing; pressing it and releasing without moving clears that path.
- The page must not scroll, zoom or bounce while the user touches the board.

### 2.5 Timer
- Starts at 0:00 when a new puzzle is shown.
- **Pauses** when the app or tab is hidden (`visibilitychange`) and resumes when it is visible again.
- Stops when the puzzle is solved.
- The elapsed time is saved with puzzle progress, so a resumed puzzle continues from its saved time.

### 2.6 Puzzle generation and sizes
- Unlimited: "New puzzle" can be pressed any number of times.
- Sizes: **7 × 7**, **9 × 9 (default)**, **11 × 11**.
  - These are a starting set. If generation is too slow for a size on a mid-range phone, the size set gets adjusted.
- Each puzzle comes from a **seed** (a random 32-bit integer), so the same seed and size always rebuild the same puzzle.
- The number of pairs comes from the generator. Allowed ranges (`PARAMS`): 7 × 7 → 4–6 pairs, 9 × 9 → 7–10, 11 × 11 → 10–15.
- Measured on a desktop CPU in the container: 7 × 7 about 11 ms, 9 × 9 about 40 ms, 11 × 11 about 200 ms per puzzle. Phones are slower, but the ready-queue hides this.
- Generation runs in a **Web Worker**, so the UI never freezes.
  - A small queue of ready puzzles is kept for each size.
  - A spinner shows in the status pill if the user has to wait.

### 2.7 Results sheet
A bottom sheet that shows:
- the solve time, and "New best!" when the time is a personal best for that size,
- the puzzle number (#N, counted per device), its size and the date,
- a short stats summary: puzzles solved, best time for this size,
- buttons: **"New puzzle"** and **"Close"**.

### 2.8 Archive
- A list of every puzzle the user has started, newest first, grouped by day ("Today", "Yesterday", "12 Nov 2026"…).
- Each row shows:
  - the puzzle number and size,
  - a mini thumbnail of the board (the solved state, or the current progress),
  - its status, either ✓ solved with its time, or "In progress" with the elapsed time.
- Tapping a row behaves differently by status:
  - **In progress:** opens the puzzle and resumes it.
  - **Solved:** opens a read-only view of the solved board, with a **"Replay"** button that restarts it from empty. A replay does not change the original solve time or stats.
- A delete button removes an entry from the archive, after confirmation.
- A filter at the top limits the list by size: All / 7 / 9 / 11.

### 2.9 Stats
Shown **per size**, using a size tabs control (default: the current size).

| Stat | Definition |
|---|---|
| Puzzles solved | total count |
| Solved today | count for the current local day |
| Best time | fastest solve |
| Average time | mean of all solve times |
| Recent times | small bar chart of the last 14 solve times |

There is no streak. There is also a "Reset all data" option, which asks for confirmation first.

### 2.10 Persistence
- All data stays on the device: no accounts, no backend.
- After every move (debounced), the app saves:
  - the current puzzle,
  - its board progress,
  - its elapsed time,
  - the selected size.
- Closing and reopening the app restores exactly where the user left off.

### 2.11 Installable app (PWA) and offline play
- The app can be installed to the home screen (iOS Safari "Add to Home Screen", Android Chrome install prompt).
- It runs full-screen (standalone), with a black status bar and an app icon.
- It works fully offline after the first load.

---

## 3. Technical Implementation

### 3.1 Stack
| Concern | Choice | Reason |
|---|---|---|
| Language | **TypeScript** (strict) | Type safety for the solver and generator logic |
| Build | **Vite** | Fast, small static output |
| UI | **Vanilla TS + small hand-rolled view layer**, no framework | Only 4 screens; keeps the bundle tiny (< 50 KB) |
| Board rendering | **SVG** | Crisp at any zoom; round caps and joins for free; trivial for ≤ 121 cells |
| Background work | **Web Worker** for generation | Keeps the UI responsive |
| Offline / PWA | **vite-plugin-pwa** (Workbox) + web app manifest | Service worker precaches all assets |
| Storage | **localStorage** (JSON, versioned schema) | Data is small; can migrate to IndexedDB if needed |
| Tests | **Vitest** | Unit tests for rules, solver, generator and gestures |
| Dev environment | **Docker + Docker Compose** | All tooling runs in containers (§3.2) |
| Hosting | Any static host (GitHub Pages / Netlify / Vercel) | No backend needed |

### 3.2 Containerised development
Nothing runs on the host except Docker. Node and npm do not need to be installed locally.

- **`Dockerfile`**: a `node:22-alpine` image with dependencies installed, used for dev, test and build.
- **`docker-compose.yml`** services:
  - `dev`: Vite dev server on `0.0.0.0:5173`, with the source code bind-mounted for hot reload. `node_modules` lives in a named volume, so host and container never mix native modules.
  - `test`: runs `vitest run`; `test-watch` runs the watch mode.
  - `build`: runs `vite build` and writes `dist/` to the host.
  - `preview`: serves the production build on port 4173, for checking the PWA and offline behaviour.
- **Testing on a phone:**
  - Open `http://<mac-lan-ip>:5173` on the same Wi-Fi network.
  - The service worker and installing to the home screen need **HTTPS**, except on `localhost`.
  - To test installation on a real phone, use the `preview` service with a self-signed certificate (`@vitejs/plugin-basic-ssl`), or deploy to the static host.
- **Commands** (documented in CLAUDE.md):
  - `docker compose up dev`
  - `docker compose run --rm test`
  - `docker compose run --rm build`
  - `docker compose run --rm dev npm install <pkg>`

### 3.3 Project structure
```
Dockerfile
docker-compose.yml
src/
  core/
    types.ts         // Cell, Puzzle, Pair, BoardState
    rng.ts           // seeded PRNG (mulberry32)
    letters.ts       // A–Z + ÄÖÜ, palette
    rules.ts         // validation: isPathValid, allConnected, isFull, isSolved
    solver.ts        // counts relaxed solutions (empty cells allowed), stops at 2
    generator.ts     // builds a strictly-unique puzzle from (size, seed)
  worker/
    generator.worker.ts
  game/
    state.ts         // board state + actions (startPath, extend, retract, clearPath)
    input.ts         // pointer events → cell coords → actions; tap vs drag
    timer.ts
  ui/
    board.ts         // SVG renderer
    screens/ game.ts, archive.ts, stats.ts, results.ts
    styles.css
  storage/
    store.ts         // load/save, schema versioning
  main.ts
public/
  icons/, manifest.webmanifest
tests/
```

### 3.4 Data model
```ts
type Coord = number;                 // cell index = row * size + col
interface Puzzle {
  id: string;                        // `${size}-${seed}`
  seed: number;
  size: 7 | 9 | 11;
  pairs: { letter: string; color: string; a: Coord; b: Coord }[];
  createdAt: number;                 // epoch ms
}
interface Progress {
  puzzleId: string;
  paths: Coord[][];                  // index = pair index; ordered cells from the start letter
  elapsedMs: number;
  solvedAt?: number;
  solveTimeMs?: number;
}
interface SaveFile {
  version: 1;
  current?: string;                  // puzzleId on the game screen
  selectedSize: 7 | 9 | 11;
  puzzles: Record<string, Puzzle>;
  progress: Record<string, Progress>;
  counter: number;                   // for puzzle #N
}
```
The solution is **not stored**. Validation is rule-based. A puzzle can always be rebuilt from `seed` and `size`.

### 3.5 Solver (used only by the generator)
The solver **counts solutions under relaxed rules**: cells may stay empty. It stops as soon as it finds 2.

- **Search:** grow paths one step at a time from one endpoint of each pair.
  - Always extend the pair whose current head has the **fewest legal moves**.
  - A head with 0 moves means a dead end, so that branch is abandoned.
  - A head with exactly 1 move is forced.
- **Pruning:**
  - Each unconnected pair's head must still reach its partner through free cells (BFS/flood fill).
  - Two pairs that would have to pass through the same narrow chokepoint (a single free cell) are detected early.
  - A path may not touch itself: it must never move next to one of its own earlier cells. Such a path has a shortcut, so that route would never be the unique one, and the search skips it.
- **Result:** the solution count (0, 1 or 2+). When there are 2 or more, the solver also returns an alternative solution, which the generator uses to repair the puzzle.

### 3.6 Generator algorithm
Goal: endpoint layouts whose **only** relaxed solution covers every cell (§1.3).

1. **Random full partition.** Cover the grid with a random Hamiltonian path:
   - Start from a serpentine (zig-zag) path.
   - Apply many seeded random "backbite" moves to shuffle it.
   - Cut the path into segments of at least 3 cells, which gives about *k* pairs.
2. **Cheap filters**, before running the solver:
   - Reject any segment where two of its cells are orthogonally adjacent but not consecutive in the path. That segment would have a shortcut, so it would allow a solution with empty cells.
   - Reject partitions with too many very short paths.
3. **Strict uniqueness check.** Run the relaxed solver on the endpoints alone.
   - Exactly 1 solution → accept. That one solution is then the full partition from step 1.
   - 2 or more → repair. Look at where the alternative solution differs from the intended one, then merge, split or re-cut the segments involved, and check again.
   - No success after N repairs → start over from step 1 with the next RNG state. This keeps the result deterministic for a given seed.
4. **Decorate.** Assign random distinct letters (A–Z, Ä, Ö, Ü) and palette colours to the pairs.
5. **Performance.**
   - Target under 1 s per puzzle for 9 × 9 on a mid-range phone.
   - A queue of ready puzzles is built in the worker, so "New puzzle" feels instant.
   - Generation time per size is measured in tests (§3.10).
   - Ship a few fallback seeds already known to be good, for each size.

### 3.7 Input handling
- Pointer Events (`pointerdown/move/up/cancel`) on the SVG, with `setPointerCapture`.
- CSS:
  - `touch-action: none` on the board,
  - `overscroll-behavior: none` and `user-select: none` on the page,
  - viewport `user-scalable=no`, plus `-webkit-touch-callout: none`.
- Pointer position → cell, with a small dead zone at cell edges to prevent jitter between two cells.
- Fast moves that skip cells are interpolated: the app walks each cell in between in order and stops at the first blocked one.
- Light haptic feedback on path completion and on solve, where supported (Android `navigator.vibrate`).

### 3.8 Rendering
- One `<svg>` with a `viewBox` in cell units, made of three layers:
  1. grid lines,
  2. paths (`<polyline>` with round caps and joins),
  3. endpoint circles with `<text>`.
- Re-rendered at most once per animation frame (`requestAnimationFrame`) while drawing.
- Archive thumbnails reuse the same renderer at a small size, without letters.

### 3.9 Mobile and iOS details
- Layout respects the phone's safe areas (`env(safe-area-inset-*)`); 100% height uses `100dvh`.
- Meta tags: `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, plus the theme colour and Apple touch icons.
- Font: the system UI font stack, so there are no font downloads.

### 3.10 Testing and acceptance
- **Unit tests** (run in the container):
  - path validation rules,
  - `allConnected` and `isSolved`,
  - the relaxed solver on hand-made puzzles with known solution counts. This includes a puzzle that is unique once the grid must be full, but has a second solution once empty cells are allowed. The solver must report **2** for it.
  - the generator, run on 100+ seeds per size: each result has exactly one relaxed solution, that solution covers every cell, and the time per size is recorded,
  - the gesture state machine:
    - draw, backtrack,
    - **blocked by another path** (the other path stays unchanged),
    - drags starting on a loose end continue the path,
    - tap-to-clear.
- **Manual check** on iPhone Safari (both in the browser and installed to the home screen) and Android Chrome:
  - no scrolling or zooming while drawing,
  - the timer pauses in the background,
  - the app works offline,
  - switching sizes works.
