// Ausrüstungsmenü vor jedem Run: Items aus dem Lager in die Slots legen.
// Mitgenommene Items werden beim Start aus dem Lager genommen.
import { emptyLoadout, Loadout, saveProfile, takeFromStash, worldProgress } from '../core/save';
import { ROUNDS_PER_WORLD } from '../core/config';
import { ArmorSlot, ITEMS, ItemDef, itemById, ItemKind, KIND_NAME } from '../data/items';
import type { WorldDef } from '../data/worlds';
import { SLOTS, type ItemRef } from '../game/inventory';
import { invGrid, itemInfo, itemTile, InvView } from './itemui';
import { sky } from './common';
import { PlayScene } from './play';
import { WorldSelectScene } from './worldselect';
import { App, C, Scene, UI } from './ui';

const FILTERS: (ItemKind | 'all')[] = ['all', 'weapon', 'armor', 'active', 'passive', 'consumable'];

export class LoadoutScene implements Scene {
  lo: Loadout;
  filter: ItemKind | 'all' = 'all';
  info: ItemDef | null = null;
  scroll = 0;
  private lastY: number | null = null;

  constructor(private app: App, private world: WorldDef) {
    this.lo = emptyLoadout();
    // letzte Ausrüstung vorschlagen (soweit noch im Lager)
    const last = app.profile.lastLoadout;
    if (!last) {
      // erster Start: komplette Startausrüstung vorschlagen
      for (const [id, n] of Object.entries(app.profile.stash)) for (let i = 0; i < n; i++) { const it = itemById(id); if (it) this.add(it); }
    } else {
      const tryAdd = (id: string | null) => { if (id && this.available(id) > 0) this.add(itemById(id)!); };
      [last.weapon, last.armor.head, last.armor.chest, last.armor.legs, last.active, ...last.consumables, ...last.passives, ...last.backpack].forEach(tryAdd);
    }
  }

  ids(): string[] {
    const l = this.lo;
    return [l.weapon, l.armor.head, l.armor.chest, l.armor.legs, l.active, ...l.consumables, ...l.passives, ...l.backpack].filter(Boolean) as string[];
  }

  available(id: string) {
    return (this.app.profile.stash[id] || 0) - this.ids().filter((x) => x === id).length;
  }

  add(it: ItemDef): boolean {
    const l = this.lo;
    const toBackpack = () => { const i = l.backpack.indexOf(null); if (i < 0) return false; l.backpack[i] = it.id; return true; };
    switch (it.kind) {
      case 'weapon': if (!l.weapon) { l.weapon = it.id; return true; } return toBackpack();
      case 'armor': if (!l.armor[it.slot]) { l.armor[it.slot] = it.id; return true; } return toBackpack();
      case 'active': if (!l.active) { l.active = it.id; return true; } return toBackpack();
      case 'passive': if (l.passives.length < SLOTS.passives) { l.passives.push(it.id); return true; } return false;
      case 'consumable': { const i = l.consumables.indexOf(null); if (i < 0) return false; l.consumables[i] = it.id; return true; }
    }
  }

  remove(ref: ItemRef) {
    const l = this.lo;
    switch (ref.area) {
      case 'weapon': l.weapon = null; break;
      case 'active': l.active = null; break;
      case 'armor': l.armor[ref.key] = null; break;
      case 'consumables': l.consumables[ref.key] = null; break;
      case 'passives': l.passives.splice(ref.key, 1); break;
      case 'backpack': l.backpack[ref.key] = null; break;
    }
  }

  view(): InvView {
    const l = this.lo, d = (id: string | null) => itemById(id) ?? null;
    return {
      weapon: d(l.weapon), active: d(l.active),
      armor: { head: d(l.armor.head), chest: d(l.armor.chest), legs: d(l.armor.legs) } as Record<ArmorSlot, ItemDef | null>,
      consumables: l.consumables.map(d), passives: l.passives.map((id) => itemById(id)!).filter(Boolean), backpack: l.backpack.map(d),
    };
  }

