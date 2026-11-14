// Inventar (Hauptmenü): Charaktere, Skins und das Lager.
// Im Lager kann man 100 gleiche Items gegen ein Item der nächsten Seltenheit tauschen.
import { CHARACTERS, ABILITIES } from '../data/characters';
import { SKINS } from '../data/skins';
import { ITEMS, ItemDef, nextRarity, RARITY_INFO, TRADE_AMOUNT, randomItem } from '../data/items';
import { addToStash, saveProfile } from '../core/save';
import { drawCharacter, Scroller, sky } from './common';
import { itemInfo, itemTile } from './itemui';
import { MenuScene } from './menu';
import { App, C, Rect, Scene, UI } from './ui';

type Tab = 'chars' | 'skins' | 'stash';

export class InventoryScene implements Scene {
  tab: Tab = 'stash';
  sel: ItemDef | null = null;
  info = '';
  scroll = new Scroller();
  constructor(private app: App) {}

  frame(c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    const ui = new UI(app, c); ui.begin();
    sky(c, w, h, '#141020', '#221a2c');
    const prof = app.profile;

    if (ui.backButton()) { app.setScene(new MenuScene(app)); return; }
    ui.text('Inventar', 72 * u, 31 * u, 22);
    ui.coinPill(w - 16 * u, 12 * u);
    const tabs: [Tab, string][] = [['stash', 'Lager'], ['chars', 'Charaktere'], ['skins', 'Skins']];
    tabs.forEach(([t, label], i) => {
      if (ui.button({ x: 190 * u + i * 128 * u, y: 12 * u, w: 120 * u, h: 38 * u }, label, { primary: this.tab === t, size: 14 })) {
        this.tab = t; this.sel = null; this.info = ''; this.scroll.y = 0;
      }
    });

    const box: Rect = { x: 16 * u, y: 60 * u, w: w - 32 * u, h: h - 60 * u - 70 * u };
    ui.panel(box, 18 * u);
    c.save(); c.beginPath(); c.rect(box.x, box.y + 2, box.w, box.h - 4); c.clip();
    let contentH = 0;
    if (this.tab === 'stash') contentH = this.stash(ui, box);
    else contentH = this.looks(ui, box);
    c.restore();
    this.scroll.update(app, contentH, box.h);

    // Detailbereich unten
    const dy = box.y + box.h + 10 * u;
    if (this.tab === 'stash' && this.sel) {
      itemInfo(ui, this.sel, 20 * u, dy + 8 * u, w - 260 * u);
      const n = prof.stash[this.sel.id] || 0;
      const next = nextRarity(this.sel.rarity);
      if (next) {
        const can = n >= TRADE_AMOUNT;
        if (ui.button({ x: w - 230 * u, y: dy + 4 * u, w: 214 * u, h: 44 * u }, `${TRADE_AMOUNT}x tauschen → ${RARITY_INFO[next].name}`, { disabled: !can, primary: can, size: 12 })) {
          prof.stash[this.sel.id] -= TRADE_AMOUNT;
          if (prof.stash[this.sel.id] <= 0) delete prof.stash[this.sel.id];
          let it = randomItem(Math.random, 0, 0);
          for (let k = 0; k < 50 && it.rarity !== next; k++) it = ITEMS.filter((i) => i.rarity === next)[Math.floor(Math.random() * ITEMS.filter((i) => i.rarity === next).length)];
          addToStash(prof, it.id);
          saveProfile(prof);
          app.audio.sfx('item');
          this.sel = it;
        }
      }
    } else ui.text(this.info || (this.tab === 'stash' ? `Tippe auf ein Item. ${TRADE_AMOUNT} gleiche Items lassen sich gegen ein selteneres tauschen.` : ''), w / 2, dy + 26 * u, 13, { align: 'center', bold: false });
  }

  private stash(ui: UI, box: Rect): number {
    const { app } = this, u = app.u, c = ui.ctx;
    const prof = app.profile;
    const T = 50 * u, gap = 8 * u;
    const cols = Math.max(1, Math.floor((box.w - 32 * u + gap) / (T + gap)));
    // Besitz zuerst, dann entdeckte, dann unbekannte
    const order = ITEMS.slice().sort((a, b) => ((prof.stash[b.id] ? 2 : prof.discovered.includes(b.id) ? 1 : 0) - (prof.stash[a.id] ? 2 : prof.discovered.includes(a.id) ? 1 : 0)));
    const y0 = box.y + 16 * u - this.scroll.y;
    order.forEach((it, i) => {
      const r = { x: box.x + 16 * u + (i % cols) * (T + gap), y: y0 + Math.floor(i / cols) * (T + gap), w: T, h: T };
      const n = prof.stash[it.id] || 0;
      const known = prof.discovered.includes(it.id);
      if (known) itemTile(ui, r, it, { count: n, dim: n === 0, selected: this.sel === it });
      else { itemTile(ui, r, null, {}); ui.text('?', r.x + T / 2, r.y + T / 2, 18, { align: 'center', color: C.dim }); }
      if (ui.hit(r)) { this.sel = known ? it : null; this.info = known ? '' : 'Noch nicht entdeckt'; app.audio.sfx('click'); }
    });
    void c;
    return Math.ceil(ITEMS.length / cols) * (T + gap) + 24 * u;
  }

  private looks(ui: UI, box: Rect): number {
    const { app } = this, u = app.u, c = ui.ctx, prof = app.profile;
    const tile = Math.min(110 * u, (box.w - 40 * u) / 6 - 12 * u), gap = 14 * u;
    const y = box.y + 18 * u - this.scroll.y;
    const list = this.tab === 'chars' ? CHARACTERS : SKINS;
    list.forEach((it, i) => {
      const r = { x: box.x + 20 * u + i * (tile + gap), y, w: tile, h: tile * 1.2 };
      const owned = this.tab === 'chars' ? prof.ownedChars.includes(it.id) : prof.ownedSkins.includes(it.id);
      const active = this.tab === 'chars' ? prof.char === it.id : prof.skin === it.id;
      ui.rr(r.x, r.y, r.w, r.h, 14 * u);
      c.fillStyle = active ? 'rgba(242,194,48,0.22)' : owned ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.3)'; c.fill();
      c.lineWidth = (active ? 3.5 : 2) * u; c.strokeStyle = active ? C.accent : C.panelLine; c.stroke();
      drawCharacter(c, r.x + r.w / 2, r.y + r.h * 0.8, r.w * 0.7, this.tab === 'chars' ? it.id : prof.char, this.tab === 'chars' ? prof.skin : it.id, { alpha: owned ? 1 : 0.3 });
      ui.text(it.name, r.x + r.w / 2, r.y + r.h - 10 * u, 12, { align: 'center' });
      if (!owned) ui.text('🔒', r.x + r.w - 14 * u, r.y + 14 * u, 13, { align: 'center' });
      if (this.tab === 'chars') ui.text(ABILITIES[(it as typeof CHARACTERS[0]).ability].icon, r.x + 14 * u, r.y + 14 * u, 14, { align: 'center' });
      if (ui.hit(r)) {
        if (!owned) { app.audio.sfx('error'); this.info = `${it.name} gibt es im Shop.`; return; }
        if (this.tab === 'chars') { prof.char = it.id; const ch = it as typeof CHARACTERS[0]; this.info = `${ch.name}: ${ch.desc}`; }
        else { prof.skin = it.id; this.info = `Skin: ${it.name}`; }
        saveProfile(prof); app.audio.sfx('click');
      }
    });
    return tile * 1.2 + 40 * u;
  }
}
