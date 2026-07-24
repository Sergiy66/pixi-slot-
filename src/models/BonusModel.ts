import { SLOT_CONFIG } from '../config/slotConfig';
import type { BonusSpinResult, SlotGrid, SpinResult, SymbolKey, WinningLine } from '../types/slot';
import { createRandomGrid } from '../utils/random';

export class BonusModel {
  private readonly symbolKeys = SLOT_CONFIG.symbols.map((symbol) => symbol.id);
  private grids: SlotGrid[] = this.createMachineGrids();
  private spinsRemaining = 0;
  private totalWin = 0;
  private lastResult: BonusSpinResult | null = null;
  private isLastResultSettled = true;

  start() {
    this.grids = this.createMachineGrids();
    this.spinsRemaining = SLOT_CONFIG.bonus.freeSpins;
    this.totalWin = 0;
    this.lastResult = null;
    this.isLastResultSettled = true;
  }

  spin(): BonusSpinResult | null {
    if (this.spinsRemaining <= 0) {
      return null;
    }

    const nextGrids = this.createMachineGrids();
    const machineResults = nextGrids.map((grid) => this.calculateGridResult(grid));
    const totalWin = machineResults.reduce((sum, result) => sum + result.totalWin, 0);
    const result: BonusSpinResult = {
      machineResults,
      totalWin,
    };

    this.grids = nextGrids;
    this.spinsRemaining -= 1;
    this.lastResult = result;
    this.isLastResultSettled = false;

    return result;
  }

  getGrids() {
    return this.grids.map((grid) => grid.map((column) => [...column]));
  }

  getLastResult() {
    return this.lastResult;
  }

  getSpinsRemaining() {
    return this.spinsRemaining;
  }

  getTotalWin() {
    return this.totalWin;
  }

  settleLastResult() {
    if (!this.lastResult || this.isLastResultSettled) {
      return;
    }

    this.totalWin += this.lastResult.totalWin;
    this.isLastResultSettled = true;
  }

  cascadeWinningLines(machineResults: readonly SpinResult[]) {
    this.grids = this.grids.map((grid, index) =>
      this.cascadeGrid(grid, machineResults[index]?.winningLines ?? []),
    );

    return this.getGrids();
  }

  private createMachineGrids() {
    return Array.from({ length: SLOT_CONFIG.bonus.machines }, () =>
      createRandomGrid(SLOT_CONFIG.reels, SLOT_CONFIG.rows, this.symbolKeys),
    );
  }

  private calculateGridResult(grid: SlotGrid): SpinResult {
    const winningLines = SLOT_CONFIG.paylines.flatMap((payline) => {
      const [firstColumn, firstRow] = payline.points[0];
      const symbol = grid[firstColumn][firstRow] as SymbolKey;
      const isWin = payline.points.every(([column, row]) => grid[column][row] === symbol);

      if (!isWin) {
        return [];
      }

      const multiplier = SLOT_CONFIG.paytable[symbol];

      return [{
        payline,
        symbol,
        multiplier,
        amount: SLOT_CONFIG.bonus.bet * multiplier * payline.payoutFactor,
        cells: payline.points.map(([column, row]) => [column, row] as const),
      }];
    });

    return {
      grid: grid.map((column) => [...column]),
      winningLines,
      totalWin: winningLines.reduce((sum, line) => sum + line.amount, 0),
    };
  }

  private cascadeGrid(grid: SlotGrid, winningLines: readonly WinningLine[]) {
    const removedRowsByColumn = new Map<number, Set<number>>();

    winningLines.forEach((line) => {
      line.cells.forEach(([column, row]) => {
        const rows = removedRowsByColumn.get(column) ?? new Set<number>();

        rows.add(row);
        removedRowsByColumn.set(column, rows);
      });
    });

    return grid.map((column, columnIndex) => {
      const removedRows = removedRowsByColumn.get(columnIndex);

      if (!removedRows?.size) {
        return [...column];
      }

      const remainingSymbols = column.filter((_, row) => !removedRows.has(row));
      const newSymbols = Array.from({ length: removedRows.size }, () => {
        const randomIndex = Math.floor(Math.random() * this.symbolKeys.length);

        return this.symbolKeys[randomIndex];
      });

      return [...newSymbols, ...remainingSymbols];
    });
  }
}
