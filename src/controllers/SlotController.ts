import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Assets, type Application, type Texture } from 'pixi.js';
import { SoundManager } from '../audio/SoundManager';
import { SLOT_CONFIG } from '../config/slotConfig';
import { LayoutManager } from '../layout/LayoutManager';
import { SlotModel } from '../models/SlotModel';
import type { SlotAssets, SlotUiState, SpineAnimationSet, SpineSymbolAsset, SymbolDefinition } from '../types/slot';
import { SlotView } from '../views/SlotView';

type StateListener = (state: SlotUiState) => void;

export class SlotController {
  static async create(app: Application, onStateChange: StateListener): Promise<SlotController> {
    const background = await Assets.load<Texture>(SLOT_CONFIG.backgroundUrl);
    const slotGrid = await Assets.load<Texture>(SLOT_CONFIG.slotGridUrl);
    const assets: SlotAssets = {
      background,
      slotGrid,
      symbols: {},
    };

    const controller = new SlotController(app, assets, onStateChange);
    await controller.initializeSymbols();

    return controller;
  }

  private readonly model = new SlotModel();
  private readonly layoutManager: LayoutManager;
  private readonly view: SlotView;
  private readonly sounds = new SoundManager();
  private readonly tickerHandler = () => {
    this.update(this.app.ticker.deltaMS / 1000);
  };

  private isSpinning = false;
  private isReady = false;
  private balance = 1000;
  private bet: number = SLOT_CONFIG.bet;
  private displayedWin = 0;
  private pendingResolve?: () => void;
  private idleAnimationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly app: Application;
  private readonly assets: SlotAssets;
  private readonly onStateChange: StateListener;
  private statusMessage = 'Loading preview symbol...';
  private loadingProgress = 0.12;
  private lastViewportWidth = 0;
  private lastViewportHeight = 0;
  private lastUiReservedHeight = 0;
  private lastUiMode: NonNullable<SlotUiState['layout']>['ui']['mode'];

  private constructor(app: Application, assets: SlotAssets, onStateChange: StateListener) {
    this.app = app;
    this.assets = assets;
    this.onStateChange = onStateChange;
    this.layoutManager = new LayoutManager({
      viewportWidth: SLOT_CONFIG.designWidth,
      viewportHeight: SLOT_CONFIG.designHeight,
      uiReservedHeight: SLOT_CONFIG.ui.minReservedHeight,
    });
    this.lastUiMode = this.layoutManager.getLayout().ui.mode;
    this.view = new SlotView(
      assets,
      this.layoutManager.getLayout(),
      this.app.renderer,
    );
    this.app.stage.addChild(this.view.root);
    this.app.stage.eventMode = 'none';

    this.view.setGrid(this.model.getGrid());
    this.app.ticker.add(this.tickerHandler);
    this.emitState();
  }

  destroy() {
    this.clearIdleAnimationTimer();
    this.app.ticker.remove(this.tickerHandler);
    this.app.stage.removeChild(this.view.root);
    this.view.destroy();
    this.sounds.destroy();
  }

  getUiState(): SlotUiState {
    return {
      balance: this.balance,
      bet: this.bet,
      totalWin: this.displayedWin,
      isSpinning: this.isSpinning,
      isReady: this.isReady,
      loadingProgress: this.loadingProgress,
      statusMessage: this.statusMessage,
      layout: this.view.getLayout(),
    };
  }

  resize(viewportWidth: number, viewportHeight: number, uiReservedHeight: number) {
    if (!this.app || !this.app.renderer || !this.view) {
      return;
    }

    const safeViewportWidth = Math.max(Number.isFinite(viewportWidth) ? viewportWidth : 0, 1);
    const safeViewportHeight = Math.max(Number.isFinite(viewportHeight) ? viewportHeight : 0, 1);
    const safeUiReservedHeight = Math.max(Number.isFinite(uiReservedHeight) ? uiReservedHeight : 0, 0);

    if (
      safeViewportWidth === this.lastViewportWidth &&
      safeViewportHeight === this.lastViewportHeight &&
      safeUiReservedHeight === this.lastUiReservedHeight
    ) {
      return;
    }

    this.lastViewportWidth = safeViewportWidth;
    this.lastViewportHeight = safeViewportHeight;
    this.lastUiReservedHeight = safeUiReservedHeight;

    const nextLayout = this.layoutManager.update({
      viewportWidth: safeViewportWidth,
      viewportHeight: safeViewportHeight,
      uiReservedHeight: safeUiReservedHeight,
    });
    const shouldEmitState = nextLayout.ui.mode !== this.lastUiMode;

    this.lastUiMode = nextLayout.ui.mode;
    this.view.resize(nextLayout);
    this.app.renderer.resize(safeViewportWidth, safeViewportHeight);
    this.app.render();

    if (shouldEmitState) {
      this.emitState();
    }
  }

