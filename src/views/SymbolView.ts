import { gsap } from 'gsap';
import { SetupPoseBoundsProvider, Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container, Graphics, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import { SLOT_CONFIG } from '../config/slotConfig';
import type { SpineAnimationSet, SpineSymbolAsset, SymbolKey } from '../types/slot';

const SYMBOL_CENTER_Y_OFFSET_RATIO = -0.018;

export class SymbolView extends Container {
  private static readonly spinTextureCache = new Map<string, Texture>();

  private readonly highlight = new Graphics();
  private readonly cellMask = new Graphics();
  private readonly spineCache = new Map<SymbolKey, Spine>();
  private readonly spinSprite = new Sprite({ texture: Texture.EMPTY, anchor: 0.5 });
  private readonly renderer: Renderer;
  private cellWidth: number;
  private cellHeight: number;
  private symbolFillRatio: number;
  private currentSymbolKey: SymbolKey | null = null;
  private currentSpine: Spine | null = null;
  private currentAnimations: SpineAnimationSet | null = null;
  private isSpinning = false;
  private isIdleAnimationEnabled = false;
  private isPlayingSpineAnimation = false;
  private readonly symbolAssets: Partial<Record<SymbolKey, SpineSymbolAsset>>;
  private spinTransitionTween: gsap.core.Tween | null = null;

  constructor(
    renderer: Renderer,
    symbolAssets: Partial<Record<SymbolKey, SpineSymbolAsset>>,
    cellWidth: number,
    cellHeight: number,
    symbolFillRatio: number,
  ) {
    super();

    this.renderer = renderer;
    this.symbolAssets = symbolAssets;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.symbolFillRatio = symbolFillRatio;

    this.spinSprite.visible = false;
    this.spinSprite.position.set(this.cellWidth / 2, this.cellHeight / 2);

    this.mask = this.cellMask;

    this.drawCellMask();
    this.drawHighlight();
    this.addChild(this.spinSprite, this.highlight, this.cellMask);
  }

  resizeLayout(cellWidth: number, cellHeight: number, symbolFillRatio: number) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.symbolFillRatio = symbolFillRatio;
    this.fitSpinSpriteToCell(this.currentSymbolKey);
    this.drawCellMask();
    this.drawHighlight();

    this.spineCache.forEach((spine, symbolKey) => {
      this.fitSpineToCell(spine, symbolKey);
    });
  }

  setHighlighted(isHighlighted: boolean) {
    if (!isHighlighted) {
      this.highlight.alpha = 0;
      this.playIdleAnimation();
      return;
    }

    this.playAnimation(this.currentAnimations?.win, false);
    this.highlight.alpha = 0.72;
  }

  setSymbol(symbolKey: SymbolKey) {
    this.currentSymbolKey = symbolKey;

    if (this.isSpinning) {
      this.showSpinSprite(symbolKey);
      return;
    }

    this.showLiveSpine(symbolKey);
  }

  setIdleAnimationEnabled(isEnabled: boolean) {
    this.isIdleAnimationEnabled = isEnabled;

    if (this.isSpinning) {
      return;
    }

    if (isEnabled) {
      this.playIdleAnimation();
      return;
    }

    this.stopSpineAnimation();
  }

  preloadSpinTextures(symbolKeys: readonly SymbolKey[]) {
    symbolKeys.forEach((symbolKey) => {
      this.getOrCreateSpinTexture(symbolKey);
    });
  }

  preloadLiveSymbol(symbolKey: SymbolKey) {
    this.getOrCreateSpine(symbolKey);
  }

  setSpinning(isSpinning: boolean) {
    this.isSpinning = isSpinning;

    if (isSpinning) {
      this.isIdleAnimationEnabled = false;
      this.isPlayingSpineAnimation = false;

      if (this.currentSymbolKey) {
        this.showSpinSprite(this.currentSymbolKey, true);
      }

      return;
    }

    if (!this.currentSymbolKey) {
      return;
    }

    this.spinSprite.visible = false;
    this.spinSprite.alpha = 1;
    this.showLiveSpine(this.currentSymbolKey);
  }

  update(deltaSeconds: number) {
    if (this.isSpinning) {
      return;
    }

    if (!this.isPlayingSpineAnimation) {
      return;
    }

    this.currentSpine?.update(deltaSeconds);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.spinTransitionTween?.kill();
    gsap.killTweensOf(this.highlight);
    gsap.killTweensOf(this.spinSprite);
    this.spineCache.clear();
    super.destroy(options);
  }

  private showLiveSpine(symbolKey: SymbolKey) {
    this.spinTransitionTween?.kill();
    this.spinTransitionTween = null;
    this.spinSprite.alpha = 1;

    const spine = this.getOrCreateSpine(symbolKey);
    const symbolAsset = this.symbolAssets[symbolKey];

    if (!symbolAsset) {
      throw new Error(`Missing Spine asset for symbol: ${symbolKey}`);
    }

    if (this.currentSpine !== spine) {
      if (this.currentSpine) {
        this.currentSpine.visible = false;
      }

      this.currentSpine = spine;
      this.currentAnimations = symbolAsset.animations;
      this.stopSpineAnimation();
    }

    this.currentSpine = spine;
    this.currentAnimations = symbolAsset.animations;
    this.currentSpine.visible = true;
    this.currentSpine.alpha = 1;
    this.spinSprite.visible = false;
    this.playIdleAnimation();
  }

  private showSpinSprite(symbolKey: SymbolKey, shouldBlendFromSpine = false) {
    this.spinTransitionTween?.kill();
    this.spinTransitionTween = null;

    this.spinSprite.texture = this.getOrCreateSpinTexture(symbolKey);
    this.fitSpinSpriteToCell(symbolKey);
    this.spinSprite.visible = true;

    if (!shouldBlendFromSpine || !this.currentSpine?.visible) {
      this.spinSprite.alpha = 1;
      this.stopSpineAnimation();

      if (this.currentSpine) {
        this.currentSpine.visible = false;
      }

      return;
    }

    this.spinSprite.alpha = 0;
    this.spinTransitionTween = gsap.to(this.spinSprite, {
      alpha: 1,
      duration: SLOT_CONFIG.symbolRendering.spinTransitionDuration,
      ease: 'sine.out',
      onComplete: () => {
        if (this.currentSpine) {
          this.currentSpine.visible = false;
        }

        this.stopSpineAnimation();
        this.spinTransitionTween = null;
      },
    });
  }

  private drawHighlight() {
    this.highlight.clear();
    this.highlight
      .roundRect(4, 4, Math.max(this.cellWidth - 8, 0), Math.max(this.cellHeight - 8, 0), 24)
      .stroke({ color: 0xfff2b0, alpha: 0.95, width: 4 })
      .fill({ color: 0xffd86b, alpha: 0.12 });

    this.highlight.alpha = 0;
  }

  private drawCellMask() {
    this.cellMask.clear();
    this.cellMask.rect(0, 0, this.cellWidth, this.cellHeight).fill({ color: 0xffffff, alpha: 0.002 });
  }

  private getOrCreateSpine(symbolKey: SymbolKey) {
    const existing = this.spineCache.get(symbolKey);

    if (existing) {
      return existing;
    }

    const symbolAsset = this.symbolAssets[symbolKey];

    if (!symbolAsset) {
      throw new Error(`Missing Spine asset for symbol: ${symbolKey}`);
    }

    const spine = Spine.from({
      skeleton: symbolAsset.skeletonAssetAlias,
      atlas: symbolAsset.atlasAssetAlias,
      autoUpdate: false,
      boundsProvider: new SetupPoseBoundsProvider(),
    });

    spine.update(0);
    this.spineCache.set(symbolKey, spine);
    this.fitSpineToCell(spine, symbolKey);
    spine.visible = false;
    this.addChild(spine);

    return spine;
  }

  private getOrCreateSpinTexture(symbolKey: SymbolKey) {
    const cacheKey = [
      symbolKey,
    ].join(':');
    const existingTexture = SymbolView.spinTextureCache.get(cacheKey);

    if (existingTexture) {
      return existingTexture;
    }

    const symbolAsset = this.symbolAssets[symbolKey];

    if (!symbolAsset) {
      throw new Error(`Missing Spine asset for symbol: ${symbolKey}`);
    }

    const spine = Spine.from({
      skeleton: symbolAsset.skeletonAssetAlias,
      atlas: symbolAsset.atlasAssetAlias,
      autoUpdate: false,
      boundsProvider: new SetupPoseBoundsProvider(),
    });

    spine.update(0);
    const bounds = spine.getLocalBounds();

    const texture = this.renderer.generateTexture({
      target: spine,
      frame: new Rectangle(bounds.x, bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1)),
      resolution: 1,
      antialias: false,
    });

    spine.destroy();
    SymbolView.spinTextureCache.set(cacheKey, texture);

    return texture;
  }

  private fitSpineToCell(spine: Spine, symbolKey: SymbolKey) {
    const bounds = spine.getLocalBounds();
    const symbolBoxSize = this.getSymbolBoxSize(symbolKey);
    const offset = this.getSymbolOffset(symbolKey);
    const scale = symbolBoxSize / Math.max(bounds.width, bounds.height, 1);

    spine.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    spine.scale.set(scale);
    spine.position.set(this.cellWidth / 2 + offset.x, this.getSymbolCenterY() + offset.y);
  }

  private fitSpinSpriteToCell(symbolKey: SymbolKey | null) {
    const symbolBoxSize = this.getSymbolBoxSize(symbolKey);
    const offset = this.getSymbolOffset(symbolKey);
    const textureWidth = Math.max(this.spinSprite.texture.width, 1);
    const textureHeight = Math.max(this.spinSprite.texture.height, 1);
    const scale = symbolBoxSize / Math.max(textureWidth, textureHeight);

    this.spinSprite.position.set(this.cellWidth / 2 + offset.x, this.getSymbolCenterY() + offset.y);
    this.spinSprite.scale.set(scale);
  }

  private getSymbolCenterY() {
    return this.cellHeight / 2 + this.cellHeight * SYMBOL_CENTER_Y_OFFSET_RATIO;
  }

  private getSymbolBoxSize(symbolKey: SymbolKey | null) {
    const fitScale = symbolKey ? this.symbolAssets[symbolKey]?.fitScale ?? 1 : 1;

    return Math.min(this.cellWidth, this.cellHeight) * this.symbolFillRatio * fitScale;
  }

  private getSymbolOffset(symbolKey: SymbolKey | null) {
    const symbolAsset = symbolKey ? this.symbolAssets[symbolKey] : null;

    return {
      x: this.cellWidth * (symbolAsset?.offsetX ?? 0),
      y: this.cellHeight * (symbolAsset?.offsetY ?? 0),
    };
  }

  private playAnimation(animationName: string | undefined, loop: boolean) {
    if (!this.currentSpine || !animationName) {
      this.isPlayingSpineAnimation = false;
      return;
    }

    this.currentSpine.state.setAnimation(0, animationName, loop);
    this.isPlayingSpineAnimation = true;
  }

  private playIdleAnimation() {
    if (!this.currentSpine || this.isSpinning || !this.isIdleAnimationEnabled) {
      return;
    }

    if (!this.currentAnimations?.idle) {
      this.stopSpineAnimation();
      return;
    }

    this.playAnimation(this.currentAnimations?.idle, true);
  }

  private stopSpineAnimation() {
    this.isPlayingSpineAnimation = false;
    this.currentSpine?.state.clearTracks();
    this.currentSpine?.skeleton.setToSetupPose();
    this.currentSpine?.update(0);
  }
}