  frame(c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    const ui = new UI(app, c); ui.begin();
    sky(c, w, h, '#141020', '#221a2c');
    const wp = worldProgress(app.profile, this.world.id);

    if (ui.backButton()) { app.setScene(new WorldSelectScene(app)); return; }
    ui.text(`Ausrüstung – ${this.world.name}`, 72 * u, 24 * u, 20);
    ui.text(`Runde ${wp.round}/${ROUNDS_PER_WORLD}${wp.prestige ? `  ·  Prestige ★${wp.prestige}` : ''}`, 72 * u, 44 * u, 12, { color: C.dim, bold: false });
    if (ui.button({ x: w - 180 * u, y: 12 * u, w: 164 * u, h: 44 * u }, '▶ Run starten', { primary: true, size: 16 })) { this.start(); return; }

    // Links: Slots
    const S = Math.min(40 * u, (w * 0.62) / 11.5);
    const left = 16 * u, top = 66 * u;
    const grid = invGrid(ui, left, top, S, this.view(), null);
    if (grid.tapped) {
      const it = this.view() && getRef(this.view(), grid.tapped);
      if (it) { this.remove(grid.tapped); this.info = it; app.audio.sfx('click'); }
    }
    ui.text('Tippe auf ein Item im Lager zum Mitnehmen, auf einen Slot zum Zurücklegen.', left, top + grid.height + 14 * u, 11, { color: C.dim, bold: false });
    if (this.info) itemInfo(ui, this.info, left, top + grid.height + 38 * u, grid.width);

    // Rechts: Lager
    const lx = left + grid.width + 20 * u, lw = w - lx - 16 * u;
    ui.panel({ x: lx - 8 * u, y: top - 6 * u, w: lw + 16 * u, h: h - top - 4 * u }, 14 * u);
    // Filter
    const fw = lw / FILTERS.length;
    FILTERS.forEach((f, i) => {
      const r = { x: lx + i * fw, y: top, w: fw - 3 * u, h: 24 * u };
      ui.rr(r.x, r.y, r.w, r.h, 8 * u);
      c.fillStyle = this.filter === f ? 'rgba(242,194,48,0.3)' : 'rgba(255,255,255,0.06)'; c.fill();
      ui.text(f === 'all' ? 'Alle' : KIND_NAME[f].slice(0, 6), r.x + r.w / 2, r.y + r.h / 2, 10, { align: 'center' });
      if (ui.hit(r)) { this.filter = f; this.scroll = 0; }
    });
    const items = ITEMS.filter((it) => (this.filter === 'all' || it.kind === this.filter) && this.available(it.id) > 0);
    const T = 42 * u, gap = 6 * u, cols = Math.max(1, Math.floor((lw + gap) / (T + gap)));
    const gy = top + 32 * u, gh = h - gy - 10 * u;
    const contentH = Math.ceil(items.length / cols) * (T + gap);
    this.dragScroll(lx, gy, lw, gh, contentH);
    c.save(); c.beginPath(); c.rect(lx - 4, gy, lw + 8, gh); c.clip();
    if (!items.length) ui.text('Nichts im Lager.', lx, gy + 16 * u, 12, { color: C.dim, bold: false });
    items.forEach((it, i) => {
      const r = { x: lx + (i % cols) * (T + gap), y: gy - this.scroll + Math.floor(i / cols) * (T + gap), w: T, h: T };
      if (r.y + T < gy || r.y > gy + gh) return;
      itemTile(ui, r, it, { count: this.available(it.id) });
      if (r.y >= gy - 4 && ui.hit(r)) {
        this.info = it;
        if (this.add(it)) app.audio.sfx('pickup'); else app.audio.sfx('error');
      }
    });
    c.restore();
  }

  private dragScroll(x: number, y: number, w: number, h: number, contentH: number) {
    const ptrs = [...this.app.input.ptrs.values()];
    const p = ptrs.length === 1 && ptrs[0].sx >= x && ptrs[0].sx <= x + w && ptrs[0].sy >= y && ptrs[0].sy <= y + h ? ptrs[0] : null;
    if (p) {
      if (this.lastY !== null && Math.abs(p.y - p.sy) > 10) this.scroll -= p.y - this.lastY;
      this.lastY = p.y;
    } else this.lastY = null;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, contentH - h)));
  }

  start() {
    const prof = this.app.profile;
    for (const id of this.ids()) takeFromStash(prof, id);
    prof.lastLoadout = JSON.parse(JSON.stringify(this.lo));
    prof.pendingLoadout = JSON.parse(JSON.stringify(this.lo));
    saveProfile(prof);
    const wp = worldProgress(prof, this.world.id);
    this.app.setScene(new PlayScene(this.app, { mode: 'world', world: this.world, round: wp.round, prestige: wp.prestige, loadout: this.lo }));
  }
}

function getRef(v: InvView, ref: ItemRef): ItemDef | null {
  switch (ref.area) {
    case 'weapon': return v.weapon;
    case 'active': return v.active;
    case 'armor': return v.armor[ref.key];
    case 'consumables': return v.consumables[ref.key];
    case 'passives': return v.passives[ref.key] ?? null;
    case 'backpack': return v.backpack[ref.key];
  }
}
