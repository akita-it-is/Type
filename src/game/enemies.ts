// Gegner-Verhalten. Jede Welt nutzt dieselben Verhaltenstypen, nur mit eigenem
// Namen/Farben/Accessoire (siehe data/worlds.ts). Dazu der Boss mit Fähigkeiten.
import type { Camera } from '../core/camera';
import { norm, rand, randPick } from '../core/util';
import type { EnemyKind, EnemyLook, WorldDef } from '../data/worlds';
import { ALL_SKILLS, BossDef, SkillId } from '../data/bosses';
import { ball, shade, shadow } from './draw';
import { Hazard, Particle, Projectile } from './entities';
import type { Game } from './game';

type Acc = WorldDef['accessory'];
export const CONTACT_DMG = 10;
export const SHOT_DMG = 10;

export abstract class Enemy {
  z = 0; vx = 0; vy = 0;
  r = 0.32;
  hp: number; maxHp: number;
  flying = false;
  flash = 0;
  dead = false;
  t = Math.random() * 10;
  spawnT = 0.6;
  contact = CONTACT_DMG;
  isBoss = false;
  elite = false;
  noLoot = false;   // beschworene Gegner geben keine Münzen
  invulnerable = false;
  kbx = 0; kby = 0;
  alpha = 1;

  constructor(public x: number, public y: number, hp: number, public look: EnemyLook, public acc: Acc) {
    this.hp = this.maxHp = hp;
  }

  makeElite() {
    this.elite = true;
    this.hp = this.maxHp = this.maxHp * 2.5;
    this.r *= 1.25;
  }

  get active() { return this.spawnT <= 0 && !this.dead; }

  update(g: Game, dt: number) {
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    const sdt = dt * g.enemyTimeScale;
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
    if (this.invulnerable) { this.flash = 0.05; return; }
    this.hp -= dmg;
    this.flash = 0.1;
    const kb = this.isBoss ? 0.4 : this.elite ? 1.5 : 3.5;
    this.kbx += kx * kb; this.kby += ky * kb;
    if (this.hp <= 0) this.die(g);
  }

  die(g: Game) {
    if (this.dead) return;
    this.dead = true;
    g.onEnemyKilled(this);
  }

