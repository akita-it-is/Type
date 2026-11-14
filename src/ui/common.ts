import { drawHero } from '../game/draw';
import { Assets } from '../core/assets';
import { charById } from '../data/characters';
import { skinById } from '../data/skins';
import { saveProfile } from '../core/save';
import type { App, UI } from './ui';

export function heroLook(charId: string, skinId: string) {
  const ch = charById(charId), sk = skinById(skinId);
  return { cloak: sk.cloak || ch.body, skin: sk.skin, hat: ch.hat };
}

/** Profil-Anzeige oben links (Avatar + Name), antippen = Namen ändern */
export function profilePill(ui: UI, app: App, x: number, y: number) {
  const u = app.u, c = ui.ctx;
  c.font = `bold ${Math.round(18 * u)}px system-ui, sans-serif`;
  const w = Math.max(150 * u, c.measureText(app.profile.name).width + 70 * u), h = 40 * u;
  const r = { x, y, w, h };
  ui.panel(r, h / 2);
  c.save();
  c.beginPath(); c.arc(x + h / 2, y + h / 2, h / 2 - 4 * u, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill(); c.clip();
  drawCharacter(c, x + h / 2, y + h * 1.25, h * 0.95, app.profile.char, app.profile.skin);
  c.restore();
  ui.text(app.profile.name, x + h + 6 * u, y + h / 2, 18);
  if (ui.hit(r)) {
    const n = window.prompt('Wie soll dein Profil heißen?', app.profile.name);
    if (n && n.trim()) { app.profile.name = n.trim().slice(0, 16); saveProfile(app.profile); }
  }
}

/** Einfache vertikale Scroll-Logik für Listen, die nicht auf den Bildschirm passen */
export class Scroller {
  y = 0;
  private last: number | null = null;
  update(app: App, contentH: number, viewH: number) {
    const ptrs = [...app.input.ptrs.values()];
    if (ptrs.length === 1) {
      const p = ptrs[0];
      if (this.last !== null && Math.abs(p.y - p.sy) > 10) this.y -= p.y - this.last;
      this.last = p.y;
    } else this.last = null;
    this.y = Math.max(0, Math.min(this.y, Math.max(0, contentH - viewH)));
  }
}

export function sky(c: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

/** Charakter im Menü zeichnen: eigenes Sprite (char_<id>_<skin> / char_<id>) oder Form-Grafik */
export function drawCharacter(c: CanvasRenderingContext2D, x: number, y: number, s: number, charId: string, skinId: string, o: { faceX?: number; alpha?: number } = {}) {
  const key = Assets.pick([`char_${charId}_${skinId}`, `char_${charId}`]);
  if (Assets.draw(c, key, x, y, s, { dirX: 0, dirY: 1, alpha: o.alpha })) return;
  c.save(); if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  drawHero(c, x, y, s, heroLook(charId, skinId), { faceX: o.faceX ?? 0, faceY: 1 });
  c.restore();
}
