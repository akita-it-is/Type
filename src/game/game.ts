// Spiel-Logik eines Durchlaufs (Run). Bewusst getrennt von Rendering, Eingabe
// und Menüs, damit eine spätere Portierung (PC/Konsole) einfacher ist.
import { Camera } from '../core/camera';
import { BOMB, DOOR_X, DOOR_Y, ROOM_H, ROOM_W } from '../core/config';
import type { AudioEngine } from '../core/audio';
import { makeRng, rand, randPick } from '../core/util';
import { Profile, saveProfile, vibrate } from '../core/save';
import { charById } from '../data/characters';
import { skinById } from '../data/skins';
import { ITEMS, ItemDef, itemById, itemsOfKind } from '../data/items';
import { playableWorlds, WorldDef } from '../data/worlds';
import { Dir, Floor, generateFloor, OPPOSITE, Room, TILE_FLOOR, TILE_ROCK, TILE_SPIKE } from './dungeon';
import { createEnemy, Enemy } from './enemies';
import { Bomb, ControlState, FloatText, Particle, Pickup, PickupType, Player, Projectile, Ring } from './entities';

export interface RunConfig {
  mode: 'story' | 'arcade';
  world: WorldDef;
  stage: number; // Story: 1..10
}

export interface RunResult {
  type: 'won' | 'dead';
  coins: number;
  kills: number;
  rooms: number;
  floors: number;
  score: number;
  newBest: boolean;
}

interface Mover { x: number; y: number; r: number }