  toPlayer(g: Game): [number, number, number] {
    const dx = g.player.x - this.x, dy = g.player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d, d];
  }

  shootAt(g: Game, ax: number, ay: number, speed = 4.5, z = 0.45, extra: Partial<Projectile> = {}) {
    const p = new Projectile(this.x + ax * this.r, this.y + ay * this.r, z, true);
    p.vx = ax * speed; p.vy = ay * speed;
    p.r = 0.13; p.dmg = SHOT_DMG; p.range = 14;
    p.color = '#ff5a4a';
    Object.assign(p, extra);
    g.projectiles.push(p);
    return p;
  }

  drawShadow(ctx: CanvasRenderingContext2D, cam: Camera) {
    if (this.spawnT > 0) return;
    shadow(ctx, cam, this.x, this.y, this.r * 0.9, this.z > 0.2 ? 0.22 : 0.35);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    if (this.spawnT > 0) {
      const [sx, sy, s] = cam.project(this.x, this.y, 0.3);
      const p = 1 - this.spawnT / 0.6;
      ctx.fillStyle = `rgba(200,200,220,${0.5 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(sx, sy, (0.2 + p * 0.4) * s, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (this.elite) {
      const [sx, sy, s] = cam.project(this.x, this.y, this.z + this.r);
      ctx.fillStyle = `rgba(255,210,60,${0.18 + 0.1 * Math.sin(this.t * 6)})`;
      ctx.beginPath(); ctx.arc(sx, sy, this.r * s * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = this.alpha;
    this.drawBody(ctx, cam, g);
    ctx.globalAlpha = 1;
    if (this.invulnerable) {
      const [sx, sy, s] = cam.project(this.x, this.y, this.z + this.r);
      ctx.strokeStyle = `rgba(140,220,255,${0.5 + 0.3 * Math.sin(this.t * 8)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy, this.r * s * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
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
        for (let i = 0; i < 5; i++)
          for (const side of [-1, 1]) {
            const ang = Math.PI * (0.55 + i * 0.09);
            ctx.beginPath();
            ctx.ellipse(sx - side * Math.cos(ang) * rad * 0.7, topY + rad * 0.55 - Math.sin(ang) * rad * 0.7, rad * 0.13, rad * 0.07, side * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
        break;
    }
  }
}

// ---------------- normale Gegner ----------------

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
    const w = this.r * s * squash * 1.1, h = (this.r * s / squash) * 1.25;
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
        const base = Math.atan2(dy, dx);
        if (g.difficulty >= 4 || this.elite) for (const off of [-0.25, 0, 0.25]) this.shootAt(g, Math.cos(base + off), Math.sin(base + off));
        else this.shootAt(g, dx, dy);
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
  state: 'walk' | 'charge' | 'stun' = 'walk';
  timer = 0;
  cdx = 0; cdy = 0;
  wdx = 1; wdy = 0; wt = 0;
  cooldown = 1;
  behave(g: Game, dt: number) {
    this.timer -= dt; this.cooldown -= dt;
    if (this.state === 'walk') {
      this.wt -= dt;
      if (this.wt <= 0) { const d = randPick([[1, 0], [-1, 0], [0, 1], [0, -1]]); this.wdx = d[0]; this.wdy = d[1]; this.wt = rand(0.8, 1.6); }
      if (g.moveCircle(this, this.wdx * 1.2 * dt, this.wdy * 1.2 * dt, false)) this.wt = 0;
      const dx = g.player.x - this.x, dy = g.player.y - this.y;
      if (this.cooldown <= 0 && Math.hypot(dx, dy) < 8) {
        if (Math.abs(dy) < 0.45) { this.cdx = Math.sign(dx); this.cdy = 0; this.state = 'charge'; }
        else if (Math.abs(dx) < 0.45) { this.cdx = 0; this.cdy = Math.sign(dy); this.state = 'charge'; }
      }
    } else if (this.state === 'charge') {
      if (g.moveCircle(this, this.cdx * 7.5 * dt, this.cdy * 7.5 * dt, false)) { this.state = 'stun'; this.timer = 0.8; g.camera.addShake(3); g.audio.sfx('door'); }
    } else if (this.timer <= 0) { this.state = 'walk'; this.cooldown = 0.8; }
  }
  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const [sx, sy, s] = cam.project(this.x, this.y, 0);
    const rad = this.r * s;
    const shake = this.state === 'charge' ? Math.sin(this.t * 60) * rad * 0.05 : 0;
    const w = rad * 1.9, h = rad * 1.7;
    ctx.fillStyle = this.col();
    rrect(ctx, sx - w / 2 + shake, sy - h, w, h, rad * 0.4); ctx.fill();
    ctx.fillStyle = shade(this.look.color, -0.3);
    ctx.fillRect(sx - w / 2 + shake, sy - h * 0.35, w, h * 0.12);
    ctx.fillStyle = this.look.accent;
    ctx.fillRect(sx - w * 0.3 + shake, sy - h * 0.25, w * 0.6, h * 0.18);
    if (this.state === 'stun') stars(ctx, sx, sy - h * 1.15, rad, this.t);
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

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function stars(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, t: number) {
  ctx.fillStyle = '#ffe066';
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + i * 2.1;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * rad * 0.7, y + Math.sin(a) * rad * 0.2, rad * 0.1, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------- Boss ----------------

interface OrbitShot { p: Projectile; a: number }

export class Boss extends Enemy {
  isBoss = true;
  contact = 15;
  spawnT = 0.01;
  skills: SkillId[];
  state: 'intro' | 'idle' | SkillId = 'intro';
  timer = 1.2;
  sub = 0;
  last: SkillId | null = null;
  tx = 0; ty = 0; dx = 0; dy = 0;
  wanderT = 0;
  orbit: OrbitShot[] = [];
  trail: [number, number][] = [];
  half = false;
  cdMult: number;
  bonus: number;   // zusätzliche Kugeln durch Prestige
  speed: number;

  constructor(x: number, y: number, public def: BossDef, look: EnemyLook, acc: Acc, hp: number,
    public prestige: number, public endboss: boolean) {
    super(x, y, hp, look, acc);
    this.r = def.size * (endboss ? 1.15 : 1);
    this.flying = def.move === 'hover';
    this.skills = [...def.skills];
    // Prestige: neue Fähigkeiten, schneller, mehr Kugeln
    const extra = (prestige >= 2 ? 1 : 0) + (prestige >= 5 ? 1 : 0) + (prestige >= 8 ? 1 : 0) + (endboss ? 1 : 0);
    const pool = ALL_SKILLS.filter((s) => !this.skills.includes(s) && s !== 'clone');
    for (let i = 0; i < extra && pool.length; i++) this.skills.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.cdMult = Math.pow(0.94, prestige);
    this.bonus = Math.floor(prestige / 2);
    this.speed = def.speed * (1 + prestige * 0.05);
  }

  get enraged() { return this.hp < this.maxHp * 0.4; }
  count(n: number) { return n + this.bonus + (this.enraged ? 2 : 0); }

  behave(g: Game, dt: number) {
    this.timer -= dt;
    if (this.def.shape === 'worm') {
      this.trail.unshift([this.x, this.y]);
      if (this.trail.length > 40) this.trail.pop();
    }
    this.updateOrbit(g, dt);
    if (this.state === 'intro') { if (this.timer <= 0) this.toIdle(); return; }
    if (this.state === 'idle') {
      this.move(g, dt);
      if (this.timer <= 0) this.startSkill(g);
      return;
    }
    this.runSkill(g, dt);
  }

  toIdle(t = 1.1) {
    this.state = 'idle';
    this.timer = t * this.cdMult * (this.enraged ? 0.7 : 1);
    this.invulnerable = false;
    this.alpha = 1;
    this.z = this.flying ? 0.35 : 0;
  }

  move(g: Game, dt: number) {
    const sp = this.speed;
    if (sp <= 0) return;
    const [dx, dy, d] = this.toPlayer(g);
    switch (this.def.move) {
      case 'chase': g.moveCircle(this, dx * sp * dt, dy * sp * dt, this.flying); break;
      case 'hover': {
        const want = d > 4 ? 1 : d < 2.5 ? -1 : 0;
        const side = Math.sin(this.t * 0.8);
        g.moveCircle(this, (dx * want - dy * side) * sp * dt, (dy * want + dx * side) * sp * dt, true);
        this.z = 0.35 + Math.sin(this.t * 2) * 0.1;
        break;
      }
      case 'wander':
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.tx = rand(1.5, g.room.w - 1.5); this.ty = rand(1.5, g.room.h - 1.5); this.wanderT = rand(1.5, 3); }
        { const [wx, wy] = norm(this.tx - this.x, this.ty - this.y); g.moveCircle(this, wx * sp * dt, wy * sp * dt, this.flying); }
        break;
    }
  }

  startSkill(g: Game) {
    let opts = this.skills.filter((s) => s !== this.last);
    if (!opts.length) opts = this.skills;
    const s = randPick(opts);
    this.last = s;
    this.state = s;
    this.sub = 0;
    this.timer = 0.5;
    switch (s) {
      case 'jump': this.timer = 1.4; this.tx = this.x; this.ty = this.y; break;
      case 'spiral': this.timer = 2.4; this.dx = Math.random() * 6; break;
      case 'dashSide': this.timer = 0.4; this.sub = 0; break;
      case 'charge': this.timer = 0.55; break;
      case 'teleport': this.timer = 0.35; break;
      case 'puddle': this.timer = 3; break;
      case 'vacuum': this.timer = 2.4; break;
      case 'laser': {
        this.timer = 1.3;
        const [dx, dy] = this.toPlayer(g);
        const n = this.enraged || this.prestige >= 4 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.45;
          g.hazards.push(new Hazard('line', this.x, this.y, 0.28, 0.8, 0.4, 20, 'rgba(255,80,80,0.9)', this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 30));
        }
        break;
      }
      case 'shieldMinions': this.timer = 8; break;
    }
  }

  runSkill(g: Game, dt: number) {
    const s = this.state as SkillId;
    switch (s) {
      case 'burst':
        if (this.timer <= 0) {
          const n = this.count(10);
          for (let i = 0; i < n; i++) { const a = this.sub * 0.3 + (i / n) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 3.8, 0.8); }
          g.audio.sfx('shot'); this.sub++; this.timer = 0.45;
          if (this.sub >= (this.enraged ? 3 : 2)) this.toIdle();
        }
        break;
      case 'spray':
        if (this.timer <= 0) {
          const [dx, dy] = this.toPlayer(g);
          const base = Math.atan2(dy, dx), n = this.count(5);
          for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.16; this.shootAt(g, Math.cos(a), Math.sin(a), 5, 0.8); }
          g.audio.sfx('shot'); this.sub++; this.timer = 0.35;
          if (this.sub >= 3) this.toIdle();
        }
        break;
      case 'spiral':
        this.sub += dt;
        if (this.sub > 0.09) {
          this.sub = 0;
          this.dx += 0.33;
          const arms = 2 + Math.min(3, this.bonus) + (this.enraged ? 1 : 0);
          for (let i = 0; i < arms; i++) { const a = this.dx + (i / arms) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 3.6, 0.8); }
          g.audio.sfx('shot');
        }
        if (this.timer <= 0) this.toIdle(1.3);
        break;
      case 'jump': {
        const p = 1 - this.timer / 1.4;
        if (p < 0.75) {
          this.tx += (g.player.x - this.tx) * Math.min(1, dt * 3);
          this.ty += (g.player.y - this.ty) * Math.min(1, dt * 3);
          this.z = Math.min(6, this.z + dt * 14);
          if (this.z > 4) { this.x = this.tx; this.y = this.ty; }
        } else this.z = Math.max(0, this.z - dt * 30);
        if (this.timer <= 0) {
          this.z = 0;
          this.x = Math.max(this.r, Math.min(g.room.w - this.r, this.x));
          this.y = Math.max(this.r, Math.min(g.room.h - this.r, this.y));
          g.camera.addShake(8); g.audio.sfx('bomb');
          g.ring(this.x, this.y, 1.6, 0.35, 'rgba(255,220,180,0.5)');
          const n = this.count(8);
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 4.2, 0.3); }
          if (Math.hypot(g.player.x - this.x, g.player.y - this.y) < this.r + 0.5 && !g.player.flying) g.hurtPlayer(20);
          this.toIdle();
        }
        break;
      }
      case 'summon':
        if (this.timer <= 0) {
          if (g.minionCount() < 5) for (let i = 0; i < 2 + Math.floor(this.bonus / 2); i++) g.spawnMinion('flyer', this.x + rand(-1, 1), this.y + rand(0.5, 1.2));
          this.toIdle();
        }
        break;
      case 'necro':
        // erweckt Untote an den Stellen, wo Gegner gestorben sind
        if (this.timer <= 0) {
          const spots = g.room.decals.slice(-4).map((d) => [d.x, d.y] as [number, number]);
          while (spots.length < 3) spots.push([rand(1, g.room.w - 1), rand(1, g.room.h - 1)]);
          if (g.minionCount() < 6) for (const [x, y] of spots.slice(0, 3 + Math.floor(this.bonus / 2))) {
            g.burst(x, y, 0.2, '#8a7ab0', 10);
            g.spawnMinion('runner', x, y);
          }
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04);
          this.toIdle(1.4);
        }
        break;
      case 'dashSide': {
        // 0: auf Spielerhöhe ausrichten, 1: Warnlinie, 2: Sprint quer durch den Raum
        const phase = this.sub % 3;
        if (phase === 0) {
          const dy = g.player.y - this.y;
          g.moveCircle(this, 0, Math.sign(dy) * Math.min(Math.abs(dy), 6 * dt), this.flying);
          if (this.timer <= 0) {
            this.dx = this.x < g.room.w / 2 ? 1 : -1;
            g.hazards.push(new Hazard('line', this.x, this.y, this.r * 0.8, 0.5, 0.01, 0, 'rgba(0,0,0,0)', this.dx > 0 ? g.room.w : 0, this.y));
            this.sub++; this.timer = 0.5;
          }
        } else if (phase === 1) {
          if (this.timer <= 0) { this.sub++; this.timer = 3; }
        } else {
          const hit = g.moveCircle(this, this.dx * 13 * dt, 0, this.flying);
          if (Math.random() < 0.5) g.particles.push(new Particle(this.x, this.y, 0.3, 0, 0, 0, this.look.color, 0.1, 0.3, 0));
          if (hit || this.timer <= 0) {
            g.camera.addShake(4);
            this.sub++; this.timer = 0.3;
            if (this.sub >= 9 || (!this.enraged && this.sub >= 6)) this.toIdle(1.2);
          }
        }
        break;
      }
      case 'charge':
        if (this.sub === 0) {
          if (this.timer <= 0) { const [dx, dy] = this.toPlayer(g); this.dx = dx; this.dy = dy; this.sub = 1; this.timer = 2; }
        } else if (this.sub === 1) {
          if (g.moveCircle(this, this.dx * 9 * dt, this.dy * 9 * dt, false) || this.timer <= 0) {
            g.camera.addShake(6); g.audio.sfx('door');
            const n = this.count(6);
            for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 3.5, 0.5); }
            this.sub = 2; this.timer = 0.7;
          }
        } else if (this.timer <= 0) this.toIdle();
        break;
      case 'laser':
        if (this.timer <= 0) this.toIdle();
        break;
      case 'teleport':
        this.alpha = Math.max(0.1, this.timer / 0.35);
        if (this.timer <= 0) {
          for (let k = 0; k < 20; k++) {
            const x = rand(1.2, g.room.w - 1.2), y = rand(1.2, g.room.h - 1.2);
            if (Math.hypot(x - g.player.x, y - g.player.y) > 3.5 && !g.room.isSolid(Math.floor(x), Math.floor(y))) { this.x = x; this.y = y; break; }
          }
          const n = this.count(8);
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 3.5, 0.6); }
          g.audio.sfx('use');
          this.toIdle(0.9);
        }
        break;
      case 'bounce':
        if (this.timer <= 0) {
          const n = this.count(6);
          for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2); this.shootAt(g, Math.cos(a), Math.sin(a), 4, 0.5, { bounces: 3, color: '#ffa040', range: 30 }); }
          g.audio.sfx('shot'); this.sub++; this.timer = 0.6;
          if (this.sub >= 2) this.toIdle();
        }
        break;
      case 'homing':
        if (this.timer <= 0) {
          const n = 2 + Math.min(4, this.bonus) + (this.enraged ? 1 : 0);
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 2.6, 0.7, { homing: true, color: '#c060ff', r: 0.17, range: 16 }); }
          g.audio.sfx('shot');
          this.toIdle(1.4);
        }
        break;
      case 'mines':
        if (this.timer <= 0) {
          const n = this.count(5);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), d = rand(1.5, 3.5);
            const x = Math.max(0.5, Math.min(g.room.w - 0.5, this.x + Math.cos(a) * d)), y = Math.max(0.5, Math.min(g.room.h - 0.5, this.y + Math.sin(a) * d));
            g.hazards.push(new Hazard('circle', x, y, 0.9, 1.6, 0.25, 20, 'rgba(255,170,60,0.75)'));
          }
          this.toIdle(1.2);
        }
        break;
      case 'rain':
        if (this.timer <= 0) {
          const n = this.count(5);
          for (let i = 0; i < n; i++) {
            const x = Math.max(0.5, Math.min(g.room.w - 0.5, g.player.x + rand(-2.5, 2.5)));
            const y = Math.max(0.5, Math.min(g.room.h - 0.5, g.player.y + rand(-2, 2)));
            g.hazards.push(new Hazard('circle', x, y, 0.75, 1.0 + i * 0.12, 0.2, 15, 'rgba(255,120,60,0.8)'));
          }
          this.toIdle(1.3);
        }
        break;
      case 'orbit':
        if (this.timer <= 0 && this.sub === 0) {
          const n = this.count(6);
          for (let i = 0; i < n; i++) {
            const p = this.shootAt(g, 0, 0, 0, 0.6, { color: '#80e0ff', range: 99 });
            this.orbit.push({ p, a: (i / n) * Math.PI * 2 });
          }
          this.sub = 1; this.timer = 3;
        } else if (this.sub === 1) {
          this.move(g, dt);
          if (this.timer <= 0) {
            for (const o of this.orbit) { o.p.vx = Math.cos(o.a) * 4.5; o.p.vy = Math.sin(o.a) * 4.5; o.p.range = 14; o.p.traveled = 0; }
            this.orbit = [];
            g.audio.sfx('shot');
            this.toIdle();
          }
        }
        break;
      case 'clone':
        if (this.timer <= 0) {
          if (g.minionCount() < 4) for (const side of [-1, 1]) {
            const c = g.spawnMinion('shooter', this.x + side * 1.5, this.y);
            c.look = this.look; c.r = this.r * 0.6; c.hp = c.maxHp = this.maxHp * 0.12;
          }
          this.toIdle(1.4);
        }
        break;
      case 'puddle': {
        const [dx, dy] = this.toPlayer(g);
        g.moveCircle(this, dx * (this.speed + 1) * dt, dy * (this.speed + 1) * dt, this.flying);
        this.sub += dt;
        if (this.sub > 0.28) { this.sub = 0; g.hazards.push(new Hazard('circle', this.x, this.y, 0.55, 0.15, 4, 10, 'rgba(120,200,60,0.35)', 0, 0, true)); }
        if (this.timer <= 0) this.toIdle();
        break;
      }
      case 'vacuum': {
        const p = g.player;
        const [dx, dy] = norm(this.x - p.x, this.y - p.y);
        if (!p.flying) g.moveCircle(p, dx * 2.4 * dt, dy * 2.4 * dt, false);
        if (Math.random() < 0.5) g.particles.push(new Particle(this.x + rand(-3, 3), this.y + rand(-2, 2), 0.3, dx * -3, dy * -3, 0, 'rgba(200,220,255,0.6)', 0.04, 0.4, 0));
        this.sub += dt;
        if (this.sub > 0.6) {
          this.sub = 0;
          const n = this.count(8);
          for (let i = 0; i < n; i++) { const a = this.t + (i / n) * Math.PI * 2; this.shootAt(g, Math.cos(a), Math.sin(a), 3, 0.6); }
        }
        if (this.timer <= 0) this.toIdle();
        break;
      }
      case 'shieldMinions':
        if (this.sub === 0) {
          for (let i = 0; i < 3; i++) g.spawnMinion('hopper', this.x + rand(-2, 2), this.y + rand(-1.5, 1.5));
          this.invulnerable = true; this.sub = 1;
        } else {
          this.move(g, dt);
          if (g.minionCount() === 0 || this.timer <= 0) this.toIdle();
        }
        break;
      case 'wave': {
        if (this.timer <= 0) {
          // Kugelwand mit Lücke, quer durch den Raum
          const horizontal = Math.abs(g.player.x - this.x) > Math.abs(g.player.y - this.y);
          const len = horizontal ? g.room.h : g.room.w;
          const gap = rand(1, len - 2);
          const dir = horizontal ? Math.sign(g.player.x - this.x) || 1 : Math.sign(g.player.y - this.y) || 1;
          for (let v = 0.5; v < len; v += 0.55) {
            if (Math.abs(v - gap) < 1.0) continue;
            const p = new Projectile(horizontal ? this.x : v, horizontal ? v : this.y, 0.5, true);
            p.vx = horizontal ? dir * 3.2 : 0; p.vy = horizontal ? 0 : dir * 3.2;
            p.r = 0.14; p.dmg = SHOT_DMG; p.range = 30; p.color = '#ff7a4a';
            g.projectiles.push(p);
          }
          g.audio.sfx('shot');
          this.sub++; this.timer = 1.0;
          if (this.sub >= (this.enraged ? 3 : 2)) this.toIdle();
        }
        break;
      }
    }
  }

  updateOrbit(g: Game, dt: number) {
    if (!this.orbit.length) return;
    this.orbit = this.orbit.filter((o) => !o.p.dead);
    for (const o of this.orbit) {
      o.a += dt * 2.5;
      o.p.x = this.x + Math.cos(o.a) * (this.r + 0.9);
      o.p.y = this.y + Math.sin(o.a) * (this.r + 0.9);
      o.p.vx = o.p.vy = 0; o.p.traveled = 0;
    }
    void g;
  }

  die(g: Game) {
    if (this.dead) return;
    for (const o of this.orbit) o.p.dead = true;
    this.orbit = [];
    if (this.def.split && !this.half) {
      for (const side of [-1, 1]) {
        const b = new Boss(this.x + side * 0.8, this.y, { ...this.def, size: this.def.size * 0.65 }, this.look, this.acc, this.maxHp * 0.4, this.prestige, false);
        b.half = true; b.state = 'idle'; b.timer = 0.8;
        g.room.enemies.push(b);
      }
    }
    super.die(g);
  }

  drawShadow(ctx: CanvasRenderingContext2D, cam: Camera) {
    const jumping = this.state === 'jump';
    shadow(ctx, cam, jumping && this.z > 4 ? this.tx : this.x, jumping && this.z > 4 ? this.ty : this.y, this.r * (jumping ? 1.1 : 0.95), 0.4);
  }

  drawBody(ctx: CanvasRenderingContext2D, cam: Camera, g: Game) {
    const breathe = 1 + Math.sin(this.t * 3) * 0.04;
    const [sx, sy, s] = cam.project(this.x, this.y, this.z);
    const rad = this.r * s;
    const c = this.col();
    switch (this.def.shape) {
      case 'blob': {
        const w = rad * 1.15 * breathe, h = (rad * 1.1) / breathe;
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(sx, sy - h, w, h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(sx - w * 0.4, sy - h * 1.5, w * 0.25, h * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
        this.drawEyes(ctx, sx, sy - h * 1.15, rad, g, '#1a1020', true);
        ctx.fillStyle = '#2a0810'; ctx.beginPath(); ctx.ellipse(sx, sy - h * 0.6, w * 0.35, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        this.drawAccessory(ctx, sx, sy - h * 2, rad);
        break;
      }
      case 'eye': {
        const cy = sy - rad * 1.05;
        ball(ctx, sx, cy, rad * breathe, this.flash > 0 ? '#fff' : '#f4f0f0');
        ctx.strokeStyle = 'rgba(200,40,40,0.5)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) { const a = i; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * rad * 0.95, cy + Math.sin(a) * rad * 0.95); ctx.lineTo(sx + Math.cos(a) * rad * 0.55, cy + Math.sin(a) * rad * 0.55); ctx.stroke(); }
        const [dx, dy] = norm(g.player.x - this.x, g.player.y - this.y);
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx + dx * rad * 0.35, cy + dy * rad * 0.25, rad * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#100810'; ctx.beginPath(); ctx.arc(sx + dx * rad * 0.45, cy + dy * rad * 0.3, rad * 0.2, 0, Math.PI * 2); ctx.fill();
        this.drawAccessory(ctx, sx, cy - rad, rad);
        break;
      }
      case 'brute': {
        const w = rad * 2.1, h = rad * 1.9;
        ctx.fillStyle = c; rrect(ctx, sx - w / 2, sy - h, w, h, rad * 0.5); ctx.fill();
        ctx.fillStyle = shade(this.look.color, -0.3); ctx.fillRect(sx - w / 2, sy - h * 0.3, w, h * 0.1);
        ctx.fillStyle = '#e8dcc0';
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx + side * w * 0.3, sy - h); ctx.lineTo(sx + side * w * 0.5, sy - h * 1.35); ctx.lineTo(sx + side * w * 0.15, sy - h * 0.95); ctx.fill(); }
        this.drawEyes(ctx, sx, sy - h * 0.7, rad, g, this.state === 'charge' || this.state === 'dashSide' ? '#ff2010' : '#1a1020', true);
        this.drawAccessory(ctx, sx, sy - h, rad);
        break;
      }
      case 'spider': {
        ctx.strokeStyle = shade(this.look.color, -0.3); ctx.lineWidth = Math.max(2, rad * 0.12);
        for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
          const ph = Math.sin(this.t * 10 + i) * rad * 0.15;
          ctx.beginPath(); ctx.moveTo(sx, sy - rad * 0.7);
          ctx.quadraticCurveTo(sx + side * rad * (0.8 + i * 0.2), sy - rad * 1.4 + ph, sx + side * rad * (1.1 + i * 0.25), sy - rad * 0.05 + i * rad * 0.05);
          ctx.stroke();
        }
        ball(ctx, sx, sy - rad * 0.75, rad * 0.85, c);
        ball(ctx, sx, sy - rad * 0.55, rad * 0.45, shade(this.look.color, -0.2));
        this.drawEyes(ctx, sx, sy - rad * 0.95, rad * 0.8, g, '#ff2020');
        this.drawAccessory(ctx, sx, sy - rad * 1.6, rad);
        break;
      }
      case 'ghost': {
        const cy = sy - rad * 1.2;
        ctx.fillStyle = c; ctx.beginPath();
        ctx.arc(sx, cy, rad, Math.PI, 0);
        for (let i = 0; i <= 6; i++) ctx.lineTo(sx + rad - (i / 6) * rad * 2, cy + rad * (1 + (i % 2 ? 0.25 : 0) + Math.sin(this.t * 6 + i) * 0.08));
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0a0612';
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx + side * rad * 0.35, cy - rad * 0.1, rad * 0.16, rad * 0.25, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = this.look.accent;
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(sx + side * rad * 0.35, cy - rad * 0.05, rad * 0.06, 0, Math.PI * 2); ctx.fill(); }
        this.drawAccessory(ctx, sx, cy - rad, rad);
        break;
      }
      case 'skull': {
        const cy = sy - rad * 1.2;
        ball(ctx, sx, cy, rad, c);
        ctx.fillStyle = c; ctx.fillRect(sx - rad * 0.55, cy + rad * 0.5, rad * 1.1, rad * 0.5);
        ctx.fillStyle = '#100810';
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(sx + side * rad * 0.38, cy, rad * 0.25, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(sx, cy + rad * 0.2); ctx.lineTo(sx - rad * 0.1, cy + rad * 0.4); ctx.lineTo(sx + rad * 0.1, cy + rad * 0.4); ctx.fill();
        for (let i = -2; i <= 2; i++) ctx.fillRect(sx + i * rad * 0.2 - rad * 0.04, cy + rad * 0.6, rad * 0.08, rad * 0.3);
        ctx.fillStyle = this.look.accent;
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(sx + side * rad * 0.38, cy, rad * 0.08, 0, Math.PI * 2); ctx.fill(); }
        this.drawAccessory(ctx, sx, cy - rad, rad);
        break;
      }
      case 'worm': {
        for (let i = this.trail.length - 1; i >= 0; i -= 6) {
          const [tx, ty] = this.trail[i];
          const [px, py, ps] = cam.project(tx, ty, 0);
          ball(ctx, px, py - this.r * ps * 0.7, this.r * ps * (0.8 - i * 0.008), shade(this.look.color, -0.15 - i * 0.004));
        }
        ball(ctx, sx, sy - rad * 0.9, rad, c);
        this.drawEyes(ctx, sx, sy - rad, rad, g, '#1a1020', true);
        this.drawAccessory(ctx, sx, sy - rad * 1.9, rad);
        break;
      }
      case 'crystal': {
        const cy = sy - rad * 1.3;
        ctx.save(); ctx.translate(sx, cy);
        const rot = this.t * 0.8;
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * Math.PI * 2; const rr = i % 2 ? rad * 0.7 : rad * 1.05; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 1.25); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.moveTo(0, -rad * 1.2); ctx.lineTo(rad * 0.4, 0); ctx.lineTo(0, rad * 0.2); ctx.closePath(); ctx.fill();
        ctx.restore();
        this.drawEyes(ctx, sx, cy, rad * 0.8, g, '#1a1020');
        this.drawAccessory(ctx, sx, cy - rad * 1.2, rad);
        break;
      }
    }
  }
}

export function createEnemy(kind: EnemyKind, x: number, y: number, world: WorldDef, hpScale: number): Enemy {
  const acc = world.accessory;
  switch (kind) {
    case 'flyer': return new Flyer(x, y, 6 * hpScale, world.enemies.flyer, acc);
    case 'hopper': return new Hopper(x, y, 11 * hpScale, world.enemies.hopper, acc);
    case 'shooter': return new Shooter(x, y, 12 * hpScale, world.enemies.shooter, acc);
    case 'charger': return new Charger(x, y, 16 * hpScale, world.enemies.charger, acc);
    case 'runner': return new Runner(x, y, 8 * hpScale, world.enemies.runner, acc);
  }
}

export function createBoss(def: BossDef, x: number, y: number, world: WorldDef, hpScale: number, prestige: number, endboss: boolean): Boss {
  const look: EnemyLook = { name: def.name, color: def.color, accent: world.boss.accent };
  const hp = def.hp * hpScale * (1 + prestige * 0.3);
  return new Boss(x, y, def, look, world.accessory, hp, prestige, endboss);
}
