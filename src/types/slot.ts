import type { Texture } from 'pixi.js';

export type SymbolKey = 'emu' | 'seaTurtle' | 'cockatoo' | 'platypus' | 'wombat';

export interface SymbolDefinition {
  id: SymbolKey;
  label: string;
  skeletonAssetAlias: string;
  skeletonAssetSrc: string;
  atlasAssetAlias: string;
  atlasAssetSrc: string;
  fitScale: number;
  offsetX?: number;
  offsetY?: number;
}

export interface GridFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  innerPadding: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SlotLayoutInput {
  viewportWidth: number;
  viewportHeight: number;
  uiReservedHeight: number;
}

export interface SlotUiLayoutMetrics {
  mode: 'desktop' | 'mobile';
  reservedHeight: number;
}

export interface SlotLayoutMetrics {
  viewport: Size;
  designSize: Size;
  backgroundRect: Rect;
  safeArea: Rect;
  uiRect: Rect;
  rootScale: number;
  rootOffset: Point;
  gridDesignRect: Rect;
  symbolsDesignRect: Rect;
  gridRect: Rect;
  symbolsRect: Rect;
  reelWidth: number;
  reelHeight: number;
  cellWidth: number;
  cellHeight: number;
  symbolFillRatio: number;
  ui: SlotUiLayoutMetrics;
}

export interface SpineAnimationSet {
  idle?: string;
  win?: string;
}

export interface SpineSymbolAsset {
  skeletonAssetAlias: string;
  atlasAssetAlias: string;
  animations: SpineAnimationSet;
  fitScale: number;
  offsetX?: number;
  offsetY?: number;
}

export type ReelColumn = SymbolKey[];
export type SlotGrid = ReelColumn[];

export interface Payline {
  id: string;
  name: string;
  color: number;
  points: readonly [number, number][];
  payoutFactor: number;
}

export interface WinningLine {
  payline: Payline;
  symbol: SymbolKey;
  multiplier: number;
  amount: number;
  cells: ReadonlyArray<readonly [number, number]>;
}

export interface SpinResult {
  grid: SlotGrid;
  winningLines: WinningLine[];
  totalWin: number;
}

export interface SlotAssets {
  background: Texture;
  slotGrid: Texture;
  symbols: Partial<Record<SymbolKey, SpineSymbolAsset>>;
}

export interface SlotUiState {
  balance: number;
  bet: number;
  totalWin: number;
  isSpinning: boolean;
  isReady: boolean;
  loadingProgress: number;
  statusMessage: string;
  layout: SlotLayoutMetrics | null;
}
