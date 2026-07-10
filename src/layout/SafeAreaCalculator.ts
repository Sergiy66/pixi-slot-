import type { Insets, Rect, Size } from '../types/slot';

function clampNonNegative(value: number) {
  return Math.max(value, 0);
}

export class SafeAreaCalculator {
  static calculate(viewport: Size, reservedBottom: number, padding: Insets): Rect {
    const horizontalPadding = padding.left + padding.right;
    const verticalPadding = padding.top + padding.bottom + reservedBottom;

    return {
      x: padding.left,
      y: padding.top,
      width: clampNonNegative(viewport.width - horizontalPadding),
      height: clampNonNegative(viewport.height - verticalPadding),
    };
  }
}