  async spin(): Promise<void> {
    if (this.isSpinning || !this.isReady || this.balance < this.bet) {
      return;
    }

    this.sounds.startBackground();
    this.sounds.playSpinButton();
    this.sounds.startSpin();

    const result = this.model.spin(this.bet);

    this.clearIdleAnimationTimer();
    this.isSpinning = true;
    this.balance -= this.bet;
    this.displayedWin = 0;
    this.view.clearWinPresentation();
    this.view.startSpin(result.grid);
    this.emitState();

    await new Promise<void>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  decreaseBet() {
    this.changeBetBy(-1);
  }

  increaseBet() {
    this.changeBetBy(1);
  }

  activateAudio() {
    this.sounds.startBackground();
  }

  private emitState() {
    this.onStateChange(this.getUiState());
  }

  private finishSpin() {
    const result = this.model.getLastResult();

    this.isSpinning = false;
    this.displayedWin = result?.totalWin ?? 0;
    this.balance += this.displayedWin;
    this.sounds.stopSpin();
    this.clearIdleAnimationTimer();
    this.idleAnimationTimer = setTimeout(() => {
      this.view.setIdleAnimationsEnabled(true);
      this.idleAnimationTimer = null;
    }, 120);

    if (result) {
      this.view.showWinningLines(result.winningLines);
    }

    if ((result?.totalWin ?? 0) > 0) {
      this.sounds.playWin();
    }

    this.emitState();
    this.pendingResolve?.();
    this.pendingResolve = undefined;
  }

  private clearIdleAnimationTimer() {
    if (!this.idleAnimationTimer) {
      return;
    }

    clearTimeout(this.idleAnimationTimer);
    this.idleAnimationTimer = null;
  }

  private changeBetBy(direction: -1 | 1) {
    if (this.isSpinning) {
      return;
    }

    const betOptions: readonly number[] = SLOT_CONFIG.betOptions;
    const currentIndex = betOptions.indexOf(this.bet);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.min(Math.max(safeCurrentIndex + direction, 0), betOptions.length - 1);
    const nextBet = betOptions[nextIndex];

    if (nextBet === this.bet) {
      return;
    }

    this.bet = nextBet;
    this.emitState();
  }

  private update(deltaSeconds: number) {
    this.view.update(deltaSeconds);

    if (this.isSpinning && !this.view.isSpinAnimating()) {
      this.finishSpin();
    }
  }

  private static extractAnimations(animationNames: string[]): SpineAnimationSet {
    const idle = animationNames.find((animationName) => /idle/i.test(animationName));
    const win = animationNames.find((animationName) => /win/i.test(animationName));

    return { idle, win };
  }

  private async initializeSymbols() {
    const totalSymbolsToLoad = SLOT_CONFIG.symbols.length;
    let loadedSymbols = 0;

    const updateLoadingState = (statusMessage: string, progressFloor = 0.12) => {
      this.statusMessage = statusMessage;
      this.loadingProgress = Math.max(progressFloor, 0.12 + (loadedSymbols / totalSymbolsToLoad) * 0.88);
      this.emitState();
    };

    SLOT_CONFIG.symbols.forEach((symbol) => {
      Assets.add({ alias: symbol.skeletonAssetAlias, src: symbol.skeletonAssetSrc });
      Assets.add({ alias: symbol.atlasAssetAlias, src: symbol.atlasAssetSrc });
    });

    const previewDefinition =
      SLOT_CONFIG.symbols.find((symbol) => symbol.id === SLOT_CONFIG.previewSymbolId) ?? SLOT_CONFIG.symbols[0];

    try {
      const previewAsset = await this.loadSpineSymbolAsset(previewDefinition);
      this.assets.symbols[previewDefinition.id] = previewAsset;
      loadedSymbols += 1;
      this.view.showPreviewSymbol(previewDefinition.id);
      updateLoadingState('Preview ready. Loading remaining symbols...', 0.28);
    } catch (error) {
      this.statusMessage = 'Preview symbol failed to load.';
      this.loadingProgress = 1;
      console.error('Failed to load preview Spine symbol', error);
      this.emitState();
      return;
    }

    for (const symbolDefinition of SLOT_CONFIG.symbols) {
      if (this.assets.symbols[symbolDefinition.id]) {
        continue;
      }

      try {
        const symbolAsset = await this.loadSpineSymbolAsset(symbolDefinition);
        this.assets.symbols[symbolDefinition.id] = symbolAsset;
        loadedSymbols += 1;
        updateLoadingState(`Loading ${symbolDefinition.label}...`);
      } catch (error) {
        this.statusMessage = `Failed on ${symbolDefinition.label}. Keeping preview only.`;
        this.loadingProgress = 1;
        console.error(`Failed to load Spine symbol: ${symbolDefinition.id}`, error);
        this.emitState();
        return;
      }
    }

    this.view.enableReels();
    this.view.setGrid(this.model.getGrid());
    this.view.setIdleAnimationsEnabled(true);
    this.isReady = true;
    this.loadingProgress = 1;
    this.statusMessage = 'All Spine symbols loaded.';
    this.emitState();
  }

  private async loadSpineSymbolAsset(symbol: SymbolDefinition): Promise<SpineSymbolAsset> {
    await Assets.load([symbol.skeletonAssetAlias, symbol.atlasAssetAlias]);

    const previewSpine = Spine.from({
      skeleton: symbol.skeletonAssetAlias,
      atlas: symbol.atlasAssetAlias,
      autoUpdate: false,
    });

    const animations = SlotController.extractAnimations(previewSpine.skeleton.data.animations.map((item) => item.name));
    previewSpine.destroy();

    return {
      skeletonAssetAlias: symbol.skeletonAssetAlias,
      atlasAssetAlias: symbol.atlasAssetAlias,
      animations,
      fitScale: symbol.fitScale,
      offsetX: symbol.offsetX,
      offsetY: symbol.offsetY,
    };
  }
}
