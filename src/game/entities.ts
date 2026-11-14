// Spieler, Projektile, Bomben, Pickups, Partikel.
import { BASE_STATS, BOMB, INVULN_TIME, PLAYER_RADIUS, START_BOMBS, Stats, ROOM_W, ROOM_H } from '../core/config';
import type { Camera } from '../core/camera';
import { norm, rand } from '../core/util';
import type { ActiveItem, ConsumableItem } from '../data/items';
import { ball, drawHero, HeroLook, shadow } from './draw';
import type { Game } from './game';

export interface ControlState {
  mx: number; my: number;       // Bewegung (-1..1)
  ax: number; ay: number;       // Zielrichtung (normiert)
  shooting: boolean;
  bomb: boolean; item: boolean; consumable: boolean; menu: boolean; // in diesem Frame gedrückt
}

export class Player {
  x = ROOM_W / 2; y = ROOM_H / 2; z = 0;
  vx = 0; vy = 0;
  r = PLAYER_RADIUS;
  stats: Stats;
  hp: number;
  invuln = 0;
  fireCd = 0;
  faceX = 0; faceY = 1;
  walk = 0;
  bombs = START_BOMBS;
  coins = 0;
  active: ActiveItem | null = null;
  charge = 0;
  consumable: ConsumableItem | null = null;
  buffs = { rage: 0, shield: 0, haste: 0 };
  items: string[] = [];
  shotSide = 1;

  constructor(base: Partial<Stats>, public look: HeroLook, public tearColor: string) {
    this.stats = { ...BASE_STATS, ...base };
    this.hp = this.stats.maxHp;
  }

  get vulnerable() { return this.invuln <= 0 && this.buffs.shield <= 0; }

