import { describe, expect, it } from 'vitest';
import { countSolutions } from '../src/core/solver';
import { touchesItself } from '../src/core/generator';
import { mulberry32, shuffle } from '../src/core/rng';
import { neighbors } from '../src/core/types';

/** Naive enumeration of all relaxed solutions (no pruning). */
function bruteSolutions(size: number, ends: [number, number][], cap = 5000): number[][][] {
  const occ = new Int16Array(size * size).fill(-1);
  ends.forEach(([a, b], p) => ((occ[a] = p), (occ[b] = p)));
  const out: number[][][] = [];
  const paths: number[][] = [];
  function pathFrom(p: number, path: number[], target: number): void {
    if (out.length >= cap) return;
    for (const nx of neighbors(path[path.length - 1], size)) {
      if (nx === target) {
        paths.push([...path, nx]);
        solvePair(p + 1);
        paths.pop();
        continue;
      }
      if (occ[nx] !== -1) continue;
      occ[nx] = p;
      path.push(nx);
      pathFrom(p, path, target);
      path.pop();
      occ[nx] = -1;
    }
  }
  function solvePair(p: number): void {
    if (p === ends.length) out.push(paths.map((x) => x.slice()));
    else pathFrom(p, [ends[p][0]], ends[p][1]);
  }
  solvePair(0);
  return out;
}

function randomLayouts(n: number) {
  const rng = mulberry32(7);
  const out: { size: number; ends: [number, number][] }[] = [];
  for (let t = 0; t < n; t++) {
    const size = 4 + (t % 2);
    const cells = shuffle(rng, [...Array(size * size).keys()]);
    const k = 2 + (t % 3);
    const ends: [number, number][] = [];
    for (let i = 0; i < k; i++) ends.push([cells[2 * i], cells[2 * i + 1]]);
    out.push({ size, ends });
  }
  return out;
}

describe('solver vs brute force', () => {
  it('counts exactly the shortcut-free solutions (capped at 2)', () => {
    for (const { size, ends } of randomLayouts(400)) {
      const all = bruteSolutions(size, ends);
      const free = all.filter((s) => s.every((p) => !touchesItself(p, size)));
      expect(countSolutions(size, ends).count, JSON.stringify({ size, ends })).toBe(Math.min(free.length, 2));
    }
  });

  it('count 1 with a full solution implies the relaxed solution is truly unique', () => {
    let fullUnique = 0;
    for (const { size, ends } of randomLayouts(2000)) {
      const r = countSolutions(size, ends);
      if (r.count !== 1 || r.solutions[0].flat().length !== size * size) continue;
      fullUnique++;
      expect(bruteSolutions(size, ends).length, JSON.stringify({ size, ends })).toBe(1);
    }
    expect(fullUnique).toBeGreaterThan(0);
  });
});
