import type { RefObject } from 'react';

interface GameCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  isVisible: boolean;
  isOverlayVisible: boolean;
}

export function GameCanvas({ canvasRef, isVisible, isOverlayVisible }: GameCanvasProps) {
  return (
    <div
      ref={canvasRef}
      className="game-canvas"
      data-visible={isVisible}
      data-overlay-visible={isOverlayVisible}
      aria-label="Slot game canvas"
    />
  );
}
