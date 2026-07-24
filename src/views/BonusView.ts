import { Container, type Renderer, type Texture } from 'pixi.js';
import { SLOT_CONFIG } from '../config/slotConfig';
import type { SlotGrid, SlotLayoutMetrics, SpineSymbolAsset, SpinResult, SymbolKey } from '../types/slot';
import { BonusMachineView } from './BonusMachineView';

interface MachineBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class BonusView {
  readonly root = new Container();

  private readonly machines: BonusMachineView[] = [];
  private layout: SlotLayoutMetrics;

  constructor(
    renderer: Renderer,
    gridTexture: Texture,
    symbolAssets: Record<SymbolKey, SpineSymbolAsset>,
    initialLayout: SlotLayoutMetrics,
  ) {
    this.layout = initialLayout;
    this.root.visible = false;
    this.root.alpha = 0;

    for (let index = 0; index < SLOT_CONFIG.bonus.machines; index += 1) {
      const machine = new BonusMachineView(renderer, gridTexture, symbolAssets, initialLayout);

      this.machines.push(machine);
      this.root.addChild(machine.root);
    }

    this.resize(initialLayout);
  }

  resize(layout: SlotLayoutMetrics) {
    this.layout = layout;
    const bounds = this.calculateMachineBounds();

    this.machines.forEach((machine, index) => {
      const machineBounds = bounds[index];

      machine.resize(machineBounds.width, machineBounds.height, layout);
      machine.root.position.set(machineBounds.x, machineBounds.y);
    });
  }

  setGrids(grids: SlotGrid[]) {
    grids.forEach((grid, index) => this.machines[index]?.setGrid(grid));
  }

  startSpin(grids: SlotGrid[]) {
    grids.forEach((grid, index) => this.machines[index]?.startSpin(grid));
  }

  showWinningLines(machineResults: readonly SpinResult[]) {
    this.machines.forEach((machine, index) => {
      machine.showWinningLines(machineResults[index]?.winningLines ?? []);
    });
  }

  clearWinPresentation() {
    this.machines.forEach((machine) => machine.clearWinPresentation());
  }

  async playCascade(machineResults: readonly SpinResult[], grids: SlotGrid[]) {
    await Promise.all(
      this.machines.map((machine, index) =>
        machine.playCascade(machineResults[index]?.winningLines ?? [], grids[index]),
      ),
    );
  }

  isAnimating() {
    return this.machines.some((machine) => machine.isAnimating());
  }

  setIdleAnimationsEnabled(isEnabled: boolean) {
    this.machines.forEach((machine) => machine.setIdleAnimationsEnabled(isEnabled));
  }

  update(deltaSeconds: number) {
    this.machines.forEach((machine) => machine.update(deltaSeconds));
  }

  dispose() {
    this.machines.forEach((machine) => machine.dispose());
  }

  private calculateMachineBounds(): MachineBounds[] {
    const { safeArea } = this.layout;
    const isMobile = this.layout.ui.mode === 'mobile';
    const gap = isMobile ? SLOT_CONFIG.bonus.mobileGap : SLOT_CONFIG.bonus.desktopGap;
    const aspectRatio = SLOT_CONFIG.gridFrame.width / SLOT_CONFIG.gridFrame.height;

    if (isMobile) {
      const maxWidth = safeArea.width * SLOT_CONFIG.bonus.mobileWidthRatio;
      const maxHeight = (
        safeArea.height * SLOT_CONFIG.bonus.mobileHeightRatio -
        gap * (SLOT_CONFIG.bonus.machines - 1)
      ) / SLOT_CONFIG.bonus.machines;
      const height = Math.min(maxWidth / aspectRatio, maxHeight);
      const width = height * aspectRatio;
      const totalHeight = height * SLOT_CONFIG.bonus.machines + gap * (SLOT_CONFIG.bonus.machines - 1);
      const startX = safeArea.x + (safeArea.width - width) / 2;
      const startY = safeArea.y + (safeArea.height - totalHeight) / 2;

      return Array.from({ length: SLOT_CONFIG.bonus.machines }, (_, index) => ({
        x: startX,
        y: startY + index * (height + gap),
        width,
        height,
      }));
    }

    const maxWidth = (safeArea.width * SLOT_CONFIG.bonus.desktopWidthRatio - gap) / 2;
    const maxHeight = (safeArea.height - gap) / 2;
    const width = Math.min(maxWidth, maxHeight * aspectRatio);
    const height = width / aspectRatio;
    const totalWidth = width * 2 + gap;
    const totalHeight = height * 2 + gap;
    const startX = safeArea.x + (safeArea.width - totalWidth) / 2;
    const startY = safeArea.y + (safeArea.height - totalHeight) / 2;

    return [
      { x: startX, y: startY, width, height },
      { x: startX + width + gap, y: startY, width, height },
      { x: safeArea.x + (safeArea.width - width) / 2, y: startY + height + gap, width, height },
    ];
  }
}
