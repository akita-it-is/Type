// Zeichnet einen Raum in 2.5D: Boden, Wände, Türen, Objekte (nach Tiefe sortiert).
import { NEAR_WALL_H, WALL_H } from '../core/config';
import { RARITY_INFO } from '../data/items';
import { box, poly, shade, shadow } from './draw';
import { Dir, Pedestal, TILE_ROCK, TILE_SPIKE } from './dungeon';
import type { Game } from './game';
import type { Enemy } from './enemies';

export function renderGame(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  const th = g.world.theme;
  const room = g.room;
  const W = room.w, H = room.h, DX = room.doorX, DY = room.doorY;

  // ---- Boden ----
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      poly(ctx, cam, [[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], (x + y) % 2 ? th.floorA : th.floorB, 'rgba(0,0,0,0.12)');
  const passage = (d: Dir) => {
    if (!room.doors[d]) return;
    const c = g.doorOpen(d) ? shade(th.floorA, -0.35) : shade(th.floorA, -0.6);
    if (d === 'up') poly(ctx, cam, [[DX, -1, 0], [DX + 1, -1, 0], [DX + 1, 0, 0], [DX, 0, 0]], c);
    if (d === 'down') poly(ctx, cam, [[DX, H, 0], [DX + 1, H, 0], [DX + 1, H + 1, 0], [DX, H + 1, 0]], c);
    if (d === 'left') poly(ctx, cam, [[-1, DY, 0], [0, DY, 0], [0, DY + 1, 0], [-1, DY + 1, 0]], c);
    if (d === 'right') poly(ctx, cam, [[W, DY, 0], [W + 1, DY, 0], [W + 1, DY + 1, 0], [W, DY + 1, 0]], c);
  };
  (['up', 'down', 'left', 'right'] as Dir[]).forEach(passage);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (room.tiles[y][x] !== TILE_SPIKE) continue;
      poly(ctx, cam, [[x + 0.05, y + 0.05, 0], [x + 0.95, y + 0.05, 0], [x + 0.95, y + 0.95, 0], [x + 0.05, y + 0.95, 0]], 'rgba(0,0,0,0.3)');
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const cx = x + 0.2 + i * 0.3, cy = y + 0.2 + j * 0.3;
          poly(ctx, cam, [[cx - 0.08, cy + 0.05, 0], [cx + 0.08, cy + 0.05, 0], [cx, cy, 0.28]], '#c8c8d0');
        }
    }

  for (const d of room.decals) {
    const [sx, sy, s] = cam.project(d.x, d.y, 0);
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.ellipse(sx, sy, d.r * s, d.r * s * cam.sp * 0.9, d.rot * 0.2, 0, Math.PI * 2); ctx.fill();
  }

  // Altar (Spezialraum)
  if (room.type === 'altar') drawAltar(ctx, g);
  // Portale nach dem Boss
  if (room.portals) drawPortals(ctx, g);
  // Gefahrenzonen am Boden
  for (const h of g.hazards) h.draw(ctx, cam);

  drawWalls(ctx, g);

  // ---- Schatten ----
  const enemies = room.enemies as Enemy[];
  for (const e of enemies) e.drawShadow(ctx, cam);
  if (g.player.hp > 0) g.player.drawShadow(ctx, cam);
  for (const p of g.projectiles) if (p.z > 0.05 && !p.flame) shadow(ctx, cam, p.x, p.y, p.r * 0.9, 0.25);
  for (const b of g.bombs) shadow(ctx, cam, b.x, b.y, 0.22);
  for (const pk of room.pickups) shadow(ctx, cam, pk.x, pk.y, 0.15, 0.25);

  // ---- Objekte nach Tiefe sortiert ----
  type D = { y: number; f: () => void };
  const list: D[] = [];
  const rc = { top: th.rockTop, front: th.rockFront, side: th.rockSide, outline: 'rgba(0,0,0,0.25)' };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (room.tiles[y][x] === TILE_ROCK) list.push({ y: y + 0.55, f: () => box(ctx, cam, x + 0.06, y + 0.08, x + 0.94, y + 0.92, 0.7, rc) });
  for (const e of enemies) list.push({ y: e.y, f: () => e.draw(ctx, cam, g) });
  if (g.player.hp > 0) list.push({ y: g.player.y, f: () => g.player.draw(ctx, cam) });
  for (const p of g.projectiles) list.push({ y: p.y, f: () => p.draw(ctx, cam) });
  for (const b of g.bombs) list.push({ y: b.y, f: () => b.draw(ctx, cam) });
  for (const pk of room.pickups) list.push({ y: pk.y, f: () => pk.draw(ctx, cam) });
  for (const pt of g.particles) list.push({ y: pt.y, f: () => pt.draw(ctx, cam) });
  for (const pd of room.pedestals) list.push({ y: pd.y + 0.3, f: () => drawPedestal(ctx, g, pd) });
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.f();

  for (const f of g.fx) f.draw(ctx, cam);
  drawNearWall(ctx, g);
  for (const t of g.texts) t.draw(ctx, cam);

  if (g.slowTime > 0) {
    ctx.fillStyle = 'rgba(120,160,255,0.08)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

function drawPedestal(ctx: CanvasRenderingContext2D, g: Game, pd: Pedestal) {
  const cam = g.camera;
  const { x, y, item } = pd;
  const rc = RARITY_INFO[item.rarity].color;
  box(ctx, cam, x - 0.32, y - 0.27, x + 0.32, y + 0.27, 0.4, { top: '#9a8a7a', front: '#6a5a4a', side: '#5a4a3a', outline: rc });
  const bob = Math.sin(g.time * 3 + x) * 0.08;
  const [sx, sy, s] = cam.project(x, y, 0.9 + bob);
  ctx.globalAlpha = 0.35; ctx.fillStyle = rc;
  ctx.beginPath(); ctx.arc(sx, sy, 0.36 * s, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `${Math.round(0.42 * s)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(item.icon, sx, sy);
  if (pd.price > 0) {
    const [px, py, ps] = cam.project(x, y + 0.45, 0);
    ctx.font = `bold ${Math.round(Math.max(11, 0.26 * ps))}px sans-serif`;
    const t = `🪙${pd.price}`;
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(t, px, py);
    ctx.fillStyle = g.runCoins >= pd.price ? '#ffe066' : '#ff7070'; ctx.fillText(t, px, py);
  }
}

function drawAltar(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera, r = g.room;
  const x = r.w / 2, y = r.h / 2;
  const used = r.altarUsed;
  box(ctx, cam, x - 0.6, y - 0.4, x + 0.6, y + 0.4, 0.45, { top: used ? '#4a4050' : '#7a5a9a', front: '#4a3a5a', side: '#3a2a4a', outline: 'rgba(0,0,0,0.4)' });
  if (!used) {
    const [sx, sy, s] = cam.project(x, y, 0.9 + Math.sin(g.time * 2) * 0.1);
    ctx.fillStyle = `rgba(200,120,255,${0.35 + 0.15 * Math.sin(g.time * 4)})`;
    ctx.beginPath(); ctx.arc(sx, sy, 0.35 * s, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${Math.round(0.4 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔮', sx, sy);
  }
}

function drawPortals(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  const pulse = 0.5 + 0.5 * Math.sin(g.time * 4);
  const hole = (x: number, y: number) => {
    poly(ctx, cam, [[x - 0.5, y - 0.4, 0], [x + 0.5, y - 0.4, 0], [x + 0.5, y + 0.4, 0], [x - 0.5, y + 0.4, 0]], '#050307', '#3a2a20');
    const [sx, sy, s] = cam.project(x, y + 0.6, 0);
    label(ctx, sx, sy, s, 'Nächste Runde', '#ffe066');
  };
  const exit = (x: number, y: number, text: string) => {
    const [sx, sy, s] = cam.project(x, y, 0);
    ctx.fillStyle = `rgba(120,220,255,${0.25 + pulse * 0.2})`;
    ctx.beginPath(); ctx.ellipse(sx, sy, 0.55 * s, 0.55 * s * cam.sp, 0, 0, Math.PI * 2); ctx.fill();
    const [tx, ty] = cam.project(x, y, 1.6);
    const grd = ctx.createLinearGradient(0, ty, 0, sy);
    grd.addColorStop(0, 'rgba(150,230,255,0)'); grd.addColorStop(1, `rgba(150,230,255,${0.5 + pulse * 0.2})`);
    ctx.fillStyle = grd; ctx.fillRect(sx - 0.4 * s, ty, 0.8 * s, sy - ty);
    label(ctx, sx, sy + 0.5 * s * cam.sp + 6, s, text, '#9ae8ff');
  };
  if (g.cfg.mode === 'arcade') { const [x, y] = g.nextPortalPos(); hole(x, y); return; }
  if (!g.isFinalRound) { const [x, y] = g.nextPortalPos(); hole(x, y); }
  const [ex, ey] = g.exitPortalPos();
  exit(ex, ey, g.isFinalRound ? 'Welt abschließen' : 'Welt verlassen');
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: string, color: string) {
  ctx.font = `bold ${Math.round(Math.max(11, 0.24 * s))}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(t, x, y);
  ctx.fillStyle = color; ctx.fillText(t, x, y);
  ctx.textBaseline = 'middle';
}

function doorColor(g: Game, d: Dir) {
  const n = g.room.doors[d]!;
  const t = n.type === 'start' || n.type === 'normal' ? g.room.type : n.type;
  return t === 'boss' ? '#8a1a1a' : t === 'item' ? '#c8a030' : t === 'shop' ? '#3a9a5a' : t === 'altar' ? '#8a4ac0' : null;
}

function drawWalls(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera, th = g.world.theme, room = g.room;
  const W = room.w, Hh = room.h, DX = room.doorX, DY = room.doorY;
  const H = WALL_H;
  const faceDark = shade(th.wallFace, -0.15);
  poly(ctx, cam, [[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]], th.wallFace);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const a = cam.project(0, 0, (H / 3) * i), b = cam.project(W, 0, (H / 3) * i);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  poly(ctx, cam, [[0, 0, 0], [0, Hh, 0], [0, Hh, H], [0, 0, H]], faceDark);
  poly(ctx, cam, [[W, 0, 0], [W, Hh, 0], [W, Hh, H], [W, 0, H]], faceDark);
  poly(ctx, cam, [[-1, -1, H], [W + 1, -1, H], [W, 0, H], [0, 0, H]], th.wallTop);
  poly(ctx, cam, [[-1, -1, H], [0, 0, H], [0, Hh, H], [-1, Hh + 1, H]], shade(th.wallTop, -0.08));
  poly(ctx, cam, [[W + 1, -1, H], [W + 1, Hh + 1, H], [W, Hh, H], [W, 0, H]], shade(th.wallTop, -0.08));

  const dh = 0.95;
  const door = (d: Dir, pts: [number, number, number][], frame: [number, number, number][]) => {
    if (!room.doors[d]) return;
    const sp = doorColor(g, d);
    poly(ctx, cam, frame, sp || shade(th.wallFace, -0.4));
    poly(ctx, cam, pts, '#07050a');
    if (!g.doorOpen(d)) {
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
  door('up', [[DX, 0, 0], [DX + 1, 0, 0], [DX + 1, 0, dh], [DX, 0, dh]],
    [[DX - 0.15, 0, 0], [DX + 1.15, 0, 0], [DX + 1.15, 0, dh + 0.15], [DX - 0.15, 0, dh + 0.15]]);
  door('left', [[0, DY + 1, 0], [0, DY, 0], [0, DY, dh], [0, DY + 1, dh]],
    [[0, DY + 1.15, 0], [0, DY - 0.15, 0], [0, DY - 0.15, dh + 0.15], [0, DY + 1.15, dh + 0.15]]);
  door('right', [[W, DY + 1, 0], [W, DY, 0], [W, DY, dh], [W, DY + 1, dh]],
    [[W, DY + 1.15, 0], [W, DY - 0.15, 0], [W, DY - 0.15, dh + 0.15], [W, DY + 1.15, dh + 0.15]]);
}

function drawNearWall(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera, th = g.world.theme, room = g.room;
  const W = room.w, H = room.h, DX = room.doorX;
  const h = NEAR_WALL_H;
  const hasDoor = !!room.doors.down;
  const seg = (x0: number, x1: number) => {
    poly(ctx, cam, [[x0, H, h], [x1, H, h], [x1, H + 1, h], [x0, H + 1, h]], th.wallTop);
    poly(ctx, cam, [[x0, H + 1, 0], [x1, H + 1, 0], [x1, H + 1, h], [x0, H + 1, h]], shade(th.wallFace, -0.3));
  };
  if (hasDoor) { seg(-1, DX); seg(DX + 1, W + 1); } else seg(-1, W + 1);
  if (hasDoor) {
    const sp = doorColor(g, 'down');
    if (sp) {
      poly(ctx, cam, [[DX - 0.15, H, h], [DX, H, h], [DX, H + 1, h], [DX - 0.15, H + 1, h]], sp);
      poly(ctx, cam, [[DX + 1, H, h], [DX + 1.15, H, h], [DX + 1.15, H + 1, h], [DX + 1, H + 1, h]], sp);
    }
    if (!g.doorOpen('down')) {
      ctx.strokeStyle = sp || shade(th.wallTop, -0.2); ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) {
        const a = cam.project(DX + i / 4, H + 0.1, 0), b = cam.project(DX + i / 4, H + 0.1, 0.6);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
  }
}

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
