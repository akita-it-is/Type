// Spieler, Projektile, Bomben, Pickups, Gefahrenzonen und Effekte.
import { BOMB, INVULN_TIME, PLAYER_RADIUS, Stats } from '../core/config';
import type { Camera } from '../core/camera';
import { norm, rand } from '../core/util';
import { ABILITIES, AbilityId } from '../data/characters';
import type { ConsumableItem, WeaponSpec } from '../data/items';
import { ball, drawHero, HeroLook, shadow } from './draw';
import { Assets, drawItemIcon } from '../core/assets';
import type { Game } from './game';
import { RunInventory } from './inventory';
import { drawSetFx, drawWeapon, emitSetParticles } from './playerfx';

export interface ControlState {
  mx: number; my: number;       // Bewegung (-1..1)
  ax: number; ay: number;       // Zielrichtung (normiert)
  shooting: boolean;
  ability: boolean; item: boolean; consumable: boolean; cycle: boolean; menu: boolean; // in diesem Frame gedrückt
}

const DEFAULT_WEAPON: WeaponSpec = { type: 'orb', damageMult: 1, delayMult: 1, rangeMult: 1 };

export class Player {
  x = 6.5; y = 3.5; z = 0;
  vx = 0; vy = 0;
  r = PLAYER_RADIUS;
  stats!: Stats;
  hp = 0;
  invuln = 0;
  fireCd = 0;
  faceX = 0; faceY = 1;
  walk = 0;
  buffs = { rage: 0, shield: 0, haste: 0 };
  abilityCd = 0;
  dashT = 0; dashX = 0; dashY = 0;
  flyT = 0;
  regenAcc = 0;
  shotSide = 1;
  spriteKeys: string[] = [];
  fullSets: string[] = [];   // komplette Rüstungs-Sets (3/3) -> sichtbarer Effekt
  weaponKick = 0;
  swingT = 0;
  boomerangOut = false;

  constructor(public charMods: Partial<Stats>, public look: HeroLook, public tearColor: string,
    public ability: AbilityId, public inv: RunInventory) {
    this.recalc(true);
  }

  /** Werte neu berechnen (nach Inventar-Änderungen) */
  recalc(full = false) {
    const oldMax = this.stats?.maxHp ?? 0;
    this.stats = this.inv.computeStats(this.charMods);
    if (full) this.hp = this.stats.maxHp;
    else if (this.stats.maxHp > oldMax) this.hp += this.stats.maxHp - oldMax;
    this.hp = Math.min(this.hp, this.stats.maxHp);
    this.fullSets = Object.entries(this.inv.setCounts()).filter(([, n]) => n >= 3).map(([id]) => id);
  }

  get weapon(): WeaponSpec { return this.inv.weapon?.weapon ?? DEFAULT_WEAPON; }
  get flying() { return this.flyT > 0; }
  get vulnerable() { return this.invuln <= 0 && this.buffs.shield <= 0 && this.dashT <= 0; }

