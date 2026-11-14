// Shop nach Skizze: Charaktere und Skins kaufen (mit im Spiel verdienten Münzen).
// Echte Käufe (In-App-Käufe) können später hier angebunden werden.
import { CHARACTERS } from '../data/characters';
import { SKINS } from '../data/skins';
import { saveProfile } from '../core/save';
import { drawHero } from '../game/draw';
import { drawCharacter, heroLook, Scroller, sky } from './common';
import { MenuScene } from './menu';
import { App, C, Rect, Scene, UI } from './ui';

interface Offer { kind: 'char' | 'skin'; id: string; name: string; price: number; desc: string }

export class ShopScene implements Scene {
  offer: Offer | null = null;
  scroll = new Scroller();
  constructor(private app: App) {}

  frame(c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    const ui = new UI(app, c); ui.begin();
    sky(c, w, h, '#141020', '#221a2c');
    const prof = app.profile;

    if (this.offer) { this.dialog(ui, c); return; }

    const top = 60 * u;
    const box: Rect = { x: 16 * u, y: top, w: w - 32 * u, h: h - top - 16 * u };
    ui.panel(box, 22 * u);
    c.save(); c.beginPath(); c.rect(box.x, box.y + 2, box.w, box.h - 4); c.clip();
    let y = box.y + 14 * u - this.scroll.y;
    const tile = Math.min(84 * u, (box.w - 40 * u) / 6 - 12 * u);
    const gap = 14 * u, x0 = box.x + 20 * u;

    const row = (title: string, list: Offer[], owned: string[], look: (id: string) => ReturnType<typeof heroLook>) => {
      ui.text(title, x0, y + 10 * u, 20); y += 28 * u;
      list.forEach((o, i) => {
        const r = { x: x0 + i * (tile + gap), y, w: tile, h: tile };
        const has = owned.includes(o.id);
        tileBg(ui, r, false, true);
        drawCharacter(c, r.x + r.w / 2, r.y + r.h * 0.78, r.h * 0.6, o.kind === 'char' ? o.id : prof.char, o.kind === 'char' ? 'standard' : o.id);
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(r.x + 2, r.y + r.h - 22 * u, r.w - 4, 20 * u);
        ui.text(has ? '✓ Besitzt' : `🪙 ${o.price}`, r.x + r.w / 2, r.y + r.h - 12 * u, 12, { align: 'center', color: has ? C.good : C.accent });
        if (ui.hit(r)) {
          app.audio.sfx('click');
          if (!has) this.offer = o;
        }
      });
      y += tile + 22 * u;
    };
    row('Charaktere', CHARACTERS.map((ch) => ({ kind: 'char' as const, id: ch.id, name: ch.name, price: ch.price, desc: ch.desc })),
      prof.ownedChars, (id) => heroLook(id, 'standard'));
    row('Skins', SKINS.map((s) => ({ kind: 'skin' as const, id: s.id, name: s.name, price: s.price, desc: 'Neue Farben für alle Charaktere' })),
      prof.ownedSkins, (id) => heroLook(prof.char, id));
    c.restore();
    this.scroll.update(app, y + this.scroll.y - box.y, box.h);

    if (ui.backButton()) { app.setScene(new MenuScene(app)); return; }
    ui.text('Shop', 74 * u, 31 * u, 24);
    ui.coinPill(w - 16 * u, 12 * u);
  }

  dialog(ui: UI, c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    const o = this.offer!;
    const prof = app.profile;
    const dw = Math.min(460 * u, w - 40 * u), dh = Math.min(260 * u, h - 40 * u);
    const r = { x: w / 2 - dw / 2, y: h / 2 - dh / 2, w: dw, h: dh };
    ui.panel(r, 22 * u);
    drawCharacter(c, r.x + 80 * u, r.y + dh * 0.72, dh * 0.5, o.kind === 'char' ? o.id : prof.char, o.kind === 'char' ? 'standard' : o.id);
    ui.text(o.name, r.x + 160 * u, r.y + 40 * u, 24);
    wrap(ui, o.desc, r.x + 160 * u, r.y + 74 * u, dw - 180 * u, 14);
    const afford = prof.coins >= o.price;
    ui.text(`Preis: 🪙 ${o.price}`, r.x + 160 * u, r.y + dh - 90 * u, 16, { color: afford ? C.accent : C.bad });
    const bw = (dw - 180 * u - 12 * u) / 2;
    if (ui.button({ x: r.x + 160 * u, y: r.y + dh - 62 * u, w: bw, h: 44 * u }, 'Kaufen', { disabled: !afford, primary: true, size: 16 })) {
      prof.coins -= o.price;
      (o.kind === 'char' ? prof.ownedChars : prof.ownedSkins).push(o.id);
      if (o.kind === 'char') prof.char = o.id; else prof.skin = o.id;
      saveProfile(prof);
      app.audio.sfx('item');
      this.offer = null;
      return;
    }
    if (ui.button({ x: r.x + 172 * u + bw, y: r.y + dh - 62 * u, w: bw, h: 44 * u }, 'Abbrechen', { size: 16 })) this.offer = null;
    else if (ui.taps.length && !ui.consumed && !ui.taps.some((t) => t.x > r.x && t.x < r.x + r.w && t.y > r.y && t.y < r.y + r.h)) this.offer = null;
  }
}

export function wrap(ui: UI, text: string, x: number, y: number, maxW: number, size: number) {
  const c = ui.ctx;
  c.font = `${Math.round(size * ui.app.u)}px system-ui, sans-serif`;
  const words = text.split(' ');
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (c.measureText(test).width > maxW && line) { ui.text(line, x, y, size, { bold: false, color: C.dim }); y += size * 1.4 * ui.app.u; line = wd; }
    else line = test;
  }
  if (line) ui.text(line, x, y, size, { bold: false, color: C.dim });
}

function tileBg(ui: UI, r: Rect, selected: boolean, enabled: boolean) {
  const u = ui.app.u;
  ui.rr(r.x, r.y, r.w, r.h, 14 * u);
  ui.ctx.fillStyle = selected ? 'rgba(242,194,48,0.22)' : enabled ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.3)';
  ui.ctx.fill();
  ui.ctx.lineWidth = (selected ? 3.5 : 2) * u;
  ui.ctx.strokeStyle = selected ? C.accent : enabled ? C.panelLine : 'rgba(255,255,255,0.2)';
  ui.ctx.stroke();
}
