import type { Coord, PuzzleDef } from '../core/types';
import { textColorFor } from '../core/letters';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface RenderOptions {
  letters?: boolean;
}

/**
 * SVG units per cell. Kept large on purpose: WebKit mis-positions text with
 * tiny font sizes (e.g. 0.42 units), which pushed letters off-centre.
 */
const U = 100;
const FONT = 0.42 * U;
/** Baseline offset that centres capital letters vertically (cap height ≈ 0.7em). */
const BASELINE = 0.35 * FONT;

const cx = (c: Coord, size: number) => ((c % size) + 0.5) * U;
const cy = (c: Coord, size: number) => (Math.floor(c / size) + 0.5) * U;

/** Static grid layer (drawn once per puzzle). */
function gridMarkup(size: number): string {
  let d = '';
  const S = size * U;
  for (let i = 1; i < size; i++) d += `M${i * U} 0V${S}M0 ${i * U}H${S}`;
  return (
    `<path class="grid" d="${d}"/>` +
    `<rect class="frame" x="0" y="0" width="${S}" height="${S}" rx="${0.08 * U}"/>`
  );
}

function pathsMarkup(puzzle: PuzzleDef, paths: Coord[][], width: number): string {
  const { size, pairs } = puzzle;
  let out = '';
  paths.forEach((path, i) => {
    if (path.length < 2) return;
    const pts = path.map((c) => `${cx(c, size)},${cy(c, size)}`).join(' ');
    out += `<polyline points="${pts}" stroke="${pairs[i].color}" stroke-width="${width * U}"/>`;
  });
  return `<g class="paths">${out}</g>`;
}

function endpointsMarkup(puzzle: PuzzleDef, letters: boolean): string {
  const { size, pairs } = puzzle;
  let out = '';
  for (const p of pairs) {
    for (const c of [p.a, p.b]) {
      const x = cx(c, size);
      const y = cy(c, size);
      out += `<circle cx="${x}" cy="${y}" r="${(letters ? 0.36 : 0.32) * U}" fill="${p.color}"/>`;
      if (letters) {
        out +=
          `<text x="${x}" y="${y + BASELINE}" font-size="${FONT}" text-anchor="middle" ` +
          `fill="${textColorFor(p.color)}">${p.letter}</text>`;
      }
    }
  }
  return `<g class="ends">${out}</g>`;
}

export function createBoardSvg(cls = 'board'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  return svg;
}

/** Full render. Cheap enough (≤ 121 cells) to redo on every drag frame. */
export function renderBoard(svg: SVGSVGElement, puzzle: PuzzleDef, paths: Coord[][], opts: RenderOptions = {}): void {
  const letters = opts.letters ?? true;
  const { size } = puzzle;
  svg.setAttribute('viewBox', `0 0 ${size * U} ${size * U}`);
  svg.innerHTML =
    gridMarkup(size) + pathsMarkup(puzzle, paths, letters ? 0.6 : 0.5) + endpointsMarkup(puzzle, letters);
}

/** Map a client point to a cell, with a dead zone near cell edges (null = stay). */
export function cellAt(svg: SVGSVGElement, size: number, clientX: number, clientY: number, deadZone = 0.08): Coord | null {
  const r = svg.getBoundingClientRect();
  const fx = ((clientX - r.left) / r.width) * size;
  const fy = ((clientY - r.top) / r.height) * size;
  const col = Math.floor(fx);
  const row = Math.floor(fy);
  if (col < 0 || row < 0 || col >= size || row >= size) return null;
  const inX = fx - col;
  const inY = fy - row;
  if (inX < deadZone || inX > 1 - deadZone || inY < deadZone || inY > 1 - deadZone) return null;
  return row * size + col;
}
