import { useState } from 'react';
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
    retryInitialization,
    uiState,
  } = useSlotGame(isGameStarted);

  const startGame = () => {
    activateAudio();
    setIsGameStarted(true);
  };

  return (
    <main ref={rootRef} className="game-root">
      <GameCanvas canvasRef={canvasRef} isVisible={isGameStarted} />

      {isGameStarted && (
        <GameUI
          panelRef={uiRef}
          balance={uiState.balance}
          bet={uiState.bet}
          totalWin={uiState.totalWin}
          isSpinning={uiState.isSpinning}
          isReady={uiState.isReady}
          layout={uiState.layout}
          onSpin={spin}
          onDecreaseBet={decreaseBet}
          onIncreaseBet={increaseBet}
        />
      )}

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
