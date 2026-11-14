// Gemeinsame Item-Oberfläche: Item-Kachel, Inventar-Raster (Ausrüstung,
// Verbrauch, Passiv, Rucksack) und Detail-Anzeige. Wird im Ausrüstungsmenü,
// im Spiel-Inventar und am Altar benutzt.
import { ARMOR_SLOT_NAME, ArmorSlot, ItemDef, KIND_NAME, RARITY_INFO, setById } from '../data/items';
import { SLOTS, type ItemRef } from '../game/inventory';
import { C, Rect, UI } from './ui';
import { drawItemIcon } from '../core/assets';

export interface InvView {
  weapon: ItemDef | null;
  armor: Record<ArmorSlot, ItemDef | null>;
  active: ItemDef | null;
  consumables: (ItemDef | null)[];
  passives: ItemDef[];
  backpack: (ItemDef | null)[];
}

export function sameRef(a: ItemRef | null, b: ItemRef | null) {
  if (!a || !b || a.area !== b.area) return false;
  return (a as any).key === (b as any).key;
}

/** Eine Item-Kachel mit Seltenheitsrahmen */
export function itemTile(ui: UI, r: Rect, item: ItemDef | null, o: { selected?: boolean; count?: number; placeholder?: string; dim?: boolean; extra?: string } = {}) {
  const c = ui.ctx, u = ui.app.u;
  ui.rr(r.x, r.y, r.w, r.h, 9 * u);
  c.fillStyle = o.selected ? 'rgba(242,194,48,0.25)' : item ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.35)';
  c.fill();
  c.lineWidth = (o.selected ? 3 : 2) * u;
  c.strokeStyle = o.selected ? C.accent : item ? RARITY_INFO[item.rarity].color : 'rgba(255,255,255,0.18)';
  c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (item) {
    c.globalAlpha = o.dim ? 0.35 : 1;
    drawItemIcon(c, item, r.x + r.w / 2, r.y + r.h / 2, r.h * 0.68);
    c.globalAlpha = 1;
  } else if (o.placeholder) {
    c.globalAlpha = 0.25;
    c.font = `${Math.round(r.h * 0.42)}px sans-serif`;
    c.fillStyle = '#fff';
    c.fillText(o.placeholder, r.x + r.w / 2, r.y + r.h / 2 + 1);
    c.globalAlpha = 1;
  }
  if (o.count !== undefined) {
    c.font = `bold ${Math.round(10 * u)}px system-ui, sans-serif`;
    c.textAlign = 'right';
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillText(String(o.count), r.x + r.w - 3 * u + 1, r.y + r.h - 7 * u + 1);
    c.fillStyle = o.count >= 100 ? C.good : '#fff'; c.fillText(String(o.count), r.x + r.w - 3 * u, r.y + r.h - 7 * u);
  }
}

/**
 * Zeichnet das komplette Inventar-Raster ab (x,y). Gibt die angetippte Stelle zurück.
 * Höhe ca. 3 Reihen + Überschriften.
 */
export function invGrid(ui: UI, x: number, y: number, S: number, view: InvView, selected: ItemRef | null): { tapped: ItemRef | null; width: number; height: number } {
  const u = ui.app.u, g = 6 * u, lab = 16 * u;
  let tapped: ItemRef | null = null;
  const slot = (r: Rect, item: ItemDef | null, ref: ItemRef, ph: string) => {
    itemTile(ui, r, item, { selected: sameRef(ref, selected), placeholder: ph });
    if (ui.hit(r)) tapped = ref;
  };
  const label = (t: string, lx: number, ly: number) => ui.text(t, lx, ly + 7 * u, 12, { color: C.dim });

  // Spalte A: Ausrüstung
  label('Waffe · Aktiv', x, y);
  slot({ x, y: y + lab, w: S, h: S }, view.weapon, { area: 'weapon' }, '⚔');
  slot({ x: x + S + g, y: y + lab, w: S, h: S }, view.active, { area: 'active' }, '✦');
  const y2 = y + lab + S + 10 * u;
  label('Rüstung', x, y2);
  (['head', 'chest', 'legs'] as ArmorSlot[]).forEach((s, i) =>
    slot({ x: x + i * (S + g), y: y2 + lab, w: S, h: S }, view.armor[s], { area: 'armor', key: s }, ['⛑', '👕', '👖'][i]));

  // Spalte B: Verbrauch + Passiv
  const xb = x + 3 * (S + g) + 14 * u;
  label(`Verbrauch (${SLOTS.consumables})`, xb, y);
  for (let i = 0; i < SLOTS.consumables; i++)
    slot({ x: xb + i * (S + g), y: y + lab, w: S, h: S }, view.consumables[i], { area: 'consumables', key: i }, '🧪');
  label(`Passiv (${view.passives.length}/${SLOTS.passives})`, xb, y2);
  for (let i = 0; i < SLOTS.passives; i++) {
    const r = { x: xb + (i % 5) * (S + g), y: y2 + lab + Math.floor(i / 5) * (S + g), w: S, h: S };
    if (i < view.passives.length) slot(r, view.passives[i], { area: 'passives', key: i }, '');
    else itemTile(ui, r, null, {});
  }

  // Spalte C: Rucksack
  const xc = xb + 5 * (S + g) + 14 * u;
  label(`Rucksack (${SLOTS.backpack})`, xc, y);
  for (let i = 0; i < SLOTS.backpack; i++)
    slot({ x: xc + (i % 3) * (S + g), y: y + lab + Math.floor(i / 3) * (S + g), w: S, h: S }, view.backpack[i], { area: 'backpack', key: i }, '🎒');

  return { tapped, width: xc + 3 * (S + g) - x, height: y2 + lab + 2 * S + g - y };
}

/** Kurzinfo zu einem Item (Name, Seltenheit, Art, Beschreibung, Set) */
export function itemInfo(ui: UI, item: ItemDef, x: number, y: number, maxW: number) {
  const ri = RARITY_INFO[item.rarity];
  const u = ui.app.u;
  ui.text(`${item.icon} ${item.name}`, x, y, 16, { color: ri.color });
  let kind: string = KIND_NAME[item.kind];
  if (item.kind === 'armor') kind += ` · ${ARMOR_SLOT_NAME[item.slot]}`;
  if (item.kind === 'active') kind += ` · Abklingzeit ${item.cooldown} s (nur im Kampf)`;
  ui.text(`${ri.name} · ${kind}`, x, y + 19 * u, 11, { color: C.dim, bold: false });
  let desc = item.desc;
  if (item.kind === 'armor') {
    const set = setById(item.set);
    if (set) desc += `  ·  Set ${set.name}: 2 Teile ${set.desc2}, 3 Teile ${set.desc3}`;
  }
  fitText(ui, desc, x, y + 37 * u, maxW, 12);
}

export function fitText(ui: UI, text: string, x: number, y: number, maxW: number, size: number, color = C.text) {
  const c = ui.ctx;
  let s = size;
  c.font = `${Math.round(s * ui.app.u)}px system-ui, sans-serif`;
  while (s > 8 && c.measureText(text).width > maxW) { s -= 0.5; c.font = `${Math.round(s * ui.app.u)}px system-ui, sans-serif`; }
  ui.text(text, x, y, s, { bold: false, color });
}
