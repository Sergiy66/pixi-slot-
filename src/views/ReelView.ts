import { gsap } from 'gsap';
import { Container, Graphics, type Renderer } from 'pixi.js';
import { SLOT_CONFIG } from '../config/slotConfig';
import type { ReelColumn, SlotLayoutMetrics, SpineSymbolAsset, SymbolKey } from '../types/slot';
import { SymbolView } from './SymbolView';

type ReelState = 'idle' | 'spinning';
const REEL_BUFFER_SYMBOLS = 2;
const STOP_BUFFER_STEPS = 1;
const EDGE_ROW_OFFSET_RATIO = 0.025;

export class ReelView extends Container {
  private readonly maskShape: Graphics;
  private readonly symbolsLayer = new Container();
  private readonly symbols: SymbolView[] = [];
  private readonly spinProxy = { offset: 0 };
  private readonly symbolKeys = SLOT_CONFIG.symbols.map((symbol) => symbol.id);
  private readonly renderer: Renderer;

  private state: ReelState = 'idle';
  private offset = 0;
  private lastAnimatedOffset = 0;
  private finalSymbols: ReelColumn = [];
  private stopSymbolQueue: SymbolKey[] = [];
  private readonly symbolAssets: Record<SymbolKey, SpineSymbolAsset>;
  private readonly randomSymbol: () => SymbolKey;
  private readonly reelIndex: number;
  private metrics: SlotLayoutMetrics;
  private spinTimeline: gsap.core.Timeline | null = null;

  constructor(
    renderer: Renderer,
    symbolAssets: Record<SymbolKey, SpineSymbolAsset>,
    randomSymbol: () => SymbolKey,
    reelIndex: number,
    metrics: SlotLayoutMetrics,
  ) {
    super();

    this.renderer = renderer;
    this.symbolAssets = symbolAssets;
    this.randomSymbol = randomSymbol;
    this.reelIndex = reelIndex;
    this.metrics = metrics;

    this.maskShape = new Graphics();
    this.symbolsLayer.mask = this.maskShape;

    for (let index = 0; index < SLOT_CONFIG.rows + REEL_BUFFER_SYMBOLS; index += 1) {
      const symbol = new SymbolView(
        this.renderer,
        this.symbolAssets,
        this.metrics.cellWidth,
        this.metrics.cellHeight,
        this.metrics.symbolFillRatio,
      );

      symbol.setSymbol(this.randomSymbol());
      symbol.preloadSpinTextures(this.symbolKeys);
      this.symbols.push(symbol);
      this.symbolsLayer.addChild(symbol);
    }

    this.addChild(this.symbolsLayer, this.maskShape);
    this.resizeLayout(metrics);
  }

  clearHighlights() {
    this.symbols.forEach((symbol) => symbol.setHighlighted(false));
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.killAnimations();
    super.destroy(options);
  }

  isAnimating() {
    return this.state !== 'idle';
  }

  setColumn(column: ReelColumn) {
    this.applyFinalSymbols(column);
  }

  setHighlightedRow(row: number, isHighlighted: boolean) {
    const orderedSymbols = this.getOrderedSymbols();
    const visibleSymbol = orderedSymbols[row + 1];

    visibleSymbol?.setHighlighted(isHighlighted);
  }

  setIdleAnimationsEnabled(isEnabled: boolean) {
    this.symbols.forEach((symbol) => symbol.setIdleAnimationEnabled(isEnabled));
  }

  startSpin(column: ReelColumn, duration: number) {
    this.killAnimations();
    this.finalSymbols = [...column];
    this.stopSymbolQueue = [];
    this.state = 'spinning';
    this.clearHighlights();
    this.symbols.forEach((symbol) => symbol.setSpinning(true));

    const spinSteps = SLOT_CONFIG.spin.cycles + this.reelIndex;
    const stopSteps = SLOT_CONFIG.rows + STOP_BUFFER_STEPS;
    const spinDistance = this.metrics.cellHeight * spinSteps;
    const stopDistance = this.metrics.cellHeight * stopSteps;
    const targetOffset = spinDistance + stopDistance;
    const spinDuration = Math.max(duration - SLOT_CONFIG.spin.stopDuration, 0.2);
    this.spinProxy.offset = 0;
    this.lastAnimatedOffset = 0;

    this.spinTimeline = gsap.timeline({
      defaults: { ease: 'none' },
      onComplete: () => {
        this.completeSpin(targetOffset);
      },
    });

    this.spinTimeline
      .to(this.spinProxy, {
        offset: spinDistance,
        duration: spinDuration,
        ease: 'none',
        onUpdate: this.applySpinOffset,
      })
      .call(() => {
        this.prepareStopSymbols(this.finalSymbols);
      })
      .to(this.spinProxy, {
        offset: targetOffset,
        duration: SLOT_CONFIG.spin.stopDuration,
        ease: 'sine.out',
        onUpdate: this.applySpinOffset,
      });
  }

