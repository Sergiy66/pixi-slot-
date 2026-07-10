import type { SlotGrid, SymbolKey } from '../types/slot';

export function pickRandomSymbol(symbols: readonly SymbolKey[], rng = Math.random): SymbolKey {
  const index = Math.floor(rng() * symbols.length);

  return symbols[index];
}

export function createRandomGrid(
  reels: number,
  rows: number,
  symbols: readonly SymbolKey[],
  rng = Math.random,
): SlotGrid {
  return Array.from({ length: reels }, () =>
    Array.from({ length: rows }, () => pickRandomSymbol(symbols, rng)),
  );
}
