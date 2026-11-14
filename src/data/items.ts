// Alle Items. Arten: Waffe, Rüstung (Kopf/Brust/Beine, mit Sets), passiv,
// aktiv (Abklingzeit läuft nur in Räumen mit Gegnern) und Verbrauch.
// Seltenheiten: gewöhnlich → legendär. Neue Items einfach hier anhängen.
import type { Game } from '../game/game';
import type { Stats } from '../core/config';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_INFO: Record<Rarity, { name: string; color: string; price: number; weight: number }> = {
  common: { name: 'Gewöhnlich', color: '#b8b8c0', price: 12, weight: 50 },
  uncommon: { name: 'Ungewöhnlich', color: '#5ad16a', price: 25, weight: 28 },
  rare: { name: 'Selten', color: '#4a9cff', price: 45, weight: 14 },
  epic: { name: 'Episch', color: '#c060ff', price: 80, weight: 6 },
  legendary: { name: 'Legendär', color: '#ff9a1a', price: 140, weight: 2 },
};

export type ItemKind = 'weapon' | 'armor' | 'passive' | 'active' | 'consumable';
export const KIND_NAME: Record<ItemKind, string> = {
  weapon: 'Waffe', armor: 'Rüstung', passive: 'Passiv', active: 'Aktiv', consumable: 'Verbrauch',
};
export type ArmorSlot = 'head' | 'chest' | 'legs';
export const ARMOR_SLOT_NAME: Record<ArmorSlot, string> = { head: 'Kopf', chest: 'Brust', legs: 'Beine' };

/** Additive Werte; *Mult-Werte sind Prozent-Boni (0.1 = +10 %) */
export interface StatMods {
  damage?: number; damageMult?: number; fireRateMult?: number; speed?: number; range?: number;
  shotSpeed?: number; maxHp?: number; armor?: number; luck?: number; crit?: number; tearSize?: number;
  multishot?: number; piercing?: boolean; homing?: boolean; lifesteal?: number; regen?: number;
  thorns?: number; magnet?: boolean; revive?: number;
}

export type WeaponType = 'orb' | 'shotgun' | 'sniper' | 'boomerang' | 'sword' | 'flame' | 'beam';
export interface WeaponSpec { type: WeaponType; damageMult: number; delayMult: number; rangeMult: number; extraShots?: number }

interface Base { id: string; name: string; desc: string; icon: string; rarity: Rarity }
export interface WeaponItem extends Base { kind: 'weapon'; weapon: WeaponSpec }
export interface ArmorItem extends Base { kind: 'armor'; slot: ArmorSlot; set: string; mods: StatMods }
export interface PassiveItem extends Base { kind: 'passive'; mods: StatMods }
export interface ActiveItem extends Base { kind: 'active'; cooldown: number; use: (g: Game) => void }
export interface ConsumableItem extends Base { kind: 'consumable'; use: (g: Game) => void }
export type ItemDef = WeaponItem | ArmorItem | PassiveItem | ActiveItem | ConsumableItem;

// ---------------- Rüstungs-Sets ----------------
export interface ArmorSet { id: string; name: string; bonus2: StatMods; bonus3: StatMods; desc2: string; desc3: string }
export const SETS: ArmorSet[] = [
  { id: 'leather', name: 'Leder', bonus2: { speed: 0.3 }, bonus3: { armor: 8 }, desc2: '+Tempo', desc3: '+8 % Rüstung' },
  { id: 'iron', name: 'Eisen', bonus2: { armor: 8 }, bonus3: { maxHp: 20, thorns: 4 }, desc2: '+8 % Rüstung', desc3: '+1 Herz, Dornen' },
  { id: 'shadow', name: 'Schatten', bonus2: { damageMult: 0.15 }, bonus3: { crit: 0.15, speed: 0.4 }, desc2: '+15 % Schaden', desc3: '+15 % Krit, +Tempo' },
  { id: 'dragon', name: 'Drachen', bonus2: { maxHp: 20 }, bonus3: { damageMult: 0.25, fireRateMult: 0.1 }, desc2: '+1 Herz', desc3: '+25 % Schaden, +Feuerrate' },
  { id: 'celestial', name: 'Himmels', bonus2: { regen: 0.6 }, bonus3: { damageMult: 0.2, armor: 10, luck: 2 }, desc2: 'Regeneration', desc3: '+Schaden, +Rüstung, +Glück' },
];
export const setById = (id: string) => SETS.find((s) => s.id === id);

const armor = (set: string, setName: string, rarity: Rarity, icons: [string, string, string], vals: [StatMods, StatMods, StatMods]): ArmorItem[] =>
  (['head', 'chest', 'legs'] as ArmorSlot[]).map((slot, i) => ({
    kind: 'armor', id: `${set}_${slot}`, set, slot, rarity, icon: icons[i], mods: vals[i],
    name: `${setName}${['helm', 'harnisch', 'stiefel'][i]}`,
    desc: describeMods(vals[i]),
  }));