  update(deltaSeconds: number) {
    this.getOrderedSymbols().forEach((symbol, index) => {
      if (index > 0 && index <= SLOT_CONFIG.rows) {
        symbol.update(deltaSeconds);
      }
    });
  }

  resizeLayout(metrics: SlotLayoutMetrics) {
    const previousStep = this.metrics.cellHeight;
    const offsetRatio = previousStep > 0 ? this.offset / previousStep : 0;

    this.metrics = metrics;
    this.drawMask();

    this.getOrderedSymbols().forEach((symbol, index) => {
      symbol.resizeLayout(this.metrics.cellWidth, this.metrics.cellHeight, this.metrics.symbolFillRatio);
      symbol.y = this.getSymbolSlotY(index);
    });

    this.offset = offsetRatio * this.metrics.cellHeight;
    this.symbolsLayer.y = this.offset;
  }

  private applyFinalSymbols(column: ReelColumn) {
    const orderedSymbols = this.getOrderedSymbols();

    orderedSymbols.forEach((symbol) => symbol.setIdleAnimationEnabled(false));

    orderedSymbols.forEach((symbol, index) => {
      symbol.y = this.getSymbolSlotY(index);
      symbol.setSymbol(column[this.getColumnIndexForSymbolSlot(index)]);
      symbol.setSpinning(false);
    });

    this.offset = 0;
    this.lastAnimatedOffset = 0;
    this.spinProxy.offset = 0;
    this.symbolsLayer.y = 0;
  }

  private completeSpin(targetOffset: number) {
    const remainingDistance = targetOffset - this.lastAnimatedOffset;

    if (Math.abs(remainingDistance) > 0.001) {
      this.moveBy(remainingDistance);
    }

    this.applyFinalSymbols(this.finalSymbols);
    this.state = 'idle';
  }

  private getOrderedSymbols() {
    return [...this.symbols].sort((left, right) => left.y - right.y);
  }

  private getColumnIndexForSymbolSlot(symbolSlot: number) {
    return (symbolSlot - 1 + SLOT_CONFIG.rows) % SLOT_CONFIG.rows;
  }

  private moveBy(distance: number) {
    if (distance === 0) {
      return;
    }

    this.offset += distance;
    this.symbolsLayer.y = this.offset;

    const step = this.metrics.cellHeight;

    while (this.offset >= step) {
      this.offset -= step;
      this.symbolsLayer.y = this.offset;
      this.recycleBottomSymbol();
    }
  }

  private recycleBottomSymbol() {
    const orderedSymbols = this.getOrderedSymbols();
    const bottomSymbol = orderedSymbols.pop();

    if (!bottomSymbol) {
      return;
    }

    bottomSymbol.setSymbol(this.stopSymbolQueue.shift() ?? this.randomSymbol());
    orderedSymbols.unshift(bottomSymbol);

    orderedSymbols.forEach((symbol, index) => {
      symbol.y = this.getSymbolSlotY(index);
    });
  }

  private getSymbolSlotY(symbolSlot: number) {
    return (symbolSlot - 1) * this.metrics.cellHeight + this.getVisibleRowOffset(symbolSlot);
  }

  private getVisibleRowOffset(symbolSlot: number) {
    if (symbolSlot === 1) {
      return -this.metrics.cellHeight * EDGE_ROW_OFFSET_RATIO;
    }

    if (symbolSlot === SLOT_CONFIG.rows) {
      return this.metrics.cellHeight * EDGE_ROW_OFFSET_RATIO;
    }

    return 0;
  }

  private prepareStopSymbols(column: ReelColumn) {
    this.stopSymbolQueue = [
      ...column.slice(0, SLOT_CONFIG.rows).reverse(),
      this.randomSymbol(),
    ];
  }

  private applySpinOffset = () => {
    const delta = this.spinProxy.offset - this.lastAnimatedOffset;
    this.lastAnimatedOffset = this.spinProxy.offset;
    this.moveBy(delta);
  };

  private killAnimations() {
    this.spinTimeline?.kill();
    this.spinTimeline = null;
    gsap.killTweensOf(this.spinProxy);
    gsap.killTweensOf(this.symbolsLayer);
  }

  private drawMask() {
    this.maskShape.clear();
    this.maskShape.rect(0, 0, this.metrics.reelWidth, this.metrics.reelHeight).fill({ color: 0xffffff, alpha: 0.002 });
  }
}
