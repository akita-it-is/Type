// Spiel-Logik eines Runs. Bewusst getrennt von Rendering, Eingabe und Menüs,
// damit eine spätere Portierung (PC/Konsole) einfacher ist.
import { Camera } from '../core/camera';
import { BOMB, DEATH_LOSES_LOADOUT, MAX_PRESTIGE, ROUNDS_PER_WORLD } from '../core/config';
import type { AudioEngine } from '../core/audio';
import { makeRng, norm, rand, randPick, Rng } from '../core/util';
import { addToStash, Loadout, loadoutIds, Profile, saveProfile, vibrate, worldProgress } from '../core/save';
import { charById } from '../data/characters';
import { skinById } from '../data/skins';
import { ItemDef, itemsOfKind, randomItem, RARITIES, RARITY_INFO, StatMods } from '../data/items';
import { playableWorlds, WorldDef, worldIndex } from '../data/worlds';
import { miniBossFor } from '../data/bosses';
import { Dir, Floor, generateFloor, OPPOSITE, Pedestal, Room, TILE_FLOOR, TILE_ROCK, TILE_SPIKE } from './dungeon';
import { Boss, createBoss, createEnemy, Enemy } from './enemies';
import {
  Bomb, ControlState, FloatText, Hazard, LineFx, Particle, Pickup, PickupType, Player, Projectile, Ring, SlashFx,
} from './entities';
import { ItemRef, RunInventory } from './inventory';

export interface RunConfig {
  mode: 'world' | 'arcade';
  world: WorldDef;
  round: number;
  prestige: number;
  loadout: Loadout;
}

export interface RunResult {
  type: 'extract' | 'dead' | 'worldclear';
  coins: number;
  kills: number;
  rounds: number;
  items: number;
  score: number;
  newBest: boolean;
  prestige: number;
}

export interface AltarBoost { name: string; icon: string; mods: StatMods }
const ALTAR_BOOSTS: AltarBoost[] = [
  { name: 'Kraft', icon: '💪', mods: { damageMult: 0.1 } },
  { name: 'Eile', icon: '🏃', mods: { speed: 0.3 } },
  { name: 'Vitalität', icon: '❤️', mods: { maxHp: 20 } },
  { name: 'Schnellfeuer', icon: '⚡', mods: { fireRateMult: 0.1 } },
  { name: 'Panzer', icon: '🛡️', mods: { armor: 5 } },
  { name: 'Glück', icon: '🍀', mods: { luck: 1.5 } },
  { name: 'Weitblick', icon: '🔭', mods: { range: 1.2 } },
  { name: 'Präzision', icon: '🎯', mods: { crit: 0.06 } },
];
export const RARITY_FACTOR = [1, 1.5, 2, 3, 4];

export function scaleMods(m: StatMods, f: number): StatMods {
  const r: StatMods = {};
  for (const [k, v] of Object.entries(m)) (r as any)[k] = typeof v === 'number' ? Math.round(v * f * 100) / 100 : v;
  return r;
}

interface Mover { x: number; y: number; r: number }
interface Fx { dead: boolean; update(dt: number): void; draw(ctx: CanvasRenderingContext2D, cam: Camera): void }

export class Game {
  camera = new Camera();
  rng: Rng = makeRng();
  player: Player;
  inv: RunInventory;
  floor!: Floor;
  room!: Room;
  world: WorldDef;
  round: number;
  prestige: number;
  projectiles: Projectile[] = [];
  bombs: Bomb[] = [];
  particles: Particle[] = [];
  hazards: Hazard[] = [];
  fx: Fx[] = [];
  texts: FloatText[] = [];
  difficulty = 1;
  hpScale = 1;
  slowTime = 0;
  time = 0;
  transition: { t: number; dir: Dir; swapped: boolean } | null = null;
  banner: { title: string; sub: string; t: number } | null = null;
  toast: { text: string; t: number } | null = null;
  result: RunResult | null = null;
  deathT = 0;
  kills = 0;
  bossKills = 0;
  roundsCleared = 0;
  runCoins = 0;
  revivesUsed = 0;
  spikeT = 0;
  altarOpen = false;
  altarOffers: AltarBoost[] = [];
  portalT = 0;

  constructor(public cfg: RunConfig, public audio: AudioEngine, public profile: Profile) {
    this.world = cfg.world;
    this.round = cfg.round;
    this.prestige = cfg.prestige;
    const ch = charById(profile.char);
    const sk = skinById(profile.skin);
    this.inv = RunInventory.fromLoadout(cfg.loadout);
    this.player = new Player(ch.mods, { cloak: sk.cloak || ch.body, skin: sk.skin, hat: ch.hat }, sk.tear, ch.ability, this.inv);
    this.player.spriteKeys = [`char_${ch.id}_${sk.id}`, `char_${ch.id}`];
    if (cfg.mode === 'world') profile.stats.runs++;
    this.newFloor();
  }

