import { type Coord, type Puzzle, type PuzzleDef, type Size, DEFAULT_SIZE, SIZES } from '../core/types';

export interface Progress {
  puzzleId: string;
  /** Index = pair index; ordered cells from the start letter. */
  paths: Coord[][];
  elapsedMs: number;
  updatedAt: number;
  solvedAt?: number;
  solveTimeMs?: number;
}

export interface SaveFile {
  version: 1;
  current?: string;
  selectedSize: Size;
  counter: number;
  puzzles: Record<string, Puzzle>;
  progress: Record<string, Progress>;
  /** Pre-generated puzzles waiting to be played, per size. */
  queue: Partial<Record<Size, PuzzleDef[]>>;
}

const KEY = 'arukone:save';

function empty(): SaveFile {
  return { version: 1, selectedSize: DEFAULT_SIZE, counter: 0, puzzles: {}, progress: {}, queue: {} };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveFile {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as SaveFile;
    if (data.version !== 1) return empty(); // future: migrate
    if (!SIZES.includes(data.selectedSize)) data.selectedSize = DEFAULT_SIZE;
    data.queue ??= {};
    return data;
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveFile): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: keep playing in memory */
  }
}

export function clearSave(): SaveFile {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return empty();
}

/** Debounced writer; flush() writes immediately. */
export function createSaver(get: () => SaveFile, delay = 300) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        writeSave(get());
      }, delay);
    },
    flush() {
      if (t) clearTimeout(t);
      t = null;
      writeSave(get());
    },
  };
}

export interface SizeStats {
  solved: number;
  solvedToday: number;
  best?: number;
  average?: number;
  /** Last 14 solve times, oldest first. */
  recent: number[];
}

export function statsFor(data: SaveFile, size: Size, now = Date.now()): SizeStats {
  const solves = Object.values(data.progress)
    .filter((p) => p.solveTimeMs !== undefined && data.puzzles[p.puzzleId]?.size === size)
    .sort((a, b) => a.solvedAt! - b.solvedAt!);
  const times = solves.map((s) => s.solveTimeMs!);
  const today = new Date(now).toDateString();
  return {
    solved: solves.length,
    solvedToday: solves.filter((s) => new Date(s.solvedAt!).toDateString() === today).length,
    best: times.length ? Math.min(...times) : undefined,
    average: times.length ? times.reduce((a, b) => a + b, 0) / times.length : undefined,
    recent: times.slice(-14),
  };
}
