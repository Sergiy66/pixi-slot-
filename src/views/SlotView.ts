import { gsap } from 'gsap';
import { Container, Graphics, Sprite, type PointData, type Renderer } from 'pixi.js';
import { SLOT_CONFIG } from '../config/slotConfig';
import type { SlotAssets, SlotGrid, SlotLayoutMetrics, SpineSymbolAsset, SymbolKey, WinningLine } from '../types/slot';
import { pickRandomSymbol } from '../utils/random';
import { BackgroundView } from './BackgroundView';
import { ReelView } from './ReelView';
import { SlotGridView } from './SlotGridView';
import { SymbolView } from './SymbolView';

export class SlotView {
  readonly root = new Container();

  private readonly backgroundLayer = new Container();
  private readonly contentRoot = new Container();
  private readonly gridLayer = new Container();
  private readonly logoLayer = new Container();
  private readonly symbolsLayer = new Container();
  private readonly winLayer = new Container();
  private readonly backgroundView: BackgroundView;
  private readonly slotGridView: SlotGridView;
  private readonly lineOverlay = new Graphics();
  private readonly logo: Sprite;
  private readonly reels: ReelView[] = [];
  private readonly assets: SlotAssets;
  private readonly renderer: Renderer;
  private readonly symbolKeys = SLOT_CONFIG.symbols.map((symbol) => symbol.id);

  private layout: SlotLayoutMetrics;
  private previewSymbolView: SymbolView | null = null;
  private reelsEnabled = false;
  private winPresentationTime = 0;
  private linePulseTween: gsap.core.Tween | null = null;

  constructor(assets: SlotAssets, initialLayout: SlotLayoutMetrics, renderer: Renderer) {
    this.assets = assets;
    this.renderer = renderer;
    this.layout = initialLayout;
    this.backgroundView = new BackgroundView(this.assets.background);
    this.slotGridView = new SlotGridView(this.assets.slotGrid);
    this.logo = new Sprite({ texture: this.assets.logo, anchor: 0.5 });
    this.logo.roundPixels = true;
    this.contentRoot.sortableChildren = true;
    this.logoLayer.zIndex = 10;

    this.backgroundLayer.addChild(this.backgroundView.root);
    this.logoLayer.addChild(this.logo);
    this.gridLayer.addChild(this.slotGridView.root);
    this.winLayer.addChild(this.lineOverlay);
    this.contentRoot.addChild(this.logoLayer, this.gridLayer, this.symbolsLayer, this.winLayer);
    this.root.addChild(this.backgroundLayer, this.contentRoot);

    this.applyStaticLayout();
    this.resize(initialLayout);
  }

  resize(layout: SlotLayoutMetrics) {
    this.layout = layout;
    this.backgroundView.resize(layout.backgroundRect);
    this.layoutLogo();
    this.contentRoot.position.set(layout.rootOffset.x, layout.rootOffset.y);
    this.contentRoot.scale.set(layout.rootScale);
  }

  clearWinPresentation() {
    this.linePulseTween?.kill();
    this.linePulseTween = null;
    this.lineOverlay.clear();
    this.lineOverlay.alpha = 1;
    this.winPresentationTime = 0;
    this.reels.forEach((reel) => reel.clearHighlights());
  }

  destroy() {
    this.linePulseTween?.kill();
    this.root.destroy({ children: true });
  }

  getLayout() {
    return this.layout;
  }

  isSpinAnimating() {
    return this.reels.some((reel) => reel.isAnimating());
  }

  setGrid(grid: SlotGrid) {
    if (!this.reelsEnabled) {
      return;
    }

    grid.forEach((column, index) => {
      this.reels[index]?.setColumn(column);
    });
  }

  setIdleAnimationsEnabled(isEnabled: boolean) {
    this.previewSymbolView?.setIdleAnimationEnabled(isEnabled);
    this.reels.forEach((reel) => reel.setIdleAnimationsEnabled(isEnabled));
  }

  showPreviewSymbol(symbolKey: SymbolKey) {
    if (!this.previewSymbolView) {
      this.previewSymbolView = new SymbolView(
        this.renderer,
        this.assets.symbols,
        this.layout.cellWidth * 2,
        this.layout.cellHeight * 2,
        this.layout.symbolFillRatio,
      );
      this.symbolsLayer.addChild(this.previewSymbolView);
      this.layoutPreviewSymbol();
    }

    this.previewSymbolView.setSymbol(symbolKey);
  }

  enableReels() {
    if (this.reelsEnabled) {
      return;
    }

    this.previewSymbolView?.destroy({ children: true });
    this.previewSymbolView = null;
    this.createReels();
    this.reelsEnabled = true;
  }

