import type { PuzzleDef, Size } from '../core/types';
import type { SaveFile } from '../storage/store';
import type { GenRequest } from '../worker/generator.worker';

const QUEUE_TARGET = 2;

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

/**
 * Supplies new puzzles. Generation runs in a Web Worker; a small queue of
 * ready puzzles per size (persisted in the save file) makes "New puzzle" instant.
 */
export class PuzzleSource {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, (p: PuzzleDef) => void>();
  private inFlight: Partial<Record<Size, number>> = {};

  constructor(private readonly save: () => SaveFile, private readonly onQueueChange: () => void) {
    this.worker = new Worker(new URL('../worker/generator.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<{ id: number; puzzle: PuzzleDef }>) => {
      const cb = this.pending.get(e.data.id);
      this.pending.delete(e.data.id);
      cb?.(e.data.puzzle);
    };
  }

  private request(size: Size): Promise<PuzzleDef> {
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.pending.set(id, resolve);
      const msg: GenRequest = { id, size, seed: randomSeed() };
      this.worker.postMessage(msg);
    });
  }

  /** Get a puzzle: from the queue if one is ready, otherwise generate now. */
  async take(size: Size): Promise<PuzzleDef> {
    const q = this.save().queue[size];
    const ready = q?.shift();
    if (ready) {
      this.onQueueChange();
      this.topUp(size);
      return ready;
    }
    const p = await this.request(size);
    this.topUp(size);
    return p;
  }

  /** Keep QUEUE_TARGET puzzles ready for this size. */
  topUp(size: Size): void {
    const data = this.save();
    const q = (data.queue[size] ??= []);
    const missing = QUEUE_TARGET - q.length - (this.inFlight[size] ?? 0);
    for (let i = 0; i < missing; i++) {
      this.inFlight[size] = (this.inFlight[size] ?? 0) + 1;
      this.request(size).then((p) => {
        this.inFlight[size]!--;
        (this.save().queue[size] ??= []).push(p);
        this.onQueueChange();
      });
    }
  }
}