export class Game {
  camera = new Camera();
  player: Player;
  floor!: Floor;
  room!: Room;
  world: WorldDef;
  projectiles: Projectile[] = [];
  bombs: Bomb[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  texts: FloatText[] = [];
  difficulty = 1;
  hpScale = 1;
  floorNum = 1;
  slowTime = 0;
  time = 0;
  transition: { t: number; dir: Dir; swapped: boolean } | null = null;
  banner: { title: string; sub: string; t: number } | null = null;
  result: RunResult | null = null;
  deathT = 0;
  kills = 0;
  roomsCleared = 0;
  pickupLock = 0;
  pedestalLock = false;
  trapdoorT = 0;
  spikeT = 0;

  constructor(public cfg: RunConfig, public audio: AudioEngine, public profile: Profile) {
    this.world = cfg.world;
    const ch = charById(profile.char);
    const sk = skinById(profile.skin);
    this.player = new Player(ch.mods, { cloak: sk.cloak || ch.body, skin: sk.skin, hat: ch.hat }, sk.tear);
    if (ch.startActive) {
      const a = itemById(ch.startActive);
      if (a && a.kind === 'active') { this.player.active = a; this.player.charge = a.charges; }
    }
    this.newFloor();
  }

  get enemyTimeScale() { return this.slowTime > 0 ? 0.45 : 1; }

  newFloor() {
    if (this.cfg.mode === 'arcade') {
      const ws = playableWorlds();
      this.world = ws[(this.floorNum - 1) % ws.length];
      this.difficulty = this.floorNum;
    } else {
      const wi = playableWorlds().indexOf(this.cfg.world);
      this.difficulty = this.cfg.stage + Math.max(0, wi) * 0.5;
    }
    this.hpScale = 1 + (this.difficulty - 1) * 0.15;
    const owned = new Set([...this.player.items, this.player.active?.id]);
    const pool = ITEMS.filter((i) => i.kind !== 'consumable' && !owned.has(i.id));
    this.floor = generateFloor({
      roomCount: Math.min(16, 6 + Math.floor(this.difficulty * 0.8)),
      difficulty: this.difficulty,
      rng: makeRng(),
      itemPool: pool,
    });
    this.enterRoom(this.floor.start, null);
    this.audio.playMusic(this.world.music);
    this.showBanner(this.cfg.mode === 'arcade' ? `Arcade – Ebene ${this.floorNum}` : `${this.world.name} – Stufe ${this.cfg.stage}`, this.world.boss.name + ' wartet...');
  }

  showBanner(title: string, sub: string) { this.banner = { title, sub, t: 2.6 }; }

  enterRoom(room: Room, exitDir: Dir | null) {
    this.room = room;
    room.visited = true;
    room.seen = true;
    for (const n of Object.values(room.doors)) if (n) n.seen = true;
    this.projectiles.length = 0;
    this.bombs.length = 0;
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    const p = this.player;
    p.vx = p.vy = 0;
    if (!exitDir) { p.x = ROOM_W / 2; p.y = ROOM_H / 2 + 1; }
    else {
      const enter = OPPOSITE[exitDir];
      if (enter === 'up') { p.x = DOOR_X + 0.5; p.y = 0.6; }
      if (enter === 'down') { p.x = DOOR_X + 0.5; p.y = ROOM_H - 0.6; }
      if (enter === 'left') { p.x = 0.6; p.y = DOOR_Y + 0.5; }
      if (enter === 'right') { p.x = ROOM_W - 0.6; p.y = DOOR_Y + 0.5; }
    }
    this.pedestalLock = false;
    if (!room.cleared && !room.spawned) {
      room.spawned = true;
      for (const s of room.spawns) {
        if (s.kind === 'boss') {
          // Boss erscheint auf der dem Spieler gegenüberliegenden Seite
          const bx = Math.max(2, Math.min(ROOM_W - 2, ROOM_W - p.x));
          const by = Math.max(1.6, Math.min(ROOM_H - 1.6, ROOM_H - p.y));
          this.spawnEnemy('boss', bx, by);
        } else this.spawnEnemy(s.kind, s.x, s.y);
      }
      this.audio.sfx('door');
    }
    if (room.type === 'boss' && !room.cleared) {
      this.audio.playMusic('boss');
      this.showBanner(this.world.boss.name, 'Boss');
    }
  }

  spawnEnemy(kind: Parameters<typeof createEnemy>[0], x: number, y: number) {
    const e = createEnemy(kind, Math.max(0.5, Math.min(ROOM_W - 0.5, x)), Math.max(0.5, Math.min(ROOM_H - 0.5, y)), this.world, this.hpScale);
    this.room.enemies.push(e);
    return e;
  }

  get boss(): Enemy | null {
    return this.room.enemies.find((e: Enemy) => e.isBoss && !e.dead) || null;
  }

  doorOpen(d: Dir) { return !!this.room.doors[d] && this.room.cleared; }

  // ---------------- Kollision ----------------

  private solidAt(tx: number, ty: number, flying: boolean, isPlayer: boolean): boolean {
    if (tx >= 0 && ty >= 0 && tx < ROOM_W && ty < ROOM_H) return this.room.isSolid(tx, ty, flying);
    if (!isPlayer) return true;
    if (tx === DOOR_X && ty === -1 && this.doorOpen('up')) return false;
    if (tx === DOOR_X && ty === ROOM_H && this.doorOpen('down')) return false;
    if (ty === DOOR_Y && tx === -1 && this.doorOpen('left')) return false;
    if (ty === DOOR_Y && tx === ROOM_W && this.doorOpen('right')) return false;
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

  /** Bewegt eine Figur mit Kollision gegen Wände/Felsen. Gibt true zurück, wenn etwas getroffen wurde. */
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

    if (this.transition) {
      const tr = this.transition;
      tr.t += dt;
      if (!tr.swapped && tr.t >= 0.16) {
        tr.swapped = true;
        const next = this.room.doors[tr.dir]!;
        this.enterRoom(next, tr.dir);
      }
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
    this.pickupLock = Math.max(0, this.pickupLock - dt);

    this.doorAssist(c);
    p.update(this, dt, c);

    if (c.bomb) this.placeBomb();
    if (c.item) this.useActive();
    if (c.consumable) this.useConsumable();

    // Gegner
    const enemies: Enemy[] = this.room.enemies;
    for (const e of enemies) e.update(this, dt);
    this.separateEnemies(enemies);

    // Kontakt-Schaden
    for (const e of enemies) {
      if (!e.active || e.z > 0.5) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r * 0.75) this.hurtPlayer(e.contact);
    }

    // Projektile
    for (const pr of this.projectiles) {
      pr.update(this, dt);
      if (pr.dead) continue;
      if (pr.enemy) {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.r * 0.8 + pr.r && pr.z < 1.2) {
          if (p.vulnerable) this.hurtPlayer(pr.dmg);
          pr.splash(this);
        }
      } else {
        for (const e of enemies) {
          if (!e.active || pr.hit.has(e)) continue;
          if (Math.hypot(pr.x - e.x, pr.y - e.y) < e.r + pr.r && Math.abs(pr.z - (e.z + e.r)) < e.r + 0.6) {
            const sp = Math.hypot(pr.vx, pr.vy) || 1;
            e.hurt(this, pr.dmg, pr.vx / sp, pr.vy / sp);
            this.audio.sfx('hit');
            this.burst(pr.x, pr.y, 0.5, e.look.color, 4);
            pr.hit.add(e);
            if (!pr.pierce) { pr.splash(this); break; }
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((x) => !x.dead);

    for (const b of this.bombs) b.update(this, dt);
    this.bombs = this.bombs.filter((b) => !b.dead);
    this.room.enemies = enemies.filter((e) => !e.dead);

    // Stacheln
    this.spikeT -= dt;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (tx >= 0 && ty >= 0 && tx < ROOM_W && ty < ROOM_H && this.room.tiles[ty][tx] === TILE_SPIKE && this.spikeT <= 0) {
      if (p.vulnerable) { this.hurtPlayer(1); this.spikeT = 0.5; }
    }

    this.updatePickups(dt);

    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter((x) => !x.dead);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
    for (const r of this.rings) r.update(dt);
    this.rings = this.rings.filter((x) => !x.dead);
    for (const t of this.texts) t.update(dt);
    this.texts = this.texts.filter((x) => !x.dead);

    // Raum geschafft?
    if (!this.room.cleared && this.room.spawned && this.room.enemies.length === 0) this.onRoomCleared();

    // Falltür
    if (this.room.trapdoor) {
      this.trapdoorT += dt;
      if (this.trapdoorT > 1 && Math.hypot(p.x - ROOM_W / 2, p.y - ROOM_H / 2) < 0.45) this.takeTrapdoor();
    }

    // Raumwechsel
    let exit: Dir | null = null;
    if (p.y < -0.25) exit = 'up';
    else if (p.y > ROOM_H + 0.25) exit = 'down';
    else if (p.x < -0.25) exit = 'left';
    else if (p.x > ROOM_W + 0.25) exit = 'right';
    if (exit && this.room.doors[exit]) this.transition = { t: 0, dir: exit, swapped: false };
  }

  /** Hilft dem Spieler, durch Türöffnungen zu gleiten statt an Kanten hängenzubleiben. */
  private doorAssist(c: ControlState) {
    const p = this.player;
    const pull = (axis: 'x' | 'y', target: number) => {
      const d = target - p[axis];
      if (Math.abs(d) < 0.6) p[axis] += d * 0.25;
    };
    if (c.my < -0.4 && p.y < 1.0 && this.doorOpen('up')) pull('x', DOOR_X + 0.5);
    if (c.my > 0.4 && p.y > ROOM_H - 1.0 && this.doorOpen('down')) pull('x', DOOR_X + 0.5);
    if (c.mx < -0.4 && p.x < 1.0 && this.doorOpen('left')) pull('y', DOOR_Y + 0.5);
    if (c.mx > 0.4 && p.x > ROOM_W - 1.0 && this.doorOpen('right')) pull('y', DOOR_Y + 0.5);
  }

  private separateEnemies(list: Enemy[]) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (!a.active || !b.active) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), min = (a.r + b.r) * 0.85;
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d, ny = dy / d;
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
      if (pk.z > 0.3 || this.pickupLock > 0) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > p.r + 0.25) continue;
      this.collect(pk);
    }
    this.room.pickups = this.room.pickups.filter((x: Pickup) => !x.dead);

    // Item-Sockel
    const ped = this.room.pedestal;
    const dc = Math.hypot(p.x - ROOM_W / 2, p.y - (ROOM_H / 2 - (this.room.trapdoor ? 1.6 : 0)));
    if (ped) {
      if (dc > 1) this.pedestalLock = false;
      if (dc < p.r + 0.35 && !this.pedestalLock) this.takeItem(ped);
    }
  }

