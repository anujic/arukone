import type { Coord } from './types';

/**
 * Relaxed Arukone solver: counts solutions where cells MAY stay empty.
 * Used by the generator to enforce strict uniqueness (SPEC §1.3).
 *
 * Paths grow from both ends of every pair. A path is never allowed to touch
 * itself (two non-consecutive cells orthogonally adjacent), so the solver
 * counts *shortcut-free* relaxed solutions.
 *
 * Why this is enough for strict uniqueness: if the solver finds exactly one
 * solution and it fills the grid, any other relaxed solution would have to
 * self-touch; shortcutting it gives a shortcut-free solution with empty cells,
 * which is different from the full one and would have been found. So
 * "count === 1 and full" ⇒ truly unique (verified by tests/solver-bruteforce).
 */
export interface SolveResult {
  /** Number of solutions found, capped at `limit`. */
  count: number;
  /** Found solutions; each is one ordered path per pair (a → b). */
  solutions: Coord[][][];
  /** True if the node budget ran out before the search finished. */
  aborted: boolean;
  nodes: number;
}

export interface SolveOptions {
  limit?: number;
  maxNodes?: number;
}

export function countSolutions(
  size: number,
  ends: ReadonlyArray<readonly [Coord, Coord]>,
  { limit = 2, maxNodes = 2_000_000 }: SolveOptions = {},
): SolveResult {
  const n = size * size;
  const K = ends.length;

  // Neighbour table: 4 slots per cell, -1 = none.
  const nb = new Int16Array(n * 4).fill(-1);
  for (let c = 0; c < n; c++) {
    const r = (c / size) | 0;
    const k = c % size;
    let i = c * 4;
    if (r > 0) nb[i++] = c - size;
    if (r < size - 1) nb[i++] = c + size;
    if (k > 0) nb[i++] = c - 1;
    if (k < size - 1) nb[i++] = c + 1;
  }
  const adjacent = (x: number, y: number) => {
    const o = x * 4;
    return nb[o] === y || nb[o + 1] === y || nb[o + 2] === y || nb[o + 3] === y;
  };

  const occ = new Int16Array(n).fill(-1);
  const stacks: number[][] = [];
  const done = new Uint8Array(K);
  let remaining = K;
  for (let p = 0; p < K; p++) {
    const [a, b] = ends[p];
    occ[a] = p;
    occ[b] = p;
    stacks.push([a], [b]);
    if (adjacent(a, b)) {
      done[p] = 1;
      remaining--;
    }
  }

  const solutions: Coord[][][] = [];
  let count = 0;
  let nodes = 0;
  let aborted = false;

  const comp = new Int16Array(n);
  const queue = new Int16Array(n);
  const moveBuf = new Int16Array((n + 1) * 4);
  const tmp = new Int16Array(4);

  /** Legal moves for side s of pair p, written to out[off..]. Returns count. */
  function legalMoves(p: number, s: number, out: Int16Array, off: number): number {
    const st = stacks[p * 2 + s];
    const h = st[st.length - 1];
    const ot = stacks[p * 2 + 1 - s];
    const h2 = ot[ot.length - 1];
    let cnt = 0;
    for (let i = h * 4, e = i + 4; i < e; i++) {
      const c = nb[i];
      if (c < 0) break;
      if (occ[c] !== -1) continue;
      let ok = true;
      for (let j = c * 4, f = j + 4; j < f; j++) {
        const m = nb[j];
        if (m < 0) break;
        if (m !== h && m !== h2 && occ[m] === p) {
          ok = false;
          break;
        }
      }
      if (ok) out[off + cnt++] = c;
    }
    return cnt;
  }

  /** Every unfinished pair's heads must touch a common empty region. */
  function connectivityOk(): boolean {
    comp.fill(-1);
    let label = 0;
    for (let c = 0; c < n; c++) {
      if (occ[c] !== -1 || comp[c] !== -1) continue;
      let qh = 0;
      let qt = 0;
      queue[qt++] = c;
      comp[c] = label;
      while (qh < qt) {
        const x = queue[qh++];
        for (let i = x * 4, e = i + 4; i < e; i++) {
          const y = nb[i];
          if (y < 0) break;
          if (occ[y] === -1 && comp[y] === -1) {
            comp[y] = label;
            queue[qt++] = y;
          }
        }
      }
      label++;
    }
    for (let p = 0; p < K; p++) {
      if (done[p]) continue;
      const s0 = stacks[p * 2];
      const s1 = stacks[p * 2 + 1];
      const h1 = s0[s0.length - 1];
      const h2 = s1[s1.length - 1];
      let t = 0;
      for (let i = h1 * 4, e = i + 4; i < e; i++) {
        const y = nb[i];
        if (y < 0) break;
        if (occ[y] === -1) tmp[t++] = comp[y];
      }
      let found = false;
      for (let i = h2 * 4, e = i + 4; i < e && !found; i++) {
        const y = nb[i];
        if (y < 0) break;
        if (occ[y] !== -1) continue;
        for (let j = 0; j < t; j++) if (tmp[j] === comp[y]) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }

  function record() {
    const sol: Coord[][] = [];
    for (let p = 0; p < K; p++) {
      const s1 = stacks[p * 2 + 1];
      const path = stacks[p * 2].slice();
      for (let i = s1.length - 1; i >= 0; i--) path.push(s1[i]);
      sol.push(path);
    }
    solutions.push(sol);
  }

  function search(depth: number) {
    if (count >= limit || aborted) return;
    if (++nodes > maxNodes) {
      aborted = true;
      return;
    }
    if (remaining === 0) {
      count++;
      record();
      return;
    }
    if (!connectivityOk()) return;

    // Most constrained head first.
    const off = depth * 4;
    let bestP = -1;
    let bestS = 0;
    let bestCnt = 5;
    for (let p = 0; p < K && bestCnt > 1; p++) {
      if (done[p]) continue;
      for (let s = 0; s < 2; s++) {
        const cnt = legalMoves(p, s, moveBuf, off);
        if (cnt === 0) return;
        if (cnt < bestCnt) {
          bestCnt = cnt;
          bestP = p;
          bestS = s;
          if (cnt === 1) break;
        }
      }
    }
    legalMoves(bestP, bestS, moveBuf, off);
    const st = stacks[bestP * 2 + bestS];
    const ot = stacks[bestP * 2 + 1 - bestS];
    for (let i = 0; i < bestCnt; i++) {
      const c = moveBuf[off + i];
      st.push(c);
      occ[c] = bestP;
      const joins = adjacent(c, ot[ot.length - 1]);
      if (joins) {
        done[bestP] = 1;
        remaining--;
      }
      search(depth + 1);
      if (joins) {
        done[bestP] = 0;
        remaining++;
      }
      occ[c] = -1;
      st.pop();
      if (count >= limit || aborted) return;
    }
  }

  search(0);
  return { count, solutions, aborted, nodes };
}
