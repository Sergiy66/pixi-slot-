import type { RefObject } from 'react';

interface GameCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  isVisible: boolean;
}

export function GameCanvas({ canvasRef, isVisible }: GameCanvasProps) {
  return <div ref={canvasRef} className="game-canvas" data-visible={isVisible} aria-label="Slot game canvas" />;
}
