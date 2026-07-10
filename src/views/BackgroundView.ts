import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rect } from '../types/slot';
import { getCoverScale, roundToPixel } from '../utils/resize';

export class BackgroundView {
  readonly root = new Container();

  private readonly sprite: Sprite;

  constructor(texture: Texture) {
    this.sprite = new Sprite(texture);
    this.sprite.roundPixels = true;

    this.root.addChild(this.sprite);
  }

  resize(rect: Rect) {
    const textureWidth = this.sprite.texture.width;
    const textureHeight = this.sprite.texture.height;
    const scale = getCoverScale(textureWidth, textureHeight, rect.width, rect.height);

    this.sprite.width = roundToPixel(textureWidth * scale);
    this.sprite.height = roundToPixel(textureHeight * scale);
    this.sprite.position.set(
      roundToPixel(rect.x + (rect.width - this.sprite.width) / 2),
      roundToPixel(rect.y + (rect.height - this.sprite.height) / 2),
    );
  }
}