  private collect(pk: Pickup) {
    const p = this.player;
    switch (pk.type) {
      case 'heart': case 'halfheart':
        if (p.hp >= p.stats.maxHp) return;
        this.healPlayer(pk.type === 'heart' ? 2 : 1);
        break;
      case 'coin':
        p.coins++; this.audio.sfx('coin');
        this.texts.push(new FloatText(p.x, p.y, '+1', '#f2c230', 0.7));
        break;
      case 'bomb':
        p.bombs++; this.audio.sfx('pickup');
        break;
      case 'consumable': {
        if (!pk.item) return;
        const old = p.consumable;
        p.consumable = pk.item;
        this.discover(pk.item);
        this.showBanner(pk.item.name, pk.item.desc);
        this.audio.sfx('pickup');
        if (old) { this.room.pickups.push(new Pickup(pk.x, pk.y, 'consumable', old)); this.pickupLock = 0.8; }
        break;
      }
    }
    pk.dead = true;
  }

  private takeItem(item: ItemDef) {
    const p = this.player;
    this.room.pedestal = null;
    if (item.kind === 'passive') {
      item.apply(p.stats, this);
      p.items.push(item.id);
    } else if (item.kind === 'active') {
      const old = p.active;
      p.active = item; p.charge = item.charges;
      if (old) { this.room.pedestal = old; this.pedestalLock = true; }
    } else {
      p.consumable = item;
    }
    p.hp = Math.min(p.hp, p.stats.maxHp);
    this.discover(item);
    this.showBanner(item.name, item.desc);
    this.audio.sfx('item');
    vibrate(this.profile, 40);
  }

