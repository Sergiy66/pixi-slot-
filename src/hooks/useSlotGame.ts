import { useEffect, useRef, useState } from 'react';
import type { Application } from 'pixi.js';
import { createPixiApp } from '../app/createPixiApp';
import { SlotController } from '../controllers/SlotController';
import type { SlotUiState } from '../types/slot';

const initialState: SlotUiState = {
  balance: 1000,
  bet: 10,
  totalWin: 0,
  isSpinning: false,
  isReady: false,
  loadingProgress: 0,
  statusMessage: 'Loading preview symbol...',
  layout: null,
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
    let app: Application | null = null;
    let controller: SlotController | null = null;

    void (async () => {
      app = await createPixiApp(host);

      if (isDisposed) {
        app.destroy(true);
        return;
      }

      controller = await SlotController.create(app, setUiState);

      if (isDisposed) {
        controller.destroy();
        app.destroy(true);
        return;
      }

      controllerRef.current = controller;
      setUiState(controller.getUiState());
      scheduleLayoutUpdate();
    })();

    return () => {
      isDisposed = true;
      controllerRef.current = null;

      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }

      controller?.destroy();
      app?.destroy(true);
    };
  }, []);

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

  return {
    rootRef,
    canvasRef,
    uiRef,
    spin,
    activateAudio,
    decreaseBet,
    increaseBet,
    uiState,
  };
}
