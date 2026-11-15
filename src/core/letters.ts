export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'.split('');

/** Pair colours, modelled on the NZZ palette. Order matters little; picked per puzzle. */
export const PALETTE = [
  '#a58c6a', // tan
  '#8a8aa8', // slate lavender
  '#3f8a52', // green
  '#e07b1f', // orange
  '#3cbfa4', // teal
  '#7f97f2', // periwinkle
  '#2d2f55', // deep navy
  '#e8b93b', // yellow
  '#1e7fa8', // steel blue
  '#b0459c', // magenta
  '#ddd2b4', // cream
  '#0e7a64', // emerald
  '#c9463d', // brick red
  '#9c6ad6', // violet
  '#8fbf3f', // lime
  '#e889a8', // pink
  '#5b6b7a', // slate grey
  '#c7a0e8', // lilac
  '#2f9e9e', // cyan
  '#a35a2a', // rust
];

/** Dark or light text, whichever contrasts better with the given hex colour. */
export function textColorFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#1a1a1a' : '#ffffff';
}
