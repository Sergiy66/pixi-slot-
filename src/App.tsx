import { useState } from 'react';
import { BigWinOverlay } from './components/BigWinOverlay';
import { GameCanvas } from './components/GameCanvas';
import { LoadingScreen } from './components/LoadingScreen';
import { GameUI } from './components/GameUI';
import { useSlotGame } from './hooks/useSlotGame';

export default function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const {
    rootRef,
    canvasRef,
    uiRef,
    spin,
    activateAudio,
    decreaseBet,
    increaseBet,
    buyBonus,
    toggleBonusAutoSpin,
    toggleBaseAutoSpin,
    retryInitialization,
    uiState,
  } = useSlotGame(isGameStarted);

  const startGame = () => {
    activateAudio();
    setIsGameStarted(true);
  };

  return (
    <main ref={rootRef} className="game-root">
      <GameCanvas
        canvasRef={canvasRef}
        isVisible={isGameStarted}
        isOverlayVisible={uiState.isBigWinVisible}
      />

      {isGameStarted && (
        <GameUI
          panelRef={uiRef}
          balance={uiState.balance}
          bet={uiState.bet}
          totalWin={uiState.totalWin}
          isSpinning={uiState.isSpinning}
          isReady={uiState.isReady}
          layout={uiState.layout}
          gameMode={uiState.gameMode}
          bonusSpinsRemaining={uiState.bonusSpinsRemaining}
          bonusTotalWin={uiState.bonusTotalWin}
          isBonusAutoSpin={uiState.isBonusAutoSpin}
          isBaseAutoSpin={uiState.isBaseAutoSpin}
          bonusBuyCost={uiState.bonusBuyCost}
          onSpin={spin}
          onBuyBonus={buyBonus}
          onToggleBonusAutoSpin={toggleBonusAutoSpin}
          onToggleBaseAutoSpin={toggleBaseAutoSpin}
          onDecreaseBet={decreaseBet}
          onIncreaseBet={increaseBet}
        />
      )}

      <BigWinOverlay
        amount={uiState.bigWinAmount}
        isVisible={uiState.isBigWinVisible}
      />

      {(!uiState.isReady || !isGameStarted) && (
        <LoadingScreen
          progress={uiState.loadingProgress}
          isReady={uiState.isReady}
          errorMessage={uiState.loadingError}
          onStart={startGame}
          onRetry={retryInitialization}
        />
      )}
    </main>
  );
}