  private discover(item: ItemDef) {
    if (!this.profile.discovered.includes(item.id)) {
      this.profile.discovered.push(item.id);
      saveProfile(this.profile);
    }
  }

  private onRoomCleared() {
    const r = this.room;
    r.cleared = true;
    this.roomsCleared++;
    this.audio.sfx('door');
    const p = this.player;
    if (p.active && p.charge < p.active.charges) {
      p.charge++;
      if (p.charge === p.active.charges) this.audio.sfx('charge');
    }
    if (r.type === 'boss') {
      r.trapdoor = true;
      this.trapdoorT = 0;
      const pool = itemsOfKind('passive').filter((i) => !p.items.includes(i.id));
      if (pool.length) r.pedestal = randPick(pool);
      this.dropPickup(ROOM_W / 2 - 1.5, ROOM_H / 2 + 1, 'heart');
      this.dropPickup(ROOM_W / 2 + 1.5, ROOM_H / 2 + 1, 'coin');
      this.dropPickup(ROOM_W / 2 + 1.8, ROOM_H / 2 + 1.3, 'coin');
      this.audio.playMusic(this.world.music);
      this.showBanner('Boss besiegt!', 'Spring in die Falltür');
      vibrate(this.profile, [60, 40, 120]);
    } else if (Math.random() < 0.45) {
      const roll = Math.random();
      const type: PickupType = roll < 0.45 ? 'coin' : roll < 0.65 ? 'halfheart' : roll < 0.8 ? 'bomb' : 'consumable';
      const spot = this.freeSpotNear(ROOM_W / 2, ROOM_H / 2);
      this.dropPickup(spot[0], spot[1], type);
    }
  }

