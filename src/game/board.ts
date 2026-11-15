import { type Coord, type PuzzleDef, rowOf, colOf } from '../core/types';
import { isPathConnected, isSolved } from '../core/rules';

/**
 * Board state + drawing actions (SPEC §2.4). DOM-free so it can be unit-tested.
 * paths[p] is the ordered list of cells of pair p, starting at the letter the
 * drag started on. Empty array = no path.
 */
export class Board {
  readonly puzzle: PuzzleDef;
  readonly size: number;
  paths: Coord[][];
  /** Pair currently being drawn, or -1. */
  drawing = -1;
  /** cell → pair index of the letter on it, or -1. */
  private readonly letterAt: Int16Array;

  constructor(puzzle: PuzzleDef, paths?: Coord[][]) {
    this.puzzle = puzzle;
    this.size = puzzle.size;
    this.letterAt = new Int16Array(this.size * this.size).fill(-1);
    puzzle.pairs.forEach((p, i) => {
      this.letterAt[p.a] = i;
      this.letterAt[p.b] = i;
    });
    this.paths = puzzle.pairs.map((_, i) => (paths?.[i] ? paths[i].slice() : []));
  }

  letterPair(c: Coord): number {
    return this.letterAt[c];
  }

  /** Pair whose path (or letter) occupies cell c, or -1. */
  ownerOf(c: Coord): number {
    if (this.letterAt[c] !== -1) return this.letterAt[c];
    for (let p = 0; p < this.paths.length; p++) if (this.paths[p].includes(c)) return p;
    return -1;
  }

  isConnected(p: number): boolean {
    return isPathConnected(this.puzzle, p, this.paths[p]);
  }

  isSolved(): boolean {
    return isSolved(this.puzzle, this.paths);
  }

  clearPath(p: number): void {
    this.paths[p] = [];
  }

  /** Begin a drag. Only drags starting on a letter draw. Returns true if drawing started. */
  start(c: Coord): boolean {
    const p = this.letterAt[c];
    if (p === -1) return false;
    this.paths[p] = [c];
    this.drawing = p;
    return true;
  }

  /**
   * Begin a drag on the loose end of an unfinished path, continuing it.
   * Returns true if drawing started.
   */
  continueFrom(c: Coord): boolean {
    for (let p = 0; p < this.paths.length; p++) {
      const path = this.paths[p];
      if (path.length >= 2 && path[path.length - 1] === c && !this.isConnected(p)) {
        this.drawing = p;
        return true;
      }
    }
    return false;
  }

  /**
   * Move the drag to cell c. Fast moves are walked cell by cell and stop at the
   * first blocked cell. Moving onto the own path retracts it to that cell.
   * Returns 'none' | 'changed' | 'connected' (just completed the pair).
   */
  moveTo(c: Coord): 'none' | 'changed' | 'connected' {
    const p = this.drawing;
    if (p === -1) return 'none';
    const path = this.paths[p];
    const idx = path.indexOf(c);
    if (idx !== -1) {
      if (idx === path.length - 1) return 'none';
      path.length = idx + 1;
      return 'changed';
    }
    let changed = false;
    while (path[path.length - 1] !== c) {
      if (this.isConnected(p)) break;
      const next = this.stepToward(path[path.length - 1], c);
      if (path.includes(next) || !this.canEnter(p, next)) break;
      path.push(next);
      changed = true;
      if (this.isConnected(p)) return 'connected';
    }
    return changed ? 'changed' : 'none';
  }

  /** End the drag. A path that is only its start letter is removed. */
  end(): void {
    const p = this.drawing;
    if (p !== -1 && this.paths[p].length < 2) this.paths[p] = [];
    this.drawing = -1;
  }

  private canEnter(p: number, c: Coord): boolean {
    const letter = this.letterAt[c];
    if (letter !== -1) return letter === p; // only the partner letter (own start is already in path)
    for (let q = 0; q < this.paths.length; q++) if (q !== p && this.paths[q].includes(c)) return false;
    return true;
  }

  /** One orthogonal step from a toward b (dominant axis first). */
  private stepToward(a: Coord, b: Coord): Coord {
    const s = this.size;
    const dr = rowOf(b, s) - rowOf(a, s);
    const dc = colOf(b, s) - colOf(a, s);
    if (Math.abs(dr) > Math.abs(dc)) return a + Math.sign(dr) * s;
    return a + Math.sign(dc);
  }

  /** Cells covered by any path. */
  coveredCount(): number {
    return this.paths.reduce((n, p) => n + p.length, 0);
  }
}
