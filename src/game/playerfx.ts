// Darstellung von Waffe in der Hand und Set-Effekten (volles Rüstungs-Set).
// Eigene Bilder: weapon_<item-id> (Waffe zeigt nach rechts, Griff links-mittig)
// und setfx_<set-id> (Add-on/Aura, gleiches Raster wie die Spielfigur).
import type { Camera } from '../core/camera';
import { Assets } from '../core/assets';
import type { WeaponType } from '../data/items';
import { rand } from '../core/util';
import type { Player } from './entities';
import { Particle } from './entities';
import type { Game } from './game';

// ---------------- Waffe ----------------

export function drawWeapon(ctx: CanvasRenderingContext2D, cam: Camera, p: Player) {
  const type = p.weapon.type;
  if (type === 'boomerang' && p.boomerangOut) return; // fliegt gerade
  const ax = p.faceX, ay = p.faceY;
  // Handhöhe: eigene Figur (ca. 1,2 Kacheln groß) oder Platzhalter-Figur
  const hand = Assets.pick(p.spriteKeys) ? 0.62 : 0.42;
  const hx = p.x + ax * 0.2, hy = p.y + ay * 0.1;
  // Figuren werden aufrecht gezeichnet -> Handhöhe in Bildschirm-Pixeln abziehen
  const [sx, fy, s] = cam.project(hx, hy, p.z);
  const sy = fy - hand * s;
  const [tx, ty] = cam.project(hx + ax, hy + ay, p.z);
  let ang = Math.atan2(ty - fy, tx - sx);
  const left = Math.cos(ang) < 0;
  // Schwert: Schwung-Animation
  if (type === 'sword') {
    const sw = p.swingT > 0 ? 1 - p.swingT / 0.18 : -1;
    const off = sw >= 0 ? -1.2 + sw * 2.4 : -0.9;
    ang += left ? -off : off;
  }
  const kick = p.weaponKick * 0.12 * s;
  ctx.save();
  ctx.translate(sx - Math.cos(ang) * kick, sy - Math.sin(ang) * kick);
  ctx.rotate(ang);
  if (left) ctx.scale(1, -1); // nicht kopfüber halten
  const id = p.inv.weapon?.id;
  const l = id ? Assets.sprites.get('weapon_' + id) : undefined;
  if (l) {
    const len = (l.def.height || 0.75) * s;
    const h = len * (l.fh / l.fw);
    ctx.imageSmoothingEnabled = !Assets.pixelArt || len < l.fw;
    ctx.drawImage(l.img, 0, 0, l.fw, l.fh, -len * 0.12, -h / 2, len, h);
  } else drawWeaponShape(ctx, type, s);
  ctx.restore();
}

/** Platzhalter-Waffen (Formen), bis eigene Bilder da sind. +x = vorne, 0 = Griff */
function drawWeaponShape(ctx: CanvasRenderingContext2D, type: WeaponType, s: number) {
  const L = s;
  ctx.lineCap = 'round';
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, c: string) => {
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.5, w * L);
    ctx.beginPath(); ctx.moveTo(x1 * L, y1 * L); ctx.lineTo(x2 * L, y2 * L); ctx.stroke();
  };
  const dot = (x: number, y: number, r: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * L, y * L, Math.max(1.5, r * L), 0, Math.PI * 2); ctx.fill(); };
  switch (type) {
    case 'orb': line(-0.05, 0, 0.45, 0, 0.05, '#7a5030'); dot(0.5, 0, 0.07, '#8fe8ff'); dot(0.48, -0.02, 0.025, '#fff'); break;
    case 'sword': line(-0.08, 0, 0.05, 0, 0.06, '#5a3a20'); line(0.05, -0.09, 0.05, 0.09, 0.04, '#c8a040'); line(0.06, 0, 0.62, 0, 0.06, '#d8dce8'); line(0.1, -0.012, 0.6, -0.012, 0.015, '#ffffff'); break;
    case 'shotgun': line(-0.05, 0.03, 0.15, 0.03, 0.08, '#6a4024'); line(0.1, 0, 0.5, 0, 0.07, '#3a3a44'); line(0.1, -0.035, 0.5, -0.035, 0.04, '#5a5a66'); break;
    case 'sniper': line(0.05, -0.2, 0.05, 0.2, 0.035, '#7a5030'); line(-0.05, 0, 0.55, 0, 0.045, '#5a3a20'); line(0.05, -0.2, 0.3, 0, 0.012, '#ddd'); line(0.05, 0.2, 0.3, 0, 0.012, '#ddd'); break;
    case 'boomerang': line(0, -0.02, 0.2, -0.2, 0.07, '#c89a5a'); line(0, -0.02, 0.22, 0.12, 0.07, '#b08040'); break;
    case 'flame': line(-0.05, 0, 0.35, 0, 0.09, '#8a3a20'); line(0.3, 0, 0.45, 0, 0.06, '#3a3a3a'); dot(0.48, 0, 0.035 + Math.random() * 0.02, '#ffb040'); break;
    case 'beam': line(-0.05, 0.02, 0.15, 0.02, 0.08, '#2a2a3a'); line(0.1, 0, 0.48, 0, 0.06, '#e0e0f0'); dot(0.48, 0, 0.03, '#8af'); break;
  }
  ctx.lineCap = 'butt';
}

