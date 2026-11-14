// Inventar während eines Runs: 1 Waffe, 3 Rüstungsteile, 1 aktives Item,
// 5 Verbrauch, 10 Passiv, 5 Rucksack (nicht ausgerüstete Waffen/Rüstung/Aktive).
import { BASE_STATS, Stats } from '../core/config';
import type { Loadout } from '../core/save';
import {
  ActiveItem, applyMods, ArmorItem, ArmorSlot, ConsumableItem, ItemDef, itemById, PassiveItem, SETS, StatMods, WeaponItem,
} from '../data/items';

export const SLOTS = { consumables: 5, passives: 10, backpack: 5 };

export type ItemRef =
  | { area: 'weapon' } | { area: 'active' } | { area: 'armor'; key: ArmorSlot }
  | { area: 'consumables'; key: number } | { area: 'passives'; key: number } | { area: 'backpack'; key: number };

export type AddResult = 'equipped' | 'backpack' | 'added' | 'full';

export class RunInventory {
  weapon: WeaponItem | null = null;
  armor: Record<ArmorSlot, ArmorItem | null> = { head: null, chest: null, legs: null };
  active: ActiveItem | null = null;
  activeCd = 0; // verbleibende Abklingzeit (s)
  consumables: (ConsumableItem | null)[] = new Array(SLOTS.consumables).fill(null);
  selConsumable = 0;
  passives: PassiveItem[] = [];
  backpack: (ItemDef | null)[] = new Array(SLOTS.backpack).fill(null);
  boosts: StatMods[] = []; // vom Altar

  static fromLoadout(l: Loadout): RunInventory {
    const inv = new RunInventory();
    const w = itemById(l.weapon); if (w?.kind === 'weapon') inv.weapon = w;
    for (const s of ['head', 'chest', 'legs'] as ArmorSlot[]) { const a = itemById(l.armor[s]); if (a?.kind === 'armor') inv.armor[s] = a; }
    const a = itemById(l.active); if (a?.kind === 'active') inv.active = a;
    l.consumables.forEach((id, i) => { const c = itemById(id); if (c?.kind === 'consumable') inv.consumables[i] = c; });
    for (const id of l.passives) { const p = itemById(id); if (p?.kind === 'passive' && inv.passives.length < SLOTS.passives) inv.passives.push(p); }
    l.backpack.forEach((id, i) => { const b = itemById(id); if (b) inv.backpack[i] = b; });
    return inv;
  }

  /** Alle Item-IDs (für Lager beim Verlassen der Welt) */
  allIds(): string[] {
    const ids: string[] = [];
    const push = (i: ItemDef | null | undefined) => { if (i) ids.push(i.id); };
    push(this.weapon); Object.values(this.armor).forEach(push); push(this.active);
    this.consumables.forEach(push); this.passives.forEach(push); this.backpack.forEach(push);
    return ids;
  }

  has(id: string) { return this.allIds().includes(id); }

  /** Item aufnehmen – wählt automatisch den passenden Platz */
  add(item: ItemDef): AddResult {
    const free = this.backpack.indexOf(null);
    switch (item.kind) {
      case 'weapon':
        if (!this.weapon) { this.weapon = item; return 'equipped'; }
        break;
      case 'armor':
        if (!this.armor[item.slot]) { this.armor[item.slot] = item; return 'equipped'; }
        break;
      case 'active':
        if (!this.active) { this.active = item; this.activeCd = 0; return 'equipped'; }
        break;
      case 'passive':
        if (this.passives.length < SLOTS.passives) { this.passives.push(item); return 'added'; }
        return 'full';
      case 'consumable': {
        const i = this.consumables.indexOf(null);
        if (i >= 0) { this.consumables[i] = item; return 'added'; }
        return 'full';
      }
    }
    if (free >= 0) { this.backpack[free] = item; return 'backpack'; }
    return 'full';
  }

  /** Rucksack-Item ausrüsten (tauscht mit dem ausgerüsteten) */
  equipFromBackpack(i: number) {
    const it = this.backpack[i];
    if (!it) return;
    let old: ItemDef | null = null;
    if (it.kind === 'weapon') { old = this.weapon; this.weapon = it; }
    else if (it.kind === 'armor') { old = this.armor[it.slot]; this.armor[it.slot] = it; }
    else if (it.kind === 'active') { old = this.active; this.active = it; this.activeCd = it.cooldown * 0.5; }
    else return;
    this.backpack[i] = old;
  }

  /** Ausgerüstetes Teil in den Rucksack legen */
  unequip(slot: 'weapon' | 'active' | ArmorSlot): boolean {
    const free = this.backpack.indexOf(null);
    if (free < 0) return false;
    if (slot === 'weapon') { this.backpack[free] = this.weapon; this.weapon = null; }
    else if (slot === 'active') { this.backpack[free] = this.active; this.active = null; }
    else { this.backpack[free] = this.armor[slot]; this.armor[slot] = null; }
    return true;
  }

  get(ref: ItemRef): ItemDef | null {
    switch (ref.area) {
      case 'weapon': return this.weapon;
      case 'active': return this.active;
      case 'armor': return this.armor[ref.key];
      case 'consumables': return this.consumables[ref.key];
      case 'passives': return this.passives[ref.key] ?? null;
      case 'backpack': return this.backpack[ref.key];
    }
  }

  remove(ref: ItemRef): ItemDef | null {
    const it = this.get(ref);
    switch (ref.area) {
      case 'weapon': this.weapon = null; break;
      case 'active': this.active = null; break;
      case 'armor': this.armor[ref.key] = null; break;
      case 'consumables': this.consumables[ref.key] = null; break;
      case 'passives': this.passives.splice(ref.key, 1); break;
      case 'backpack': this.backpack[ref.key] = null; break;
    }
    return it;
  }

  nextConsumable() {
    for (let k = 1; k <= SLOTS.consumables; k++) {
      const i = (this.selConsumable + k) % SLOTS.consumables;
      if (this.consumables[i]) { this.selConsumable = i; return; }
    }
  }

  currentConsumable(): ConsumableItem | null {
    if (!this.consumables[this.selConsumable]) this.nextConsumable();
    return this.consumables[this.selConsumable];
  }

  /** Aktive Set-Boni: [Set-Name, Anzahl Teile] */
  setCounts(): Record<string, number> {
    const c: Record<string, number> = {};
    for (const a of Object.values(this.armor)) if (a) c[a.set] = (c[a.set] || 0) + 1;
    return c;
  }

  /** Endwerte berechnen: Charakter + Rüstung + Sets + Passive + Altar-Boni */
  computeStats(charMods: Partial<Stats>): Stats {
    const s: Stats = { ...BASE_STATS, ...charMods };
    let dmgMult = 0, rateMult = 0;
    const take = (m: StatMods) => { applyMods(s, m); dmgMult += m.damageMult || 0; rateMult += m.fireRateMult || 0; };
    for (const a of Object.values(this.armor)) if (a) take(a.mods);
    const counts = this.setCounts();
    for (const set of SETS) {
      const n = counts[set.id] || 0;
      if (n >= 2) take(set.bonus2);
      if (n >= 3) take(set.bonus3);
    }
    for (const p of this.passives) take(p.mods);
    for (const b of this.boosts) take(b);
    s.damage *= 1 + dmgMult;
    s.fireDelay /= Math.max(0.3, 1 + rateMult);
    s.armor = Math.min(75, s.armor);
    s.crit = Math.min(0.75, s.crit);
    s.speed = Math.min(7.5, s.speed);
    s.tearSize = Math.min(0.3, s.tearSize);
    return s;
  }
}
