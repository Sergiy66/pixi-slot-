import type { RefObject } from 'react';

interface GameCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
}

export function GameCanvas({ canvasRef }: GameCanvasProps) {
  return <div ref={canvasRef} className="game-canvas" aria-label="Slot game canvas" />;
}
