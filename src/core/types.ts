/** Cell index = row * size + col. */
export type Coord = number;

export const SIZES = [7, 9, 11] as const;
export type Size = (typeof SIZES)[number];
export const DEFAULT_SIZE: Size = 9;

export interface Pair {
  letter: string;
  color: string;
  a: Coord;
  b: Coord;
}

/** Deterministic puzzle definition: rebuildable from (size, seed). */
export interface PuzzleDef {
  id: string;
  seed: number;
  size: Size;
  pairs: Pair[];
}

export interface Puzzle extends PuzzleDef {
  /** Per-device running number (#N). */
  number: number;
  createdAt: number;
}

export const rowOf = (c: Coord, size: number) => Math.floor(c / size);
export const colOf = (c: Coord, size: number) => c % size;

export function neighbors(c: Coord, size: number): Coord[] {
  const r = rowOf(c, size);
  const k = colOf(c, size);
  const out: Coord[] = [];
  if (r > 0) out.push(c - size);
  if (r < size - 1) out.push(c + size);
  if (k > 0) out.push(c - 1);
  if (k < size - 1) out.push(c + 1);
  return out;
}

export function isAdjacent(a: Coord, b: Coord, size: number): boolean {
  const dr = Math.abs(rowOf(a, size) - rowOf(b, size));
  const dc = Math.abs(colOf(a, size) - colOf(b, size));
  return dr + dc === 1;
}
