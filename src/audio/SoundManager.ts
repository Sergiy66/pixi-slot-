import { Howl, Howler } from 'howler';
import backgroundSoundUrl from '../assets/sound/background.mp3';
import bonusSoundUrl from '../assets/sound/bonus.mp3';
import spinButtonSoundUrl from '../assets/sound/spin button.mp3';
import spinSoundUrl from '../assets/sound/spin.wav';
import winSoundUrl from '../assets/sound/win.mp3';

const BACKGROUND_VOLUME = 0.24;
const BACKGROUND_FADE_IN_MS = 1200;
const BONUS_VOLUME = 0.3;
const MUSIC_CROSSFADE_MS = 700;
const SPIN_VOLUME = 0.42;
const WIN_VOLUME = 0.72;
const WIN_FADE_IN_MS = 180;

export class SoundManager {
  private readonly background = new Howl({
    src: [backgroundSoundUrl],
    loop: true,
    volume: BACKGROUND_VOLUME,
  });

  private readonly spinButton = new Howl({
    src: [spinButtonSoundUrl],
    volume: 0.62,
  });

  private readonly bonus = new Howl({
    src: [bonusSoundUrl],
    loop: true,
    volume: BONUS_VOLUME,
  });

  private readonly spin = new Howl({
    src: [spinSoundUrl],
    loop: true,
    volume: SPIN_VOLUME,
  });

  private readonly win = new Howl({
    src: [winSoundUrl],
    volume: WIN_VOLUME,
  });

  private backgroundId: number | null = null;
  private bonusId: number | null = null;
  private spinId: number | null = null;
  private winId: number | null = null;
  private winStopTimer: ReturnType<typeof setTimeout> | null = null;
  private spinStopTimer: ReturnType<typeof setTimeout> | null = null;
  private backgroundStopTimer: ReturnType<typeof setTimeout> | null = null;
  private bonusStopTimer: ReturnType<typeof setTimeout> | null = null;

  startBackground() {
    Howler.mute(false);
    this.fadeOutBonus();
    this.clearBackgroundStopTimer();

    if (this.background.playing()) {
      if (this.backgroundId !== null) {
        this.background.fade(BACKGROUND_VOLUME, BACKGROUND_VOLUME, BACKGROUND_FADE_IN_MS, this.backgroundId);
      }
      return;
    }

    this.background.volume(0);
    this.backgroundId = this.background.play();
    this.background.fade(0, BACKGROUND_VOLUME, BACKGROUND_FADE_IN_MS, this.backgroundId);
  }

  startBonus() {
    Howler.mute(false);
    this.fadeOutBackground();
    this.clearBonusStopTimer();

    if (this.bonus.playing()) {
      if (this.bonusId !== null) {
        this.bonus.fade(BONUS_VOLUME, BONUS_VOLUME, MUSIC_CROSSFADE_MS, this.bonusId);
      }
      return;
    }

    this.bonus.volume(0);
    this.bonusId = this.bonus.play();
    this.bonus.fade(0, BONUS_VOLUME, MUSIC_CROSSFADE_MS, this.bonusId);
  }

  playSpinButton() {
    this.spinButton.stop();
    this.spinButton.play();
  }

  startSpin() {
    this.clearSpinStopTimer();

    if (this.spinId !== null) {
      this.spin.stop(this.spinId);
    }

    this.spin.volume(SPIN_VOLUME);
    this.spinId = this.spin.play();
  }

  stopSpin() {
    if (this.spinId === null) {
      return;
    }

    const currentSpinId = this.spinId;

    this.spin.fade(SPIN_VOLUME, 0, 220, currentSpinId);
    this.spinStopTimer = setTimeout(() => {
      this.spin.stop(currentSpinId);
      this.spin.volume(SPIN_VOLUME);

      if (this.spinId === currentSpinId) {
        this.spinId = null;
      }
    }, 240);
  }

  playWin() {
    this.clearWinStopTimer();

    if (this.winId !== null) {
      this.win.stop(this.winId);
    }

    this.win.volume(0);
    this.winId = this.win.play();
    this.win.fade(0, WIN_VOLUME, WIN_FADE_IN_MS, this.winId);

    this.winStopTimer = setTimeout(() => {
      if (this.winId === null) {
        return;
      }

      const currentWinId = this.winId;

      this.win.fade(WIN_VOLUME, 0, 260, currentWinId);
      this.winStopTimer = setTimeout(() => {
        this.win.stop(currentWinId);
        this.win.volume(WIN_VOLUME);

        if (this.winId === currentWinId) {
          this.winId = null;
        }
      }, 280);
    }, 1400);
  }

  destroy() {
    this.clearSpinStopTimer();
    this.clearWinStopTimer();
    this.clearBackgroundStopTimer();
    this.clearBonusStopTimer();
    this.backgroundId = null;
    this.bonusId = null;
    this.background.unload();
    this.bonus.unload();
    this.spinButton.unload();
    this.spin.unload();
    this.win.unload();
  }

  private clearSpinStopTimer() {
    if (this.spinStopTimer === null) {
      return;
    }

    clearTimeout(this.spinStopTimer);
    this.spinStopTimer = null;
  }

  private clearWinStopTimer() {
    if (this.winStopTimer === null) {
      return;
    }

    clearTimeout(this.winStopTimer);
    this.winStopTimer = null;
  }

  private fadeOutBackground() {
    if (this.backgroundId === null) {
      return;
    }

    const id = this.backgroundId;

    this.clearBackgroundStopTimer();
    this.background.fade(BACKGROUND_VOLUME, 0, MUSIC_CROSSFADE_MS, id);
    this.backgroundStopTimer = setTimeout(() => {
      this.background.stop(id);

      if (this.backgroundId === id) {
        this.backgroundId = null;
      }
    }, MUSIC_CROSSFADE_MS + 40);
  }

  private fadeOutBonus() {
    if (this.bonusId === null) {
      return;
    }

    const id = this.bonusId;

    this.clearBonusStopTimer();
    this.bonus.fade(BONUS_VOLUME, 0, MUSIC_CROSSFADE_MS, id);
    this.bonusStopTimer = setTimeout(() => {
      this.bonus.stop(id);

      if (this.bonusId === id) {
        this.bonusId = null;
      }
    }, MUSIC_CROSSFADE_MS + 40);
  }

  private clearBackgroundStopTimer() {
    if (this.backgroundStopTimer === null) {
      return;
    }

    clearTimeout(this.backgroundStopTimer);
    this.backgroundStopTimer = null;
  }

  private clearBonusStopTimer() {
    if (this.bonusStopTimer === null) {
      return;
    }

    clearTimeout(this.bonusStopTimer);
    this.bonusStopTimer = null;
  }
}
