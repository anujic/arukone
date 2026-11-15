import { type Coord, type Pair, type PuzzleDef, type Size, isAdjacent, neighbors } from './types';
import { type Rng, mulberry32, randInt, shuffle } from './rng';
import { countSolutions } from './solver';
import { LETTERS, PALETTE } from './letters';

/**
 * Puzzle generator (SPEC §3.6).
 *
 * 1. Random Hamiltonian path (serpentine + backbite moves).
 * 2. Cut it into segments that never touch themselves (len ≥ 3).
 * 3. Strict uniqueness: the relaxed solver (empty cells allowed) must find
 *    exactly one solution. If not, split a path where the alternative
 *    solution differs and try again.
 * Deterministic for (size, seed): only the seeded RNG and node budgets are used.
 */

export interface GenParams {
  minLen: number;
  /** Probability of a voluntary cut once a segment reaches minLen. */
  cutProb: number;
  maxPairs: number;
  minPairs: number;
  maxRepairs: number;
  solverNodes: number;
}

/**
 * Tuned with scripts/bench.ts. Forced cuts alone (cutProb 0) already give
 * about size ± 1 pairs; maxPairs trades puzzle length against generation time.
 */
export const PARAMS: Record<Size, GenParams> = {
  7: { minLen: 3, cutProb: 0, minPairs: 4, maxPairs: 6, maxRepairs: 6, solverNodes: 200_000 },
  9: { minLen: 3, cutProb: 0, minPairs: 7, maxPairs: 10, maxRepairs: 8, solverNodes: 300_000 },
  11: { minLen: 3, cutProb: 0, minPairs: 10, maxPairs: 15, maxRepairs: 10, solverNodes: 400_000 },
};

export interface GenResult {
  puzzle: PuzzleDef;
  /** The unique solution, one path per pair (a → b). Not persisted; used by tests. */
  solution: Coord[][];
  stats: { attempts: number; solverNodes: number };
}

/** Random Hamiltonian path over the grid via backbite moves. */
export function hamiltonianPath(size: number, rng: Rng): Coord[] {
  const n = size * size;
  const path: Coord[] = [];
  for (let r = 0; r < size; r++) {
    for (let k = 0; k < size; k++) path.push(r * size + (r % 2 === 0 ? k : size - 1 - k));
  }
  const pos = new Int32Array(n);
  path.forEach((c, i) => (pos[c] = i));
  const steps = n * 60;
  for (let s = 0; s < steps; s++) {
    if (rng() < 0.5) path.reverse(), path.forEach((c, i) => (pos[c] = i));
    // Backbite at the end of the path.
    const end = path[n - 1];
    const nbs = neighbors(end, size);
    const x = nbs[randInt(rng, nbs.length)];
    const i = pos[x];
    if (i === n - 2) continue;
    // Reverse path[i+1 .. n-1].
    for (let lo = i + 1, hi = n - 1; lo < hi; lo++, hi--) {
      const t = path[lo];
      path[lo] = path[hi];
      path[hi] = t;
      pos[path[lo]] = lo;
      pos[path[hi]] = hi;
    }
  }
  return path;
}

/** True if some two non-consecutive cells of the segment are adjacent. */
export function touchesItself(seg: Coord[], size: number): boolean {
  for (let i = 0; i < seg.length; i++) {
    for (let j = i + 2; j < seg.length; j++) if (isAdjacent(seg[i], seg[j], size)) return true;
  }
  return false;
}

/** Cut a Hamiltonian path into non-self-touching segments. Returns null if a segment is too short. */
export function cutPath(path: Coord[], size: number, rng: Rng, p: GenParams): Coord[][] | null {
  const segs: Coord[][] = [];
  let cur: Coord[] = [];
  for (const c of path) {
    let mustCut = false;
    for (let i = 0; i < cur.length - 1; i++) {
      if (isAdjacent(cur[i], c, size)) {
        mustCut = true;
        break;
      }
    }
    const voluntary = cur.length >= p.minLen && rng() < p.cutProb;
    if (mustCut || voluntary) {
      if (cur.length < p.minLen) return null;
      segs.push(cur);
      cur = [];
    }
    cur.push(c);
  }
  if (cur.length < p.minLen) return null;
  segs.push(cur);
  return segs;
}

/** Split a segment into two non-trivial halves at a random point, or null. */
function splitSegment(seg: Coord[], rng: Rng, minLen: number): [Coord[], Coord[]] | null {
  const lo = minLen;
  const hi = seg.length - minLen;
  if (hi < lo) return null;
  const at = lo + randInt(rng, hi - lo + 1);
  return [seg.slice(0, at), seg.slice(at)];
}

/** Which intended segments differ in the alternative solution. */
function differingSegments(segs: Coord[][], alt: Coord[][]): number[] {
  const out: number[] = [];
  segs.forEach((s, i) => {
    const a = alt[i];
    const same = a.length === s.length && a.every((c, j) => c === s[j]);
    if (!same) out.push(i);
  });
  return out;
}

export function generate(size: Size, seed: number): GenResult {
  const rng = mulberry32(seed);
  const p = PARAMS[size];
  let attempts = 0;
  let solverNodes = 0;

  for (;;) {
    attempts++;
    const ham = hamiltonianPath(size, rng);
    let segs: Coord[][] | null = null;
    for (let t = 0; t < 20 && !segs; t++) segs = cutPath(ham, size, rng, p);
    if (!segs || segs.length > p.maxPairs) continue;

    for (let repair = 0; repair <= p.maxRepairs; repair++) {
      if (segs.length > p.maxPairs) break;
      const ends = segs.map((s) => [s[0], s[s.length - 1]] as const);
      const res = countSolutions(size, ends, { limit: 2, maxNodes: p.solverNodes });
      solverNodes += res.nodes;
      if (res.aborted) break;
      if (res.count === 1) {
        if (segs.length < p.minPairs) break;
        const { puzzle, order } = decorate(size, seed, segs, rng);
        return { puzzle, solution: order.map((i) => segs![i]), stats: { attempts, solverNodes } };
      }
      if (res.count === 0) break; // cannot happen for a valid partition; be safe
      // Split one of the paths that the alternative solution reroutes.
      const alt = res.solutions.find((s) => differingSegments(segs!, s).length > 0)!;
      const diff = shuffle(rng, differingSegments(segs, alt));
      let didSplit = false;
      for (const i of diff) {
        const halves = splitSegment(segs[i], rng, p.minLen);
        if (halves) {
          segs.splice(i, 1, halves[0], halves[1]);
          didSplit = true;
          break;
        }
      }
      if (!didSplit) break;
    }
  }
}

function decorate(size: Size, seed: number, segs: Coord[][], rng: Rng): { puzzle: PuzzleDef; order: number[] } {
  const letters = shuffle(rng, LETTERS.slice());
  const colors = shuffle(rng, PALETTE.slice());
  const order = shuffle(rng, segs.map((_, i) => i));
  const pairs: Pair[] = order.map((i, k) => ({
    letter: letters[k],
    color: colors[k % colors.length],
    a: segs[i][0],
    b: segs[i][segs[i].length - 1],
  }));
  return { puzzle: { id: `${size}-${seed}`, seed, size, pairs }, order };
}
