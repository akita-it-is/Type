// Zentrale Konfiguration – Balancing, Kamera und Bildschirm-Layout.

// Raumgrößen sind variabel (siehe dungeon.ts); Standardraum = 13 x 7
export const ROOM_W = 13;
export const ROOM_H = 7;
export const WALL_H = 1.3;
export const NEAR_WALL_H = 0.3;

export const CAMERA = { pitchDeg: 56, height: 11 };

// HP: 1 Herz = 20 Lebenspunkte
export const HP_PER_HEART = 20;

export const BASE_STATS = {
  maxHp: 60,
  speed: 4.3,
  damage: 3.5,
  fireDelay: 0.36,   // Sekunden zwischen Schüssen
  shotSpeed: 8.5,
  range: 6.5,
  tearSize: 0.13,
  multishot: 1,
  piercing: false,
  homing: false,
  armor: 0,          // Schadensreduktion in % (max 75)
  luck: 0,           // bessere Seltenheiten / mehr Drops
  crit: 0,           // Chance auf doppelten Schaden (0..1)
  lifesteal: 0,      // HP pro Kill
  regen: 0,          // HP pro Sekunde im Kampf
  thorns: 0,         // Schaden an Gegnern, die dich berühren
  magnet: false,     // Münzen fliegen zu dir
  revive: 0,         // Wiederbelebungen
};
export type Stats = typeof BASE_STATS;

export const PLAYER_RADIUS = 0.3;
export const INVULN_TIME = 0.8;

// Run-Regeln
export const ROUNDS_PER_WORLD = 20;
export const MAX_PRESTIGE = 10;
/** true = bei Tod geht auch die mitgebrachte Ausrüstung verloren */
export const DEATH_LOSES_LOADOUT = false;

export const BOMB = { fuse: 1.4, radius: 1.7, damage: 40 };

type Pos = (w: number, h: number) => [number, number];

// Bildschirm-Layout der Touch-Steuerung (CSS-Pixel)
export const LAYOUT = {
  stickRadius: 54,
  deadzone: 0.15,
  aimThreshold: 0.3,
  moveStick: ((w, h) => [92, h - 88]) as Pos,
  aimStick: ((w, h) => [w - 92, h - 88]) as Pos,
  buttons: {
    ability: { pos: ((w, h) => [w - 198, h - 54]) as Pos, r: 30 },
    item: { pos: ((w, h) => [w - 206, h - 152]) as Pos, r: 31 },
    consumable: { pos: ((w, h) => [w - 104, h - 192]) as Pos, r: 31 },
    cycle: { pos: ((w, h) => [w - 56, h - 222]) as Pos, r: 15 },
  },
  inventoryBtn: { pos: ((w, h) => [30, 30]) as Pos, r: 21 },
};

export const MAX_DT = 1 / 30;
