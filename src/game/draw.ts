// Zeichen-Hilfen für die 2.5D-Darstellung. PROVISORISCHE Grafik aus Formen –
// später durch Sprites/Modelle ersetzbar (gleiche Aufrufstellen).
import type { Camera } from '../core/camera';

export type V3 = [number, number, number];

export function poly(ctx: CanvasRenderingContext2D, cam: Camera, pts: V3[], fill: string, stroke?: string) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = cam.project(pts[i][0], pts[i][1], pts[i][2]);
    if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

export interface BoxColors { top: string; front: string; side: string; outline?: string }

/** Quader von (x0,y0) bis (x1,y1), Höhe h – zeichnet nur sichtbare Seiten. */
export function box(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, y0: number, x1: number, y1: number, h: number, c: BoxColors, z0 = 0) {
  const z1 = z0 + h;
  poly(ctx, cam, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c.front, c.outline);
  if (cam.cx < x0) poly(ctx, cam, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], c.side, c.outline);
  if (cam.cx > x1) poly(ctx, cam, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], c.side, c.outline);
  poly(ctx, cam, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c.top, c.outline);
}

export function shadow(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, r: number, alpha = 0.35) {
  const [sx, sy, s] = cam.project(x, y, 0);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, r * s, r * s * cam.sp * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function ball(ctx: CanvasRenderingContext2D, sx: number, sy: number, rad: number, color: string, hi = 'rgba(255,255,255,0.45)') {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hi;
  ctx.beginPath(); ctx.arc(sx - rad * 0.35, sy - rad * 0.35, rad * 0.35, 0, Math.PI * 2); ctx.fill();
}

export function shade(hex: string, f: number): string {
  // f < 0 dunkler, f > 0 heller
  const n = parseInt(hex.slice(1).padEnd(6, '0').slice(0, 6), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

export interface HeroLook { cloak: string; skin: string; hat: 'hood' | 'cap' | 'horns' | 'crown' | 'none' }

/**
 * Spielfigur zeichnen. (x,y) = Fußpunkt auf dem Bildschirm, s = Pixel pro Welteinheit.
 */
export function drawHero(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, look: HeroLook,
  o: { faceX?: number; faceY?: number; walk?: number; flash?: boolean; alpha?: number } = {}) {
  const fx = o.faceX ?? 0, fy = o.faceY ?? 1;
  const bob = Math.sin((o.walk ?? 0) * 12) * 0.03 * s;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  const cloak = o.flash ? '#ffffff' : look.cloak;
  const skin = o.flash ? '#ffffff' : look.skin;
  // Füße
  const step = Math.sin((o.walk ?? 0) * 12) * 0.08 * s;
  ctx.fillStyle = shade(look.cloak, -0.5);
  ctx.beginPath(); ctx.ellipse(x - 0.11 * s + step, y - 0.03 * s, 0.07 * s, 0.045 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 0.11 * s - step, y - 0.03 * s, 0.07 * s, 0.045 * s, 0, 0, Math.PI * 2); ctx.fill();
  // Körper (Umhang)
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(x - 0.2 * s, y - 0.05 * s + bob);
  ctx.quadraticCurveTo(x - 0.22 * s, y - 0.42 * s + bob, x, y - 0.48 * s + bob);
  ctx.quadraticCurveTo(x + 0.22 * s, y - 0.42 * s + bob, x + 0.2 * s, y - 0.05 * s + bob);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 0.2 * s, y - 0.12 * s + bob, 0.4 * s, 0.05 * s);
  // Kopf
  const hy = y - 0.68 * s + bob, hr = 0.26 * s;
  if (look.hat === 'hood') {
    ctx.fillStyle = cloak;
    ctx.beginPath(); ctx.arc(x, hy, hr * 1.18, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(x, hy + (look.hat === 'hood' ? hr * 0.08 : 0), hr, 0, Math.PI * 2); ctx.fill();
  if (look.hat === 'hood' && fy < -0.5) {
    ctx.fillStyle = cloak;
    ctx.beginPath(); ctx.arc(x, hy, hr * 1.18, 0, Math.PI * 2); ctx.fill();
  }
  // Augen (nicht sichtbar, wenn von hinten)
  if (fy > -0.5 || Math.abs(fx) > 0.5) {
    const ex = fx * hr * 0.45, ey = Math.max(0, fy) * hr * 0.18;
    ctx.fillStyle = '#1a1420';
    for (const side of [-1, 1]) {
      if (fx > 0.7 && side < 0) continue;
      if (fx < -0.7 && side > 0) continue;
      ctx.beginPath();
      ctx.ellipse(x + ex + side * hr * 0.38, hy + ey, hr * 0.12, hr * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const side of [-1, 1]) {
      if ((fx > 0.7 && side < 0) || (fx < -0.7 && side > 0)) continue;
      ctx.beginPath(); ctx.arc(x + ex + side * hr * 0.38 - hr * 0.04, hy + ey - hr * 0.07, hr * 0.05, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Kopfbedeckung
  ctx.fillStyle = o.flash ? '#fff' : shade(look.cloak, -0.25);
  if (look.hat === 'cap') {
    ctx.beginPath(); ctx.arc(x, hy - hr * 0.15, hr * 1.02, Math.PI, 0); ctx.fill();
    ctx.fillRect(x - hr * 0.2 + fx * hr * 0.6, hy - hr * 0.25, hr * 1.1 * (fx < 0 ? -1 : 1), hr * 0.18);
  } else if (look.hat === 'horns') {
    ctx.fillStyle = o.flash ? '#fff' : '#e8dcc0';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * hr * 0.55, hy - hr * 0.6);
      ctx.quadraticCurveTo(x + side * hr * 1.3, hy - hr * 1.0, x + side * hr * 1.1, hy - hr * 1.6);
      ctx.lineTo(x + side * hr * 0.85, hy - hr * 0.55);
      ctx.fill();
    }
  } else if (look.hat === 'crown') {
    ctx.fillStyle = o.flash ? '#fff' : '#f2c230';
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.7, hy - hr * 0.7);
    for (let i = 0; i <= 4; i++) {
      ctx.lineTo(x - hr * 0.7 + i * hr * 0.35, hy - hr * (i % 2 === 0 ? 1.45 : 1.0));
    }
    ctx.lineTo(x + hr * 0.7, hy - hr * 0.7);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
