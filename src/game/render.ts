// Zeichnet einen Raum in 2.5D: Boden, Wände, Türen, Objekte (nach Tiefe sortiert).
import { DOOR_X, DOOR_Y, NEAR_WALL_H, ROOM_H, ROOM_W, WALL_H } from '../core/config';
import { box, poly, shade, shadow } from './draw';
import { Dir, TILE_ROCK, TILE_SPIKE } from './dungeon';
import type { Game } from './game';
import type { Enemy } from './enemies';

export function renderGame(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  const th = g.world.theme;
  const room = g.room;

  // ---- Boden ----
  for (let y = 0; y < ROOM_H; y++)
    for (let x = 0; x < ROOM_W; x++) {
      poly(ctx, cam, [[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], (x + y) % 2 ? th.floorA : th.floorB, 'rgba(0,0,0,0.12)');
    }
  // Türdurchgänge (Boden außerhalb)
  const passage = (d: Dir) => {
    if (!room.doors[d]) return;
    const c = g.doorOpen(d) ? shade(th.floorA, -0.35) : shade(th.floorA, -0.6);
    if (d === 'up') poly(ctx, cam, [[DOOR_X, -1, 0], [DOOR_X + 1, -1, 0], [DOOR_X + 1, 0, 0], [DOOR_X, 0, 0]], c);
    if (d === 'down') poly(ctx, cam, [[DOOR_X, ROOM_H, 0], [DOOR_X + 1, ROOM_H, 0], [DOOR_X + 1, ROOM_H + 1, 0], [DOOR_X, ROOM_H + 1, 0]], c);
    if (d === 'left') poly(ctx, cam, [[-1, DOOR_Y, 0], [0, DOOR_Y, 0], [0, DOOR_Y + 1, 0], [-1, DOOR_Y + 1, 0]], c);
    if (d === 'right') poly(ctx, cam, [[ROOM_W, DOOR_Y, 0], [ROOM_W + 1, DOOR_Y, 0], [ROOM_W + 1, DOOR_Y + 1, 0], [ROOM_W, DOOR_Y + 1, 0]], c);
  };
  (['up', 'down', 'left', 'right'] as Dir[]).forEach(passage);

  // Stacheln
  for (let y = 0; y < ROOM_H; y++)
    for (let x = 0; x < ROOM_W; x++) {
      if (room.tiles[y][x] !== TILE_SPIKE) continue;
      poly(ctx, cam, [[x + 0.05, y + 0.05, 0], [x + 0.95, y + 0.05, 0], [x + 0.95, y + 0.95, 0], [x + 0.05, y + 0.95, 0]], 'rgba(0,0,0,0.3)');
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const cx = x + 0.2 + i * 0.3, cy = y + 0.2 + j * 0.3;
          poly(ctx, cam, [[cx - 0.08, cy + 0.05, 0], [cx + 0.08, cy + 0.05, 0], [cx, cy, 0.28]], '#c8c8d0');
        }
    }

  // Flecken
  for (const d of room.decals) {
    const [sx, sy, s] = cam.project(d.x, d.y, 0);
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.ellipse(sx, sy, d.r * s, d.r * s * cam.sp * 0.9, d.rot * 0.2, 0, Math.PI * 2); ctx.fill();
  }

  // Falltür
  if (room.trapdoor) {
    const x = ROOM_W / 2, y = ROOM_H / 2;
    poly(ctx, cam, [[x - 0.55, y - 0.45, 0], [x + 0.55, y - 0.45, 0], [x + 0.55, y + 0.45, 0], [x - 0.55, y + 0.45, 0]], '#050307', '#2a2020');
    poly(ctx, cam, [[x - 0.55, y - 0.45, 0], [x + 0.55, y - 0.45, 0], [x + 0.55, y - 0.45, -0.4], [x - 0.55, y - 0.45, -0.4]], '#1a1418');
  }

  drawWalls(ctx, g);

  // ---- Schatten ----
  const enemies = room.enemies as Enemy[];
  for (const e of enemies) e.drawShadow(ctx, cam);
  if (g.player.hp > 0) g.player.drawShadow(ctx, cam);
  for (const p of g.projectiles) if (p.z > 0.05) shadow(ctx, cam, p.x, p.y, p.r * 0.9, 0.25);
  for (const b of g.bombs) shadow(ctx, cam, b.x, b.y, 0.22);
  for (const pk of room.pickups) shadow(ctx, cam, pk.x, pk.y, 0.15, 0.25);

  // ---- Objekte nach Tiefe sortieren ----
  type D = { y: number; f: () => void };
  const list: D[] = [];
  const rc = { top: th.rockTop, front: th.rockFront, side: th.rockSide, outline: 'rgba(0,0,0,0.25)' };
  for (let y = 0; y < ROOM_H; y++)
    for (let x = 0; x < ROOM_W; x++)
      if (room.tiles[y][x] === TILE_ROCK) list.push({ y: y + 0.55, f: () => box(ctx, cam, x + 0.06, y + 0.08, x + 0.94, y + 0.92, 0.7, rc) });
  for (const e of enemies) list.push({ y: e.y, f: () => e.draw(ctx, cam, g) });
  if (g.player.hp > 0) list.push({ y: g.player.y, f: () => g.player.draw(ctx, cam) });
  for (const p of g.projectiles) list.push({ y: p.y, f: () => p.draw(ctx, cam) });
  for (const b of g.bombs) list.push({ y: b.y, f: () => b.draw(ctx, cam) });
  for (const pk of room.pickups) list.push({ y: pk.y, f: () => pk.draw(ctx, cam) });
  for (const pt of g.particles) list.push({ y: pt.y, f: () => pt.draw(ctx, cam) });
  if (room.pedestal) {
    const px = ROOM_W / 2, py = ROOM_H / 2 - (room.trapdoor ? 1.6 : 0);
    list.push({ y: py + 0.3, f: () => drawPedestal(ctx, g, px, py) });
  }
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.f();

  for (const r of g.rings) r.draw(ctx, cam);

  drawNearWall(ctx, g);

  for (const t of g.texts) t.draw(ctx, cam);

  // Zeitlupe-Effekt
  if (g.slowTime > 0) {
    ctx.fillStyle = 'rgba(120,160,255,0.08)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

function drawPedestal(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number) {
  const cam = g.camera;
  const item = g.room.pedestal!;
  box(ctx, cam, x - 0.35, y - 0.3, x + 0.35, y + 0.3, 0.45, { top: '#9a8a7a', front: '#6a5a4a', side: '#5a4a3a', outline: 'rgba(0,0,0,0.3)' });
  const bob = Math.sin(g.time * 3) * 0.08;
  const [sx, sy, s] = cam.project(x, y, 0.95 + bob);
  const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 0.5 * s);
  grd.addColorStop(0, item.color + '');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35; ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(sx, sy, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `${Math.round(0.45 * s)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(item.icon, sx, sy);
}

function doorColors(g: Game, d: Dir) {
  const n = g.room.doors[d]!;
  const special = n.type === 'boss' || g.room.type === 'boss' ? '#8a1a1a' : n.type === 'item' || g.room.type === 'item' ? '#c8a030' : null;
  return special;
}

function drawWalls(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera, th = g.world.theme, room = g.room;
  const H = WALL_H;
  const faceDark = shade(th.wallFace, -0.15);
  // Hintere Wand
  poly(ctx, cam, [[0, 0, 0], [ROOM_W, 0, 0], [ROOM_W, 0, H], [0, 0, H]], th.wallFace);
  // Fugen in der Wand
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const a = cam.project(0, 0, (H / 3) * i), b = cam.project(ROOM_W, 0, (H / 3) * i);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  // Seitenwände (Innenseiten)
  poly(ctx, cam, [[0, 0, 0], [0, ROOM_H, 0], [0, ROOM_H, H], [0, 0, H]], faceDark);
  poly(ctx, cam, [[ROOM_W, 0, 0], [ROOM_W, ROOM_H, 0], [ROOM_W, ROOM_H, H], [ROOM_W, 0, H]], faceDark);
  // Wandoberseiten
  poly(ctx, cam, [[-1, -1, H], [ROOM_W + 1, -1, H], [ROOM_W, 0, H], [0, 0, H]], th.wallTop);
  poly(ctx, cam, [[-1, -1, H], [0, 0, H], [0, ROOM_H, H], [-1, ROOM_H + 1, H]], shade(th.wallTop, -0.08));
  poly(ctx, cam, [[ROOM_W + 1, -1, H], [ROOM_W + 1, ROOM_H + 1, H], [ROOM_W, ROOM_H, H], [ROOM_W, 0, H]], shade(th.wallTop, -0.08));

  // Türen in hinteren/seitlichen Wänden
  const dh = 0.95;
  const door = (d: Dir, pts: [number, number, number][], frame: [number, number, number][]) => {
    if (!room.doors[d]) return;
    const sp = doorColors(g, d);
    poly(ctx, cam, frame, sp || shade(th.wallFace, -0.4));
    poly(ctx, cam, pts, '#07050a');
    if (!g.doorOpen(d)) {
      // Gitter
      ctx.strokeStyle = sp || shade(th.wallTop, -0.2);
      ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const a = lerp3(pts[0], pts[1], t), b = lerp3(pts[3], pts[2], t);
        const pa = cam.project(...a), pb = cam.project(...b);
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      }
    }
  };
  door('up', [[DOOR_X, 0, 0], [DOOR_X + 1, 0, 0], [DOOR_X + 1, 0, dh], [DOOR_X, 0, dh]],
    [[DOOR_X - 0.15, 0, 0], [DOOR_X + 1.15, 0, 0], [DOOR_X + 1.15, 0, dh + 0.15], [DOOR_X - 0.15, 0, dh + 0.15]]);
  door('left', [[0, DOOR_Y + 1, 0], [0, DOOR_Y, 0], [0, DOOR_Y, dh], [0, DOOR_Y + 1, dh]],
    [[0, DOOR_Y + 1.15, 0], [0, DOOR_Y - 0.15, 0], [0, DOOR_Y - 0.15, dh + 0.15], [0, DOOR_Y + 1.15, dh + 0.15]]);
  door('right', [[ROOM_W, DOOR_Y + 1, 0], [ROOM_W, DOOR_Y, 0], [ROOM_W, DOOR_Y, dh], [ROOM_W, DOOR_Y + 1, dh]],
    [[ROOM_W, DOOR_Y + 1.15, 0], [ROOM_W, DOOR_Y - 0.15, 0], [ROOM_W, DOOR_Y - 0.15, dh + 0.15], [ROOM_W, DOOR_Y + 1.15, dh + 0.15]]);
}

function drawNearWall(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera, th = g.world.theme;
  const h = NEAR_WALL_H;
  const hasDoor = !!g.room.doors.down;
  const seg = (x0: number, x1: number) => {
    poly(ctx, cam, [[x0, ROOM_H, h], [x1, ROOM_H, h], [x1, ROOM_H + 1, h], [x0, ROOM_H + 1, h]], th.wallTop);
    poly(ctx, cam, [[x0, ROOM_H + 1, 0], [x1, ROOM_H + 1, 0], [x1, ROOM_H + 1, h], [x0, ROOM_H + 1, h]], shade(th.wallFace, -0.3));
  };
  if (hasDoor) { seg(-1, DOOR_X); seg(DOOR_X + 1, ROOM_W + 1); }
  else seg(-1, ROOM_W + 1);
  // Innenkante
  poly(ctx, cam, [[0, ROOM_H, 0], [ROOM_W, ROOM_H, 0], [ROOM_W, ROOM_H, h], [0, ROOM_H, h]], 'rgba(0,0,0,0)');
  if (hasDoor) {
    const sp = doorColors(g, 'down');
    if (sp) {
      poly(ctx, cam, [[DOOR_X - 0.15, ROOM_H, h], [DOOR_X, ROOM_H, h], [DOOR_X, ROOM_H + 1, h], [DOOR_X - 0.15, ROOM_H + 1, h]], sp);
      poly(ctx, cam, [[DOOR_X + 1, ROOM_H, h], [DOOR_X + 1.15, ROOM_H, h], [DOOR_X + 1.15, ROOM_H + 1, h], [DOOR_X + 1, ROOM_H + 1, h]], sp);
    }
    if (!g.doorOpen('down')) {
      ctx.strokeStyle = sp || shade(th.wallTop, -0.2); ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) {
        const a = cam.project(DOOR_X + i / 4, ROOM_H + 0.1, 0), b = cam.project(DOOR_X + i / 4, ROOM_H + 0.1, 0.6);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
  }
}

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
