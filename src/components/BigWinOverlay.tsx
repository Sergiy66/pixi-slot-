import type { CSSProperties } from 'react';
import bigWinUrl from '../assets/big-win.png';
import { SLOT_CONFIG } from '../config/slotConfig';

interface BigWinOverlayProps {
  amount: number;
  isVisible: boolean;
}

export function BigWinOverlay({ amount, isVisible }: BigWinOverlayProps) {
  const style = {
    '--big-win-max-width': `${SLOT_CONFIG.bigWin.maxWidthRatio * 100}vw`,
    '--big-win-max-height-width': `${SLOT_CONFIG.bigWin.maxHeightRatio * 150}vh`,
    '--big-win-amount-top': `${50 + SLOT_CONFIG.bigWin.amountOffsetYRatio * 100}%`,
    '--big-win-pulse-duration': `${SLOT_CONFIG.bigWin.pulseDuration}s`,
    '--big-win-pulse-scale': SLOT_CONFIG.bigWin.pulseScale,
  } as CSSProperties;

  return (
    <div className="big-win-overlay" data-visible={isVisible} aria-hidden="true">
      <div className="big-win-overlay__content" style={style}>
        <img
          className="big-win-overlay__image"
          src={bigWinUrl}
          alt=""
          loading="eager"
          decoding="sync"
        />
        <span className="big-win-overlay__amount">{amount.toFixed(2)}</span>
      </div>
    </div>
  );
}
