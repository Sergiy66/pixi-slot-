import { useEffect, useRef, useState } from 'react';
import type { Application } from 'pixi.js';
import { createPixiApp } from '../app/createPixiApp';
import { SLOT_CONFIG } from '../config/slotConfig';
import { SlotController } from '../controllers/SlotController';
import type { SlotUiState } from '../types/slot';

const initialState: SlotUiState = {
  balance: SLOT_CONFIG.initialBalance,
  bet: SLOT_CONFIG.bet,
  totalWin: 0,
  isSpinning: false,
  isReady: false,
  loadingProgress: 0,
  loadingError: null,
  statusMessage: SLOT_CONFIG.loading.initialStatusMessage,
  layout: null,
  gameMode: 'base',
  bonusSpinsRemaining: 0,
  bonusTotalWin: 0,
  isBaseAutoSpin: false,
  isBonusAutoSpin: false,
  isBigWinVisible: false,
  bigWinAmount: 0,
  bonusBuyCost: SLOT_CONFIG.bonus.buyCost,
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useSlotGame(isGameStarted = true) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<SlotController | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const [uiState, setUiState] = useState<SlotUiState>(initialState);
  const [initializationAttempt, setInitializationAttempt] = useState(0);

  const scheduleLayoutUpdate = () => {
    if (layoutFrameRef.current !== null) {
      cancelAnimationFrame(layoutFrameRef.current);
    }

    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = null;
      const controller = controllerRef.current;
      const ui = uiRef.current;

      if (!controller) {
        return;
      }

      controller.resize(
        window.innerWidth,
        window.innerHeight,
        Math.round(ui?.getBoundingClientRect().height ?? 0),
      );
    });
  };

  useEffect(() => {
    const host = canvasRef.current;

    if (!host) {
      return;
    }

    let isDisposed = false;
    let isControllerInitializing = false;
    let app: Application | null = null;
    let controller: SlotController | null = null;

    void (async () => {
      try {
        app = await createPixiApp(host);

        if (isDisposed) {
          app.destroy(true);
          return;
        }

        isControllerInitializing = true;

        try {
          controller = await SlotController.create(app, (nextState) => {
            if (!isDisposed) {
              setUiState(nextState);
            }
          });
        } finally {
          isControllerInitializing = false;
        }

        if (isDisposed) {
          controller.destroy();
          app.destroy(true);
          return;
        }

        controllerRef.current = controller;
        setUiState(controller.getUiState());
        scheduleLayoutUpdate();
      } catch (error) {
        if (isDisposed) {
          app?.destroy(true);
          app = null;
          return;
        }

        console.error('Game initialization failed', error);
        app?.destroy(true);
        app = null;
        setUiState((currentState) => ({
          ...currentState,
          isReady: false,
          loadingProgress: Math.min(
            currentState.loadingProgress,
            SLOT_CONFIG.loading.maxProgressBeforeReady,
          ),
          loadingError: error instanceof Error ? error.message : 'Game initialization failed.',
          statusMessage: 'Game initialization failed.',
        }));
      }
    })();

    return () => {
      isDisposed = true;
      controllerRef.current = null;

      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }

      controller?.destroy();

      if (!isControllerInitializing) {
        app?.destroy(true);
        app = null;
      }
    };
  }, [initializationAttempt]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const ui = uiRef.current;
    const observer = new ResizeObserver(() => {
      scheduleLayoutUpdate();
    });

    observer.observe(root);

    if (ui) {
      observer.observe(ui);
    }

    window.addEventListener('resize', scheduleLayoutUpdate, { passive: true });
    scheduleLayoutUpdate();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleLayoutUpdate);

      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }
    };
  }, [isGameStarted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isGameStarted) {
        return;
      }

      if (event.repeat || isEditableTarget(event.target)) {
        return;
      }

      if (event.key !== ' ' && event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      void controllerRef.current?.spin();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isGameStarted]);

  const spin = async () => {
    if (!isGameStarted) {
      return;
    }

    await controllerRef.current?.spin();
  };

  const activateAudio = () => {
    controllerRef.current?.activateAudio();
  };

  const decreaseBet = () => {
    controllerRef.current?.decreaseBet();
  };

  const increaseBet = () => {
    controllerRef.current?.increaseBet();
  };

  const buyBonus = async () => {
    await controllerRef.current?.buyBonus();
  };

  const toggleBonusAutoSpin = () => {
    controllerRef.current?.toggleBonusAutoSpin();
  };

  const toggleBaseAutoSpin = () => {
    controllerRef.current?.toggleBaseAutoSpin();
  };

  const retryInitialization = () => {
    setUiState(initialState);
    setInitializationAttempt((attempt) => attempt + 1);
  };

  return {
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
  };
}
