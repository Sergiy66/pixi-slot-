import { gsap } from 'gsap';
import { Container, Graphics, type Renderer } from 'pixi.js';
import { SLOT_CONFIG } from '../config/slotConfig';
import type { ReelColumn, SlotLayoutMetrics, SpineSymbolAsset, SymbolKey } from '../types/slot';
import { FrameTaskQueue } from '../utils/FrameTaskQueue';
import { SymbolView } from './SymbolView';

type ReelState = 'idle' | 'spinning' | 'cascading';
const REEL_BUFFER_SYMBOLS = 2;
const STOP_BUFFER_STEPS = 1;
const EDGE_ROW_OFFSET_RATIO = 0.025;
const STEP_EPSILON_RATIO = 0.000001;

export class ReelView extends Container {
  private static readonly spinePreloadQueue = new FrameTaskQueue(
    SLOT_CONFIG.symbolRendering.spinePreloadsPerFrame,
  );

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
  private pendingSpinePreloads: Array<() => void> = [];

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

      if (index === 0 || index > SLOT_CONFIG.rows) {
        symbol.setSpinning(true);
      }

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
    this.clearPendingSpinePreloads();
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
    this.scheduleFinalSpinePreloads(column, spinSteps + stopSteps);

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

  cascadeRows(rowsToRemove: readonly number[], nextColumn: ReelColumn): Promise<void> {
    const uniqueRowsToRemove = [...new Set(rowsToRemove)].sort((left, right) => left - right);

    if (uniqueRowsToRemove.length === 0) {
      this.applyFinalSymbols(nextColumn);
      return Promise.resolve();
    }

    this.killAnimations();
    this.state = 'cascading';
    this.clearHighlights();
    this.setIdleAnimationsEnabled(false);

    const removedRows = new Set(uniqueRowsToRemove);
    const orderedSymbols = this.getOrderedSymbols();
    const visibleSymbols = Array.from({ length: SLOT_CONFIG.rows }, (_, row) => orderedSymbols[row + 1]);
    const removedSymbols = uniqueRowsToRemove
      .map((row) => visibleSymbols[row])
      .filter((symbol): symbol is SymbolView => Boolean(symbol));
    const fallingSymbols = visibleSymbols
      .map((symbol, row) => ({ symbol, row }))
      .filter((item): item is { symbol: SymbolView; row: number } => Boolean(item.symbol) && !removedRows.has(item.row))
      .map(({ symbol, row }) => ({
        symbol,
        finalRow: row + uniqueRowsToRemove.filter((removedRow) => removedRow > row).length,
      }));

    const timeline = gsap.timeline();
    this.spinTimeline = timeline;

    timeline.to(removedSymbols, {
      alpha: 0,
      duration: SLOT_CONFIG.cascade.vanishDuration,
      ease: 'sine.in',
      stagger: SLOT_CONFIG.cascade.vanishStagger,
    });

    timeline.call(() => {
      removedSymbols.forEach((symbol, index) => {
        const finalRow = index;

        symbol.setSymbol(nextColumn[finalRow]);
        symbol.alpha = 0;
        symbol.scale.set(SLOT_CONFIG.cascade.scaleIn);
        symbol.y = this.getSymbolSlotY(finalRow + 1 - uniqueRowsToRemove.length);
      });
    });

    timeline.to(
      fallingSymbols.map(({ symbol }) => symbol),
      {
        y: (index) => this.getSymbolSlotY(fallingSymbols[index].finalRow + 1),
        duration: SLOT_CONFIG.cascade.fallDuration,
        ease: 'sine.out',
      },
      'drop',
    );

    timeline.to(
      removedSymbols,
      {
        y: (index) => this.getSymbolSlotY(index + 1),
        alpha: 1,
        duration: SLOT_CONFIG.cascade.dropDuration,
        ease: 'sine.out',
      },
      'drop',
    );

    timeline.to(
      removedSymbols.map((symbol) => symbol.scale),
      {
        x: 1,
        y: 1,
        duration: SLOT_CONFIG.cascade.scaleDuration,
        ease: 'sine.out',
      },
      'drop',
    );

    return new Promise((resolve) => {
      timeline.eventCallback('onComplete', () => {
        this.applyFinalSymbols(nextColumn);
        this.spinTimeline = null;
        this.state = 'idle';
        resolve();
      });
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
      const symbolKey = column[this.getColumnIndexForSymbolSlot(index)];

      if (index > 0 && index <= SLOT_CONFIG.rows) {
        symbol.preloadLiveSymbol(symbolKey);
        symbol.setSymbol(symbolKey);
        symbol.setSpinning(false);
        return;
      }

      symbol.setSpinning(true);
      symbol.setSymbol(symbolKey);
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

    this.settleSpinSymbols();
    this.state = 'idle';
  }

  private settleSpinSymbols() {
    const orderedSymbols = this.getOrderedSymbols();

    orderedSymbols.forEach((symbol, index) => {
      symbol.y = this.getSymbolSlotY(index);

      if (index === 0 || index > SLOT_CONFIG.rows) {
        symbol.setSymbol(this.finalSymbols[this.getColumnIndexForSymbolSlot(index)]);
        return;
      }

      symbol.setSpinning(false);
    });

    this.offset = 0;
    this.lastAnimatedOffset = 0;
    this.spinProxy.offset = 0;
    this.symbolsLayer.y = 0;
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
    const stepEpsilon = step * STEP_EPSILON_RATIO;

    while (this.offset >= step - stepEpsilon) {
      this.offset = Math.max(this.offset - step, 0);
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

    const stopSymbol = this.stopSymbolQueue.shift();
    const nextSymbol = stopSymbol ?? this.randomSymbol();

    bottomSymbol.setSymbol(nextSymbol);

    if (stopSymbol) {
      bottomSymbol.preloadLiveSymbol(stopSymbol);
    }

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

  private scheduleFinalSpinePreloads(column: ReelColumn, totalSteps: number) {
    this.clearPendingSpinePreloads();
    const orderedSymbols = this.getOrderedSymbols();
    const rotation = totalSteps % orderedSymbols.length;
    const finalOrder = rotation === 0
      ? orderedSymbols
      : [
          ...orderedSymbols.slice(-rotation),
          ...orderedSymbols.slice(0, -rotation),
        ];

    column.slice(0, SLOT_CONFIG.rows).forEach((symbolKey, row) => {
      const symbol = finalOrder[row + 1];

      if (!symbol) {
        return;
      }

      this.pendingSpinePreloads.push(
        ReelView.spinePreloadQueue.enqueue(() => symbol.preloadLiveSymbol(symbolKey)),
      );
    });
  }

  private clearPendingSpinePreloads() {
    this.pendingSpinePreloads.forEach((cancel) => cancel());
    this.pendingSpinePreloads = [];
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
