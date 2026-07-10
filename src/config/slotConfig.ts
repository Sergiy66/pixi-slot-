import backgroundUrl from '../assets/background.png';
import slotGridUrl from '../assets/slot-grid.png';
import cockatooAtlasUrl from '../assets/Cockatoo_export/Cockatoo.atlas?url';
import cockatooSkeletonUrl from '../assets/Cockatoo_export/Cockatoo.json?url';
import emuAtlasUrl from '../assets/Emu_export/Emu.atlas?url';
import emuSkeletonUrl from '../assets/Emu_export/Emu.json?url';
import platypusAtlasUrl from '../assets/Platypus_export/Platypus.atlas?url';
import platypusSkeletonUrl from '../assets/Platypus_export/Platypus.json?url';
import seaTurtleAtlasUrl from '../assets/Sea turtle_export/Sea Turtle.atlas?url';
import seaTurtleSkeletonUrl from '../assets/Sea turtle_export/Sea Turtle.json?url';
import wombatAtlasUrl from '../assets/Wombat_export/Wombat.atlas?url';
import wombatSkeletonUrl from '../assets/Wombat_export/Wombat.json?url';
import type { GridFrame, Payline, SymbolDefinition, SymbolKey } from '../types/slot';

const symbols: readonly SymbolDefinition[] = [
  {
    id: 'emu',
    label: 'Emu',
    skeletonAssetAlias: 'symbols/emu/skeleton',
    skeletonAssetSrc: emuSkeletonUrl,
    atlasAssetAlias: 'symbols/emu/atlas',
    atlasAssetSrc: emuAtlasUrl,
    fitScale: 1.04,
  },
  {
    id: 'seaTurtle',
    label: 'Sea Turtle',
    skeletonAssetAlias: 'symbols/seaTurtle/skeleton',
    skeletonAssetSrc: seaTurtleSkeletonUrl,
    atlasAssetAlias: 'symbols/seaTurtle/atlas',
    atlasAssetSrc: seaTurtleAtlasUrl,
    fitScale: 1.01,
  },
  {
    id: 'cockatoo',
    label: 'Cockatoo',
    skeletonAssetAlias: 'symbols/cockatoo/skeleton',
    skeletonAssetSrc: cockatooSkeletonUrl,
    atlasAssetAlias: 'symbols/cockatoo/atlas',
    atlasAssetSrc: cockatooAtlasUrl,
    fitScale: 1.18,
    offsetY: 0.08,
  },
  {
    id: 'platypus',
    label: 'Platypus',
    skeletonAssetAlias: 'symbols/platypus/skeleton',
    skeletonAssetSrc: platypusSkeletonUrl,
    atlasAssetAlias: 'symbols/platypus/atlas',
    atlasAssetSrc: platypusAtlasUrl,
    fitScale: 1.04,
  },
  {
    id: 'wombat',
    label: 'Wombat',
    skeletonAssetAlias: 'symbols/wombat/skeleton',
    skeletonAssetSrc: wombatSkeletonUrl,
    atlasAssetAlias: 'symbols/wombat/atlas',
    atlasAssetSrc: wombatAtlasUrl,
    fitScale: 1.03,
  },
] as const;

const gridFrame: GridFrame = {
  x: 320,
  y: 80,
  width: 1280,
  height: 640,
  innerPadding: {
    left: 120,
    right: 120,
    top: 80,
    bottom: 80,
  },
};

const paylines: readonly Payline[] = [
  {
    id: 'top-row',
    name: 'Top Row',
    color: 0xffc857,
    payoutFactor: 2,
    points: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
  },
  {
    id: 'middle-row',
    name: 'Middle Row',
    color: 0x67e8f9,
    payoutFactor: 2,
    points: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ],
  },
  {
    id: 'bottom-row',
    name: 'Bottom Row',
    color: 0xfb7185,
    payoutFactor: 2,
    points: [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
    ],
  },
  {
    id: 'v-shape',
    name: 'V Shape',
    color: 0x86efac,
    payoutFactor: 2,
    points: [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 1],
      [4, 0],
    ],
  },
  {
    id: 'inverted-v',
    name: 'Inverted V',
    color: 0xc4b5fd,
    payoutFactor: 2,
    points: [
      [0, 2],
      [1, 1],
      [2, 0],
      [3, 1],
      [4, 2],
    ],
  },
  {
    id: 'diag-up-left',
    name: 'Diagonal Up Left',
    color: 0xf97316,
    payoutFactor: 1,
    points: [
      [0, 2],
      [1, 1],
      [2, 0],
    ],
  },
  {
    id: 'diag-up-center',
    name: 'Diagonal Up Center',
    color: 0x38bdf8,
    payoutFactor: 1,
    points: [
      [1, 2],
      [2, 1],
      [3, 0],
    ],
  },
  {
    id: 'diag-up-right',
    name: 'Diagonal Up Right',
    color: 0xfacc15,
    payoutFactor: 1,
    points: [
      [2, 2],
      [3, 1],
      [4, 0],
    ],
  },
  {
    id: 'diag-down-left',
    name: 'Diagonal Down Left',
    color: 0x4ade80,
    payoutFactor: 1,
    points: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
  },
  {
    id: 'diag-down-center',
    name: 'Diagonal Down Center',
    color: 0xe879f9,
    payoutFactor: 1,
    points: [
      [1, 0],
      [2, 1],
      [3, 2],
    ],
  },
  {
    id: 'diag-down-right',
    name: 'Diagonal Down Right',
    color: 0x60a5fa,
    payoutFactor: 1,
    points: [
      [2, 0],
      [3, 1],
      [4, 2],
    ],
  },
] as const;

const paytable: Readonly<Record<SymbolKey, number>> = {
  emu: 2,
  seaTurtle: 4,
  cockatoo: 6,
  platypus: 8,
  wombat: 10,
};

export const SLOT_CONFIG = {
  designWidth: 1920,
  designHeight: 1080,
  reels: 5,
  rows: 3,
  bet: 10,
  betOptions: [10, 20, 50, 100, 200, 500],
  backgroundUrl,
  slotGridUrl,
  symbols,
  previewSymbolId: 'emu' as const,
  gridFrame,
  paylines,
  paytable,
  spin: {
    speed: 1380,
    baseDuration: 1.05,
    reelDelay: 0.18,
    cycles: 8,
    stopDuration: 0.42,
  },
  ui: {
    compactBreakpoint: 768,
    minReservedHeight: 136,
    tabletReservedHeight: 152,
    mobileReservedHeight: 172,
  },
  layout: {
    safeAreaPadding: {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    },
    compactSafeAreaPadding: {
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
    },
    gridMaxWidthRatio: 0.8,
    gridMaxHeightRatio: 0.64,
    compactGridMaxWidthRatio: 0.985,
    compactGridMaxHeightRatio: 0.68,
  },
  slotLayout: {
    symbolFillRatio: 0.86,
  },
  lineDisplaySeconds: 2.8,
} as const;
