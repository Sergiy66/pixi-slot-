import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { SLOT_CONFIG } from '../config/slotConfig';
import type { GameMode, SlotLayoutMetrics } from '../types/slot';

interface GameUIProps {
  panelRef: RefObject<HTMLElement | null>;
  balance: number;
  bet: number;
  totalWin: number;
  isSpinning: boolean;
  isReady: boolean;
  layout: SlotLayoutMetrics | null;
  gameMode: GameMode;
  bonusSpinsRemaining: number;
  bonusTotalWin: number;
  isBaseAutoSpin: boolean;
  isBonusAutoSpin: boolean;
  bonusBuyCost: number;
  onSpin: () => void | Promise<void>;
  onBuyBonus: () => void | Promise<void>;
  onToggleBonusAutoSpin: () => void;
  onToggleBaseAutoSpin: () => void;
  onDecreaseBet: () => void;
  onIncreaseBet: () => void;
}

function formatCurrency(value: number) {
  return value.toFixed(2);
}

const minBet = SLOT_CONFIG.betOptions[0];
const maxBet = SLOT_CONFIG.betOptions[SLOT_CONFIG.betOptions.length - 1];

export function GameUI({
  panelRef,
  balance,
  bet,
  totalWin,
  isSpinning,
  isReady,
  layout,
  gameMode,
  bonusSpinsRemaining,
  bonusTotalWin,
  isBaseAutoSpin,
  isBonusAutoSpin,
  bonusBuyCost,
  onSpin,
  onBuyBonus,
  onToggleBonusAutoSpin,
  onToggleBaseAutoSpin,
  onDecreaseBet,
  onIncreaseBet,
}: GameUIProps) {
  const winChipRef = useRef<HTMLDivElement>(null);
  const winValueRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const winChip = winChipRef.current;
    const winValue = winValueRef.current;

    if (!winChip || !winValue || totalWin <= 0) {
      return;
    }

    const timeline = gsap.timeline();

    timeline
      .fromTo(
        winChip,
        { scale: 0.97, y: 8 },
        { scale: 1.03, y: 0, duration: 0.22, ease: 'back.out(2.4)' },
      )
      .to(winChip, { scale: 1, duration: 0.16, ease: 'power2.out' })
      .fromTo(
        winValue,
        { opacity: 0.25, y: 10 },
        { opacity: 1, y: 0, duration: 0.26, ease: 'power2.out' },
        0,
      );

    return () => {
      timeline.kill();
      gsap.killTweensOf(winChip);
      gsap.killTweensOf(winValue);
    };
  }, [totalWin]);

  const uiMode = layout?.ui.mode ?? 'desktop';
  const canSpin = isReady && !isSpinning && !isBaseAutoSpin && balance >= bet;
  const canBuyBonus = isReady && !isSpinning && balance >= bonusBuyCost;
  const canBonusSpin = isReady && !isSpinning && !isBonusAutoSpin && bonusSpinsRemaining > 0;

  return (
    <section ref={panelRef} className="game-ui" data-layout-mode={uiMode} data-game-mode={gameMode}>
      <div className="game-ui__panel">
        {gameMode === 'bonus' ? (
          <>
            <div className="ui-chip">
              <span className="ui-chip__label">Free spins</span>
              <strong className="ui-chip__value">{bonusSpinsRemaining}</strong>
            </div>
            <div className="ui-chip">
              <span className="ui-chip__label">Bet</span>
              <strong className="ui-chip__value">{formatCurrency(bet)}</strong>
            </div>
            <div className="ui-chip ui-chip--win ui-chip--bonus-total">
              <span className="ui-chip__label">Total win</span>
              <strong className="ui-chip__value">{formatCurrency(bonusTotalWin)}</strong>
            </div>
            <button className="spin-button" type="button" disabled={!canBonusSpin} onClick={onSpin}>
              {isSpinning ? 'SPINNING...' : 'SPIN'}
            </button>
            <button
              className="spin-button auto-spin-button"
              data-active={isBonusAutoSpin}
              type="button"
              disabled={!isReady || bonusSpinsRemaining <= 0}
              onClick={onToggleBonusAutoSpin}
            >
              {isBonusAutoSpin ? 'STOP AUTO' : 'AUTO SPIN'}
            </button>
          </>
        ) : (
          <>
            <div className="ui-chip">
              <span className="ui-chip__label">Balance</span>
              <strong className="ui-chip__value">{formatCurrency(balance)}</strong>
            </div>
            <div className="ui-chip ui-chip--bet">
              <span className="ui-chip__label">Bet</span>
              <div className="bet-control">
                <button
                  className="bet-control__button"
                  type="button"
                  aria-label="Decrease bet"
                  disabled={isSpinning || bet <= minBet}
                  onClick={onDecreaseBet}
                >
                  -
                </button>
                <strong className="ui-chip__value">{formatCurrency(bet)}</strong>
                <button
                  className="bet-control__button"
                  type="button"
                  aria-label="Increase bet"
                  disabled={isSpinning || bet >= maxBet}
                  onClick={onIncreaseBet}
                >
                  +
                </button>
              </div>
            </div>
            <div ref={winChipRef} className="ui-chip ui-chip--win">
              <span className="ui-chip__label">Win</span>
              <strong ref={winValueRef} className="ui-chip__value">
                {totalWin > 0 ? `WIN +${formatCurrency(totalWin)}` : '0'}
              </strong>
            </div>
            <button className="spin-button" type="button" disabled={!canSpin} onClick={onSpin}>
              {isSpinning ? 'SPINNING...' : !isReady ? 'LOADING...' : balance < bet ? 'NO BALANCE' : 'SPIN'}
            </button>
            <button
              className="spin-button bonus-buy-button"
              type="button"
              disabled={!canBuyBonus}
              onClick={onBuyBonus}
            >
              {balance < bonusBuyCost ? `NEED ${bonusBuyCost}` : `BUY BONUS ${bonusBuyCost}`}
            </button>
            <button
              className="spin-button auto-spin-button"
              data-active={isBaseAutoSpin}
              type="button"
              disabled={!isReady || balance < bet}
              onClick={onToggleBaseAutoSpin}
            >
              {isBaseAutoSpin ? 'STOP AUTO' : 'AUTO SPIN'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
