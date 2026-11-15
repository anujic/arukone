import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import type { PuzzleDef } from '../src/core/types';
import { Timer, formatTime } from '../src/game/timer';

// 3×3:  A . A
//       B . B
//       C . C
const puzzle = {
  id: 't', seed: 0, size: 3,
  pairs: [
    { letter: 'A', color: '#000', a: 0, b: 2 },
    { letter: 'B', color: '#000', a: 3, b: 5 },
    { letter: 'C', color: '#000', a: 6, b: 8 },
  ],
} as unknown as PuzzleDef;

describe('Board gestures', () => {
  it('draws from a letter to its partner and solves', () => {
    const b = new Board(puzzle);
    for (const [s, e] of [[0, 2], [3, 5], [8, 6]]) {
      expect(b.start(s)).toBe(true);
      b.moveTo(s === 8 ? 7 : s + 1);
      expect(b.moveTo(e)).toBe('connected');
      b.end();
    }
    expect(b.isSolved()).toBe(true);
  });

  it('only starts on letters', () => {
    const b = new Board(puzzle);
    expect(b.start(4)).toBe(false);
  });

  it('interpolates fast moves and stops when connected', () => {
    const b = new Board(puzzle);
    b.start(0);
    expect(b.moveTo(2)).toBe('connected');
    expect(b.paths[0]).toEqual([0, 1, 2]);
  });

  it('retracts when dragging back over the own path', () => {
    const b = new Board(puzzle);
    b.start(0);
    b.moveTo(1);
    b.moveTo(4);
    expect(b.paths[0]).toEqual([0, 1, 4]);
    b.moveTo(1);
    expect(b.paths[0]).toEqual([0, 1]);
    b.moveTo(0);
    expect(b.paths[0]).toEqual([0]);
  });

  it('is blocked by another path and does not change it', () => {
    const b = new Board(puzzle);
    b.start(3);
    b.moveTo(4);
    b.end();
    b.start(0);
    b.moveTo(1);
    expect(b.moveTo(4)).toBe('none');
    expect(b.paths[0]).toEqual([0, 1]);
    expect(b.paths[1]).toEqual([3, 4]);
  });

  it('is blocked by foreign letters', () => {
    const b = new Board(puzzle);
    b.start(0);
    expect(b.moveTo(3)).toBe('none');
    expect(b.paths[0]).toEqual([0]);
  });

  it('restarting from a letter clears the old path; a bare tap removes it', () => {
    const b = new Board(puzzle);
    b.start(0);
    b.moveTo(2);
    b.end();
    b.start(2);
    expect(b.paths[0]).toEqual([2]);
    b.end();
    expect(b.paths[0]).toEqual([]);
  });

  it('keeps unfinished paths and clears by pair', () => {
    const b = new Board(puzzle);
    b.start(0);
    b.moveTo(1);
    b.end();
    expect(b.paths[0]).toEqual([0, 1]);
    expect(b.ownerOf(1)).toBe(0);
    b.clearPath(b.ownerOf(1));
    expect(b.paths[0]).toEqual([]);
  });

  it('continues an unfinished path from its loose end', () => {
    const b = new Board(puzzle);
    b.start(0);
    b.moveTo(1);
    b.end();
    expect(b.continueFrom(0)).toBe(false); // the letter end is not a loose end
    expect(b.continueFrom(1)).toBe(true);
    expect(b.moveTo(2)).toBe('connected');
    b.end();
    expect(b.paths[0]).toEqual([0, 1, 2]);
    expect(b.continueFrom(2)).toBe(false); // connected paths have no loose end
  });

  it('continuing can also retract back toward the start', () => {
    const b = new Board(puzzle);
    b.start(0);
    b.moveTo(1);
    b.moveTo(4);
    b.end();
    b.continueFrom(4);
    b.moveTo(1);
    b.end();
    expect(b.paths[0]).toEqual([0, 1]);
  });

  it('ignores moves after connecting until the finger lifts', () => {
    const b = new Board(puzzle);
    b.start(0);
    b.moveTo(2);
    expect(b.moveTo(5)).toBe('none');
    expect(b.paths[0]).toEqual([0, 1, 2]);
  });
});

describe('Timer', () => {
  it('pauses and resumes', () => {
    let t = 0;
    const timer = new Timer(1000, () => t);
    timer.start();
    t = 500;
    expect(timer.ms).toBe(1500);
    timer.pause();
    t = 5000;
    expect(timer.ms).toBe(1500);
    timer.start();
    t = 5100;
    expect(timer.ms).toBe(1600);
  });

  it('formats', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(29_900)).toBe('0:29');
    expect(formatTime(3_725_000)).toBe('1:02:05');
  });
});