  showWinningLines(winningLines: WinningLine[]) {
    this.lineOverlay.clear();
    this.reels.forEach((reel) => reel.clearHighlights());

    if (winningLines.length === 0) {
      this.winPresentationTime = 0;
      this.linePulseTween?.kill();
      this.linePulseTween = null;
      return;
    }

    this.renderWinningLines(winningLines);
    this.linePulseTween?.kill();
    this.lineOverlay.alpha = 1;
    this.linePulseTween = gsap.to(this.lineOverlay, {
      alpha: 0.45,
      duration: 0.45,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    this.winPresentationTime = SLOT_CONFIG.lineDisplaySeconds;
  }

  startSpin(grid: SlotGrid) {
    this.clearWinPresentation();
    this.setIdleAnimationsEnabled(false);

    grid.forEach((column, index) => {
      const duration = SLOT_CONFIG.spin.baseDuration + index * SLOT_CONFIG.spin.reelDelay;
      this.reels[index]?.startSpin(column, duration);
    });
  }

  async playCascade(winningLines: readonly WinningLine[], grid: SlotGrid) {
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

  update(deltaSeconds: number) {
    this.previewSymbolView?.update(deltaSeconds);
    this.reels.forEach((reel) => reel.update(deltaSeconds));

    if (this.winPresentationTime <= 0) {
      return;
    }

    this.winPresentationTime -= deltaSeconds;

    if (this.winPresentationTime <= 0) {
      this.clearWinPresentation();
    }
  }

  private applyStaticLayout() {
    this.layoutLogo();
    this.slotGridView.resize(this.layout.gridDesignRect);
    this.layoutPreviewSymbol();
    this.layoutReels();
  }

  private layoutLogo() {
    const maxWidth = this.layout.gridDesignRect.width * 1.48;
    const maxHeight = this.layout.gridDesignRect.y * 3.1;
    const scale = Math.min(
      maxWidth / this.logo.texture.width,
      maxHeight / this.logo.texture.height,
    );

    this.logo.scale.set(scale);
    this.logo.position.set(
      this.layout.gridDesignRect.x + this.layout.gridDesignRect.width / 2,
      this.layout.gridDesignRect.y / 2,
    );
  }

  private createReels() {
    for (let index = 0; index < SLOT_CONFIG.reels; index += 1) {
      const reel = new ReelView(
        this.renderer,
        this.assets.symbols as Record<SymbolKey, SpineSymbolAsset>,
        this.randomSymbol,
        index,
        this.layout,
      );

      this.reels.push(reel);
      this.symbolsLayer.addChild(reel);
    }

    this.layoutReels();
  }

  private layoutPreviewSymbol() {
    if (!this.previewSymbolView) {
      return;
    }

    const previewWidth = this.layout.cellWidth * 2;
    const previewHeight = this.layout.cellHeight * 2;

    this.previewSymbolView.resizeLayout(previewWidth, previewHeight, this.layout.symbolFillRatio);
    this.previewSymbolView.position.set(
      this.layout.symbolsDesignRect.x + (this.layout.symbolsDesignRect.width - previewWidth) / 2,
      this.layout.symbolsDesignRect.y + (this.layout.symbolsDesignRect.height - previewHeight) / 2,
    );
  }

  private layoutReels() {
    this.reels.forEach((reel, index) => {
      reel.resizeLayout(this.layout);
      reel.position.set(this.layout.symbolsDesignRect.x + index * this.layout.cellWidth, this.layout.symbolsDesignRect.y);
    });
  }

  private renderWinningLines(winningLines: WinningLine[]) {
    this.lineOverlay.clear();
    this.reels.forEach((reel) => reel.clearHighlights());

    const highlightedCells = new Set<string>();

    for (const line of winningLines) {
      const points = line.cells.map(([column, row]) => this.getCellCenter(column, row));
      const flatPoints = points.flatMap((point) => [point.x, point.y]);

      this.lineOverlay.poly(flatPoints, false).stroke({
        width: 12,
        color: line.payline.color,
        alpha: 0.95,
        cap: 'round',
        join: 'round',
      });

      points.forEach((point) => {
        this.lineOverlay.circle(point.x, point.y, 12).fill({ color: line.payline.color, alpha: 0.92 });
      });

      line.cells.forEach(([column, row]) => {
        highlightedCells.add(`${column}:${row}`);
      });
    }

    highlightedCells.forEach((cellId) => {
      const [column, row] = cellId.split(':').map(Number);
      this.reels[column]?.setHighlightedRow(row, true);
    });
  }

  private getCellCenter(column: number, row: number): PointData {
    return {
      x: this.layout.symbolsDesignRect.x + column * this.layout.cellWidth + this.layout.cellWidth / 2,
      y: this.layout.symbolsDesignRect.y + row * this.layout.cellHeight + this.layout.cellHeight / 2,
    };
  }

  private randomSymbol = (): SymbolKey => pickRandomSymbol(this.symbolKeys);
}
