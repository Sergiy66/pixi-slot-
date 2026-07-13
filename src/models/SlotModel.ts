import { SLOT_CONFIG } from '../config/slotConfig';
import type { SpinResult, SymbolKey, SlotGrid, WinningLine } from '../types/slot';
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

  cascadeWinningLines(winningLines: readonly WinningLine[]): SlotGrid {
    if (winningLines.length === 0) {
      return this.getGrid();
    }

    const symbolKeys = SLOT_CONFIG.symbols.map((symbol) => symbol.id);
    const removedRowsByColumn = new Map<number, Set<number>>();

    winningLines.forEach((line) => {
      line.cells.forEach(([column, row]) => {
        const removedRows = removedRowsByColumn.get(column) ?? new Set<number>();
        removedRows.add(row);
        removedRowsByColumn.set(column, removedRows);
      });
    });

    const nextGrid = this.grid.map((column, columnIndex) => {
      const removedRows = removedRowsByColumn.get(columnIndex);

      if (!removedRows || removedRows.size === 0) {
        return [...column];
      }

      const remainingSymbols = column.filter((_, rowIndex) => !removedRows.has(rowIndex));
      const newSymbols = Array.from({ length: removedRows.size }, () => {
        const randomIndex = Math.floor(Math.random() * symbolKeys.length);

        return symbolKeys[randomIndex];
      });

      return [...newSymbols, ...remainingSymbols];
    });

    this.grid = nextGrid;

    return this.getGrid();
  }
}
