export function getCoverScale(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  return Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
}

export function getFitScale(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  return Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
}

export function roundToPixel(value: number) {
  return Math.round(value);
}
