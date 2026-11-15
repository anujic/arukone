import { type Coord, type PuzzleDef, isAdjacent } from './types';

/**
 * A path is the ordered list of cells of one pair, starting at one of its letters.
 * It is connected when it runs from one letter to the other.
 */
export function isPathConnected(puzzle: PuzzleDef, pairIndex: number, path: Coord[]): boolean {
  const { a, b } = puzzle.pairs[pairIndex];
  if (path.length < 2) return false;
  const first = path[0];
  const last = path[path.length - 1];
  if (!((first === a && last === b) || (first === b && last === a))) return false;
  return isPathValid(puzzle, pairIndex, path);
}

/** Checks adjacency, no repeats, and no foreign letters on the path. */
export function isPathValid(puzzle: PuzzleDef, pairIndex: number, path: Coord[]): boolean {
  const { size, pairs } = puzzle;
  const own = pairs[pairIndex];
  const seen = new Set<Coord>();
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c < 0 || c >= size * size || seen.has(c)) return false;
    seen.add(c);
    if (i > 0 && !isAdjacent(path[i - 1], c, size)) return false;
    for (let p = 0; p < pairs.length; p++) {
      if (p !== pairIndex && (pairs[p].a === c || pairs[p].b === c)) return false;
    }
    if (i > 0 && i < path.length - 1 && (c === own.a || c === own.b)) return false;
  }
  return true;
}

/** No two paths share a cell. */
export function pathsDisjoint(paths: Coord[][]): boolean {
  const seen = new Set<Coord>();
  for (const p of paths) for (const c of p) {
    if (seen.has(c)) return false;
    seen.add(c);
  }
  return true;
}

export function allConnected(puzzle: PuzzleDef, paths: Coord[][]): boolean {
  return puzzle.pairs.every((_, i) => isPathConnected(puzzle, i, paths[i] ?? [])) && pathsDisjoint(paths);
}

export function isFull(puzzle: PuzzleDef, paths: Coord[][]): boolean {
  const covered = new Set<Coord>();
  for (const p of paths) for (const c of p) covered.add(c);
  return covered.size === puzzle.size * puzzle.size;
}

/** Solved = all pairs connected; full coverage is a safety check (guaranteed by strict uniqueness). */
export function isSolved(puzzle: PuzzleDef, paths: Coord[][]): boolean {
  return allConnected(puzzle, paths) && isFull(puzzle, paths);
}
