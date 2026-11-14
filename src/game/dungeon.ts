// Runden-Generator: Startraum, Bossraum, Itemraum und Shop garantiert,
// 2–8 Kampfräume in verschiedenen Größen, optional ein Spezialraum (Altar).
import { Rng } from '../core/util';
import { ROOM_TEMPLATES } from '../data/rooms';
import type { EnemyKind } from '../data/worlds';
import type { ItemDef } from '../data/items';

export type RoomType = 'start' | 'normal' | 'item' | 'shop' | 'altar' | 'boss';
export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const TILE_FLOOR = 0, TILE_ROCK = 1, TILE_SPIKE = 2;

/** Raumgrößen (immer ungerade, damit Türen mittig liegen) */
export const ROOM_SIZES = {
  small: [9, 5], medium: [13, 7], large: [17, 9], wide: [21, 7],
} as const;

export interface Spawn { kind: EnemyKind | 'boss'; x: number; y: number; elite?: boolean }
export interface Decal { x: number; y: number; r: number; color: string; rot: number }
export interface Pedestal { x: number; y: number; item: ItemDef; price: number; lock: boolean; heart?: boolean }

export class Room {
  tiles: number[][] = [];
  doors: Partial<Record<Dir, Room>> = {};
  visited = false;
  seen = false;
  cleared = false;
  spawned = false;
  spawns: Spawn[] = [];
  enemies: any[] = [];   // Enemy[]
  pickups: any[] = [];   // Pickup[]
  decals: Decal[] = [];
  pedestals: Pedestal[] = [];
  altarUsed = false;
  portals = false;       // nach dem Boss: Falltür + Ausgang
  dist = 0;
  w = 13; h = 7;
  constructor(public gx: number, public gy: number, public type: RoomType) {}

  get doorX() { return (this.w - 1) / 2; }
  get doorY() { return (this.h - 1) / 2; }

  isSolid(tx: number, ty: number, flying = false): boolean {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    return this.tiles[ty][tx] === TILE_ROCK && !flying;
  }
  doorTiles(): [number, number][] {
    return [[this.doorX, 0], [this.doorX, this.h - 1], [0, this.doorY], [this.w - 1, this.doorY]];
  }
}

export interface Floor {
  rooms: Room[];
  start: Room;
  boss: Room;
}

export interface FloorOptions {
  mobRooms: number;   // 2..8
  altar: boolean;
  difficulty: number;
  eliteChance: number;
  rng: Rng;
}

export function generateFloor(o: FloorOptions): Floor {
  const { rng } = o;
  const total = 4 + o.mobRooms + (o.altar ? 1 : 0);
  const specials = 3 + (o.altar ? 1 : 0); // boss, item, shop, (altar)
  const map = new Map<string, Room>();
  const key = (x: number, y: number) => `${x},${y}`;
  const get = (x: number, y: number) => map.get(key(x, y));
  const nCount = (x: number, y: number) => (Object.values(DIRS) as [number, number][]).filter(([dx, dy]) => get(x + dx, y + dy)).length;

  let start!: Room;
  for (let attempt = 0; attempt < 200; attempt++) {
    map.clear();
    start = new Room(5, 5, 'start');
    map.set(key(5, 5), start);
    const list = [start];
    let guard = 0;
    while (list.length < total && guard++ < 3000) {
      const base = rng.pick(list);
      const [dx, dy] = DIRS[rng.pick(Object.keys(DIRS) as Dir[])];
      const nx = base.gx + dx, ny = base.gy + dy;
      if (nx < 0 || ny < 0 || nx > 10 || ny > 10 || get(nx, ny)) continue;
      if (nCount(nx, ny) > 1) continue;
      const r = new Room(nx, ny, 'normal');
      map.set(key(nx, ny), r);
      list.push(r);
    }
    if (list.length === total && deadEnds([...map.values()], start, nCount).length >= Math.min(specials, 3)) break;
  }

  const rooms = [...map.values()];
  for (const r of rooms)
    for (const d of Object.keys(DIRS) as Dir[]) {
      const [dx, dy] = DIRS[d];
      const n = get(r.gx + dx, r.gy + dy);
      if (n) r.doors[d] = n;
    }
  // Abstand vom Start
  const q = [start];
  const seen = new Set([start]);
  while (q.length) {
    const r = q.shift()!;
    for (const n of Object.values(r.doors)) if (n && !seen.has(n)) { seen.add(n); n.dist = r.dist + 1; q.push(n); }
  }
  const ends = deadEnds(rooms, start, nCount).sort((a, b) => b.dist - a.dist);
  const boss = ends[0];
  boss.type = 'boss';
  const others = rng.shuffle(ends.slice(1));
  const rest = rng.shuffle(rooms.filter((r) => r !== start && r !== boss && !others.includes(r)));
  const candidates = [...others, ...rest];
  const assign = (t: RoomType) => { const r = candidates.shift(); if (r) r.type = t; };
  assign('item'); assign('shop');
  if (o.altar) assign('altar');

  for (const r of rooms) buildRoom(r, o);
  return { rooms, start, boss };
}

function deadEnds(rooms: Room[], start: Room, nCount: (x: number, y: number) => number) {
  return rooms.filter((r) => r !== start && nCount(r.gx, r.gy) === 1);
}

