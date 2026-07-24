import { gsap } from 'gsap';
import { Container, Graphics, type PointData, type Renderer, type Texture } from 'pixi.js';
import { SLOT_CONFIG } from '../config/slotConfig';
import type { SlotGrid, SlotLayoutMetrics, SpineSymbolAsset, SymbolKey, WinningLine } from '../types/slot';
import { pickRandomSymbol } from '../utils/random';
import { ReelView } from './ReelView';
import { SlotGridView } from './SlotGridView';

export class BonusMachineView {
  readonly root = new Container();

  private readonly gridView: SlotGridView;
  private readonly reelsLayer = new Container();
  private readonly winLayer = new Container();
  private readonly lineOverlay = new Graphics();
  private readonly reels: ReelView[] = [];
  private readonly symbolKeys = SLOT_CONFIG.symbols.map((symbol) => symbol.id);
  private winningLines: readonly WinningLine[] = [];
  private linePulseTween: gsap.core.Tween | null = null;
  private innerX = 0;
  private innerY = 0;
  private cellWidth = 1;
  private cellHeight = 1;

  constructor(
    renderer: Renderer,
    gridTexture: Texture,
    symbolAssets: Record<SymbolKey, SpineSymbolAsset>,
    initialLayout: SlotLayoutMetrics,
  ) {
    this.gridView = new SlotGridView(gridTexture);
    this.winLayer.addChild(this.lineOverlay);
    this.root.addChild(this.gridView.root, this.reelsLayer, this.winLayer);

    for (let index = 0; index < SLOT_CONFIG.reels; index += 1) {
      const reel = new ReelView(renderer, symbolAssets, this.randomSymbol, index, initialLayout);

      this.reels.push(reel);
      this.reelsLayer.addChild(reel);
    }
  }

  resize(width: number, height: number, layout: SlotLayoutMetrics) {
    this.gridView.resize({ x: 0, y: 0, width, height });

    const scaleX = width / SLOT_CONFIG.gridFrame.width;
    const scaleY = height / SLOT_CONFIG.gridFrame.height;
    this.innerX = SLOT_CONFIG.gridFrame.innerPadding.left * scaleX;
    this.innerY = SLOT_CONFIG.gridFrame.innerPadding.top * scaleY;
    const innerWidth = width - (SLOT_CONFIG.gridFrame.innerPadding.left + SLOT_CONFIG.gridFrame.innerPadding.right) * scaleX;
    const innerHeight = height - (SLOT_CONFIG.gridFrame.innerPadding.top + SLOT_CONFIG.gridFrame.innerPadding.bottom) * scaleY;
    this.cellWidth = innerWidth / SLOT_CONFIG.reels;
    this.cellHeight = innerHeight / SLOT_CONFIG.rows;
    const reelMetrics: SlotLayoutMetrics = {
      ...layout,
      reelWidth: this.cellWidth,
      reelHeight: innerHeight,
      cellWidth: this.cellWidth,
      cellHeight: this.cellHeight,
      symbolFillRatio: SLOT_CONFIG.slotLayout.symbolFillRatio,
    };

    this.reels.forEach((reel, index) => {
      reel.resizeLayout(reelMetrics);
      reel.position.set(this.innerX + index * this.cellWidth, this.innerY);
    });

    if (this.winningLines.length > 0) {
      this.renderWinningLines();
    }
  }

  setGrid(grid: SlotGrid) {
    grid.forEach((column, index) => this.reels[index]?.setColumn(column));
  }

  startSpin(grid: SlotGrid) {
    this.clearWinPresentation();
    this.reels.forEach((reel, index) => {
      reel.setIdleAnimationsEnabled(false);
      reel.startSpin(grid[index], SLOT_CONFIG.bonus.spinDuration + index * SLOT_CONFIG.spin.reelDelay);
    });
  }

  showWinningLines(winningLines: readonly WinningLine[]) {
    this.clearWinPresentation();
    this.winningLines = winningLines;

    if (winningLines.length === 0) {
      return;
    }

    this.renderWinningLines();
    this.linePulseTween = gsap.to(this.lineOverlay, {
      alpha: 0.45,
      duration: 0.42,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  clearWinPresentation() {
    this.linePulseTween?.kill();
    this.linePulseTween = null;
    this.winningLines = [];
    this.lineOverlay.clear();
    this.lineOverlay.alpha = 1;
    this.reels.forEach((reel) => reel.clearHighlights());
  }

  async playCascade(winningLines: readonly WinningLine[], grid: SlotGrid) {
    if (winningLines.length === 0) {
      return;
    }

    const rowsByColumn = new Map<number, number[]>();

    winningLines.forEach((line) => {
      line.cells.forEach(([column, row]) => {
        const rows = rowsByColumn.get(column) ?? [];

        if (!rows.includes(row)) {
          rows.push(row);
        }

        rowsByColumn.set(column, rows);
      });
    });

    this.clearWinPresentation();
    await Promise.all(
      this.reels.map((reel, index) => reel.cascadeRows(rowsByColumn.get(index) ?? [], grid[index])),
    );
    this.setGrid(grid);
  }

  isAnimating() {
    return this.reels.some((reel) => reel.isAnimating());
  }

  setIdleAnimationsEnabled(isEnabled: boolean) {
    this.reels.forEach((reel) => reel.setIdleAnimationsEnabled(isEnabled));
  }

  update(deltaSeconds: number) {
    this.reels.forEach((reel) => reel.update(deltaSeconds));
  }

  dispose() {
    this.clearWinPresentation();
  }

  private renderWinningLines() {
    this.lineOverlay.clear();
    this.lineOverlay.alpha = 1;
    const highlightedCells = new Set<string>();
    const lineWidth = Math.max(this.cellHeight * 0.075, 2);
    const markerRadius = Math.max(this.cellHeight * 0.075, 2);

    this.winningLines.forEach((line) => {
      const points = line.cells.map(([column, row]) => this.getCellCenter(column, row));
      const flatPoints = points.flatMap((point) => [point.x, point.y]);

      this.lineOverlay.poly(flatPoints, false).stroke({
        width: lineWidth,
        color: line.payline.color,
        alpha: 0.95,
        cap: 'round',
        join: 'round',
      });

      points.forEach((point) => {
        this.lineOverlay.circle(point.x, point.y, markerRadius).fill({
          color: line.payline.color,
          alpha: 0.92,
        });
      });

      line.cells.forEach(([column, row]) => highlightedCells.add(`${column}:${row}`));
    });

    highlightedCells.forEach((cellId) => {
      const [column, row] = cellId.split(':').map(Number);

      this.reels[column]?.setHighlightedRow(row, true);
    });
  }

  private getCellCenter(column: number, row: number): PointData {
    return {
      x: this.innerX + column * this.cellWidth + this.cellWidth / 2,
      y: this.innerY + row * this.cellHeight + this.cellHeight / 2,
    };
  }

  private randomSymbol = () => pickRandomSymbol(this.symbolKeys);
}
