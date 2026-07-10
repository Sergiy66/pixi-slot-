import { Application } from 'pixi.js';

export async function createPixiApp(host: HTMLElement): Promise<Application> {
  const app = new Application();
  const resolution = Math.min(window.devicePixelRatio || 1, 1.5);

  await app.init({
    autoDensity: true,
    antialias: true,
    backgroundAlpha: 0,
    width: host.clientWidth || 1,
    height: host.clientHeight || 1,
    resolution,
  });

  app.canvas.classList.add('pixi-stage');
  host.appendChild(app.canvas);

  return app;
}
