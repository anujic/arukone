import { describe, expect, it } from 'vitest';
import { allConnected, isFull, isPathValid, isSolved } from '../src/core/rules';
import type { PuzzleDef } from '../src/core/types';

// 3×3:  A . A
//       B . B
//       C . C   (solution: each row is one path)
const puzzle: PuzzleDef = {
  id: 't', seed: 0, size: 9 as never,
  pairs: [
    { letter: 'A', color: '#000', a: 0, b: 2 },
    { letter: 'B', color: '#000', a: 3, b: 5 },
    { letter: 'C', color: '#000', a: 6, b: 8 },
  ],
};
(puzzle as { size: number }).size = 3;

describe('rules', () => {
  it('accepts a valid solution', () => {
    const paths = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
    expect(allConnected(puzzle, paths)).toBe(true);
    expect(isFull(puzzle, paths)).toBe(true);
    expect(isSolved(puzzle, paths)).toBe(true);
  });

  it('accepts paths drawn from either end', () => {
    expect(isSolved(puzzle, [[2, 1, 0], [5, 4, 3], [6, 7, 8]])).toBe(true);
  });

  it('rejects diagonal steps and foreign letters', () => {
    expect(isPathValid(puzzle, 0, [0, 4])).toBe(false);
    expect(isPathValid(puzzle, 0, [0, 3])).toBe(false); // B's letter
  });

  it('rejects incomplete or overlapping boards', () => {
    expect(isSolved(puzzle, [[0, 1, 2], [3, 4, 5], [6, 7]])).toBe(false);
    expect(allConnected(puzzle, [[0, 1, 2], [3, 4, 5], [6, 7, 8], []])).toBe(true);
  });

  it('is not solved when connected but not full', () => {
    // 1×... use a puzzle where a cell stays empty
    const p2: PuzzleDef = { ...puzzle, pairs: puzzle.pairs.slice(0, 2) };
    const paths = [[0, 1, 2], [3, 4, 5]];
    expect(allConnected(p2, paths)).toBe(true);
    expect(isSolved(p2, paths)).toBe(false);
  });
});
