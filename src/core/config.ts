// Zentrale Konfiguration – Balancing, Kamera und Bildschirm-Layout.

export const ROOM_W = 13; // Innenbreite eines Raums in Kacheln
export const ROOM_H = 7;  // Innentiefe eines Raums in Kacheln
export const WALL_H = 1.3;
export const NEAR_WALL_H = 0.3;
export const DOOR_X = 6; // obere/untere Tür bei x = 6..7
export const DOOR_Y = 3; // linke/rechte Tür bei y = 3..4

export const CAMERA = { pitchDeg: 56, height: 11 };

export const BASE_STATS = {
  maxHp: 6,          // halbe Herzen
  speed: 4.3,
  damage: 3.5,
  fireDelay: 0.36,
  shotSpeed: 8.5,
  range: 6.5,
  tearSize: 0.13,
  multishot: 1,
  piercing: false,
  homing: false,
};
export type Stats = typeof BASE_STATS;

export const PLAYER_RADIUS = 0.3;
export const INVULN_TIME = 1.0;
export const START_BOMBS = 1;

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
    bomb: { pos: ((w, h) => [w - 198, h - 54]) as Pos, r: 29 },
    item: { pos: ((w, h) => [w - 206, h - 152]) as Pos, r: 31 },
    consumable: { pos: ((w, h) => [w - 104, h - 192]) as Pos, r: 31 },
  },
  inventoryBtn: { pos: ((w, h) => [30, 30]) as Pos, r: 21 },
};

export const MAX_DT = 1 / 30;
