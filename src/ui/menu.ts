// Hauptmenü nach Skizze: Profil oben links, Münzen oben rechts, Knöpfe links,
// Charakter auf Podest rechts, Vögel/Wolken im Hintergrund.
import { drawHero } from '../game/draw';
import { heroLook, profilePill, sky } from './common';
import { UI, App, Scene, C } from './ui';
import { WorldSelectScene } from './worldselect';
import { InventoryScene } from './inventory';
import { ShopScene } from './shop';
import { SettingsScene } from './settings';
import { PlayScene } from './play';
import { worldById } from '../data/worlds';
import { emptyLoadout } from '../core/save';

export class MenuScene implements Scene {
  birds = Array.from({ length: 6 }, () => ({ x: Math.random(), y: 0.1 + Math.random() * 0.4, s: 0.02 + Math.random() * 0.03, p: Math.random() * 6 }));
  constructor(private app: App) { app.audio.playMusic('menu'); }

  frame(c: CanvasRenderingContext2D, dt: number) {
    const { app } = this, { w, h, u } = app;
    const ui = new UI(app, c); ui.begin();

    // Hintergrund
    sky(c, w, h, '#1a1430', '#3a2a40');
    const groundY = h * 0.7;
    c.fillStyle = '#1a1420'; c.fillRect(0, groundY, w, h - groundY);
    c.strokeStyle = 'rgba(255,240,220,0.5)'; c.lineWidth = 2.5 * u;
    c.beginPath(); c.moveTo(0, groundY); c.lineTo(w, groundY); c.stroke();
    // Vögel (wie in der Skizze)
    c.strokeStyle = 'rgba(255,240,220,0.55)'; c.lineWidth = 2 * u;
    for (const b of this.birds) {
      b.x += b.s * dt; if (b.x > 1.1) { b.x = -0.1; b.y = 0.1 + Math.random() * 0.4; }
      b.p += dt * 6;
      const bx = w * 0.35 + b.x * w * 0.65, by = h * b.y, f = Math.sin(b.p) * 6 * u;
      c.beginPath(); c.moveTo(bx - 14 * u, by - f); c.quadraticCurveTo(bx - 6 * u, by - 8 * u, bx, by);
      c.quadraticCurveTo(bx + 6 * u, by - 8 * u, bx + 14 * u, by - f); c.stroke();
    }

    // Charakter auf Podest
    const cx = w * 0.68, cy = groundY + 10 * u;
    c.fillStyle = '#2a2230'; c.strokeStyle = 'rgba(255,240,220,0.7)'; c.lineWidth = 3 * u;
    c.beginPath(); c.ellipse(cx, cy, 90 * u, 30 * u, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(cx, cy - 4 * u, 40 * u, 12 * u, 0, 0, Math.PI * 2); c.fill();
    const t = app.time;
    drawHero(c, cx, cy - 4 * u + Math.sin(t * 2) * 2 * u, Math.min(h * 0.42, 190 * u), heroLook(app.profile.char, app.profile.skin), {
      faceX: Math.sin(t * 0.5) * 0.4, faceY: 1,
    });

    // Titel (provisorisch)
    ui.text('DUNGEON CRAWLER', cx, h * 0.12, 26, { align: 'center', color: C.accent });

    // Profil & Münzen
    profilePill(ui, app, 16 * u, 14 * u);
    ui.coinPill(w - 16 * u, 14 * u);

    // Menü-Knöpfe
    const bw = Math.min(260 * u, w * 0.34), bh = Math.min(48 * u, (h - 90 * u) / 5 - 8 * u);
    let y = 72 * u;
    const gap = bh + Math.min(12 * u, (h - 72 * u - bh * 5) / 5);
    const x = 16 * u;
    if (ui.button({ x, y, w: bw, h: bh }, 'Spielen', { icon: '▶' })) app.setScene(new WorldSelectScene(app));
    y += gap;
    if (ui.button({ x, y, w: bw, h: bh }, 'Inventar', { icon: '🎒' })) app.setScene(new InventoryScene(app));
    y += gap;
    if (ui.button({ x, y, w: bw, h: bh }, 'Shop', { icon: '🛒' })) app.setScene(new ShopScene(app));
    y += gap;
    if (ui.button({ x, y, w: bw, h: bh }, 'Einstellungen', { icon: '⚙️' })) app.setScene(new SettingsScene(app));
    y += gap;
    const best = app.profile.arcadeBest;
    if (ui.button({ x, y, w: bw, h: bh }, best ? `Arcade (${best})` : 'Arcade', { icon: '🕹️' }))
      app.setScene(new PlayScene(app, { mode: 'arcade', world: worldById('aliens'), round: 1, prestige: 0, loadout: emptyLoadout() }));
  }
}
