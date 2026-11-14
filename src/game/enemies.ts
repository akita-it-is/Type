// Gegner-Verhalten. Jede Welt nutzt dieselben Verhaltenstypen, nur mit eigenem
// Namen/Farben/Accessoire (siehe data/worlds.ts).
import type { Camera } from '../core/camera';
import { norm, rand } from '../core/util';
import { ROOM_W, ROOM_H } from '../core/config';
import type { EnemyKind, EnemyLook, WorldDef } from '../data/worlds';
import { ball, shade, shadow } from './draw';
import { Particle, Projectile } from './entities';
import type { Game } from './game';

type Acc = WorldDef['accessory'];

export abstract class Enemy {
  z = 0; vx = 0; vy = 0;
  r = 0.32;
  hp: number; maxHp: number;
  flying = false;
  flash = 0;
  dead = false;
  t = Math.random() * 10;
  spawnT = 0.6;
  contact = 1;
  isBoss = false;
  kbx = 0; kby = 0;
  coinChance = 0.12;

  constructor(public x: number, public y: number, hp: number, public look: EnemyLook, public acc: Acc) {
    this.hp = this.maxHp = hp;
  }

  get active() { return this.spawnT <= 0 && !this.dead; }

  update(g: Game, dt: number) {
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    const ts = g.enemyTimeScale;
    const sdt = dt * ts;
    this.t += sdt;
    this.flash = Math.max(0, this.flash - dt);
    this.behave(g, sdt);
    if (this.kbx || this.kby) {
      g.moveCircle(this, this.kbx * dt, this.kby * dt, this.flying);
      const f = Math.max(0, 1 - dt * 10);
      this.kbx *= f; this.kby *= f;
      if (Math.abs(this.kbx) + Math.abs(this.kby) < 0.05) this.kbx = this.kby = 0;
    }
  }

  abstract behave(g: Game, dt: number): void;

  hurt(g: Game, dmg: number, kx: number, ky: number) {
    if (!this.active) return;
    this.hp -= dmg;
    this.flash = 0.1;
    const kb = this.isBoss ? 0.6 : 3.5;
    this.kbx += kx * kb; this.kby += ky * kb;
    if (this.hp <= 0) this.die(g);
  }

  die(g: Game) {
    this.dead = true;
    g.onEnemyKilled(this);
  }

