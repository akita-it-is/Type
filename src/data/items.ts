// Items: passiv (Werte-Boni), aktiv ("Item"-Knopf, lädt sich durch Räume auf)
// und Verbrauchsgegenstände ("Verbrauch"-Knopf, einmalig).
import type { Game } from '../game/game';
import type { Stats } from '../core/config';

interface Base { id: string; name: string; desc: string; icon: string; color: string }
export interface PassiveItem extends Base { kind: 'passive'; apply: (s: Stats, g: Game) => void }
export interface ActiveItem extends Base { kind: 'active'; charges: number; use: (g: Game) => void }
export interface ConsumableItem extends Base { kind: 'consumable'; use: (g: Game) => void }
export type ItemDef = PassiveItem | ActiveItem | ConsumableItem;

export const ITEMS: ItemDef[] = [
  // --- Passiv ---
  { kind: 'passive', id: 'shard', name: 'Glassplitter', desc: 'Schaden +', icon: '🗡️', color: '#9cf',
    apply: (s) => { s.damage += 1.2; } },
  { kind: 'passive', id: 'quick', name: 'Flinke Finger', desc: 'Feuerrate +', icon: '⚡', color: '#ff6',
    apply: (s) => { s.fireDelay *= 0.78; } },
  { kind: 'passive', id: 'boots', name: 'Federschuhe', desc: 'Tempo +', icon: '👟', color: '#6f6',
    apply: (s) => { s.speed += 0.7; } },
  { kind: 'passive', id: 'stoneheart', name: 'Steinherz', desc: '+1 Herzcontainer', icon: '❤️', color: '#f66',
    apply: (s, g) => { s.maxHp += 2; g.player.hp += 2; } },
  { kind: 'passive', id: 'scope', name: 'Fernrohr', desc: 'Reichweite +', icon: '🔭', color: '#fc6',
    apply: (s) => { s.range += 2.2; s.shotSpeed += 1; } },
  { kind: 'passive', id: 'trident', name: 'Dreizack', desc: 'Dreifachschuss', icon: '🔱', color: '#6cf',
    apply: (s) => { s.multishot = Math.max(s.multishot, 3); s.fireDelay *= 1.2; } },
  { kind: 'passive', id: 'bigtears', name: 'Dicke Tropfen', desc: 'Größere Schüsse, Schaden +', icon: '💧', color: '#69f',
    apply: (s) => { s.tearSize *= 1.4; s.damage += 0.7; } },
  { kind: 'passive', id: 'ghost', name: 'Geisterschuss', desc: 'Schüsse durchdringen Gegner', icon: '👻', color: '#ddf',
    apply: (s) => { s.piercing = true; } },
  { kind: 'passive', id: 'eye', name: 'Suchauge', desc: 'Zielsuchende Schüsse', icon: '👁️', color: '#c9f',
    apply: (s) => { s.homing = true; } },
  { kind: 'passive', id: 'powder', name: 'Pulverfass', desc: '+5 Bomben', icon: '🛢️', color: '#c96',
    apply: (_s, g) => { g.player.bombs += 5; } },

  // --- Aktiv ---
  { kind: 'active', id: 'crystalring', name: 'Kristallring', desc: 'Feuert einen Ring aus 12 Schüssen', icon: '💍', color: '#8ff', charges: 2,
    use: (g) => g.radialPlayerShots(12) },
  { kind: 'active', id: 'thunder', name: 'Donnerkeil', desc: 'Trifft alle Gegner im Raum', icon: '🌩️', color: '#ff8', charges: 4,
    use: (g) => g.damageAllEnemies(25) },
  { kind: 'active', id: 'phase', name: 'Phasenumhang', desc: '4 s unverwundbar und schneller', icon: '🧥', color: '#aaf', charges: 3,
    use: (g) => { g.player.buffs.shield = 4; g.player.buffs.haste = 4; } },

  // --- Verbrauch ---
  { kind: 'consumable', id: 'potion', name: 'Heiltrank', desc: 'Heilt 2 Herzen', icon: '🧪', color: '#f88',
    use: (g) => g.healPlayer(4) },
  { kind: 'consumable', id: 'rage', name: 'Wuttrank', desc: 'Doppelter Schaden für 8 s', icon: '🔥', color: '#f84',
    use: (g) => { g.player.buffs.rage = 8; } },
  { kind: 'consumable', id: 'hourglass', name: 'Sanduhr', desc: 'Gegner 6 s verlangsamt', icon: '⏳', color: '#fd8',
    use: (g) => { g.slowTime = 6; } },
  { kind: 'consumable', id: 'shieldscroll', name: 'Schildrolle', desc: '5 s unverwundbar', icon: '🛡️', color: '#8cf',
    use: (g) => { g.player.buffs.shield = 5; } },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const itemsOfKind = <K extends ItemDef['kind']>(k: K) =>
  ITEMS.filter((i) => i.kind === k) as Extract<ItemDef, { kind: K }>[];