  private freeSpotNear(x: number, y: number): [number, number] {
    for (let rad = 0; rad < 6; rad++)
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad; dx <= rad; dx++) {
          const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
          if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
          if (this.room.tiles[ty][tx] === TILE_FLOOR) return [tx + 0.5, ty + 0.5];
        }
    return [x, y];
  }

  dropPickup(x: number, y: number, type: PickupType) {
    const item = type === 'consumable' ? randPick(itemsOfKind('consumable')) : null;
    this.room.pickups.push(new Pickup(x, y, type, item));
  }

  private takeTrapdoor() {
    this.room.trapdoor = false;
    if (this.cfg.mode === 'arcade') {
      this.floorNum++;
      this.audio.sfx('win');
      this.newFloor();
    } else {
      this.finish('won');
    }
  }

  private finish(type: 'won' | 'dead') {
    const coins = this.player.coins + (type === 'won' ? 40 + this.cfg.stage * 10 : 0);
    const score = this.kills * 10 + this.roomsCleared * 25 + (this.floorNum - 1) * 250;
    let newBest = false;
    const prof = this.profile;
    prof.coins += coins;
    if (this.cfg.mode === 'story' && type === 'won') {
      const id = this.cfg.world.id;
      prof.progress[id] = Math.max(prof.progress[id] || 0, this.cfg.stage);
    }
    if (this.cfg.mode === 'arcade' && score > prof.arcadeBest) { prof.arcadeBest = score; newBest = true; }
    saveProfile(prof);
    this.result = { type, coins, kills: this.kills, rooms: this.roomsCleared, floors: this.floorNum, score, newBest };
    this.audio.sfx(type === 'won' ? 'win' : 'lose');
    this.audio.playMusic('menu');
  }

  // ---------------- Aktionen ----------------

  hurtPlayer(halfHearts: number) {
    const p = this.player;
    if (!p.vulnerable || p.hp <= 0) return;
    p.hp -= halfHearts;
    p.hurtTimer();
    this.camera.addShake(6);
    this.audio.sfx('hurt');
    vibrate(this.profile, 80);
    this.burst(p.x, p.y, 0.5, '#c02030', 8);
    if (p.hp <= 0) {
      p.hp = 0;
      this.burst(p.x, p.y, 0.5, p.look.cloak, 25);
    }
  }

  healPlayer(halfHearts: number) {
    const p = this.player;
    p.hp = Math.min(p.stats.maxHp, p.hp + halfHearts);
    this.audio.sfx('pickup');
    this.texts.push(new FloatText(p.x, p.y, '+♥', '#ff6070', 0.8));
  }

  placeBomb() {
    const p = this.player;
    if (p.bombs <= 0) { this.audio.sfx('error'); return; }
    p.bombs--;
    this.bombs.push(new Bomb(p.x, p.y + 0.05));
  }

  useActive() {
    const p = this.player;
    if (!p.active || p.charge < p.active.charges) { this.audio.sfx('error'); return; }
    p.charge = 0;
    p.active.use(this);
    this.audio.sfx('use');
  }

  useConsumable() {
    const p = this.player;
    if (!p.consumable) { this.audio.sfx('error'); return; }
    const c = p.consumable;
    p.consumable = null;
    c.use(this);
    this.texts.push(new FloatText(p.x, p.y, c.name, c.color, 1.2));
    this.audio.sfx('use');
  }

  explode(x: number, y: number) {
    const R = BOMB.radius;
    this.audio.sfx('bomb');
    this.camera.addShake(12);
    vibrate(this.profile, 120);
    this.ring(x, y, R, 0.35, 'rgba(255,200,80,0.6)');
    this.burst(x, y, 0.3, '#ffb040', 20, 5);
    this.burst(x, y, 0.3, '#555', 14, 3);
    for (const e of this.room.enemies as Enemy[]) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < R + e.r) e.hurt(this, BOMB.damage, (e.x - x) / (d || 1), (e.y - y) / (d || 1));
    }
    const p = this.player;
    if (Math.hypot(p.x - x, p.y - y) < R) this.hurtPlayer(2);
    for (let ty = 0; ty < ROOM_H; ty++)
      for (let tx = 0; tx < ROOM_W; tx++)
        if (this.room.tiles[ty][tx] === TILE_ROCK && Math.hypot(tx + 0.5 - x, ty + 0.5 - y) < R + 0.3) this.breakRock(tx, ty);
    this.room.decals.push({ x, y, r: 0.9, color: 'rgba(0,0,0,0.45)', rot: Math.random() * 3 });
  }

  hitRock(_tx: number, _ty: number) { /* Platzhalter: z.B. Felsen mit Trefferpunkten */ }

  breakRock(tx: number, ty: number) {
    this.room.tiles[ty][tx] = TILE_FLOOR;
    const t = this.world.theme;
    this.burst(tx + 0.5, ty + 0.5, 0.4, t.rockTop, 10, 3);
    if (Math.random() < 0.12) this.dropPickup(tx + 0.5, ty + 0.5, 'coin');
  }

  onEnemyKilled(e: Enemy) {
    this.kills++;
    this.audio.sfx('enemyDie');
    this.burst(e.x, e.y, e.z + e.r, e.look.color, e.isBoss ? 40 : 12, e.isBoss ? 5 : 3);
    this.room.decals.push({ x: e.x, y: e.y, r: e.r * (e.isBoss ? 1.6 : 1.2), color: this.world.theme.decal, rot: Math.random() * 3 });
    if (this.room.decals.length > 40) this.room.decals.shift();
    if (e.isBoss) {
      this.camera.addShake(14);
      for (const o of this.room.enemies as Enemy[]) if (!o.dead && o !== e) o.die(this);
    } else if (Math.random() < e.coinChance) this.dropPickup(e.x, e.y, 'coin');
  }

  damageAllEnemies(dmg: number) {
    this.camera.addShake(8);
    for (const e of this.room.enemies as Enemy[]) {
      if (!e.active) continue;
      this.ring(e.x, e.y, 0.8, 0.3, 'rgba(255,255,140,0.6)');
      e.hurt(this, dmg, 0, 0);
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

  ring(x: number, y: number, r: number, dur: number, color: string) { this.rings.push(new Ring(x, y, r, dur, color)); }

  burst(x: number, y: number, z: number, color: string, n: number, speed = 2) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.3, 1) * speed;
      this.particles.push(new Particle(x, y, z, Math.cos(a) * sp, Math.sin(a) * sp, rand(1, 4), color, rand(0.03, 0.07), rand(0.4, 0.9)));
    }
  }
}
