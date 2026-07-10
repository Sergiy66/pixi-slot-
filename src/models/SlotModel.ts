import { SLOT_CONFIG } from '../config/slotConfig';
import type { SpinResult, SymbolKey, SlotGrid } from '../types/slot';
import { createRandomGrid } from '../utils/random';

export class SlotModel {
  private grid: SlotGrid = createRandomGrid(
    SLOT_CONFIG.reels,
    SLOT_CONFIG.rows,
    SLOT_CONFIG.symbols.map((symbol) => symbol.id),
  );

  private lastResult: SpinResult | null = null;

  getGrid(): SlotGrid {
    return this.grid.map((column) => [...column]);
  }

  getLastResult(): SpinResult | null {
    return this.lastResult;
  }

  spin(bet: number): SpinResult {
    const nextGrid = createRandomGrid(
      SLOT_CONFIG.reels,
      SLOT_CONFIG.rows,
      SLOT_CONFIG.symbols.map((symbol) => symbol.id),
    );

    const winningLines = SLOT_CONFIG.paylines.flatMap((payline) => {
      const [firstColumn, firstRow] = payline.points[0];
      const firstSymbol = nextGrid[firstColumn][firstRow];

      const isWin = payline.points.every(([column, row]) => nextGrid[column][row] === firstSymbol);

      if (!isWin) {
        return [];
      }

      const multiplier = SLOT_CONFIG.paytable[firstSymbol];

      return [
        {
          payline,
          symbol: firstSymbol as SymbolKey,
          multiplier,
          amount: bet * multiplier * payline.payoutFactor,
          cells: payline.points.map(([column, row]) => [column, row] as const),
        },
      ];
    });

    const totalWin = winningLines.reduce((sum, line) => sum + line.amount, 0);
    const result: SpinResult = {
      grid: nextGrid.map((column) => [...column]),
      winningLines,
      totalWin,
    };

    this.grid = nextGrid;
    this.lastResult = result;

    return result;
  }
}