export function describeMods(m: StatMods): string {
  const p: string[] = [];
  if (m.armor) p.push(`+${m.armor} % Rüstung`);
  if (m.maxHp) p.push(`+${m.maxHp / 20} Herz`);
  if (m.damage) p.push(`+${m.damage} Schaden`);
  if (m.damageMult) p.push(`+${Math.round(m.damageMult * 100)} % Schaden`);
  if (m.fireRateMult) p.push(`+${Math.round(m.fireRateMult * 100)} % Feuerrate`);
  if (m.speed) p.push(`+${m.speed} Tempo`);
  if (m.range) p.push(`+${m.range} Reichweite`);
  if (m.crit) p.push(`+${Math.round(m.crit * 100)} % Krit`);
  if (m.luck) p.push(`+${m.luck} Glück`);
  if (m.regen) p.push('Regeneration');
  if (m.thorns) p.push('Dornen');
  if (m.lifesteal) p.push('Lebensraub');
  return p.join(', ');
}

export const ITEMS: ItemDef[] = [
  // ---------------- Waffen ----------------
  { kind: 'weapon', id: 'wand', name: 'Kristallstab', rarity: 'common', icon: '🪄', desc: 'Schießt Energiekugeln.', weapon: { type: 'orb', damageMult: 1, delayMult: 1, rangeMult: 1 } },
  { kind: 'weapon', id: 'rustysword', name: 'Rostiges Schwert', rarity: 'common', icon: '🗡️', desc: 'Nahkampf-Schlag, zerstört Geschosse.', weapon: { type: 'sword', damageMult: 2.2, delayMult: 1.2, rangeMult: 1 } },
  { kind: 'weapon', id: 'scatter', name: 'Streuer', rarity: 'uncommon', icon: '🔫', desc: 'Viele Kugeln auf kurze Distanz.', weapon: { type: 'shotgun', damageMult: 0.6, delayMult: 1.7, rangeMult: 0.55 } },
  { kind: 'weapon', id: 'boomerang', name: 'Bumerang', rarity: 'uncommon', icon: '🪃', desc: 'Kehrt zurück und durchdringt Gegner.', weapon: { type: 'boomerang', damageMult: 1.3, delayMult: 1.5, rangeMult: 0.9 } },
  { kind: 'weapon', id: 'twinwand', name: 'Zwillingsstab', rarity: 'rare', icon: '✨', desc: 'Zwei Kugeln pro Schuss.', weapon: { type: 'orb', damageMult: 0.9, delayMult: 1, rangeMult: 1, extraShots: 1 } },
  { kind: 'weapon', id: 'crossbow', name: 'Armbrust', rarity: 'rare', icon: '🏹', desc: 'Langsam, stark, durchdringend.', weapon: { type: 'sniper', damageMult: 2.8, delayMult: 2.2, rangeMult: 1.7 } },
  { kind: 'weapon', id: 'runeblade', name: 'Runenklinge', rarity: 'epic', icon: '⚔️', desc: 'Großer, starker Schwertschlag.', weapon: { type: 'sword', damageMult: 3.4, delayMult: 1.1, rangeMult: 1.3 } },
  { kind: 'weapon', id: 'dragonbreath', name: 'Drachenatem', rarity: 'epic', icon: '🐉', desc: 'Flammenstrahl auf kurze Distanz.', weapon: { type: 'flame', damageMult: 0.4, delayMult: 0.22, rangeMult: 0.45 } },
  { kind: 'weapon', id: 'starlaser', name: 'Sternenlaser', rarity: 'legendary', icon: '🌟', desc: 'Sofortiger Laserstrahl durch alles.', weapon: { type: 'beam', damageMult: 1.1, delayMult: 0.6, rangeMult: 1.4 } },

  // ---------------- Rüstung ----------------
  ...armor('leather', 'Leder', 'common', ['🎩', '🧥', '👢'], [{ armor: 4 }, { armor: 6, maxHp: 20 }, { armor: 4, speed: 0.2 }]),
  ...armor('iron', 'Eisen', 'uncommon', ['⛑️', '🛡️', '🥾'], [{ armor: 7 }, { armor: 10, maxHp: 20 }, { armor: 7 }]),
  ...armor('shadow', 'Schatten', 'rare', ['🥷', '🦇', '👟'], [{ armor: 5, crit: 0.05 }, { armor: 7, damageMult: 0.1 }, { armor: 5, speed: 0.4 }]),
  ...armor('dragon', 'Drachen', 'epic', ['🐲', '🔥', '🦎'], [{ armor: 10, damage: 0.5 }, { armor: 14, maxHp: 20 }, { armor: 10, fireRateMult: 0.08 }]),
  ...armor('celestial', 'Himmels', 'legendary', ['👑', '🌙', '☁️'], [{ armor: 12, luck: 1 }, { armor: 16, maxHp: 40 }, { armor: 12, speed: 0.4, range: 1 }]),

  // ---------------- Passiv ----------------
  { kind: 'passive', id: 'shard', name: 'Glassplitter', rarity: 'common', icon: '🔪', desc: '+0.6 Schaden', mods: { damage: 0.6 } },
  { kind: 'passive', id: 'boots', name: 'Federschuhe', rarity: 'common', icon: '🪶', desc: '+Tempo', mods: { speed: 0.4 } },
  { kind: 'passive', id: 'scope', name: 'Fernrohr', rarity: 'common', icon: '🔭', desc: '+Reichweite, +Schussgeschwindigkeit', mods: { range: 1.5, shotSpeed: 1 } },
  { kind: 'passive', id: 'magnet', name: 'Hufeisenmagnet', rarity: 'common', icon: '🧲', desc: 'Münzen fliegen zu dir', mods: { magnet: true } },
  { kind: 'passive', id: 'quick', name: 'Flinke Finger', rarity: 'uncommon', icon: '⚡', desc: '+15 % Feuerrate', mods: { fireRateMult: 0.15 } },
  { kind: 'passive', id: 'stoneheart', name: 'Steinherz', rarity: 'uncommon', icon: '❤️', desc: '+1 Herz', mods: { maxHp: 20 } },
  { kind: 'passive', id: 'bigtears', name: 'Dicke Tropfen', rarity: 'uncommon', icon: '💧', desc: 'Größere Schüsse, +Schaden', mods: { tearSize: 0.05, damage: 0.5 } },
  { kind: 'passive', id: 'clover', name: 'Glücksklee', rarity: 'uncommon', icon: '🍀', desc: '+2 Glück (bessere Items, mehr Drops)', mods: { luck: 2 } },
  { kind: 'passive', id: 'thornmail', name: 'Dornenpanzer', rarity: 'uncommon', icon: '🌵', desc: 'Gegner, die dich berühren, nehmen Schaden', mods: { thorns: 8, armor: 3 } },
  { kind: 'passive', id: 'trident', name: 'Dreizack', rarity: 'rare', icon: '🔱', desc: '+2 Schüsse, etwas langsamer', mods: { multishot: 2, fireRateMult: -0.15 } },
  { kind: 'passive', id: 'ghost', name: 'Geisterschuss', rarity: 'rare', icon: '👻', desc: 'Schüsse durchdringen Gegner', mods: { piercing: true } },
  { kind: 'passive', id: 'eye', name: 'Suchauge', rarity: 'rare', icon: '👁️', desc: 'Zielsuchende Schüsse', mods: { homing: true } },
  { kind: 'passive', id: 'critlens', name: 'Kritischer Blick', rarity: 'rare', icon: '🎯', desc: '+15 % Krit-Chance (doppelter Schaden)', mods: { crit: 0.15 } },
  { kind: 'passive', id: 'vampire', name: 'Vampirzahn', rarity: 'epic', icon: '🧛', desc: 'Heilt 2 LP pro besiegtem Gegner', mods: { lifesteal: 2 } },
  { kind: 'passive', id: 'regenring', name: 'Lebensring', rarity: 'epic', icon: '💍', desc: 'Regeneriert LP im Kampf', mods: { regen: 0.8 } },
  { kind: 'passive', id: 'twinsoul', name: 'Zwillingsseele', rarity: 'legendary', icon: '♊', desc: '+1 Schuss, +25 % Schaden', mods: { multishot: 1, damageMult: 0.25 } },
  { kind: 'passive', id: 'phoenix', name: 'Phönixfeder', rarity: 'legendary', icon: '🌅', desc: 'Einmal wiederbeleben pro Run', mods: { revive: 1 } },

  // ---------------- Aktiv ----------------
  { kind: 'active', id: 'crystalring', name: 'Kristallring', rarity: 'common', icon: '💠', desc: 'Ring aus 12 Schüssen', cooldown: 12, use: (g) => g.radialPlayerShots(12) },
  { kind: 'active', id: 'healhand', name: 'Heilende Hand', rarity: 'uncommon', icon: '🤲', desc: 'Heilt 2 Herzen', cooldown: 30, use: (g) => g.healPlayer(40) },
  { kind: 'active', id: 'thunder', name: 'Donnerkeil', rarity: 'uncommon', icon: '🌩️', desc: 'Trifft alle Gegner im Raum', cooldown: 18, use: (g) => g.damageAllEnemies(30) },
  { kind: 'active', id: 'phase', name: 'Phasenumhang', rarity: 'rare', icon: '🧥', desc: '3 s unverwundbar und schneller', cooldown: 20, use: (g) => { g.player.buffs.shield = 3; g.player.buffs.haste = 3; } },
  { kind: 'active', id: 'bombrain', name: 'Bombenhagel', rarity: 'rare', icon: '☄️', desc: 'Bomben regnen auf Gegner', cooldown: 22, use: (g) => g.bombRain(5) },
  { kind: 'active', id: 'timesand', name: 'Zeitsand', rarity: 'epic', icon: '⌛', desc: 'Gegner 5 s verlangsamt', cooldown: 25, use: (g) => { g.slowTime = 5; } },
  { kind: 'active', id: 'starfall', name: 'Sternschnuppe', rarity: 'legendary', icon: '💫', desc: 'Riesiger Schaden an allen Gegnern', cooldown: 35, use: (g) => { g.damageAllEnemies(90); g.radialPlayerShots(20); } },

  // ---------------- Verbrauch ----------------
  { kind: 'consumable', id: 'potion', name: 'Heiltrank', rarity: 'common', icon: '🧪', desc: 'Heilt 2 Herzen', use: (g) => g.healPlayer(40) },
  { kind: 'consumable', id: 'bombitem', name: 'Bombe', rarity: 'common', icon: '💣', desc: 'Legt eine Bombe (zerstört Felsen)', use: (g) => g.placeBomb(g.player.x, g.player.y + 0.05) },
  { kind: 'consumable', id: 'rage', name: 'Wuttrank', rarity: 'uncommon', icon: '🔥', desc: 'Doppelter Schaden für 8 s', use: (g) => { g.player.buffs.rage = 8; } },
  { kind: 'consumable', id: 'shieldscroll', name: 'Schildrolle', rarity: 'uncommon', icon: '📜', desc: '5 s unverwundbar', use: (g) => { g.player.buffs.shield = 5; } },
  { kind: 'consumable', id: 'hourglass', name: 'Sanduhr', rarity: 'rare', icon: '⏳', desc: 'Gegner 6 s verlangsamt', use: (g) => { g.slowTime = 6; } },
  { kind: 'consumable', id: 'elixir', name: 'Großes Elixier', rarity: 'epic', icon: '⚗️', desc: 'Volle Heilung', use: (g) => g.healPlayer(9999) },
];

