/** Elapsed-time stopwatch that can be paused and restored from a saved value. */
export class Timer {
  private base: number;
  private startedAt: number | null = null;

  constructor(elapsedMs = 0, private readonly now: () => number = () => performance.now()) {
    this.base = elapsedMs;
  }

  get running(): boolean {
    return this.startedAt !== null;
  }

  start(): void {
    if (this.startedAt === null) this.startedAt = this.now();
  }

  pause(): void {
    if (this.startedAt !== null) {
      this.base += this.now() - this.startedAt;
      this.startedAt = null;
    }
  }

  get ms(): number {
    return this.base + (this.startedAt !== null ? this.now() - this.startedAt : 0);
  }
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
