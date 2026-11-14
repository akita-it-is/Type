// HUD nach Skizze: Inventar-Knopf + Herzen oben links, Boss-Balken oben mittig, Karte oben rechts.
import { LAYOUT } from '../core/config';
import { drawHeartShape } from './entities';
import type { Game } from './game';

export function drawHud(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number) {
  const p = g.player;
  // Inventar-Knopf
  const [ix, iy] = LAYOUT.inventoryBtn.pos(w, h);
  const ir = LAYOUT.inventoryBtn.r;
  ctx.fillStyle = 'rgba(20,16,28,0.6)';
  ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `${Math.round(ir * 0.95)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🎒', ix, iy + 1);

  // Herzen
  const hs = 10;
  const x0 = ix + ir + 18;
  for (let i = 0; i < p.stats.maxHp / 2; i++) {
    const hp = p.hp - i * 2;
    const fill = hp >= 2 ? 1 : hp === 1 ? 0.5 : 0;
    const col = i % 8, row = Math.floor(i / 8);
    drawHeartShape(ctx, x0 + col * (hs * 2.4), 20 + row * 22, hs, fill, fill === 0);
  }

  // Münzen & Bomben
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const rows = Math.ceil(p.stats.maxHp / 2 / 8);
  const ty = 20 + rows * 22 + 2;
  textShadow(ctx, `🪙 ${p.coins}`, x0 - 8, ty);
  textShadow(ctx, `💣 ${p.bombs}`, x0 + 56, ty);

  // Boss-Balken
  const boss = g.boss;
  if (boss && boss.spawnT <= 0) {
    const bw = Math.min(360, w * 0.38), bx = w / 2 - bw / 2, by = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 3, by - 3, bw + 6, 18);
    ctx.fillStyle = '#4a0a10'; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#e8303a'; ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 12);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, 12);
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    textShadow(ctx, boss.look.name, w / 2, by + 26);
  }

  drawMinimap(ctx, g, w);

  // Buffs
  const buffs: string[] = [];
  if (p.buffs.rage > 0) buffs.push(`🔥${Math.ceil(p.buffs.rage)}`);
  if (p.buffs.shield > 0) buffs.push(`🛡️${Math.ceil(p.buffs.shield)}`);
  if (g.slowTime > 0) buffs.push(`⏳${Math.ceil(g.slowTime)}`);
  if (buffs.length) { ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'; textShadow(ctx, buffs.join('  '), x0 - 8, ty + 20); }

  // Banner (Item-Name, Etappe, ...)
  if (g.banner) {
    const a = Math.min(1, g.banner.t * 2, (2.6 - g.banner.t) * 4);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const bw = Math.min(w * 0.6, 420);
    ctx.fillRect(w / 2 - bw / 2, h * 0.2, bw, 58);
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif'; textShadow(ctx, g.banner.title, w / 2, h * 0.2 + 20);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#ddd'; ctx.fillText(g.banner.sub, w / 2, h * 0.2 + 44);
    ctx.globalAlpha = 1;
  }
}

function textShadow(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, color = '#fff') {
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(t, x + 1.5, y + 1.5);
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}

function drawMinimap(ctx: CanvasRenderingContext2D, g: Game, w: number) {
  const rooms = g.floor.rooms.filter((r) => r.seen);
  if (!rooms.length) return;
  const cw = 15, ch = 10, gap = 3;
  const minX = Math.min(...rooms.map((r) => r.gx)), maxX = Math.max(...rooms.map((r) => r.gx));
  const minY = Math.min(...rooms.map((r) => r.gy)), maxY = Math.max(...rooms.map((r) => r.gy));
  const mw = (maxX - minX + 1) * (cw + gap) + gap, mh = (maxY - minY + 1) * (ch + gap) + gap;
  const ox = w - mw - 10, oy = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(ox, oy, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, mw, mh);
  for (const r of rooms) {
    const x = ox + gap + (r.gx - minX) * (cw + gap), y = oy + gap + (r.gy - minY) * (ch + gap);
    ctx.fillStyle = r === g.room ? '#ffffff' : r.visited ? '#8a8a98' : '#3a3a48';
    ctx.fillRect(x, y, cw, ch);
    const icon = r.type === 'boss' ? '#e8303a' : r.type === 'item' ? '#f2c230' : null;
    if (icon) { ctx.fillStyle = icon; ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, 3, 0, Math.PI * 2); ctx.fill(); }
  }
}
