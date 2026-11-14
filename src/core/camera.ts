import { CAMERA, ROOM_W, ROOM_H, WALL_H } from './config';

// Perspektivische Kamera: Welt (x = rechts, y = zur Kamera hin, z = hoch)
// wird auf den Bildschirm projiziert -> 2.5D-Ansicht.
export class Camera {
  sp: number; cp: number;
  cx = 0; cy = 0; cz = 0;
  k = 1; ox = 0; oy = 0;
  shake = 0; sx = 0; sy = 0;
  rw = ROOM_W; rh = ROOM_H;
  private vw = 0; private vh = 0; private margins = [0, 0, 0];

  constructor() {
    const p = (CAMERA.pitchDeg * Math.PI) / 180;
    this.sp = Math.sin(p);
    this.cp = Math.cos(p);
    this.setRoom(ROOM_W, ROOM_H);
  }

  /** Kamera auf einen Raum der Größe w x h ausrichten */
  setRoom(w: number, h: number) {
    this.rw = w; this.rh = h;
    const scale = Math.max(w / ROOM_W, h / ROOM_H);
    const height = CAMERA.height * scale;
    this.cx = w / 2;
    this.cz = height;
    this.cy = h / 2 + height / Math.tan(Math.asin(this.sp));
    if (this.vw) this.fit(this.vw, this.vh, this.margins[0], this.margins[1], this.margins[2]);
  }

  raw(x: number, y: number, z: number): [number, number, number] {
    const dx = x - this.cx, dy = y - this.cy, dz = z - this.cz;
    const Y = -this.sp * dy + this.cp * dz;
    const Z = -this.cp * dy - this.sp * dz;
    return [dx / Z, -Y / Z, 1 / Z];
  }

  /** Liefert [screenX, screenY, Pixel pro Welteinheit an diesem Punkt] */
  project(x: number, y: number, z = 0): [number, number, number] {
    const r = this.raw(x, y, z);
    return [this.ox + this.sx + r[0] * this.k, this.oy + this.sy + r[1] * this.k, r[2] * this.k];
  }

  fit(w: number, h: number, top: number, bottom: number, side: number) {
    this.vw = w; this.vh = h; this.margins = [top, bottom, side];
    const pts: [number, number, number][] = [
      [-1, -1, WALL_H], [this.rw + 1, -1, WALL_H],
      [-1, this.rh + 1, 0], [this.rw + 1, this.rh + 1, 0],
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      const r = this.raw(p[0], p[1], p[2]);
      minX = Math.min(minX, r[0]); maxX = Math.max(maxX, r[0]);
      minY = Math.min(minY, r[1]); maxY = Math.max(maxY, r[1]);
    }
    const aw = w - side * 2, ah = h - top - bottom;
    this.k = Math.min(aw / (maxX - minX), ah / (maxY - minY));
    this.ox = side + (aw - (maxX - minX) * this.k) / 2 - minX * this.k;
    this.oy = top + (ah - (maxY - minY) * this.k) / 2 - minY * this.k;
  }

  addShake(a: number) { this.shake = Math.max(this.shake, a); }

  update(dt: number, enabled = true) {
    if (this.shake > 0 && enabled) {
      this.shake = Math.max(0, this.shake - dt * 30);
      this.sx = (Math.random() * 2 - 1) * this.shake;
      this.sy = (Math.random() * 2 - 1) * this.shake;
    } else { this.shake = 0; this.sx = this.sy = 0; }
  }
}
