import { describe, expect, it } from 'vitest';
import { countSolutions } from '../src/core/solver';

describe('relaxed solver', () => {
  it('finds the unique solution of a forced 3×3', () => {
    // A . A / B . B / C . C
    const r = countSolutions(3, [[0, 2], [3, 5], [6, 8]]);
    expect(r.count).toBe(1);
    expect(r.solutions[0]).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8]]);
  });

  it('counts solutions that leave cells empty', () => {
    // 3×3 with a single pair in opposite corners: many routes, e.g. via the
    // edges (full or not). Relaxed count must be ≥ 2.
    const r = countSolutions(3, [[0, 8]]);
    expect(r.count).toBe(2);
  });

  it('reports 2 for a puzzle that is unique only when the grid must be full', () => {
    // 2 rows × 3 cols embedded in a 3×3 is awkward; use 3×3 with
    //   A . .
    //   . . .
    //   . . A
    // plus nothing else: the full-coverage (Hamiltonian) solutions are
    // several too, so construct a sharper case on 3×3:
    //   A A' row 0: A at 0, A at 6 (left column), B at 1 and 7 (middle column)
    //   right column empty. Full-coverage forces... relaxed allows straight
    //   columns leaving the right column empty.
    // Pairs: A: 0→6, B: 2→8 with column 1 free.
    // Relaxed: A straight down col 0, B straight down col 2, col 1 empty → valid.
    // Any route using column 1 also exists, so count ≥ 2.
    const r = countSolutions(3, [[0, 6], [2, 8]]);
    expect(r.count).toBe(2);
    // The straight solution (col 1 empty) is among the relaxed solutions.
    const empties = r.solutions.map((s) => 9 - s.flat().length);
    expect(Math.max(...empties)).toBeGreaterThan(0);
  });

  it('returns 0 for an impossible layout', () => {
    // 2×2: A at 0 and 3, B at 1 and 2 — the paths would have to cross.
    expect(countSolutions(2, [[0, 3], [1, 2]]).count).toBe(0);
  });
});