// ---------------- Set-Effekte ----------------

/** layer: 'back' wird vor der Figur gezeichnet, 'front' danach */
export function drawSetFx(ctx: CanvasRenderingContext2D, cam: Camera, p: Player, layer: 'back' | 'front') {
  if (!p.fullSets.length) return;
  const [sx, sy, s] = cam.project(p.x, p.y, p.z);
  const t = performance.now() / 1000;
  for (const set of p.fullSets) {
    const key = 'setfx_' + set;
    const l = Assets.sprites.get(key);
    if (l) {
      if ((l.def.layer || 'front') === layer)
        Assets.draw(ctx, key, sx, sy, s, { t, dirX: p.faceX, dirY: p.faceY, moving: p.walk > 0 });
      continue;
    }
    // Platzhalter-Effekte
    if (layer === 'back') {
      const glow = (c: string, r: number) => {
        const g = ctx.createRadialGradient(sx, sy - 0.5 * s, 0, sx, sy - 0.5 * s, r * s);
        g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy - 0.5 * s, r * s, 0, Math.PI * 2); ctx.fill();
      };
      if (set === 'shadow') glow(`rgba(110,40,170,${0.35 + 0.1 * Math.sin(t * 3)})`, 0.75);
      if (set === 'dragon') glow(`rgba(255,110,30,${0.25 + 0.08 * Math.sin(t * 5)})`, 0.7);
      if (set === 'celestial') glow(`rgba(255,230,140,${0.3 + 0.1 * Math.sin(t * 2)})`, 0.85);
      if (set === 'iron') {
        ctx.strokeStyle = `rgba(200,210,230,${0.35 + 0.15 * Math.sin(t * 2)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(sx, sy, 0.38 * s, 0.38 * s * cam.sp, 0, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      if (set === 'celestial') { // Heiligenschein
        ctx.strokeStyle = '#ffe680'; ctx.lineWidth = Math.max(2, 0.05 * s);
        ctx.beginPath(); ctx.ellipse(sx, sy - 1.3 * s + Math.sin(t * 2) * 0.03 * s, 0.2 * s, 0.07 * s, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (set === 'iron' && Math.sin(t * 1.7) > 0.93) { // Glanz auf der Rüstung
        const gx = sx + 0.15 * s, gy = sy - 0.75 * s;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(gx, gy - 0.1 * s); ctx.lineTo(gx + 0.025 * s, gy); ctx.lineTo(gx, gy + 0.1 * s); ctx.lineTo(gx - 0.025 * s, gy); ctx.fill();
        ctx.beginPath(); ctx.moveTo(gx - 0.1 * s, gy); ctx.lineTo(gx, gy + 0.025 * s); ctx.lineTo(gx + 0.1 * s, gy); ctx.lineTo(gx, gy - 0.025 * s); ctx.fill();
      }
    }
  }
}

/** Partikel für Set-Effekte (Glut, Staub, Schattenschwaden) */
export function emitSetParticles(g: Game, p: Player, dt: number) {
  for (const set of p.fullSets) {
    if (Assets.has('setfx_' + set) && !Assets.sprites.get('setfx_' + set)!.def.particles) continue;
    const moving = p.walk > 0;
    if (set === 'dragon' && Math.random() < dt * 8)
      g.particles.push(new Particle(p.x + rand(-0.25, 0.25), p.y + rand(-0.1, 0.1), p.z + rand(0.2, 0.8), 0, 0, rand(0.5, 1.2), Math.random() < 0.5 ? '#ffb040' : '#ff6020', 0.025, 0.8, -1));
    if (set === 'shadow' && Math.random() < dt * 10)
      g.particles.push(new Particle(p.x + rand(-0.3, 0.3), p.y + rand(-0.1, 0.1), p.z + rand(0, 0.6), rand(-0.2, 0.2), 0, 0.6, 'rgba(90,40,140,0.8)', 0.04, 0.6, -0.5));
    if (set === 'leather' && moving && Math.random() < dt * 12)
      g.particles.push(new Particle(p.x + rand(-0.15, 0.15), p.y + 0.1, 0.02, -p.vx * 0.1, -p.vy * 0.1, 0.4, 'rgba(160,130,90,0.7)', 0.035, 0.4, 2));
    if (set === 'celestial' && Math.random() < dt * 4)
      g.particles.push(new Particle(p.x + rand(-0.35, 0.35), p.y + rand(-0.1, 0.1), p.z + rand(0.1, 1), 0, 0, 0.3, '#fff6c0', 0.02, 0.9, -0.2));
  }
}