export const itemById = (id: string | null | undefined) => (id ? ITEMS.find((i) => i.id === id) : undefined);
export const itemsOfKind = <K extends ItemKind>(k: K) => ITEMS.filter((i) => i.kind === k) as Extract<ItemDef, { kind: K }>[];

/** Zufällige Seltenheit; Glück und Runde verschieben die Gewichte Richtung selten */
export function rollRarity(rng: () => number, luck: number, depth: number): Rarity {
  const bonus = luck * 0.6 + depth * 0.25;
  const weights = RARITIES.map((r, i) => RARITY_INFO[r].weight * (i === 0 ? Math.max(0.3, 1 - bonus * 0.04) : 1 + bonus * 0.08 * i));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < RARITIES.length; i++) if ((roll -= weights[i]) <= 0) return RARITIES[i];
  return 'common';
}

export function randomItem(rng: () => number, luck: number, depth: number, kinds?: ItemKind[], exclude: string[] = []): ItemDef {
  const rarity = rollRarity(rng, luck, depth);
  let pool = ITEMS.filter((i) => i.rarity === rarity && (!kinds || kinds.includes(i.kind)) && !exclude.includes(i.id));
  if (!pool.length) pool = ITEMS.filter((i) => (!kinds || kinds.includes(i.kind)));
  return pool[Math.floor(rng() * pool.length)];
}

