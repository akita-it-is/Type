// Zentrale Konfiguration – hier lassen sich Balancing, Kamera und Steuerung anpassen.

export const ROOM_W = 13; // Innenbreite eines Raums in Kacheln
export const ROOM_H = 7;  // Innentiefe eines Raums in Kacheln
export const WALL_H = 1.3;      // Höhe der hinteren/seitlichen Wände
export const NEAR_WALL_H = 0.3; // Höhe der vorderen (zur Kamera zeigenden) Wand

// Türpositionen (Kachel-Koordinaten der Öffnung)
export const DOOR_X = 6; // obere/untere Tür bei x = 6..7
export const DOOR_Y = 3; // linke/rechte Tür bei y = 3..4

export const CAMERA = {
  pitchDeg: 56, // Neigung der Kamera (90 = genau von oben)
  height: 11,   // Höhe der Kamera über dem Boden (kleiner = stärkere Perspektive)
};

export const PLAYER = {
  radius: 0.3,
  speed: 4.3,
  maxHp: 6,          // in halben Herzen
  damage: 3.5,
  fireDelay: 0.36,   // Sekunden zwischen Schüssen
  shotSpeed: 8.5,
  range: 6.5,        // Kacheln
  tearSize: 0.13,
  bombs: 1,
  dashSpeed: 15,
  dashTime: 0.14,
  dashCooldown: 1.0,
  invulnTime: 1.0,
};

export const BOMB = {
  fuse: 1.4,
  radius: 1.7,
  damage: 40,
};

// Steuerung (Positionen in CSS-Pixeln relativ zur Bildschirmgröße)
export const CONTROLS = {
  stickRadius: 56,
  deadzone: 0.15,
  aimThreshold: 0.35,
  buttonRadius: 36,
  // Funktionen liefern die Position abhängig von Breite/Höhe des Bildschirms
  buttons: [
    { id: 'bomb', pos: (w, h) => [w - 64, h * 0.30 + 10] },
    { id: 'dash', pos: (w, h) => [w - 150, h * 0.22 + 10] },
  ],
  pause: { pos: (w, h) => [w / 2, 26], r: 20 },
};

export const COLORS = {
  bg: '#08070c',
  floorA: '#3b2f2a',
  floorB: '#362b26',
  floorLine: 'rgba(0,0,0,0.18)',
  wallFace: '#4d3f38',
  wallFaceDark: '#3a2f2a',
  wallTop: '#5f4f46',
  rockTop: '#7a6d66',
  rockFront: '#5a4e48',
  rockSide: '#4b403b',
  player: '#f1d6c4',
  playerCloak: '#5d7ec9',
  tear: '#8fd8ff',
  enemyShot: '#ff5a4a',
  ui: '#f4ead8',
};

export const DEBUG = false;
