import { SLOT_CONFIG } from '../config/slotConfig';
import type { Point, Rect, Size, SlotLayoutInput, SlotLayoutMetrics } from '../types/slot';
import { getFitScale } from '../utils/resize';
import { SafeAreaCalculator } from './SafeAreaCalculator';

function clampFinite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeSize(width: number, height: number): Size {
  return {
    width: Math.max(clampFinite(width, 1), 1),
    height: Math.max(clampFinite(height, 1), 1),
  };
}

function mapRect(rect: Rect, scale: number, offset: Point): Rect {
  return {
    x: offset.x + rect.x * scale,
    y: offset.y + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

export class LayoutManager {
  private layout: SlotLayoutMetrics;

  constructor(initialInput: SlotLayoutInput) {
    this.layout = LayoutManager.createMetrics(initialInput);
  }

  getLayout() {
    return this.layout;
  }

  update(input: SlotLayoutInput) {
    this.layout = LayoutManager.createMetrics(input);
    return this.layout;
  }

  static calculate({ viewportWidth, viewportHeight, uiReservedHeight }: SlotLayoutInput): SlotLayoutMetrics {
    return LayoutManager.createMetrics({
      viewportWidth,
      viewportHeight,
      uiReservedHeight,
    });
  }

  private static createMetrics({ viewportWidth, viewportHeight, uiReservedHeight }: SlotLayoutInput): SlotLayoutMetrics {
    const viewport = normalizeSize(viewportWidth, viewportHeight);
    const isCompactViewport = viewport.width < SLOT_CONFIG.ui.compactBreakpoint;
    const responsiveUiSafeHeight = LayoutManager.getResponsiveUiSafeHeight(viewport.width);
    const reservedHeight = Math.max(
      clampFinite(uiReservedHeight, 0),
      responsiveUiSafeHeight,
      SLOT_CONFIG.ui.minReservedHeight,
    );
    const designSize = {
      width: SLOT_CONFIG.designWidth,
      height: SLOT_CONFIG.designHeight,
    };

    const gridDesignRect: Rect = {
      x: SLOT_CONFIG.gridFrame.x,
      y: SLOT_CONFIG.gridFrame.y,
      width: SLOT_CONFIG.gridFrame.width,
      height: SLOT_CONFIG.gridFrame.height,
    };

    const symbolsDesignRect: Rect = {
      x: gridDesignRect.x + SLOT_CONFIG.gridFrame.innerPadding.left,
      y: gridDesignRect.y + SLOT_CONFIG.gridFrame.innerPadding.top,
      width: gridDesignRect.width - SLOT_CONFIG.gridFrame.innerPadding.left - SLOT_CONFIG.gridFrame.innerPadding.right,
      height: gridDesignRect.height - SLOT_CONFIG.gridFrame.innerPadding.top - SLOT_CONFIG.gridFrame.innerPadding.bottom,
    };

    const safeAreaPadding = isCompactViewport
      ? SLOT_CONFIG.layout.compactSafeAreaPadding
      : SLOT_CONFIG.layout.safeAreaPadding;
    const safeArea = SafeAreaCalculator.calculate(viewport, reservedHeight, safeAreaPadding);
    const gridMaxWidthRatio = isCompactViewport
      ? SLOT_CONFIG.layout.compactGridMaxWidthRatio
      : SLOT_CONFIG.layout.gridMaxWidthRatio;
    const gridMaxHeightRatio = isCompactViewport
      ? SLOT_CONFIG.layout.compactGridMaxHeightRatio
      : SLOT_CONFIG.layout.gridMaxHeightRatio;
    const availableHeight = Math.max(viewport.height - reservedHeight, 1);
    const maxGridWidth = Math.max(
      Math.min(safeArea.width, viewport.width * gridMaxWidthRatio),
      1,
    );
    const maxGridHeight = Math.max(
      Math.min(safeArea.height, availableHeight * gridMaxHeightRatio),
      1,
    );
    const rootScale = Math.max(
      Math.min(
        getFitScale(gridDesignRect.width, gridDesignRect.height, maxGridWidth, maxGridHeight),
        1,
      ),
      0.01,
    );

    const gridRect: Rect = {
      x: (viewport.width - gridDesignRect.width * rootScale) / 2,
      y: Math.max(safeAreaPadding.top, (availableHeight - gridDesignRect.height * rootScale) / 2),
      width: gridDesignRect.width * rootScale,
      height: gridDesignRect.height * rootScale,
    };

    const rootOffset: Point = {
      x: gridRect.x - gridDesignRect.x * rootScale,
      y: gridRect.y - gridDesignRect.y * rootScale,
    };

    const symbolsRect = mapRect(symbolsDesignRect, rootScale, rootOffset);
    const cellWidth = symbolsDesignRect.width / SLOT_CONFIG.reels;
    const cellHeight = symbolsDesignRect.height / SLOT_CONFIG.rows;

    return {
      viewport,
      designSize,
      backgroundRect: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      },
      safeArea,
      uiRect: {
        x: 0,
        y: viewport.height - reservedHeight,
        width: viewport.width,
        height: reservedHeight,
      },
      rootScale,
      rootOffset,
      gridDesignRect,
      symbolsDesignRect,
      gridRect,
      symbolsRect,
      reelWidth: cellWidth,
      reelHeight: symbolsDesignRect.height,
      cellWidth,
      cellHeight,
      symbolFillRatio: SLOT_CONFIG.slotLayout.symbolFillRatio,
      ui: {
        mode: viewport.width <= SLOT_CONFIG.ui.compactBreakpoint ? 'mobile' : 'desktop',
        reservedHeight,
      },
    };
  }

  private static getResponsiveUiSafeHeight(viewportWidth: number) {
    if (viewportWidth <= SLOT_CONFIG.ui.mobileBreakpoint) {
      return SLOT_CONFIG.ui.mobileReservedHeight;
    }

    if (viewportWidth <= SLOT_CONFIG.ui.compactBreakpoint) {
      return SLOT_CONFIG.ui.tabletReservedHeight;
    }

    return SLOT_CONFIG.ui.minReservedHeight;
  }
}