  /** Richtung zum Spieler */
  toPlayer(g: Game): [number, number, number] {
    const dx = g.player.x - this.x, dy = g.player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d, d];
  }

  shootAt(g: Game, ax: number, ay: number, speed = 4.5, z = 0.45) {
    const p = new Projectile(this.x + ax * this.r, this.y + ay * this.r, z, true);
    p.vx = ax * speed; p.vy = ay * speed;
    p.r = 0.13; p.dmg = 1; p.range = 9;
    p.color = '#ff5a4a';
    g.projectiles.push(p);
  }

  drawShadow(ctx: CanvasRenderingContext2D, cam: Camera) {
    if (this.spawnT > 0) return;
    shadow(ctx, cam, this.x, this.y, this.r * 0.9, this.z > 0.2 ? 0.22 : 0.35);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    if (this.spawnT > 0) {
      // Erscheinen: Rauchwolke
      const [sx, sy, s] = cam.project(this.x, this.y, 0.3);
      const p = 1 - this.spawnT / 0.6;
      ctx.fillStyle = `rgba(200,200,220,${0.5 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(sx, sy, (0.2 + p * 0.4) * s, 0, Math.PI * 2); ctx.fill();
      return;
    }
    this.drawBody(ctx, cam, g);
  }

  abstract drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game): void;

  col() { return this.flash > 0 ? '#ffffff' : this.look.color; }

  drawEyes(ctx: CanvasRenderingContext2D, sx: number, sy: number, rad: number, g: Game, color = '#1a1020', angry = false) {
    const [dx, dy] = norm(g.player.x - this.x, g.player.y - this.y);
    for (const side of [-1, 1]) {
      const ex = sx + side * rad * 0.38 + dx * rad * 0.15;
      const ey = sy - rad * 0.1 + dy * rad * 0.1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, rad * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(ex + dx * rad * 0.07, ey + dy * rad * 0.05, rad * 0.11, 0, Math.PI * 2); ctx.fill();
      if (angry) {
        ctx.strokeStyle = '#1a1020'; ctx.lineWidth = Math.max(1.5, rad * 0.08);
        ctx.beginPath(); ctx.moveTo(ex - side * rad * 0.25, ey - rad * 0.32); ctx.lineTo(ex + side * rad * 0.15, ey - rad * 0.2); ctx.stroke();
      }
    }
  }

  drawAccessory(ctx: CanvasRenderingContext2D, sx: number, topY: number, rad: number) {
    const a = this.look.accent;
    switch (this.acc) {
      case 'antenna':
        ctx.strokeStyle = shade(this.look.color, -0.4); ctx.lineWidth = Math.max(1.5, rad * 0.08);
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(sx + side * rad * 0.25, topY + rad * 0.1); ctx.lineTo(sx + side * rad * 0.45, topY - rad * 0.45); ctx.stroke();
          ctx.fillStyle = a; ctx.beginPath(); ctx.arc(sx + side * rad * 0.45, topY - rad * 0.45, rad * 0.12, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'helmet':
        ctx.fillStyle = '#b8b0a0';
        ctx.beginPath(); ctx.arc(sx, topY + rad * 0.45, rad * 0.75, Math.PI, 0); ctx.fill();
        ctx.fillStyle = a;
        ctx.beginPath(); ctx.ellipse(sx, topY - rad * 0.15, rad * 0.5, rad * 0.18, 0, Math.PI, 0); ctx.fill();
        break;
      case 'laurel':
        ctx.fillStyle = '#6aa04a';
        for (let i = 0; i < 5; i++) {
          for (const side of [-1, 1]) {
            const ang = Math.PI * (0.55 + i * 0.09);
            ctx.beginPath();
            ctx.ellipse(sx + side * Math.cos(ang) * rad * 0.7 * -1, topY + rad * 0.55 - Math.sin(ang) * rad * 0.7, rad * 0.13, rad * 0.07, side * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
    }
  }
}

// ---------------- Verhaltenstypen ----------------

export class Flyer extends Enemy {
  flying = true;
  r = 0.26;
  behave(g: Game, dt: number) {
    const [dx, dy] = this.toPlayer(g);
    const wob = Math.sin(this.t * 3) * 0.7;
    const ax = dx * Math.cos(wob) - dy * Math.sin(wob);
    const ay = dx * Math.sin(wob) + dy * Math.cos(wob);
    const sp = 2.1;
    this.vx += (ax * sp - this.vx) * Math.min(1, dt * 3);
    this.vy += (ay * sp - this.vy) * Math.min(1, dt * 3);
    g.moveCircle(this, this.vx * dt, this.vy * dt, true);
    this.z = 0.5 + Math.sin(this.t * 5) * 0.08;
  }
  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const [sx, sy, s] = cam.project(this.x, this.y, this.z + this.r);
    const rad = this.r * s;
    const flap = Math.sin(this.t * 30) * 0.5 + 0.5;
    ctx.fillStyle = 'rgba(230,240,255,0.6)';
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sx + side * rad * 0.9, sy - rad * 0.4, rad * 0.7, rad * (0.25 + 0.25 * flap), side * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ball(ctx, sx, sy, rad, this.col());
    this.drawEyes(ctx, sx, sy, rad, g);
    this.drawAccessory(ctx, sx, sy - rad, rad);
  }
}

export class Hopper extends Enemy {
  r = 0.34;
  state: 'idle' | 'hop' = 'idle';
  timer = rand(0.4, 1.2);
  hdx = 0; hdy = 0;
  behave(g: Game, dt: number) {
    this.timer -= dt;
    if (this.state === 'idle') {
      this.z = 0;
      if (this.timer <= 0) {
        const [dx, dy] = this.toPlayer(g);
        const a = Math.atan2(dy, dx) + rand(-0.6, 0.6);
        this.hdx = Math.cos(a); this.hdy = Math.sin(a);
        this.state = 'hop'; this.timer = 0.55;
      }
    } else {
      const p = 1 - this.timer / 0.55;
      this.z = Math.sin(p * Math.PI) * 0.6;
      g.moveCircle(this, this.hdx * 3.6 * dt, this.hdy * 3.6 * dt, false);
      if (this.timer <= 0) { this.state = 'idle'; this.timer = rand(0.5, 1.1); this.z = 0; }
    }
  }
  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const squash = this.state === 'idle' ? 1 + Math.sin(this.t * 6) * 0.06 + (this.timer < 0.2 ? 0.2 : 0) : 0.85;
    const [sx, sy, s] = cam.project(this.x, this.y, this.z);
    const w = this.r * s * squash * 1.1, h = this.r * s / squash * 1.25;
    ctx.fillStyle = this.col();
    ctx.beginPath(); ctx.ellipse(sx, sy - h * 0.8, w, h * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(sx - w * 0.35, sy - h * 1.15, w * 0.25, h * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
    this.drawEyes(ctx, sx, sy - h * 0.9, this.r * s, g);
    this.drawAccessory(ctx, sx, sy - h * 1.6, this.r * s);
  }
}

export class Shooter extends Enemy {
  r = 0.36;
  coinChance = 0.2;
  fireT = rand(1.2, 2.4);
  tele = 0;
  wdx = 0; wdy = 0; wt = 0;
  behave(g: Game, dt: number) {
    this.wt -= dt;
    if (this.wt <= 0) { const a = rand(0, Math.PI * 2); this.wdx = Math.cos(a); this.wdy = Math.sin(a); this.wt = rand(1.2, 2.5); }
    if (this.tele <= 0) g.moveCircle(this, this.wdx * 0.9 * dt, this.wdy * 0.9 * dt, false);
    this.fireT -= dt;
    if (this.fireT <= 0 && this.tele <= 0) this.tele = 0.45;
    if (this.tele > 0) {
      this.tele -= dt;
      if (this.tele <= 0) {
        const [dx, dy] = this.toPlayer(g);
        if (g.difficulty >= 4) {
          for (const off of [-0.25, 0, 0.25]) this.shootAt(g, Math.cos(Math.atan2(dy, dx) + off), Math.sin(Math.atan2(dy, dx) + off));
        } else this.shootAt(g, dx, dy);
        g.audio.sfx('shot');
        this.fireT = rand(1.8, 2.6);
      }
    }
  }
  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const swell = this.tele > 0 ? 1 + (0.45 - this.tele) * 0.5 : 1;
    const [sx, sy, s] = cam.project(this.x, this.y, this.r * swell);
    const rad = this.r * s * swell;
    ball(ctx, sx, sy, rad, this.col());
    // großes Auge
    const [dx, dy] = norm(g.player.x - this.x, g.player.y - this.y);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx + dx * rad * 0.15, sy + dy * rad * 0.1, rad * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.tele > 0 ? '#ff3020' : this.look.accent;
    ctx.beginPath(); ctx.arc(sx + dx * rad * 0.3, sy + dy * rad * 0.2, rad * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#100810';
    ctx.beginPath(); ctx.arc(sx + dx * rad * 0.35, sy + dy * rad * 0.22, rad * 0.12, 0, Math.PI * 2); ctx.fill();
    this.drawAccessory(ctx, sx, sy - rad, rad);
  }
}

export class Charger extends Enemy {
  r = 0.36;
  coinChance = 0.2;
  state: 'walk' | 'charge' | 'stun' = 'walk';
  timer = 0;
  cdx = 0; cdy = 0;
  wdx = 1; wdy = 0; wt = 0;
  cooldown = 1;
  behave(g: Game, dt: number) {
    this.timer -= dt; this.cooldown -= dt;
    if (this.state === 'walk') {
      this.wt -= dt;
      if (this.wt <= 0) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)]; this.wdx = d[0]; this.wdy = d[1]; this.wt = rand(0.8, 1.6); }
      const hit = g.moveCircle(this, this.wdx * 1.2 * dt, this.wdy * 1.2 * dt, false);
      if (hit) this.wt = 0;
      const dx = g.player.x - this.x, dy = g.player.y - this.y;
      if (this.cooldown <= 0 && Math.hypot(dx, dy) < 8) {
        if (Math.abs(dy) < 0.45) { this.cdx = Math.sign(dx); this.cdy = 0; this.state = 'charge'; }
        else if (Math.abs(dx) < 0.45) { this.cdx = 0; this.cdy = Math.sign(dy); this.state = 'charge'; }
      }
    } else if (this.state === 'charge') {
      const hit = g.moveCircle(this, this.cdx * 7.5 * dt, this.cdy * 7.5 * dt, false);
      if (hit) { this.state = 'stun'; this.timer = 0.8; g.camera.addShake(3); g.audio.sfx('door'); }
    } else if (this.timer <= 0) { this.state = 'walk'; this.cooldown = 0.8; }
  }
  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const [sx, sy, s] = cam.project(this.x, this.y, 0);
    const rad = this.r * s;
    const shake = this.state === 'charge' ? Math.sin(this.t * 60) * rad * 0.05 : 0;
    ctx.fillStyle = this.col();
    const w = rad * 1.9, h = rad * 1.7;
    ctx.beginPath();
    (ctx as any).roundRect ? (ctx as any).roundRect(sx - w / 2 + shake, sy - h, w, h, rad * 0.4) : ctx.rect(sx - w / 2, sy - h, w, h);
    ctx.fill();
    ctx.fillStyle = shade(this.look.color, -0.3);
    ctx.fillRect(sx - w / 2 + shake, sy - h * 0.35, w, h * 0.12);
    ctx.fillStyle = this.look.accent;
    ctx.fillRect(sx - w * 0.3 + shake, sy - h * 0.25, w * 0.6, h * 0.18);
    if (this.state === 'stun') {
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + i * 2.1;
        ctx.beginPath(); ctx.arc(sx + Math.cos(a) * rad * 0.7, sy - h * 1.15 + Math.sin(a) * rad * 0.2, rad * 0.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    this.drawEyes(ctx, sx + shake, sy - h * 0.65, rad, g, this.state === 'charge' ? '#ff2010' : '#1a1020', true);
    this.drawAccessory(ctx, sx + shake, sy - h, rad);
  }
}

export class Runner extends Enemy {
  r = 0.28;
  behave(g: Game, dt: number) {
    const [dx, dy] = this.toPlayer(g);
    const sp = 2.8;
    this.vx += (dx * sp - this.vx) * Math.min(1, dt * 5);
    this.vy += (dy * sp - this.vy) * Math.min(1, dt * 5);
    g.moveCircle(this, this.vx * dt, this.vy * dt, false);
  }
  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const [sx, sy, s] = cam.project(this.x, this.y, 0);
    const rad = this.r * s;
    ctx.strokeStyle = shade(this.look.color, -0.4); ctx.lineWidth = Math.max(1.5, rad * 0.14);
    for (let i = 0; i < 4; i++) {
      const lx = sx + (i - 1.5) * rad * 0.5;
      const ph = Math.sin(this.t * 18 + i * 1.6) * rad * 0.2;
      ctx.beginPath(); ctx.moveTo(lx, sy - rad * 0.6); ctx.lineTo(lx + ph, sy); ctx.stroke();
    }
    ctx.fillStyle = this.col();
    ctx.beginPath(); ctx.ellipse(sx, sy - rad * 0.85, rad * 1.1, rad * 0.65, 0, 0, Math.PI * 2); ctx.fill();
    this.drawEyes(ctx, sx, sy - rad * 0.95, rad * 0.9, g, '#1a1020', true);
    this.drawAccessory(ctx, sx, sy - rad * 1.45, rad * 0.9);
  }
}

// ---------------- Boss ----------------

export class Boss extends Enemy {
  r = 0.85;
  isBoss = true;
  contact = 2;
  state = 'intro';
  timer = 1.2;
  sub = 0;
  tx = 0; ty = 0;
  coinChance = 0;
  spawnT = 0.01;

  behave(g: Game, dt: number) {
    this.timer -= dt;
    const enraged = this.hp < this.maxHp * 0.4;
    switch (this.state) {
      case 'intro':
        if (this.timer <= 0) this.next(g);
        break;
      case 'move': {
        const [dx, dy] = this.toPlayer(g);
        g.moveCircle(this, dx * (enraged ? 1.6 : 1.1) * dt, dy * (enraged ? 1.6 : 1.1) * dt, false);
        if (this.timer <= 0) this.next(g);
        break;
      }
      case 'burst':
        if (this.timer <= 0) {
          const n = enraged ? 14 : 10;
          const off = this.sub * 0.3;
          for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 3.8, 0.8); }
          g.audio.sfx('shot');
          this.sub++;
          this.timer = 0.45;
          if (this.sub >= (enraged ? 3 : 2)) { this.state = 'move'; this.timer = 1.4; }
        }
        break;
      case 'spray':
        if (this.timer <= 0) {
          const [dx, dy] = this.toPlayer(g);
          const base = Math.atan2(dy, dx);
          for (let i = -2; i <= 2; i++) this.shootAt(g, Math.cos(base + i * 0.18), Math.sin(base + i * 0.18), 5, 0.8);
          g.audio.sfx('shot');
          this.sub++; this.timer = 0.35;
          if (this.sub >= 3) { this.state = 'move'; this.timer = 1.2; }
        }
        break;
      case 'jump': {
        // hochspringen, Schatten folgt dem Spieler, dann Landung
        const p = 1 - this.timer / 1.4;
        if (p < 0.75) {
          this.tx += (g.player.x - this.tx) * Math.min(1, dt * 3);
          this.ty += (g.player.y - this.ty) * Math.min(1, dt * 3);
          this.z = Math.min(6, this.z + dt * 14);
          if (this.z > 4) { this.x = this.tx; this.y = this.ty; }
        } else {
          this.z = Math.max(0, this.z - dt * 30);
        }
        if (this.timer <= 0) {
          this.z = 0;
          this.x = Math.max(this.r, Math.min(ROOM_W - this.r, this.x));
          this.y = Math.max(this.r, Math.min(ROOM_H - this.r, this.y));
          g.camera.addShake(8);
          g.audio.sfx('bomb');
          g.ring(this.x, this.y, 1.6, 0.35, 'rgba(255,220,180,0.5)');
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 4.2, 0.3); }
          if (Math.hypot(g.player.x - this.x, g.player.y - this.y) < this.r + 0.5) g.hurtPlayer(2);
          this.state = 'move'; this.timer = 1.0;
        }
        break;
      }
      case 'summon':
        if (this.timer <= 0) {
          const minions = g.room.enemies.filter((e: Enemy) => !e.isBoss && !e.dead).length;
          if (minions < 4) for (let i = 0; i < 2; i++) g.spawnEnemy('flyer', this.x + rand(-1, 1), this.y + rand(0.5, 1.2));
          this.state = 'move'; this.timer = 1.2;
        }
        break;
    }
  }

  next(g: Game) {
    const opts = ['burst', 'spray', 'jump', 'summon', 'burst', 'spray'];
    this.state = opts[Math.floor(Math.random() * opts.length)];
    this.sub = 0;
    if (this.state === 'jump') { this.timer = 1.4; this.tx = this.x; this.ty = this.y; }
    else if (this.state === 'summon') this.timer = 0.6;
    else this.timer = 0.5;
  }

  get contactActive() { return this.z < 0.5; }

  drawShadow(ctx: CanvasRenderingContext2D, cam: Camera) {
    const sx = this.state === 'jump' ? this.tx : this.x, sy = this.state === 'jump' ? this.ty : this.y;
    shadow(ctx, cam, this.z > 4 ? sx : this.x, this.z > 4 ? sy : this.y, this.r * (this.state === 'jump' ? 1.1 : 0.95), 0.4);
  }

  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const breathe = 1 + Math.sin(this.t * 3) * 0.04;
    const tele = (this.state === 'burst' || this.state === 'spray') && this.sub === 0 ? 1 + (0.5 - this.timer) * 0.2 : 1;
    const [sx, sy, s] = cam.project(this.x, this.y, this.z);
    const rad = this.r * s;
    const w = rad * 1.15 * breathe * tele, h = rad * 1.1 / breathe;
    ctx.fillStyle = this.col();
    ctx.beginPath(); ctx.ellipse(sx, sy - h, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(this.look.color, -0.25);
    ctx.beginPath(); ctx.ellipse(sx, sy - h * 0.55, w * 0.85, h * 0.4, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(sx - w * 0.4, sy - h * 1.5, w * 0.25, h * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
    this.drawEyes(ctx, sx, sy - h * 1.15, rad, g, '#1a1020', true);
    // Mund
    ctx.fillStyle = '#2a0810';
    ctx.beginPath(); ctx.ellipse(sx, sy - h * 0.6, w * 0.35, h * (this.state === 'burst' ? 0.2 : 0.1), 0, 0, Math.PI * 2); ctx.fill();
    this.drawAccessory(ctx, sx, sy - h * 2, rad);
  }
}

export function createEnemy(kind: EnemyKind | 'boss', x: number, y: number, world: WorldDef, hpScale: number): Enemy {
  const acc = world.accessory;
  switch (kind) {
    case 'flyer': return new Flyer(x, y, 6 * hpScale, world.enemies.flyer, acc);
    case 'hopper': return new Hopper(x, y, 11 * hpScale, world.enemies.hopper, acc);
    case 'shooter': return new Shooter(x, y, 12 * hpScale, world.enemies.shooter, acc);
    case 'charger': return new Charger(x, y, 16 * hpScale, world.enemies.charger, acc);
    case 'runner': return new Runner(x, y, 8 * hpScale, world.enemies.runner, acc);
    case 'boss': return new Boss(x, y, 150 * hpScale, world.boss, acc);
  }
}

export { Particle };