  get enemyTimeScale() { return this.slowTime > 0 ? 0.45 : 1; }
  get inCombat() { return this.room.enemies.some((e: Enemy) => e.active); }
  get isFinalRound() { return this.cfg.mode === 'world' && this.round >= ROUNDS_PER_WORLD; }

  newFloor() {
    if (this.cfg.mode === 'arcade') {
      const ws = playableWorlds();
      this.world = ws[Math.floor((this.round - 1) / 3) % ws.length];
    }
    const wi = Math.max(0, worldIndex(this.world));
    this.difficulty = 1 + (this.round - 1) * 0.3 + this.prestige * 1.5 + wi * 0.5;
    this.hpScale = 1 + (this.difficulty - 1) * 0.18;
    const rng = this.rng;
    const mobs = Math.max(2, Math.min(8, 2 + Math.floor((this.round - 1) / 4) + rng.int(0, 2) + Math.floor(this.prestige / 2)));
    this.floor = generateFloor({
      mobRooms: mobs, altar: rng.chance(0.35), difficulty: this.difficulty,
      eliteChance: Math.min(0.3, 0.05 + this.round * 0.008 + this.prestige * 0.02), rng,
    });
    for (const r of this.floor.rooms) this.furnish(r);
    this.enterRoom(this.floor.start, null);
    this.audio.playMusic(this.world.music);
    const title = this.cfg.mode === 'arcade' ? `Arcade – Runde ${this.round}` : `${this.world.name} – Runde ${this.round}/${ROUNDS_PER_WORLD}`;
    const sub = this.prestige > 0 ? `Prestige ${this.prestige}` : this.isFinalRound ? 'Endboss-Runde!' : 'Finde den Boss';
    this.showBanner(title, sub);
  }

  /** Item-, Shop- und Altarräume einrichten */
  private furnish(r: Room) {
    const luck = this.player.stats.luck;
    const depth = this.round / 4 + this.prestige;
    const cx = r.w / 2, cy = r.h / 2;
    if (r.type === 'item') {
      const it = randomItem(this.rng, luck, depth, ['weapon', 'armor', 'passive', 'active']);
      r.pedestals.push({ x: cx, y: cy, item: it, price: 0, lock: false });
    } else if (r.type === 'shop') {
      const items: ItemDef[] = [];
      for (let i = 0; i < 3; i++) items.push(randomItem(this.rng, luck, depth, ['weapon', 'armor', 'passive', 'active'], items.map((x) => x.id)));
      items.push(randomItem(this.rng, luck, depth, ['consumable']));
      const xs = [cx - 3, cx - 1, cx + 1, cx + 3];
      items.forEach((it, i) => r.pedestals.push({ x: xs[i], y: cy - 0.5, item: it, price: this.priceOf(it), lock: false }));
      const heart = itemsOfKind('consumable').find((c) => c.id === 'potion')!;
      r.pedestals.push({ x: cx, y: cy + 1.4, item: heart, price: 15, lock: false, heart: true });
    }
  }

  priceOf(it: ItemDef) {
    const base = RARITY_INFO[it.rarity].price;
    return Math.round(base * (it.kind === 'consumable' ? 0.6 : 1) * (1 + this.prestige * 0.1));
  }

  showBanner(title: string, sub: string) { this.banner = { title, sub, t: 2.6 }; }
  showToast(text: string) { this.toast = { text, t: 1.8 }; }

  enterRoom(room: Room, exitDir: Dir | null) {
    this.room = room;
    room.visited = true; room.seen = true;
    for (const n of Object.values(room.doors)) if (n) n.seen = true;
    this.camera.setRoom(room.w, room.h);
    this.projectiles.length = 0; this.bombs.length = 0; this.particles.length = 0;
    this.hazards.length = 0; this.fx.length = 0; this.texts.length = 0;
    this.altarOpen = false;
    const p = this.player;
    p.vx = p.vy = 0;
    if (!exitDir) { p.x = room.w / 2; p.y = room.h / 2 + 1; }
    else {
      const enter = OPPOSITE[exitDir];
      if (enter === 'up') { p.x = room.doorX + 0.5; p.y = 0.6; }
      if (enter === 'down') { p.x = room.doorX + 0.5; p.y = room.h - 0.6; }
      if (enter === 'left') { p.x = 0.6; p.y = room.doorY + 0.5; }
      if (enter === 'right') { p.x = room.w - 0.6; p.y = room.doorY + 0.5; }
    }
    for (const pd of room.pedestals) pd.lock = false;
    if (!room.cleared && !room.spawned) {
      room.spawned = true;
      for (const s of room.spawns) {
        if (s.kind === 'boss') {
          const bx = Math.max(2, Math.min(room.w - 2, room.w - p.x));
          const by = Math.max(1.8, Math.min(room.h - 1.8, room.h - p.y));
          const final = this.isFinalRound || (this.cfg.mode === 'arcade' && this.round % 10 === 0);
          const def = final ? this.world.endboss : miniBossFor(Math.max(0, worldIndex(this.world)), this.round);
          const boss = createBoss(def, bx, by, this.world, this.hpScale * (final ? 1 : 1), this.prestige, final);
          room.enemies.push(boss);
        } else {
          const e = createEnemy(s.kind, s.x, s.y, this.world, this.hpScale);
          if (s.elite) e.makeElite();
          room.enemies.push(e);
        }
      }
      this.audio.sfx('door');
    }
    if (room.type === 'boss' && !room.cleared) {
      this.audio.playMusic('boss');
      const b = room.enemies.find((e: Enemy) => e.isBoss) as Boss | undefined;
      if (b) this.showBanner(b.def.name, b.endboss ? 'ENDBOSS' : 'Miniboss');
    }
  }

