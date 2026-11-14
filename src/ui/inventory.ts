// Inventar nach Skizze: Charaktere oben, Items unten (+ Skins zum Auswählen).
import { CHARACTERS } from '../data/characters';
import { SKINS } from '../data/skins';
import { ITEMS } from '../data/items';
import { saveProfile } from '../core/save';
import { drawHero } from '../game/draw';
import { heroLook, Scroller, sky } from './common';
import { MenuScene } from './menu';
import { App, C, Rect, Scene, UI } from './ui';

export class InventoryScene implements Scene {
  info = 'Tippe auf einen Charakter, Skin oder ein Item.';
  scroll = new Scroller();
  constructor(private app: App) {}

  frame(c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    const ui = new UI(app, c); ui.begin();
    sky(c, w, h, '#141020', '#221a2c');
    const prof = app.profile;

    const top = 60 * u;
    const box: Rect = { x: 16 * u, y: top, w: w - 32 * u, h: h - top - 44 * u };
    ui.panel(box, 22 * u);
    c.save();
    c.beginPath(); c.rect(box.x, box.y + 2, box.w, box.h - 4); c.clip();
    let y = box.y + 14 * u - this.scroll.y;
    const tile = Math.min(70 * u, (box.w - 40 * u) / 6 - 12 * u);
    const gap = 12 * u;
    const x0 = box.x + 20 * u;

    // Charaktere
    ui.text('Charaktere', x0, y + 10 * u, 20); y += 28 * u;
    CHARACTERS.forEach((ch, i) => {
      const r = { x: x0 + i * (tile + gap), y, w: tile, h: tile };
      const owned = prof.ownedChars.includes(ch.id);
      tileBg(ui, r, prof.char === ch.id, owned);
      c.save(); c.globalAlpha = owned ? 1 : 0.25;
      drawHero(c, r.x + r.w / 2, r.y + r.h * 0.92, r.h * 0.75, heroLook(ch.id, owned ? prof.skin : 'standard'));
      c.restore();
      if (!owned) ui.text('🔒', r.x + r.w - 13 * u, r.y + 14 * u, 13, { align: 'center' });
      if (ui.hit(r)) {
        if (owned) { prof.char = ch.id; saveProfile(prof); app.audio.sfx('click'); this.info = `${ch.name}: ${ch.desc}`; }
        else { app.audio.sfx('error'); this.info = `${ch.name} gibt es im Shop.`; }
      }
    });
    y += tile + 20 * u;

    // Skins
    ui.text('Skins', x0, y + 10 * u, 20); y += 28 * u;
    SKINS.forEach((sk, i) => {
      const r = { x: x0 + i * (tile + gap), y, w: tile, h: tile };
      const owned = prof.ownedSkins.includes(sk.id);
      tileBg(ui, r, prof.skin === sk.id, owned);
      c.save(); c.globalAlpha = owned ? 1 : 0.25;
      drawHero(c, r.x + r.w / 2, r.y + r.h * 0.92, r.h * 0.75, heroLook(prof.char, sk.id));
      c.restore();
      if (!owned) ui.text('🔒', r.x + r.w - 13 * u, r.y + 14 * u, 13, { align: 'center' });
      if (ui.hit(r)) {
        if (owned) { prof.skin = sk.id; saveProfile(prof); app.audio.sfx('click'); this.info = `Skin: ${sk.name}`; }
        else { app.audio.sfx('error'); this.info = `Skin "${sk.name}" gibt es im Shop.`; }
      }
    });
    y += tile + 20 * u;

    // Items (Sammlung)
    const found = ITEMS.filter((i) => prof.discovered.includes(i.id)).length;
    ui.text(`Items  (${found}/${ITEMS.length} entdeckt)`, x0, y + 10 * u, 20); y += 28 * u;
    const it = tile * 0.72;
    const perRow = Math.max(1, Math.floor((box.w - 40 * u + gap) / (it + gap)));
    ITEMS.forEach((item, i) => {
      const r = { x: x0 + (i % perRow) * (it + gap), y: y + Math.floor(i / perRow) * (it + gap), w: it, h: it };
      const known = prof.discovered.includes(item.id);
      tileBg(ui, r, false, known);
      c.font = `${Math.round(it * 0.55)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (known) c.fillText(item.icon, r.x + r.w / 2, r.y + r.h / 2 + 1);
      else ui.text('?', r.x + r.w / 2, r.y + r.h / 2, 20, { align: 'center', color: C.dim });
      if (ui.hit(r)) {
        app.audio.sfx('click');
        const kind = item.kind === 'passive' ? 'Passiv' : item.kind === 'active' ? 'Aktiv' : 'Verbrauch';
        this.info = known ? `${item.name} (${kind}): ${item.desc}` : 'Noch nicht entdeckt – finde es in einem Dungeon!';
      }
    });
    y += Math.ceil(ITEMS.length / perRow) * (it + gap);
    c.restore();
    this.scroll.update(app, y + this.scroll.y - box.y + 10 * u, box.h);

    if (ui.backButton()) { app.setScene(new MenuScene(app)); return; }
    ui.text('Inventar', 74 * u, 31 * u, 24);
    ui.coinPill(w - 16 * u, 12 * u);
    ui.text(this.info, w / 2, h - 22 * u, 14, { align: 'center', bold: false });
  }
}

export function tileBg(ui: UI, r: Rect, selected: boolean, enabled: boolean) {
  const u = ui.app.u;
  ui.rr(r.x, r.y, r.w, r.h, 14 * u);
  ui.ctx.fillStyle = selected ? 'rgba(242,194,48,0.22)' : enabled ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.3)';
  ui.ctx.fill();
  ui.ctx.lineWidth = (selected ? 3.5 : 2) * u;
  ui.ctx.strokeStyle = selected ? C.accent : enabled ? C.panelLine : 'rgba(255,255,255,0.2)';
  ui.ctx.stroke();
}