  update(g: Game, dt: number, c: ControlState) {
    const b = this.buffs;
    b.rage = Math.max(0, b.rage - dt); b.shield = Math.max(0, b.shield - dt); b.haste = Math.max(0, b.haste - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.flyT = Math.max(0, this.flyT - dt);
    this.z += ((this.flyT > 0 ? 0.7 : 0) - this.z) * Math.min(1, dt * 8);

    if (g.inCombat && this.stats.regen > 0) {
      this.regenAcc += this.stats.regen * dt;
      if (this.regenAcc >= 1) { const n = Math.floor(this.regenAcc); this.regenAcc -= n; this.hp = Math.min(this.stats.maxHp, this.hp + n); }
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      g.moveCircle(this, this.dashX * 15 * dt, this.dashY * 15 * dt, this.flying);
      if (Math.random() < 0.6) g.particles.push(new Particle(this.x, this.y, 0.4, 0, 0, 0, this.look.cloak, 0.08, 0.25, 0));
    } else {
      const speed = this.stats.speed * (b.haste > 0 ? 1.35 : 1);
      const acc = Math.min(1, dt * 14);
      this.vx += (c.mx * speed - this.vx) * acc;
      this.vy += (c.my * speed - this.vy) * acc;
      g.moveCircle(this, this.vx * dt, this.vy * dt, this.flying);
    }
    const moving = Math.hypot(this.vx, this.vy) > 0.3;
    this.walk = moving ? this.walk + dt : 0;

    if (c.shooting) { this.faceX = c.ax; this.faceY = c.ay; }
    else if (moving) { const n = norm(this.vx, this.vy); this.faceX = n[0]; this.faceY = n[1]; }

    this.fireCd -= dt;
    if (c.shooting && this.fireCd <= 0) {
      this.fireCd = this.stats.fireDelay * this.weapon.delayMult;
      this.attack(g, c.ax, c.ay);
    }
    if (c.ability) this.useAbility(g, c);
    this.weaponKick = Math.max(0, this.weaponKick - dt * 8);
    this.swingT = Math.max(0, this.swingT - dt);
    this.boomerangOut = this.weapon.type === 'boomerang' && g.projectiles.some((p) => p.boomerang && !p.dead);
    emitSetParticles(g, this, dt);
  }

  useAbility(g: Game, c: ControlState) {
    if (this.abilityCd > 0) { g.audio.sfx('error'); return; }
    const ab = ABILITIES[this.ability];
    this.abilityCd = ab.cooldown;
    g.audio.sfx('use');
    switch (this.ability) {
      case 'dash': {
        let [dx, dy] = norm(c.mx, c.my);
        if (!dx && !dy) [dx, dy] = norm(this.faceX, this.faceY);
        if (!dx && !dy) dy = 1;
        this.dashX = dx; this.dashY = dy; this.dashT = 0.16;
        break;
      }
      case 'fly': this.flyT = 3; break;
      case 'bomb': g.placeBomb(this.x, this.y + 0.05); break;
      case 'timeslow': g.slowTime = Math.max(g.slowTime, 3); break;
      case 'shield': this.buffs.shield = 2; break;
    }
  }

  baseDamage() { return this.stats.damage * this.weapon.damageMult * (this.buffs.rage > 0 ? 2 : 1); }

  attack(g: Game, ax: number, ay: number) {
    const s = this.stats, w = this.weapon;
    const range = s.range * w.rangeMult;
    const dmg = this.baseDamage();
    const base = Math.atan2(ay, ax);
    this.shotSide *= -1;
    this.weaponKick = 1;
    if (w.type === 'sword') this.swingT = 0.18;
    const make = (a: number, opts: Partial<Projectile> = {}) => {
      const dx = Math.cos(a), dy = Math.sin(a);
      const p = new Projectile(this.x + dx * 0.25 - dy * 0.08 * this.shotSide, this.y + dy * 0.25, 0.62 + this.z, false);
      p.vx = dx * s.shotSpeed + this.vx * 0.3; p.vy = dy * s.shotSpeed + this.vy * 0.3;
      p.r = s.tearSize; p.dmg = dmg; p.range = range; p.pierce = s.piercing; p.homing = s.homing;
      p.color = this.buffs.rage > 0 ? '#ff6a3a' : this.tearColor;
      p.crit = Math.random() < s.crit;
      Object.assign(p, opts);
      if (p.speedMult !== 1) { p.vx *= p.speedMult; p.vy *= p.speedMult; p.speedMult = 1; }
      g.projectiles.push(p);
      return p;
    };
    const fan = (n: number, spread: number, opts: Partial<Projectile> = {}) => {
      for (let i = 0; i < n; i++) make(base + (n > 1 ? (i - (n - 1) / 2) * spread : 0), opts);
    };
    switch (w.type) {
      case 'orb': fan(s.multishot + (w.extraShots || 0), 0.2); g.audio.sfx('shoot'); break;
      case 'shotgun': fan(4 + s.multishot * 2, 0.13, { range: range * rand(0.8, 1.1) }); g.audio.sfx('shot'); break;
      case 'sniper': fan(s.multishot, 0.12, { pierce: true, r: s.tearSize * 1.2, speedMult: 2 }); g.audio.sfx('shoot'); break;
      case 'boomerang': fan(s.multishot, 0.3, { pierce: true, boomerang: true, r: s.tearSize * 1.4, spin: true }); g.audio.sfx('shoot'); break;
      case 'flame':
        for (let i = 0; i < Math.max(1, s.multishot); i++)
          make(base + rand(-0.18, 0.18), { pierce: true, flame: true, r: s.tearSize * rand(0.8, 1.3), range: range * rand(0.7, 1.1) });
        break;
      case 'sword': g.slash(this.x, this.y, ax, ay, 1.25 * w.rangeMult + s.tearSize, dmg * (Math.random() < s.crit ? 2 : 1)); break;
      case 'beam': g.beam(this.x, this.y, ax, ay, range, dmg * (Math.random() < s.crit ? 2 : 1)); break;
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const [sx, sy, s] = cam.project(this.x, this.y, this.z);
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    if (this.flyT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const f = Math.sin(performance.now() / 50) * 0.15;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(sx + side * 0.32 * s, sy - 0.45 * s, 0.25 * s, (0.12 + f * 0.5) * s, side * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawSetFx(ctx, cam, this, 'back');
    const weaponBehind = this.faceY < -0.3;
    if (weaponBehind) drawWeapon(ctx, cam, this);
    if (!Assets.draw(ctx, Assets.pick(this.spriteKeys), sx, sy, s, { t: performance.now() / 1000, dirX: this.faceX, dirY: this.faceY, moving: this.walk > 0, alpha: blink ? 0.35 : 1 }))
      drawHero(ctx, sx, sy, s, this.look, { faceX: this.faceX, faceY: this.faceY, walk: this.walk, alpha: blink ? 0.35 : 1 });
    if (!weaponBehind) drawWeapon(ctx, cam, this);
    drawSetFx(ctx, cam, this, 'front');
    if (this.buffs.shield > 0) {
      ctx.strokeStyle = `rgba(140,200,255,${0.4 + 0.3 * Math.sin(performance.now() / 80)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx, sy - 0.45 * s, 0.5 * s, 0.6 * s, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawShadow(ctx: CanvasRenderingContext2D, cam: Camera) { shadow(ctx, cam, this.x, this.y, 0.28, this.z > 0.2 ? 0.2 : 0.35); }

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
  crit = false;
  bounces = 0;
  boomerang = false;
  returning = false;
  flame = false;
  spin = false;
  speedMult = 1;
  hit = new Set<object>();
  dead = false;
  falling = false;
  age = 0;
  constructor(public x: number, public y: number, public z: number, public enemy: boolean) {}

  update(g: Game, dt: number) {
    this.age += dt;
    if (this.homing && !this.falling) this.steer(g, dt);
    if (this.boomerang && this.returning) {
      const p = g.player;
      const [dx, dy] = norm(p.x - this.x, p.y - this.y);
      const sp = Math.hypot(this.vx, this.vy);
      this.vx = dx * sp; this.vy = dy * sp;
      if (Math.hypot(p.x - this.x, p.y - this.y) < 0.4) { this.dead = true; return; }
    }
    const f = this.enemy ? g.enemyTimeScale : 1;
    const ox = this.x, oy = this.y;
    this.x += this.vx * dt * f;
    this.y += this.vy * dt * f;
    this.traveled += Math.hypot(this.vx, this.vy) * dt * f;
    if (this.boomerang && !this.returning && this.traveled > this.range * 0.6) { this.returning = true; this.hit.clear(); }
    if (this.traveled > this.range && !this.boomerang) this.falling = true;
    if (this.boomerang && this.traveled > this.range * 2.5) this.falling = true;
    if (this.falling) {
      if (this.flame) { this.dead = true; return; }
      this.vz -= 16 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0.05) return this.splash(g);
    }
    const room = g.room;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    const out = this.x < 0 || this.y < 0 || this.x >= room.w || this.y >= room.h;
    if (out || room.isSolid(tx, ty)) {
      if (this.bounces > 0) {
        this.bounces--;
        const hx = Math.floor(this.x) !== Math.floor(ox) && (this.x < 0 || this.x >= room.w || room.isSolid(tx, Math.floor(oy)));
        if (hx) this.vx = -this.vx; else this.vy = -this.vy;
        this.x = ox; this.y = oy;
        return;
      }
      if (this.boomerang && !out) { this.returning = true; this.x = ox; this.y = oy; return; }
      return this.splash(g);
    }
  }

  private steer(g: Game, dt: number) {
    let tx = 0, ty = 0, found = false;
    if (this.enemy) { tx = g.player.x; ty = g.player.y; found = true; }
    else {
      let bd = 5;
      for (const e of g.room.enemies) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < bd) { bd = d; tx = e.x; ty = e.y; found = true; }
      }
    }
    if (!found) return;
    const sp = Math.hypot(this.vx, this.vy);
    const a = Math.atan2(this.vy, this.vx);
    let da = Math.atan2(ty - this.y, tx - this.x) - a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const turn = (this.enemy ? 1.8 : 5) * dt;
    const na = a + Math.max(-turn, Math.min(turn, da));
    this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
  }

  splash(g: Game) {
    this.dead = true;
    if (this.flame) return;
    for (let i = 0; i < 4; i++)
      g.particles.push(new Particle(this.x, this.y, Math.max(0.05, this.z), rand(-1.5, 1.5), rand(-1.5, 1.5), rand(1, 3), this.color, 0.05, 0.35));
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    // Spieler-Schüsse: Höhe wie bei aufrechten Figuren (kommt aus der Waffe)
    let [sx, sy, s] = cam.project(this.x, this.y, this.enemy ? this.z : 0);
    if (!this.enemy) sy -= this.z * s;
    const rad = Math.max(2, this.r * s);
    if (this.flame) {
      const life = Math.min(1, this.traveled / this.range);
      ctx.globalAlpha = 1 - life * 0.7;
      ctx.fillStyle = life < 0.3 ? '#fff0a0' : life < 0.6 ? '#ff9a30' : '#d04020';
      ctx.beginPath(); ctx.arc(sx, sy, rad * (1 + life), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (this.spin) {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.age * 18);
      ctx.fillStyle = '#c89a5a';
      ctx.fillRect(-rad * 1.6, -rad * 0.35, rad * 3.2, rad * 0.7);
      ctx.fillRect(-rad * 0.35, -rad * 1.6, rad * 0.7, rad * 1.6);
      ctx.restore();
      return;
    }
    if (Assets.icon(ctx, this.enemy ? 'shot_enemy' : 'shot_player', sx, sy, rad * 2.4)) return;
    ball(ctx, sx, sy, rad, this.color);
    if (this.enemy) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

export class Bomb {
  t = BOMB.fuse;
  dead = false;
  constructor(public x: number, public y: number, public byEnemy = false) {}
  update(g: Game, dt: number) {
    this.t -= dt;
    if (this.t <= 0) { this.dead = true; g.explode(this.x, this.y, this.byEnemy); }
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

export type PickupType = 'heart' | 'halfheart' | 'coin' | 'consumable';

export class Pickup {
  z = 0.6; vz = 2.5;
  vx = 0; vy = 0;
  dead = false;
  t = Math.random() * 6;
  constructor(public x: number, public y: number, public type: PickupType, public item: ConsumableItem | null = null, public value = 1) {}
  update(g: Game, dt: number) {
    this.t += dt;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 12 * dt;
      this.z += this.vz * dt;
      if (this.z < 0) { this.z = 0; this.vz = Math.abs(this.vz) > 1.5 ? -this.vz * 0.4 : 0; }
    }
    if (this.vx || this.vy) {
      g.moveCircle(this as any, this.vx * dt, this.vy * dt, false);
      this.vx *= 1 - dt * 4; this.vy *= 1 - dt * 4;
      if (Math.abs(this.vx) + Math.abs(this.vy) < 0.05) this.vx = this.vy = 0;
    }
    if (this.type === 'coin' && g.player.stats.magnet) {
      const dx = g.player.x - this.x, dy = g.player.y - this.y, d = Math.hypot(dx, dy);
      if (d < 4 && d > 0.01) { this.x += (dx / d) * 6 * dt; this.y += (dy / d) * 6 * dt; }
    }
  }
  get r() { return 0.15; }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const hover = this.type === 'consumable' ? 0.15 + Math.sin(this.t * 3) * 0.05 : 0;
    const [sx, sy, s] = cam.project(this.x, this.y, this.z + 0.18 + hover);
    switch (this.type) {
      case 'heart': case 'halfheart':
        if (Assets.icon(ctx, this.type, sx, sy, 0.45 * s)) break;
        drawHeartShape(ctx, sx, sy, 0.2 * s, this.type === 'heart' ? 1 : 0.5); break;
      case 'coin': {
        if (Assets.draw(ctx, 'coin', sx, sy + 0.12 * s, s, { t: this.t, moving: true })) break;
        const w = Math.abs(Math.cos(this.t * 4));
        const big = this.value > 1;
        ctx.fillStyle = big ? '#ffd860' : '#f2c230';
        const rr = (big ? 0.19 : 0.14) * s;
        ctx.beginPath(); ctx.ellipse(sx, sy, rr * Math.max(0.2, w), rr, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a07010'; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      }
      case 'consumable':
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(sx, sy, 0.26 * s, 0, Math.PI * 2); ctx.fill();
        if (this.item) drawItemIcon(ctx, this.item, sx, sy, 0.42 * s);
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
    ctx.fillStyle = '#e8303a'; ctx.fillRect(x - size * 1.5, y - size * 1.5, size * 3 * fill, size * 3);
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
    ctx.globalAlpha = Math.min(1, (this.life / this.maxLife) * 2);
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

/** Linien-Effekt (Laser, Schwerthieb-Bogen) */
export class LineFx {
  t = 0; dead = false;
  constructor(public x1: number, public y1: number, public x2: number, public y2: number, public width: number, public color: string, public dur = 0.15, public z = 0.6, public upright = false) {}
  update(dt: number) { this.t += dt; if (this.t > this.dur) this.dead = true; }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const a = cam.project(this.x1, this.y1, this.upright ? 0 : this.z), b = cam.project(this.x2, this.y2, this.upright ? 0 : this.z);
    if (this.upright) { a[1] -= this.z * a[2]; b[1] -= this.z * b[2]; }
    ctx.globalAlpha = 1 - this.t / this.dur;
    ctx.strokeStyle = this.color; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, this.width * (a[2] + b[2]) / 2);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth *= 0.35;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }
}

export class SlashFx {
  t = 0; dead = false;
  constructor(public x: number, public y: number, public angle: number, public range: number, public dur = 0.16) {}
  update(dt: number) { this.t += dt; if (this.t > this.dur) this.dead = true; }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const p = this.t / this.dur;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    const n = 10, a0 = this.angle - 0.9, a1 = this.angle + 0.9;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      const q = cam.project(this.x + Math.cos(a) * this.range, this.y + Math.sin(a) * this.range, 0.5);
      if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + (a1 - a0) * (i / n);
      const q = cam.project(this.x + Math.cos(a) * this.range * 0.55, this.y + Math.sin(a) * this.range * 0.55, 0.5);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/**
 * Gefahrenzone (Boss-Angriffe): erst Warnung, dann Schaden.
 * Kreis (Meteor, Mine, Gift) oder Linie (Laser, Sprint-Bahn).
 */
export class Hazard {
  t = 0; dead = false; hitDone = false;
  constructor(
    public shape: 'circle' | 'line',
    public x: number, public y: number, public r: number,
    public warn: number, public active: number, public dmg: number, public color: string,
    public x2 = 0, public y2 = 0, public tick = false,
  ) {}
  get live() { return this.t >= this.warn; }
  update(g: Game, dt: number) {
    this.t += dt * g.enemyTimeScale;
    if (this.t > this.warn + this.active) { this.dead = true; return; }
    if (!this.live || this.dmg <= 0) return;
    if (this.hitDone && !this.tick) return;
    const p = g.player;
    if (p.flying && this.shape === 'circle' && this.tick) return;
    if (this.contains(p.x, p.y, p.r * 0.6)) { g.hurtPlayer(this.dmg); this.hitDone = true; }
  }
  contains(px: number, py: number, pr: number) {
    if (this.shape === 'circle') return Math.hypot(px - this.x, py - this.y) < this.r + pr;
    const dx = this.x2 - this.x, dy = this.y2 - this.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - this.x) * dx + (py - this.y) * dy) / l2));
    return Math.hypot(px - (this.x + dx * t), py - (this.y + dy * t)) < this.r + pr;
  }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const warnP = Math.min(1, this.t / Math.max(0.01, this.warn));
    if (this.shape === 'circle') {
      const [sx, sy, s] = cam.project(this.x, this.y, 0.02);
      ctx.beginPath(); ctx.ellipse(sx, sy, this.r * s, this.r * s * cam.sp, 0, 0, Math.PI * 2);
      if (!this.live) {
        ctx.strokeStyle = 'rgba(255,60,60,0.8)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = `rgba(255,60,60,${0.12 + warnP * 0.2})`; ctx.fill();
      } else {
        ctx.fillStyle = this.color; ctx.fill();
      }
    } else {
      const a = cam.project(this.x, this.y, this.live ? 0.5 : 0.02), b = cam.project(this.x2, this.y2, this.live ? 0.5 : 0.02);
      ctx.lineCap = 'round';
      ctx.strokeStyle = this.live ? this.color : `rgba(255,60,60,${0.25 + warnP * 0.35})`;
      ctx.lineWidth = Math.max(2, this.r * 2 * (a[2] + b[2]) / 2 * (this.live ? 1 : 0.5));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      if (this.live) { ctx.strokeStyle = '#fff'; ctx.lineWidth *= 0.3; ctx.stroke(); }
      ctx.lineCap = 'butt';
    }
  }
}

export class FloatText {
  t = 0; dead = false;
  constructor(public x: number, public y: number, public text: string, public color = '#fff', public dur = 1.0) {}
  update(dt: number) { this.t += dt; if (this.t > this.dur) this.dead = true; }
  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const [sx, sy, s] = cam.project(this.x, this.y, 1.2 + this.t * 0.8);
    ctx.globalAlpha = Math.max(0, Math.min(1, (this.dur - this.t) * 3));
    ctx.font = `bold ${Math.round(Math.max(12, 0.32 * s))}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(this.text, sx, sy);
    ctx.fillStyle = this.color; ctx.fillText(this.text, sx, sy);
    ctx.globalAlpha = 1;
  }
}

export { BOMB };
