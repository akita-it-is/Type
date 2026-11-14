// Ebenen-Generator: Raster aus Räumen, Start in der Mitte, Boss am weitesten entfernt.
import { ROOM_W, ROOM_H, DOOR_X, DOOR_Y } from '../core/config';
import { Rng } from '../core/util';
import { ROOM_TEMPLATES } from '../data/rooms';
import type { EnemyKind } from '../data/worlds';
import type { ItemDef } from '../data/items';

export type RoomType = 'start' | 'normal' | 'item' | 'boss';
export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const TILE_FLOOR = 0, TILE_ROCK = 1, TILE_SPIKE = 2;

export interface Spawn { kind: EnemyKind | 'boss'; x: number; y: number }
export interface Decal { x: number; y: number; r: number; color: string; rot: number }

export class Room {
  tiles: number[][] = [];
  doors: Partial<Record<Dir, Room>> = {};
  visited = false;
  seen = false;
  cleared = false;
  spawned = false;
  spawns: Spawn[] = [];
  enemies: any[] = [];   // Enemy[] (any, um Zirkel-Importe zu vermeiden)
  pickups: any[] = [];   // Pickup[]
  decals: Decal[] = [];
  pedestal: ItemDef | null = null;
  trapdoor = false;
  dist = 0;
  constructor(public gx: number, public gy: number, public type: RoomType) {}

  isSolid(tx: number, ty: number, flying = false): boolean {
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return true;
    const t = this.tiles[ty][tx];
    return t === TILE_ROCK && !flying;
  }
}

export interface Floor {
  rooms: Room[];
  start: Room;
  boss: Room;
  get(x: number, y: number): Room | undefined;
}

export interface FloorOptions {
  roomCount: number;
  difficulty: number; // 1.. steigend
  rng: Rng;
  itemPool: ItemDef[];
}

export function generateFloor(o: FloorOptions): Floor {
  const { rng } = o;
  const map = new Map<string, Room>();
  const key = (x: number, y: number) => `${x},${y}`;
  const get = (x: number, y: number) => map.get(key(x, y));
  const neighbors = (x: number, y: number) =>
    (Object.values(DIRS) as [number, number][]).filter(([dx, dy]) => get(x + dx, y + dy)).length;

  let attempts = 0;
  let start: Room;
  do {
    map.clear();
    start = new Room(4, 4, 'start');
    map.set(key(4, 4), start);
    const list = [start];
    let guard = 0;
    while (list.length < o.roomCount && guard++ < 2000) {
      const base = rng.pick(list);
      const [dx, dy] = DIRS[rng.pick(Object.keys(DIRS) as Dir[])];
      const nx = base.gx + dx, ny = base.gy + dy;
      if (nx < 0 || ny < 0 || nx > 8 || ny > 8 || get(nx, ny)) continue;
      if (neighbors(nx, ny) > 1) continue;
      if (list.length > 1 && rng.chance(0.4) && neighbors(base.gx, base.gy) >= 3) continue;
      const r = new Room(nx, ny, 'normal');
      map.set(key(nx, ny), r);
      list.push(r);
    }
    attempts++;
  } while (deadEnds([...map.values()], start, get).length < 2 && attempts < 50);

  const rooms = [...map.values()];
  // Türen verbinden
  for (const r of rooms) {
    for (const d of Object.keys(DIRS) as Dir[]) {
      const [dx, dy] = DIRS[d];
      const n = get(r.gx + dx, r.gy + dy);
      if (n) r.doors[d] = n;
    }
  }
  // Abstand per Breitensuche
  const q = [start];
  const seen = new Set([start]);
  while (q.length) {
    const r = q.shift()!;
    for (const n of Object.values(r.doors)) {
      if (n && !seen.has(n)) { seen.add(n); n.dist = r.dist + 1; q.push(n); }
    }
  }
  const ends = deadEnds(rooms, start, get).sort((a, b) => b.dist - a.dist);
  const boss = ends[0] || rooms.slice().sort((a, b) => b.dist - a.dist)[0];
  boss.type = 'boss';
  const itemRoom = ends.find((r) => r !== boss);
  if (itemRoom) itemRoom.type = 'item';

  for (const r of rooms) buildRoom(r, o);

  return { rooms, start, boss, get };
}