function buildRoom(r: Room, o: FloorOptions) {
  const { rng } = o;
  const size = r.type === 'normal'
    ? rng.pick([ROOM_SIZES.small, ROOM_SIZES.medium, ROOM_SIZES.medium, ROOM_SIZES.large, ROOM_SIZES.wide])
    : r.type === 'boss' ? ROOM_SIZES.large
      : r.type === 'start' ? ROOM_SIZES.medium
        : ROOM_SIZES.small;
  r.w = size[0]; r.h = size[1];
  const empty = () => Array.from({ length: r.h }, () => new Array(r.w).fill(TILE_FLOOR));
  if (r.type !== 'normal') {
    r.tiles = empty();
    r.cleared = r.type !== 'boss';
    if (r.type === 'boss') r.spawns = [{ kind: 'boss', x: r.w / 2, y: r.h / 2 }];
    return;
  }
  for (let tries = 0; tries < 30; tries++) {
    const t = r.w === 13 && r.h === 7 && rng.chance(0.6) ? fromTemplate(rng, empty()) : procedural(rng, r.w, r.h, empty());
    // Türbereiche freihalten
    for (const [x, y] of r.doorTiles()) {
      t[y][x] = TILE_FLOOR;
      if (y === 0) t[1][x] = t[1][x] === TILE_ROCK ? TILE_FLOOR : t[1][x];
      if (y === r.h - 1) t[r.h - 2][x] = t[r.h - 2][x] === TILE_ROCK ? TILE_FLOOR : t[r.h - 2][x];
    }
    r.tiles = t;
    if (connected(r)) break;
    r.tiles = empty();
  }

  // Gegner: mehr in größeren Räumen
  const d = o.difficulty;
  const kinds: [EnemyKind, number][] = [
    ['flyer', 3], ['hopper', 3], ['runner', d >= 2 ? 2 : 0.5], ['shooter', d >= 2 ? 2.5 : 1], ['charger', d >= 3 ? 2 : 0.5],
  ];
  const totalW = kinds.reduce((s, k) => s + k[1], 0);
  const area = (r.w * r.h) / 91;
  const count = Math.min(14, Math.round((rng.int(2, 4) + d * 0.35) * Math.sqrt(area)));
  const free: [number, number][] = [];
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      if (r.tiles[y][x] !== TILE_FLOOR) continue;
      if (r.doorTiles().some(([dx, dy]) => Math.hypot(dx - x, dy - y) < 3)) continue;
      free.push([x, y]);
    }
  rng.shuffle(free);
  for (let i = 0; i < count && i < free.length; i++) {
    let roll = rng() * totalW;
    let kind: EnemyKind = 'flyer';
    for (const [k, w] of kinds) { if ((roll -= w) <= 0) { kind = k; break; } }
    r.spawns.push({ kind, x: free[i][0] + 0.5, y: free[i][1] + 0.5, elite: rng.chance(o.eliteChance) });
  }
  if (!r.spawns.length) r.cleared = true;
}

function fromTemplate(rng: Rng, t: number[][]) {
  const tpl = rng.pick(ROOM_TEMPLATES);
  const fx = rng.chance(0.5), fy = rng.chance(0.5);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 13; x++) {
      const c = tpl[fy ? 6 - y : y][fx ? 12 - x : x];
      t[y][x] = c === '#' ? TILE_ROCK : c === '^' ? TILE_SPIKE : TILE_FLOOR;
    }
  return t;
}

/** Symmetrische Zufallslayouts für alle Raumgrößen */
function procedural(rng: Rng, w: number, h: number, t: number[][]) {
  const style = rng.int(0, 3);
  const set = (x: number, y: number, v: number) => {
    // vierfach gespiegelt
    for (const [px, py] of [[x, y], [w - 1 - x, y], [x, h - 1 - y], [w - 1 - x, h - 1 - y]]) t[py][px] = v;
  };
  if (style === 0) return t; // leer
  if (style === 1) { // Säulenraster
    for (let y = 1; y < h / 2; y += 2) for (let x = 2; x < w / 2; x += 3) set(x, y, TILE_ROCK);
  } else if (style === 2) { // Zufallsgruppen
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const x = rng.int(1, Math.floor(w / 2) - 1), y = rng.int(1, Math.floor(h / 2));
      set(x, y, TILE_ROCK);
      if (rng.chance(0.5)) set(x + 1, y, TILE_ROCK);
      if (rng.chance(0.4)) set(x, y + 1 < h / 2 ? y + 1 : y, TILE_ROCK);
    }
  } else { // Stachelfelder + Felsen
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const x = rng.int(1, Math.floor(w / 2) - 1), y = rng.int(1, Math.floor(h / 2));
      set(x, y, rng.chance(0.5) ? TILE_SPIKE : TILE_ROCK);
      set(x + 1, y, TILE_SPIKE);
    }
  }
  return t;
}

function connected(r: Room): boolean {
  const seen = new Set<number>();
  const [sx, sy] = r.doorTiles()[0];
  const q: [number, number][] = [[sx, sy]];
  seen.add(sy * r.w + sx);
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= r.w || ny >= r.h || r.tiles[ny][nx] === TILE_ROCK) continue;
      const k = ny * r.w + nx;
      if (seen.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  // alle Bodenfelder müssen erreichbar sein (keine eingeschlossenen Gegner)
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.tiles[y][x] !== TILE_ROCK && !seen.has(y * r.w + x)) return false;
  return true;
}