  spawnMinion(kind: Parameters<typeof createEnemy>[0], x: number, y: number) {
    const e = createEnemy(kind, Math.max(0.5, Math.min(this.room.w - 0.5, x)), Math.max(0.5, Math.min(this.room.h - 0.5, y)), this.world, this.hpScale * 0.8);
    e.noLoot = true; e.spawnT = 0.4;
    this.room.enemies.push(e);
    return e;
  }

  minionCount() { return this.room.enemies.filter((e: Enemy) => !e.isBoss && !e.dead).length; }

  get boss(): Boss | null {
    return (this.room.enemies.find((e: Enemy) => e.isBoss && !e.dead) as Boss) || null;
  }

  doorOpen(d: Dir) { return !!this.room.doors[d] && this.room.cleared; }

  // ---------------- Kollision ----------------

  private solidAt(tx: number, ty: number, flying: boolean, isPlayer: boolean): boolean {
    const r = this.room;
    if (tx >= 0 && ty >= 0 && tx < r.w && ty < r.h) return r.isSolid(tx, ty, flying);
    if (!isPlayer) return true;
    if (tx === r.doorX && ty === -1 && this.doorOpen('up')) return false;
    if (tx === r.doorX && ty === r.h && this.doorOpen('down')) return false;
    if (ty === r.doorY && tx === -1 && this.doorOpen('left')) return false;
    if (ty === r.doorY && tx === r.w && this.doorOpen('right')) return false;
    return true;
  }