function deadEnds(rooms: Room[], start: Room, get: (x: number, y: number) => Room | undefined) {
  return rooms.filter((r) => r !== start &&
    (Object.values(DIRS) as [number, number][]).filter(([dx, dy]) => get(r.gx + dx, r.gy + dy)).length === 1);
}

const DOOR_TILES: [number, number][] = [[DOOR_X, 0], [DOOR_X, ROOM_H - 1], [0, DOOR_Y], [ROOM_W - 1, DOOR_Y]];

function buildRoom(r: Room, o: FloorOptions) {
  const { rng } = o;
  const empty = () => Array.from({ length: ROOM_H }, () => new Array(ROOM_W).fill(TILE_FLOOR));
  if (r.type !== 'normal') {
    r.tiles = empty();
    r.cleared = r.type !== 'boss';
    if (r.type === 'item' && o.itemPool.length) r.pedestal = o.itemPool.splice(rng.int(0, o.itemPool.length - 1), 1)[0];
    if (r.type === 'boss') r.spawns = [{ kind: 'boss', x: ROOM_W / 2, y: 2.2 }];
    return;
  }
  // Vorlage wählen, spiegeln, Erreichbarkeit prüfen
  for (let tries = 0; tries < 20; tries++) {
    const tpl = rng.pick(ROOM_TEMPLATES);
    const fx = rng.chance(0.5), fy = rng.chance(0.5);
    const t = empty();
    for (let y = 0; y < ROOM_H; y++)
      for (let x = 0; x < ROOM_W; x++) {
        const c = tpl[fy ? ROOM_H - 1 - y : y][fx ? ROOM_W - 1 - x : x];
        t[y][x] = c === '#' ? TILE_ROCK : c === '^' ? TILE_SPIKE : TILE_FLOOR;
      }
    for (const [x, y] of DOOR_TILES) t[y][x] = TILE_FLOOR;
    if (connected(t)) { r.tiles = t; break; }
  }
  if (!r.tiles.length) r.tiles = empty();

  // Gegner
  const d = o.difficulty;
  const kinds: [EnemyKind, number][] = [
    ['flyer', 3], ['hopper', 3], ['runner', d >= 2 ? 2 : 0.5], ['shooter', d >= 2 ? 2.5 : 1], ['charger', d >= 3 ? 2 : 0.5],
  ];
  const total = kinds.reduce((s, k) => s + k[1], 0);
  const count = Math.min(9, rng.int(2, 4) + Math.floor(d * 0.45));
  const free: [number, number][] = [];
  for (let y = 0; y < ROOM_H; y++)
    for (let x = 0; x < ROOM_W; x++) {
      if (r.tiles[y][x] !== TILE_FLOOR) continue;
      if (DOOR_TILES.some(([dx, dy]) => Math.hypot(dx - x, dy - y) < 3)) continue;
      free.push([x, y]);
    }
  rng.shuffle(free);
  for (let i = 0; i < count && i < free.length; i++) {
    let roll = rng() * total;
    let kind: EnemyKind = 'flyer';
    for (const [k, w] of kinds) { if ((roll -= w) <= 0) { kind = k; break; } }
    r.spawns.push({ kind, x: free[i][0] + 0.5, y: free[i][1] + 0.5 });
  }
  if (!r.spawns.length) r.cleared = true;
}

function connected(t: number[][]): boolean {
  const seen = new Set<number>();
  const q: [number, number][] = [[DOOR_X, 0]];
  seen.add(DOOR_X);
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= ROOM_W || ny >= ROOM_H) continue;
      if (t[ny][nx] === TILE_ROCK) continue;
      const k = ny * ROOM_W + nx;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return DOOR_TILES.every(([x, y]) => seen.has(y * ROOM_W + x));
}
