import { generate } from '../core/generator';
import type { Size } from '../core/types';

export interface GenRequest {
  id: number;
  size: Size;
  seed: number;
}

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const { id, size, seed } = e.data;
  const { puzzle } = generate(size, seed);
  self.postMessage({ id, puzzle });
};
