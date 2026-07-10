import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rect } from '../types/slot';

export class SlotGridView {
  readonly root = new Container();

  private readonly sprite: Sprite;

  constructor(texture: Texture) {
    this.sprite = new Sprite(texture);
    this.sprite.roundPixels = true;

    this.root.addChild(this.sprite);
  }

  resize(layout: Rect) {
    this.sprite.position.set(layout.x, layout.y);
    this.sprite.width = layout.width;
    this.sprite.height = layout.height;
  }
}