export const TRADE_AMOUNT = 100;
export function nextRarity(r: Rarity): Rarity | null {
  const i = RARITIES.indexOf(r);
  return i < RARITIES.length - 1 ? RARITIES[i + 1] : null;
}

export function applyMods(s: Stats, m: StatMods, mult = 1) {
  if (m.damage) s.damage += m.damage * mult;
  if (m.speed) s.speed += m.speed * mult;
  if (m.range) s.range += m.range * mult;
  if (m.shotSpeed) s.shotSpeed += m.shotSpeed * mult;
  if (m.maxHp) s.maxHp += m.maxHp * mult;
  if (m.armor) s.armor += m.armor * mult;
  if (m.luck) s.luck += m.luck * mult;
  if (m.crit) s.crit += m.crit * mult;
  if (m.tearSize) s.tearSize += m.tearSize * mult;
  if (m.multishot) s.multishot += m.multishot;
  if (m.piercing) s.piercing = true;
  if (m.homing) s.homing = true;
  if (m.lifesteal) s.lifesteal += m.lifesteal * mult;
  if (m.regen) s.regen += m.regen * mult;
  if (m.thorns) s.thorns += m.thorns * mult;
  if (m.magnet) s.magnet = true;
  if (m.revive) s.revive += m.revive;
}