  update(g: Game, dt: number, c: ControlState) {
    const b = this.buffs;
    b.rage = Math.max(0, b.rage - dt); b.shield = Math.max(0, b.shield - dt); b.haste = Math.max(0, b.haste - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    const speed = this.stats.speed * (b.haste > 0 ? 1.35 : 1);
    const tvx = c.mx * speed, tvy = c.my * speed;
    const acc = Math.min(1, dt * 14);
    this.vx += (tvx - this.vx) * acc;
    this.vy += (tvy - this.vy) * acc;
    g.moveCircle(this, this.vx * dt, this.vy * dt, false);
    const moving = Math.hypot(this.vx, this.vy) > 0.3;
    if (moving) this.walk += dt; else this.walk = 0;

    if (c.shooting) { this.faceX = c.ax; this.faceY = c.ay; }
    else if (moving) { const n = norm(this.vx, this.vy); this.faceX = n[0]; this.faceY = n[1]; }

    this.fireCd -= dt;
    if (c.shooting && this.fireCd <= 0) {
      this.fireCd = this.stats.fireDelay;
      this.shoot(g, c.ax, c.ay);
    }
  }

  shoot(g: Game, ax: number, ay: number) {
    const s = this.stats;
    const n = s.multishot;
    const spread = 0.22;
    const base = Math.atan2(ay, ax);
    this.shotSide *= -1;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const dx = Math.cos(a), dy = Math.sin(a);
      const px = -dy * 0.08 * this.shotSide;
      const p = new Projectile(this.x + dx * 0.25 + px, this.y + dy * 0.25, 0.62, false);
      p.vx = dx * s.shotSpeed + this.vx * 0.3;
      p.vy = dy * s.shotSpeed + this.vy * 0.3;
      p.r = s.tearSize;
      p.dmg = s.damage * (this.buffs.rage > 0 ? 2 : 1);
      p.range = s.range;
      p.pierce = s.piercing;
      p.homing = s.homing;
      p.color = this.buffs.rage > 0 ? '#ff6a3a' : this.tearColor;
      g.projectiles.push(p);
    }
    g.audio.sfx('shoot');
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const [sx, sy, s] = cam.project(this.x, this.y, this.z);
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    drawHero(ctx, sx, sy, s, this.look, {
      faceX: this.faceX, faceY: this.faceY, walk: this.walk, alpha: blink ? 0.35 : 1,
    });
    if (this.buffs.shield > 0) {
      ctx.strokeStyle = `rgba(140,200,255,${0.4 + 0.3 * Math.sin(performance.now() / 80)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx, sy - 0.45 * s, 0.5 * s, 0.6 * s, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawShadow(ctx: CanvasRenderingContext2D, cam: Camera) { shadow(ctx, cam, this.x, this.y, 0.28); }

  hurtTimer() { this.invuln = INVULN_TIME; }
}

export class Projectile {
  vx = 0; vy = 0; vz = 0;
  r = 0.12;
  dmg = 1;
  range = 6;
  traveled = 0;
  color = '#8fd8ff';
  pierce = false;
  homing = false;
  hit = new Set<object>();
  dead = false;
  falling = false;
  constructor(public x: number, public y: number, public z: number, public enemy: boolean) {}

  update(g: Game, dt: number) {
    if (this.homing && !this.falling) {
      let best: any = null, bd = 5;
      for (const e of g.room.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(this.vx, this.vy);
        const a = Math.atan2(this.vy, this.vx);
        const ta = Math.atan2(best.y - this.y, best.x - this.x);
        let da = ta - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const na = a + Math.max(-5 * dt, Math.min(5 * dt, da));
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }
    const f = this.enemy ? g.enemyTimeScale : 1;
    this.x += this.vx * dt * f;
    this.y += this.vy * dt * f;
    this.traveled += Math.hypot(this.vx, this.vy) * dt * f;
    if (this.traveled > this.range) this.falling = true;
    if (this.falling) {
      this.vz -= 16 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0.05) return this.splash(g);
    }
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (this.x < 0 || this.y < 0 || this.x >= ROOM_W || this.y >= ROOM_H || g.room.isSolid(tx, ty)) {
      if (g.room.isSolid(tx, ty) && this.x >= 0 && this.y >= 0 && this.x < ROOM_W && this.y < ROOM_H) g.hitRock(tx, ty);
      return this.splash(g);
    }
  }

  splash(g: Game) {
    this.dead = true;
    for (let i = 0; i < 5; i++) {
      g.particles.push(new Particle(this.x, this.y, Math.max(0.05, this.z), rand(-1.5, 1.5), rand(-1.5, 1.5), rand(1, 3), this.color, 0.05, 0.35));
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const [sx, sy, s] = cam.project(this.x, this.y, this.z);
    ball(ctx, sx, sy, Math.max(2, this.r * s), this.color);
    if (this.enemy) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, this.r * s), 0, Math.PI * 2); ctx.stroke();
    }
  }
}

export class Bomb {
  t = BOMB.fuse;
  dead = false;
  constructor(public x: number, public y: number) {}
  update(g: Game, dt: number) {
    this.t -= dt;
    if (this.t <= 0) { this.dead = true; g.explode(this.x, this.y); }
  }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const [sx, sy, s] = cam.project(this.x, this.y, 0.22);
    const pulse = this.t < 0.6 ? 1 + Math.sin(this.t * 40) * 0.08 : 1;
    const flash = Math.sin(this.t * (this.t < 0.6 ? 40 : 12)) > 0.6;
    ball(ctx, sx, sy, 0.22 * s * pulse, flash ? '#c04030' : '#22202a', 'rgba(255,255,255,0.3)');
    ctx.strokeStyle = '#c8a070'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy - 0.2 * s); ctx.quadraticCurveTo(sx + 0.1 * s, sy - 0.32 * s, sx + 0.06 * s, sy - 0.38 * s); ctx.stroke();
    ctx.fillStyle = Math.random() > 0.5 ? '#ffd040' : '#ff7020';
    ctx.beginPath(); ctx.arc(sx + 0.06 * s, sy - 0.39 * s, 0.045 * s, 0, Math.PI * 2); ctx.fill();
  }
}

export type PickupType = 'heart' | 'halfheart' | 'coin' | 'bomb' | 'consumable';

export class Pickup {
  z = 0.6; vz = 2.5;
  dead = false;
  t = Math.random() * 6;
  constructor(public x: number, public y: number, public type: PickupType, public item: ConsumableItem | null = null) {}
  update(_g: Game, dt: number) {
    this.t += dt;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 12 * dt;
      this.z += this.vz * dt;
      if (this.z < 0) { this.z = 0; this.vz = Math.abs(this.vz) > 1.5 ? -this.vz * 0.4 : 0; }
    }
  }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const hover = this.type === 'consumable' ? 0.15 + Math.sin(this.t * 3) * 0.05 : 0;
    const [sx, sy, s] = cam.project(this.x, this.y, this.z + 0.18 + hover);
    switch (this.type) {
      case 'heart': case 'halfheart':
        drawHeartShape(ctx, sx, sy, 0.2 * s, this.type === 'heart' ? 1 : 0.5); break;
      case 'coin': {
        const w = Math.abs(Math.cos(this.t * 4));
        ctx.fillStyle = '#f2c230';
        ctx.beginPath(); ctx.ellipse(sx, sy, 0.15 * s * Math.max(0.2, w), 0.15 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a07010'; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      }
      case 'bomb':
        ball(ctx, sx, sy, 0.17 * s, '#22202a', 'rgba(255,255,255,0.3)');
        ctx.fillStyle = '#c8a070'; ctx.fillRect(sx - 0.03 * s, sy - 0.25 * s, 0.06 * s, 0.1 * s);
        break;
      case 'consumable':
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(sx, sy, 0.26 * s, 0, Math.PI * 2); ctx.fill();
        ctx.font = `${Math.round(0.36 * s)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.item?.icon || '?', sx, sy);
        break;
    }
  }
}

