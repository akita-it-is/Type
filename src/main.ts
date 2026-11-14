// Einstiegspunkt: Canvas, Hauptschleife, Szenenwechsel, Querformat-Hinweis.
import { AudioEngine } from './core/audio';
import { Input } from './core/input';
import { loadProfile } from './core/save';
import { MenuScene } from './ui/menu';
import { Assets } from './core/assets';
import { App, Scene } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const input = new Input(canvas);
const audio = new AudioEngine();
const profile = loadProfile();
audio.setVolumes(profile.settings.music, profile.settings.sfx);

let scene: Scene;
const app: App = {
  w: 0, h: 0, u: 1, input, audio, profile, time: 0,
  setScene(s) { scene = s; input.endFrame(); s.onResize?.(); },
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  app.w = window.innerWidth;
  app.h = window.innerHeight;
  canvas.width = Math.round(app.w * dpr);
  canvas.height = Math.round(app.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // UI-Skalierung: Handy ~1, Tablet größer
  app.u = Math.max(0.75, Math.min(1.7, Math.min(app.w / 860, app.h / 400)));
  scene?.onResize?.();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

input.onFirstInteract = () => {
  audio.init();
  // Auf dem Handy: Vollbild + Querformat sperren (Android/Chrome)
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions)
      .then(() => (screen.orientation as any)?.lock?.('landscape'))
      .catch(() => { /* nicht erlaubt – egal */ });
  }
};

document.addEventListener('visibilitychange', () => { if (document.hidden) scene?.onHidden?.(); });

scene = new MenuScene(app);
Assets.load(); // eigene Grafiken laden (falls vorhanden)
// Für Tests/Debugging in der Browser-Konsole erreichbar
(window as any).__app = app;
(window as any).__scene = () => scene;

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  app.time += dt;
  input.pollGamepad();
  ctx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);

  if (app.h > app.w) {
    // Hochformat -> Hinweis
    ctx.fillStyle = '#08070c'; ctx.fillRect(0, 0, app.w, app.h);
    ctx.fillStyle = '#f4ead8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '48px sans-serif'; ctx.fillText('📱↻', app.w / 2, app.h / 2 - 40);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Bitte drehe dein Gerät', app.w / 2, app.h / 2 + 20);
    ctx.fillText('ins Querformat', app.w / 2, app.h / 2 + 48);
    scene.onHidden?.();
  } else {
    scene.frame(ctx, dt);
  }
  input.endFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
