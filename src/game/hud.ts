// HUD nach Skizze: Inventar-Knopf + Herzen oben links, Boss-Balken oben mittig, Karte oben rechts.
import { HP_PER_HEART, LAYOUT, ROUNDS_PER_WORLD } from '../core/config';
import { drawHeartShape } from './entities';
import type { Game } from './game';

export function drawHud(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number) {
  const p = g.player;
  const [ix, iy] = LAYOUT.inventoryBtn.pos(w, h);
  const ir = LAYOUT.inventoryBtn.r;
  ctx.fillStyle = 'rgba(20,16,28,0.6)';
  ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `${Math.round(ir * 0.95)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🎒', ix, iy + 1);

  // Herzen (1 Herz = 20 LP, Teilfüllung möglich)
  const hs = 10, x0 = ix + ir + 18;
  const hearts = Math.ceil(p.stats.maxHp / HP_PER_HEART);
  for (let i = 0; i < hearts; i++) {
    const fill = Math.max(0, Math.min(1, (p.hp - i * HP_PER_HEART) / HP_PER_HEART));
    drawHeartShape(ctx, x0 + (i % 10) * (hs * 2.4), 20 + Math.floor(i / 10) * 22, hs, fill, fill === 0);
  }
  const ty = 20 + Math.ceil(hearts / 10) * 22 + 2;
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  textShadow(ctx, `🪙 ${g.runCoins}`, x0 - 8, ty);
  if (p.stats.armor > 0) textShadow(ctx, `🛡️ ${Math.round(p.stats.armor)}%`, x0 + 60, ty);
  const rl = g.cfg.mode === 'arcade' ? `Runde ${g.round}` : `Runde ${g.round}/${ROUNDS_PER_WORLD}${g.prestige ? ` · ★${g.prestige}` : ''}`;
  ctx.font = '12px sans-serif';
  textShadow(ctx, rl, x0 - 8, ty + 18, '#ddd');

  const boss = g.boss;
  if (boss && boss.spawnT <= 0) {
    const bosses = g.room.enemies.filter((e: any) => e.isBoss && !e.dead);
    const hp = bosses.reduce((a: number, b: any) => a + Math.max(0, b.hp), 0);
    const max = Math.max(boss.maxHp, bosses.reduce((a: number, b: any) => a + b.maxHp, 0));
    const bw = Math.min(360, w * 0.38), bx = w / 2 - bw / 2, by = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 3, by - 3, bw + 6, 18);
    ctx.fillStyle = '#4a0a10'; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = boss.invulnerable ? '#80c8ff' : '#e8303a'; ctx.fillRect(bx, by, bw * Math.min(1, hp / max), 12);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, 12);
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    textShadow(ctx, boss.look.name + (boss.endboss ? ' (Endboss)' : ''), w / 2, by + 26);
  }

  drawMinimap(ctx, g, w);

  const buffs: string[] = [];
  if (p.buffs.rage > 0) buffs.push(`🔥${Math.ceil(p.buffs.rage)}`);
  if (p.buffs.shield > 0) buffs.push(`🛡️${Math.ceil(p.buffs.shield)}`);
  if (p.flyT > 0) buffs.push(`🪽${Math.ceil(p.flyT)}`);
  if (g.slowTime > 0) buffs.push(`⏳${Math.ceil(g.slowTime)}`);
  if (buffs.length) { ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'; textShadow(ctx, buffs.join('  '), x0 - 8, ty + 36); }

  if (g.banner) {
    const a = Math.min(1, g.banner.t * 2, (2.6 - g.banner.t) * 4);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const bw = Math.min(w * 0.62, 460);
    ctx.fillRect(w / 2 - bw / 2, h * 0.2, bw, 58);
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif'; textShadow(ctx, g.banner.title, w / 2, h * 0.2 + 20);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#ddd'; ctx.fillText(g.banner.sub, w / 2, h * 0.2 + 44);
    ctx.globalAlpha = 1;
  }
  if (g.toast) {
    ctx.globalAlpha = Math.min(1, g.toast.t * 3);
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    const tw = ctx.measureText(g.toast.text).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(w / 2 - tw / 2, h * 0.62, tw, 28);
    textShadow(ctx, g.toast.text, w / 2, h * 0.62 + 14);
    ctx.globalAlpha = 1;
  }
}

function textShadow(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, color = '#fff') {
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(t, x + 1.5, y + 1.5);
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}

const ROOM_ICON: Record<string, string> = { boss: '#e8303a', item: '#f2c230', shop: '#4ad070', altar: '#b060ff' };

function drawMinimap(ctx: CanvasRenderingContext2D, g: Game, w: number) {
  const rooms = g.floor.rooms.filter((r) => r.seen);
  if (!rooms.length) return;
  const cw = 14, ch = 9, gap = 3;
  const minX = Math.min(...rooms.map((r) => r.gx)), maxX = Math.max(...rooms.map((r) => r.gx));
  const minY = Math.min(...rooms.map((r) => r.gy)), maxY = Math.max(...rooms.map((r) => r.gy));
  const mw = (maxX - minX + 1) * (cw + gap) + gap, mh = (maxY - minY + 1) * (ch + gap) + gap;
  const ox = w - mw - 10, oy = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ox, oy, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, mw, mh);
  for (const r of rooms) {
    const x = ox + gap + (r.gx - minX) * (cw + gap), y = oy + gap + (r.gy - minY) * (ch + gap);
    ctx.fillStyle = r === g.room ? '#ffffff' : r.visited ? '#8a8a98' : '#3a3a48';
    ctx.fillRect(x, y, cw, ch);
    const icon = ROOM_ICON[r.type];
    if (icon) { ctx.fillStyle = icon; ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, 3, 0, Math.PI * 2); ctx.fill(); }
  }
}