  private axis(e: Mover, ax: 'x' | 'y', d: number, flying: boolean, isPlayer: boolean): boolean {
    if (d === 0) return false;
    e[ax] += d;
    const r = e.r;
    const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r - 1e-6);
    const y0 = Math.floor(e.y - r), y1 = Math.floor(e.y + r - 1e-6);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.solidAt(tx, ty, flying, isPlayer)) continue;
        if (ax === 'x') e.x = d > 0 ? tx - r - 1e-4 : tx + 1 + r + 1e-4;
        else e.y = d > 0 ? ty - r - 1e-4 : ty + 1 + r + 1e-4;
        return true;
      }
    return false;
  }

  moveCircle(e: Mover, dx: number, dy: number, flying: boolean): boolean {
    const isPlayer = e === this.player;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2));
    let hit = false;
    for (let i = 0; i < steps; i++) {
      hit = this.axis(e, 'x', dx / steps, flying, isPlayer) || hit;
      hit = this.axis(e, 'y', dy / steps, flying, isPlayer) || hit;
    }
    return hit;
  }

  // ---------------- Update ----------------

  update(dt: number, c: ControlState) {
    this.time += dt;
    this.camera.update(dt, this.profile.settings.screenShake);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }

    if (this.transition) {
      const tr = this.transition;
      tr.t += dt;
      if (!tr.swapped && tr.t >= 0.16) { tr.swapped = true; this.enterRoom(this.room.doors[tr.dir]!, tr.dir); }
      if (tr.t >= 0.32) this.transition = null;
      return;
    }
    if (this.result) return;
    const p = this.player;
    if (p.hp <= 0) {
      this.deathT += dt;
      for (const pt of this.particles) pt.update(dt);
      if (this.deathT > 1.4) this.finish('dead');
      return;
    }

    this.slowTime = Math.max(0, this.slowTime - dt);
    const combat = this.inCombat;
    if (combat && this.inv.activeCd > 0) {
      this.inv.activeCd = Math.max(0, this.inv.activeCd - dt);
      if (this.inv.activeCd === 0) this.audio.sfx('charge');
    }

    this.doorAssist(c);
    p.update(this, dt, c);
    if (c.item) this.useActive();
    if (c.consumable) this.useConsumable();
    if (c.cycle) { this.inv.nextConsumable(); this.audio.sfx('click'); }

    const enemies: Enemy[] = this.room.enemies;
    for (const e of enemies) e.update(this, dt);
    this.separateEnemies(enemies);

    // Kontakt-Schaden (+ Dornen)
    for (const e of enemies) {
      if (!e.active || e.z > 0.5) continue;
      if (p.flying && !e.flying) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r * 0.75) {
        if (p.vulnerable && p.stats.thorns > 0) e.hurt(this, p.stats.thorns, 0, 0);
        this.hurtPlayer(e.contact);
      }
    }

    this.updateProjectiles(dt, enemies);

    for (const b of this.bombs) b.update(this, dt);
    this.bombs = this.bombs.filter((b) => !b.dead);
    for (const h of this.hazards) h.update(this, dt);
    this.hazards = this.hazards.filter((h) => !h.dead);
    this.room.enemies = this.room.enemies.filter((e: Enemy) => !e.dead);

    // Stacheln
    this.spikeT -= dt;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (!p.flying && tx >= 0 && ty >= 0 && tx < this.room.w && ty < this.room.h && this.room.tiles[ty][tx] === TILE_SPIKE && this.spikeT <= 0 && p.vulnerable) {
      this.hurtPlayer(10); this.spikeT = 0.5;
    }

    this.updatePickups(dt);
    this.updateSpecialRooms(dt);

    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter((x) => !x.dead);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
    for (const f of this.fx) f.update(dt);
    this.fx = this.fx.filter((x) => !x.dead);
    for (const t of this.texts) t.update(dt);
    this.texts = this.texts.filter((x) => !x.dead);

    if (!this.room.cleared && this.room.spawned && this.room.enemies.length === 0) this.onRoomCleared();

    let exit: Dir | null = null;
    if (p.y < -0.25) exit = 'up';
    else if (p.y > this.room.h + 0.25) exit = 'down';
    else if (p.x < -0.25) exit = 'left';
    else if (p.x > this.room.w + 0.25) exit = 'right';
    if (exit && this.room.doors[exit]) this.transition = { t: 0, dir: exit, swapped: false };
  }

  private updateProjectiles(dt: number, enemies: Enemy[]) {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.update(this, dt);
      if (pr.dead) continue;
      if (pr.enemy) {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.r * 0.8 + pr.r && pr.z < 1.4) {
          if (p.vulnerable) { this.hurtPlayer(pr.dmg); pr.splash(this); }
        }
      } else {
        for (const e of enemies) {
          if (!e.active || pr.hit.has(e)) continue;
          if (Math.hypot(pr.x - e.x, pr.y - e.y) < e.r + pr.r && Math.abs(pr.z - (e.z + e.r)) < e.r + 0.7) {
            const sp = Math.hypot(pr.vx, pr.vy) || 1;
            this.damageEnemy(e, pr.dmg * (pr.crit ? 2 : 1), pr.vx / sp, pr.vy / sp, pr.crit);
            pr.hit.add(e);
            if (!pr.pierce) { pr.splash(this); break; }
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((x) => !x.dead);
  }

  damageEnemy(e: Enemy, dmg: number, kx: number, ky: number, crit = false) {
    e.hurt(this, dmg, kx, ky);
    this.audio.sfx('hit');
    this.burst(e.x, e.y, e.z + e.r, e.look.color, 3);
    if (crit) this.texts.push(new FloatText(e.x, e.y, 'KRIT!', '#ffe066', 0.6));
  }

  private doorAssist(c: ControlState) {
    const p = this.player, r = this.room;
    const pull = (axis: 'x' | 'y', target: number) => { const d = target - p[axis]; if (Math.abs(d) < 0.6) p[axis] += d * 0.25; };
    if (c.my < -0.4 && p.y < 1.0 && this.doorOpen('up')) pull('x', r.doorX + 0.5);
    if (c.my > 0.4 && p.y > r.h - 1.0 && this.doorOpen('down')) pull('x', r.doorX + 0.5);
    if (c.mx < -0.4 && p.x < 1.0 && this.doorOpen('left')) pull('y', r.doorY + 0.5);
    if (c.mx > 0.4 && p.x > r.w - 1.0 && this.doorOpen('right')) pull('y', r.doorY + 0.5);
  }

  private separateEnemies(list: Enemy[]) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (!a.active || !b.active) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), min = (a.r + b.r) * 0.85;
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2, nx = dx / d, ny = dy / d;
          const wa = a.isBoss ? 0.1 : 1, wb = b.isBoss ? 0.1 : 1;
          this.moveCircle(a, -nx * push * wa, -ny * push * wa, a.flying);
          this.moveCircle(b, nx * push * wb, ny * push * wb, b.flying);
        }
      }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const pk of this.room.pickups as Pickup[]) {
      pk.update(this, dt);
      if (pk.z > 0.3) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > p.r + 0.25) continue;
      this.collect(pk);
    }
    this.room.pickups = this.room.pickups.filter((x: Pickup) => !x.dead);

    // Sockel (Items, Shop)
    for (const pd of this.room.pedestals) {
      const d = Math.hypot(p.x - pd.x, p.y - pd.y);
      if (d > 0.9) pd.lock = false;
      if (d < p.r + 0.32 && !pd.lock) this.tryPedestal(pd);
    }
  }

  private tryPedestal(pd: Pedestal) {
    pd.lock = true;
    const p = this.player;
    if (pd.price > 0 && this.runCoins < pd.price) { this.showToast(`Zu wenig Münzen (${pd.price} 🪙)`); this.audio.sfx('error'); return; }
    if (pd.heart) {
      if (p.hp >= p.stats.maxHp) { this.showToast('Du bist schon voll geheilt'); return; }
      this.runCoins -= pd.price;
      this.room.pedestals.splice(this.room.pedestals.indexOf(pd), 1);
      this.healPlayer(40);
      return;
    }
    const res = this.inv.add(pd.item);
    if (res === 'full') {
      this.showToast(pd.item.kind === 'passive' ? 'Passiv-Plätze voll (10)' : pd.item.kind === 'consumable' ? 'Verbrauch-Plätze voll (5)' : 'Rucksack voll (5)');
      this.audio.sfx('error');
      return;
    }
    if (pd.price > 0) { this.runCoins -= pd.price; this.audio.sfx('coin'); }
    this.room.pedestals.splice(this.room.pedestals.indexOf(pd), 1);
    p.recalc();
    this.showBanner(pd.item.name, `${RARITY_INFO[pd.item.rarity].name} · ${pd.item.desc}${res === 'backpack' ? ' (Rucksack)' : ''}`);
    this.audio.sfx('item');
    vibrate(this.profile, 40);
  }

  private collect(pk: Pickup) {
    const p = this.player;
    switch (pk.type) {
      case 'heart': case 'halfheart':
        if (p.hp >= p.stats.maxHp) return;
        this.healPlayer(pk.type === 'heart' ? 20 : 10);
        break;
      case 'coin':
        this.runCoins += pk.value;
        this.audio.sfx('coin');
        break;
      case 'consumable': {
        if (!pk.item) return;
        if (this.inv.add(pk.item) === 'full') return;
        this.showToast(`${pk.item.icon} ${pk.item.name}`);
        this.audio.sfx('pickup');
        break;
      }
    }
    pk.dead = true;
  }

  private updateSpecialRooms(dt: number) {
    const p = this.player, r = this.room;
    if (r.type === 'altar' && !r.altarUsed) {
      const d = Math.hypot(p.x - r.w / 2, p.y - r.h / 2);
      if (d < 0.8 && !this.altarOpen) {
        if (!this.altarOffers.length) this.altarOffers = this.rng.shuffle(ALTAR_BOOSTS.slice()).slice(0, 3);
        this.altarOpen = true;
      }
      if (d > 1.6) this.altarOpen = false;
    }
    if (r.portals) {
      this.portalT += dt;
      if (this.portalT < 1) return;
      const [nx, ny] = this.nextPortalPos(), [ex, ey] = this.exitPortalPos();
      if (this.cfg.mode === 'arcade' || !this.isFinalRound) {
        if (Math.hypot(p.x - nx, p.y - ny) < 0.5) { r.portals = false; this.nextRound(); return; }
      }
      if (this.cfg.mode === 'world' && Math.hypot(p.x - ex, p.y - ey) < 0.5) {
        r.portals = false;
        this.finish(this.isFinalRound ? 'worldclear' : 'extract');
      }
    }
  }

  nextPortalPos(): [number, number] { return this.cfg.mode === 'arcade' ? [this.room.w / 2, this.room.h / 2] : [this.room.w / 2 - 2, this.room.h / 2]; }
  exitPortalPos(): [number, number] { return this.isFinalRound ? [this.room.w / 2, this.room.h / 2] : [this.room.w / 2 + 2, this.room.h / 2]; }

  /** Altar: Item opfern -> dauerhafter Bonus für diesen Run (stärker bei selteneren Items) */
  altarTrade(boost: AltarBoost, ref: ItemRef) {
    const it = this.inv.remove(ref);
    if (!it) return;
    const f = RARITY_FACTOR[RARITIES.indexOf(it.rarity)];
    this.inv.boosts.push(scaleMods(boost.mods, f));
    this.player.recalc();
    this.room.altarUsed = true;
    this.altarOpen = false;
    this.ring(this.room.w / 2, this.room.h / 2, 2, 0.6, 'rgba(200,120,255,0.5)');
    this.showBanner(`${boost.icon} ${boost.name}`, `${it.name} geopfert – Bonus x${f}`);
    this.audio.sfx('item');
  }

  /** Item aus dem Inventar auf den Boden legen */
  dropItem(ref: ItemRef) {
    const it = this.inv.remove(ref);
    if (!it) return;
    this.room.pedestals.push({ x: this.player.x, y: this.player.y, item: it, price: 0, lock: true });
    this.player.recalc();
    this.audio.sfx('click');
  }

  private onRoomCleared() {
    const r = this.room;
    r.cleared = true;
    this.audio.sfx('door');
    if (r.type === 'boss') {
      this.bossKills++;
      this.roundsCleared++;
      r.portals = true;
      this.portalT = 0;
      const cx = r.w / 2, cy = r.h / 2;
      // Belohnung: Item + Herz
      const it = randomItem(this.rng, this.player.stats.luck, this.round / 3 + this.prestige + 1, ['weapon', 'armor', 'passive', 'active']);
      r.pedestals.push({ x: cx, y: cy - 2, item: it, price: 0, lock: false });
      this.dropPickup(cx, cy + 1.8, 'heart');
      this.audio.playMusic(this.world.music);
      if (this.cfg.mode === 'arcade') this.showBanner('Boss besiegt!', 'Spring in die Falltür');
      else if (this.isFinalRound) this.showBanner('Welt geschafft!', 'Durch das Portal: Prestige steigt');
      else this.showBanner('Boss besiegt!', 'Links: nächste Runde · Rechts: Welt verlassen');
      vibrate(this.profile, [60, 40, 120]);
    } else if (this.rng.chance(0.3 + this.player.stats.luck * 0.03)) {
      const roll = this.rng();
      const type: PickupType = roll < 0.6 ? 'halfheart' : roll < 0.8 ? 'heart' : 'consumable';
      const [x, y] = this.freeSpotNear(r.w / 2, r.h / 2);
      this.dropPickup(x, y, type);
    }
  }

  private nextRound() {
    this.round++;
    this.audio.sfx('win');
    this.newFloor();
  }

  private freeSpotNear(x: number, y: number): [number, number] {
    for (let rad = 0; rad < 6; rad++)
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad; dx <= rad; dx++) {
          const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
          if (tx < 0 || ty < 0 || tx >= this.room.w || ty >= this.room.h) continue;
          if (this.room.tiles[ty][tx] === TILE_FLOOR) return [tx + 0.5, ty + 0.5];
        }
    return [x, y];
  }

  dropPickup(x: number, y: number, type: PickupType, value = 1) {
    const item = type === 'consumable' ? randomItem(this.rng, this.player.stats.luck, this.round / 4, ['consumable']) : null;
    const pk = new Pickup(x, y, type, item?.kind === 'consumable' ? item : null, value);
    this.room.pickups.push(pk);
    return pk;
  }

  dropCoins(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const pk = this.dropPickup(x, y, 'coin');
      const a = rand(0, Math.PI * 2), sp = n > 1 ? rand(1, 3) : 0;
      pk.vx = Math.cos(a) * sp; pk.vy = Math.sin(a) * sp;
    }
  }

  /** Run beenden: Verlassen (Items + Münzen behalten) oder Tod (alles verloren) */
  finish(type: RunResult['type']) {
    const prof = this.profile;
    const score = this.kills * 10 + this.roundsCleared * 250;
    let newBest = false;
    let coins = 0, items = 0;
    let prestige = this.prestige;
    prof.pendingLoadout = null;
    if (this.cfg.mode === 'arcade') {
      coins = Math.floor(this.runCoins / 2);
      prof.coins += coins;
      if (score > prof.arcadeBest) { prof.arcadeBest = score; newBest = true; }
    } else if (type === 'dead') {
      prof.stats.deaths++;
      if (!DEATH_LOSES_LOADOUT) {
        // mitgebrachte Ausrüstung zurück ins Lager
        for (const id of loadoutIds(this.cfg.loadout)) addToStash(prof, id);
      }
    } else {
      coins = this.runCoins;
      prof.coins += coins;
      const ids = this.inv.allIds();
      items = ids.length;
      for (const id of ids) addToStash(prof, id);
      prof.stats.kills += this.kills;
      prof.stats.bosses += this.bossKills;
      prof.stats.extractions++;
      const wp = worldProgress(prof, this.world.id);
      // Beim nächsten Mal startet die Welt wieder bei Runde 1
      wp.best = Math.max(wp.best, this.round);
      if (type === 'worldclear') {
        wp.clears++;
        wp.prestige = Math.min(MAX_PRESTIGE, wp.prestige + 1);
        prestige = wp.prestige;
      }
    }
    saveProfile(prof);
    this.result = { type, coins, kills: this.kills, rounds: this.roundsCleared, items, score, newBest, prestige };
    this.audio.sfx(type === 'dead' ? 'lose' : 'win');
    this.audio.playMusic('menu');
  }

  // ---------------- Aktionen ----------------

  hurtPlayer(dmg: number) {
    const p = this.player;
    if (!p.vulnerable || p.hp <= 0) return;
    const real = dmg * (1 - p.stats.armor / 100);
    p.hp -= real;
    p.hurtTimer();
    this.camera.addShake(6);
    this.audio.sfx('hurt');
    vibrate(this.profile, 80);
    this.burst(p.x, p.y, 0.5, '#c02030', 8);
    if (p.hp <= 0) {
      if (this.revivesUsed < p.stats.revive) {
        this.revivesUsed++;
        p.hp = p.stats.maxHp * 0.5;
        p.invuln = 2;
        this.ring(p.x, p.y, 2.5, 0.6, 'rgba(255,170,60,0.6)');
        this.showBanner('Wiederbelebt!', 'Phönixfeder');
        return;
      }
      p.hp = 0;
      this.burst(p.x, p.y, 0.5, p.look.cloak, 25);
    }
  }

  healPlayer(hp: number) {
    const p = this.player;
    p.hp = Math.min(p.stats.maxHp, p.hp + hp);
    this.audio.sfx('pickup');
    this.texts.push(new FloatText(p.x, p.y, '+♥', '#ff6070', 0.8));
  }

  placeBomb(x: number, y: number) { this.bombs.push(new Bomb(x, y)); }

  bombRain(n: number) {
    const targets = (this.room.enemies as Enemy[]).filter((e) => e.active);
    for (let i = 0; i < n; i++) {
      const t = targets.length ? randPick(targets) : null;
      const b = new Bomb(t ? t.x + rand(-0.5, 0.5) : rand(1, this.room.w - 1), t ? t.y + rand(-0.5, 0.5) : rand(1, this.room.h - 1));
      b.t = 0.6 + i * 0.15;
      this.bombs.push(b);
    }
  }

  useActive() {
    const a = this.inv.active;
    if (!a) { this.showToast('Kein aktives Item ausgerüstet'); this.audio.sfx('error'); return; }
    if (this.inv.activeCd > 0) { this.audio.sfx('error'); return; }
    this.inv.activeCd = a.cooldown;
    a.use(this);
    this.audio.sfx('use');
  }

  useConsumable() {
    const c = this.inv.currentConsumable();
    if (!c) { this.audio.sfx('error'); return; }
    this.inv.consumables[this.inv.selConsumable] = null;
    c.use(this);
    this.texts.push(new FloatText(this.player.x, this.player.y, c.name, '#fff', 1.2));
    this.audio.sfx('use');
    this.inv.nextConsumable();
  }

  explode(x: number, y: number, byEnemy = false) {
    const R = BOMB.radius;
    this.audio.sfx('bomb');
    this.camera.addShake(12);
    vibrate(this.profile, 120);
    this.ring(x, y, R, 0.35, 'rgba(255,200,80,0.6)');
    this.burst(x, y, 0.3, '#ffb040', 20, 5);
    this.burst(x, y, 0.3, '#555', 14, 3);
    const dmg = BOMB.damage * (1 + (this.difficulty - 1) * 0.1);
    for (const e of this.room.enemies as Enemy[]) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < R + e.r) e.hurt(this, dmg, (e.x - x) / (d || 1), (e.y - y) / (d || 1));
    }
    const p = this.player;
    if (Math.hypot(p.x - x, p.y - y) < R && (byEnemy || p.vulnerable)) this.hurtPlayer(20);
    for (let ty = 0; ty < this.room.h; ty++)
      for (let tx = 0; tx < this.room.w; tx++)
        if (this.room.tiles[ty][tx] === TILE_ROCK && Math.hypot(tx + 0.5 - x, ty + 0.5 - y) < R + 0.3) this.breakRock(tx, ty);
    this.room.decals.push({ x, y, r: 0.9, color: 'rgba(0,0,0,0.45)', rot: Math.random() * 3 });
  }

  breakRock(tx: number, ty: number) {
    this.room.tiles[ty][tx] = TILE_FLOOR;
    this.burst(tx + 0.5, ty + 0.5, 0.4, this.world.theme.rockTop, 10, 3);
    if (this.rng.chance(0.15)) this.dropCoins(tx + 0.5, ty + 0.5, 1);
  }

  onEnemyKilled(e: Enemy) {
    this.kills++;
    this.audio.sfx('enemyDie');
    this.burst(e.x, e.y, e.z + e.r, e.look.color, e.isBoss ? 40 : 12, e.isBoss ? 5 : 3);
    this.room.decals.push({ x: e.x, y: e.y, r: e.r * (e.isBoss ? 1.6 : 1.2), color: this.world.theme.decal, rot: Math.random() * 3 });
    if (this.room.decals.length > 40) this.room.decals.shift();
    const p = this.player;
    if (p.stats.lifesteal > 0) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.lifesteal);
    // Münzen: jedes Monster 1, starke 3–5, Bosse mehr
    if (e.isBoss) {
      const b = e as Boss;
      if (!b.half || true) this.dropCoins(e.x, e.y, b.endboss ? 25 : b.half ? 4 : this.rng.int(8, 12));
      this.camera.addShake(14);
      if (!this.room.enemies.some((o: Enemy) => o.isBoss && !o.dead && o !== e))
        for (const o of this.room.enemies as Enemy[]) if (!o.dead && o !== e) { o.noLoot = true; o.die(this); }
    } else if (!e.noLoot) {
      this.dropCoins(e.x, e.y, e.elite ? this.rng.int(3, 5) : 1);
      if (e.elite && this.rng.chance(0.08 + p.stats.luck * 0.01)) this.dropPickup(e.x, e.y, 'consumable');
    }
  }

  damageAllEnemies(dmg: number) {
    this.camera.addShake(8);
    for (const e of this.room.enemies as Enemy[]) {
      if (!e.active) continue;
      this.ring(e.x, e.y, 0.8, 0.3, 'rgba(255,255,140,0.6)');
      e.hurt(this, dmg * this.hpScale, 0, 0);
    }
  }

  radialPlayerShots(n: number) {
    const p = this.player;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const pr = new Projectile(p.x, p.y, 0.62, false);
      pr.vx = Math.cos(a) * p.stats.shotSpeed; pr.vy = Math.sin(a) * p.stats.shotSpeed;
      pr.r = p.stats.tearSize * 1.2; pr.dmg = p.stats.damage * 1.5; pr.range = p.stats.range;
      pr.color = '#aaf8ff'; pr.pierce = true;
      this.projectiles.push(pr);
    }
  }

  /** Schwerthieb: trifft Gegner im Bogen vor dem Spieler und zerstört Geschosse */
  slash(x: number, y: number, ax: number, ay: number, range: number, dmg: number) {
    const ang = Math.atan2(ay, ax);
    this.fx.push(new SlashFx(x, y, ang, range));
    this.audio.sfx('shot');
    const inArc = (px: number, py: number, extra: number) => {
      const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
      if (d > range + extra) return false;
      let da = Math.atan2(dy, dx) - ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      return Math.abs(da) < 1.0 || d < 0.5;
    };
    for (const e of this.room.enemies as Enemy[]) if (e.active && inArc(e.x, e.y, e.r)) this.damageEnemy(e, dmg, ax, ay);
    for (const pr of this.projectiles) if (pr.enemy && inArc(pr.x, pr.y, 0.1)) pr.splash(this);
  }

  /** Laserstrahl: sofort, durchdringt Gegner, stoppt an Felsen */
  beam(x: number, y: number, ax: number, ay: number, range: number, dmg: number) {
    let len = 0;
    while (len < range) {
      const px = x + ax * len, py = y + ay * len;
      if (px < 0 || py < 0 || px >= this.room.w || py >= this.room.h || this.room.isSolid(Math.floor(px), Math.floor(py))) break;
      len += 0.1;
    }
    this.fx.push(new LineFx(x, y, x + ax * len, y + ay * len, 0.12, this.player.tearColor, 0.12, 0.62, true));
    this.audio.sfx('shoot');
    for (const e of this.room.enemies as Enemy[]) {
      if (!e.active) continue;
      const t = Math.max(0, Math.min(len, (e.x - x) * ax + (e.y - y) * ay));
      if (Math.hypot(e.x - (x + ax * t), e.y - (y + ay * t)) < e.r + 0.15) this.damageEnemy(e, dmg, ax * 0.3, ay * 0.3);
    }
  }

  ring(x: number, y: number, r: number, dur: number, color: string) { this.fx.push(new Ring(x, y, r, dur, color)); }

  burst(x: number, y: number, z: number, color: string, n: number, speed = 2) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.3, 1) * speed;
      this.particles.push(new Particle(x, y, z, Math.cos(a) * sp, Math.sin(a) * sp, rand(1, 4), color, rand(0.03, 0.07), rand(0.4, 0.9)));
    }
  }
}

export { norm };
