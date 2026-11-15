import { describe, expect, it } from 'vitest';
import { generate, PARAMS, touchesItself } from '../src/core/generator';
import { countSolutions } from '../src/core/solver';
import { isSolved } from '../src/core/rules';
import { SIZES } from '../src/core/types';

const SEEDS: Record<number, number> = { 7: 100, 9: 100, 11: 25 };

describe.each(SIZES)('generator %i×%i', (size) => {
  it('produces strictly unique, full-coverage puzzles', () => {
    const t0 = performance.now();
    for (let seed = 1; seed <= SEEDS[size]; seed++) {
      const { puzzle, solution } = generate(size, seed);
      const p = PARAMS[size];
      expect(puzzle.pairs.length).toBeGreaterThanOrEqual(p.minPairs);
      expect(puzzle.pairs.length).toBeLessThanOrEqual(p.maxPairs);
      // The stored solution solves the puzzle and fills the grid.
      expect(isSolved(puzzle, solution)).toBe(true);
      solution.forEach((s) => expect(touchesItself(s, size)).toBe(false));
      // Independent re-check of strict uniqueness (empty cells allowed).
      const r = countSolutions(size, puzzle.pairs.map((q) => [q.a, q.b] as const), { maxNodes: 5_000_000 });
      expect(r.aborted).toBe(false);
      expect(r.count).toBe(1);
      // Distinct letters.
      expect(new Set(puzzle.pairs.map((q) => q.letter)).size).toBe(puzzle.pairs.length);
    }
    const avg = (performance.now() - t0) / SEEDS[size];
    console.log(`size ${size}: ${avg.toFixed(1)} ms per puzzle (incl. re-check)`);
  }, 120_000);

  it('is deterministic for a seed', () => {
    expect(generate(size, 42).puzzle).toEqual(generate(size, 42).puzzle);
  });
});
