// Generator benchmark: docker compose run --rm dev npx vite-node scripts/bench.ts [size] [count]
import { generate, PARAMS } from '../src/core/generator';
import type { Size } from '../src/core/types';

const size = Number(process.argv[2] ?? 9) as Size;
const count = Number(process.argv[3] ?? 20);
if (process.argv[4]) Object.assign(PARAMS[size], JSON.parse(process.argv[4]));
const times: number[] = [];
const pairs: number[] = [];
let attempts = 0;
for (let s = 1; s <= count; s++) {
  const t0 = performance.now();
  const r = generate(size, s * 7919);
  times.push(performance.now() - t0);
  pairs.push(r.puzzle.pairs.length);
  attempts += r.stats.attempts;
}
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / count;
console.log(
  `size ${size}: avg ${avg.toFixed(0)}ms, median ${times[count >> 1].toFixed(0)}ms, max ${times[count - 1].toFixed(0)}ms, ` +
    `pairs avg ${(pairs.reduce((a, b) => a + b, 0) / count).toFixed(1)} [${Math.min(...pairs)}-${Math.max(...pairs)}], attempts avg ${(attempts / count).toFixed(1)}`,
);
