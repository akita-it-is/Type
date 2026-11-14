import { CAMERA, ROOM_W, ROOM_H, WALL_H } from './config.js';

// Perspektivische Kamera: Welt (x = rechts, y = nach vorne/zur Kamera, z = hoch)
// wird auf den Bildschirm projiziert. Daraus entsteht die 2.5D-Ansicht.
export class Camera {
  constructor() {
    const p = (CAMERA.pitchDeg * Math.PI) / 180;
    this.sp = Math.sin(p);
    this.cp = Math.cos(p);
    this.cx = ROOM_W / 2;
    this.cz = CAMERA.height;
    this.cy = ROOM_H / 2 + CAMERA.height / Math.tan(p);
    this.k = 1;
    this.ox = 0;
    this.oy = 0;
    this.shake = 0;
    this.sx = 0;
    this.sy = 0;
  }

  raw(x, y, z) {
    const dx = x - this.cx, dy = y - this.cy, dz = z - this.cz;
    const Y = -this.sp * dy + this.cp * dz;
    const Z = -this.cp * dy - this.sp * dz;
    return [dx / Z, -Y / Z, 1 / Z];
  }

  // Liefert [screenX, screenY, pixelProWelteinheit]
  project(x, y, z = 0) {
    const r = this.raw(x, y, z);
    return [this.ox + this.sx + r[0] * this.k, this.oy + this.sy + r[1] * this.k, r[2] * this.k];
  }

  fit(w, h, margin = { top: 8, bottom: 8, side: 8 }) {
    const pts = [
      [-1, -1, WALL_H], [ROOM_W + 1, -1, WALL_H],
      [-1, ROOM_H + 1, 0], [ROOM_W + 1, ROOM_H + 1, 0],
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      const r = this.raw(...p);
      minX = Math.min(minX, r[0]); maxX = Math.max(maxX, r[0]);
      minY = Math.min(minY, r[1]); maxY = Math.max(maxY, r[1]);
    }
    const aw = w - margin.side * 2, ah = h - margin.top - margin.bottom;
    this.k = Math.min(aw / (maxX - minX), ah / (maxY - minY));
    this.ox = margin.side + (aw - (maxX - minX) * this.k) / 2 - minX * this.k;
    this.oy = margin.top + (ah - (maxY - minY) * this.k) / 2 - minY * this.k;
  }

  addShake(amount) { this.shake = Math.max(this.shake, amount); }

  update(dt) {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 30);
      this.sx = (Math.random() * 2 - 1) * this.shake;
      this.sy = (Math.random() * 2 - 1) * this.shake;
    } else { this.sx = this.sy = 0; }
  }
}