export function drawHeartShape(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: number, empty = false) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.85);
    ctx.bezierCurveTo(x - size * 1.3, y - size * 0.1, x - size * 0.6, y - size * 1.05, x, y - size * 0.35);
    ctx.bezierCurveTo(x + size * 0.6, y - size * 1.05, x + size * 1.3, y - size * 0.1, x, y + size * 0.85);
  };
  path();
  ctx.fillStyle = empty || fill < 1 ? 'rgba(40,10,15,0.7)' : '#e8303a';
  ctx.fill();
  if (fill > 0 && fill < 1) {
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = '#e8303a'; ctx.fillRect(x - size * 1.5, y - size * 1.5, size * 1.5, size * 3);
    ctx.restore();
  }
  path();
  ctx.lineWidth = Math.max(1.5, size * 0.14);
  ctx.strokeStyle = '#2a0a10';
  ctx.stroke();
  if (fill > 0 && !empty) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(x - size * 0.45, y - size * 0.35, size * 0.18, 0, Math.PI * 2); ctx.fill();
  }
}

export class Particle {
  dead = false;
  life: number;
  constructor(public x: number, public y: number, public z: number,
    public vx: number, public vy: number, public vz: number,
    public color: string, public size: number, public maxLife: number, public gravity = 12) {
    this.life = maxLife;
  }
  update(dt: number) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vz -= this.gravity * dt;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    if (this.z < 0) { this.z = 0; this.vz *= -0.3; this.vx *= 0.6; this.vy *= 0.6; }
  }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const [sx, sy, s] = cam.project(this.x, this.y, this.z);
    ctx.globalAlpha = Math.min(1, this.life / this.maxLife * 2);
    ctx.fillStyle = this.color;
    const r = Math.max(1, this.size * s);
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
}

export class Ring {
  t = 0;
  dead = false;
  constructor(public x: number, public y: number, public maxR: number, public dur: number, public color: string) {}
  update(dt: number) { this.t += dt; if (this.t > this.dur) this.dead = true; }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const p = this.t / this.dur;
    const [sx, sy, s] = cam.project(this.x, this.y, 0.05);
    const r = this.maxR * (0.3 + 0.7 * p) * s;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.ellipse(sx, sy, r, r * cam.sp, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export class FloatText {
  t = 0; dead = false;
  constructor(public x: number, public y: number, public text: string, public color = '#fff', public dur = 1.0) {}
  update(dt: number) { this.t += dt; if (this.t > this.dur) this.dead = true; }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const [sx, sy, s] = cam.project(this.x, this.y, 1.2 + this.t * 0.8);
    ctx.globalAlpha = Math.min(1, (this.dur - this.t) * 3);
    ctx.font = `bold ${Math.round(0.32 * s)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(this.text, sx, sy);
    ctx.fillStyle = this.color; ctx.fillText(this.text, sx, sy);
    ctx.globalAlpha = 1;
  }
}

export { BOMB };
