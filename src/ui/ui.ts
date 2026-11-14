// Einfaches "Immediate-Mode"-UI auf dem Canvas: Knöpfe werden pro Frame gezeichnet
// und geben true zurück, wenn sie angetippt wurden. Später durch schönere Grafiken ersetzbar.
import type { AudioEngine } from '../core/audio';
import type { Input } from '../core/input';
import type { Profile } from '../core/save';

export interface Scene {
  frame(ctx: CanvasRenderingContext2D, dt: number): void;
  onResize?(): void;
  onHidden?(): void;
}

export interface App {
  w: number; h: number;
  u: number; // UI-Skalierung
  input: Input;
  audio: AudioEngine;
  profile: Profile;
  setScene(s: Scene): void;
  time: number;
}

export const C = {
  text: '#f4ead8',
  dim: '#a89c8c',
  panel: 'rgba(24,18,30,0.82)',
  panelLine: 'rgba(255,240,220,0.55)',
  accent: '#f2c230',
  good: '#7affb0',
  bad: '#ff6070',
};

export interface Rect { x: number; y: number; w: number; h: number }

export class UI {
  taps: { x: number; y: number }[] = [];
  consumed = false;
  constructor(public app: App, public ctx: CanvasRenderingContext2D) {}

  begin() { this.taps = this.app.input.taps(); this.consumed = false; }

  hit(r: Rect): boolean {
    if (this.consumed) return false;
    const t = this.taps.find((p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    if (t) { this.consumed = true; return true; }
    return false;
  }

  rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  panel(r: Rect, radius = 18, fill = C.panel, line = C.panelLine) {
    const c = this.ctx;
    this.rr(r.x, r.y, r.w, r.h, radius);
    c.fillStyle = fill; c.fill();
    c.lineWidth = 2.5 * this.app.u; c.strokeStyle = line; c.stroke();
  }

  text(t: string, x: number, y: number, size: number, o: { color?: string; align?: CanvasTextAlign; bold?: boolean; shadow?: boolean } = {}) {
    const c = this.ctx;
    c.font = `${o.bold === false ? '' : 'bold '}${Math.round(size * this.app.u)}px system-ui, sans-serif`;
    c.textAlign = o.align || 'left';
    c.textBaseline = 'middle';
    if (o.shadow !== false) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(t, x + 1.5, y + 2); }
    c.fillStyle = o.color || C.text;
    c.fillText(t, x, y);
  }

  /** Knopf wie in der Menü-Skizze: abgerundet, mit Kreis-Symbol links */
  button(r: Rect, label: string, o: { icon?: string; disabled?: boolean; primary?: boolean; size?: number; center?: boolean } = {}): boolean {
    const c = this.ctx, u = this.app.u;
    const pressed = !o.disabled && [...this.app.input.ptrs.values()].some((p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    c.save();
    if (o.disabled) c.globalAlpha = 0.45;
    this.rr(r.x, r.y + (pressed ? 2 : 0), r.w, r.h, r.h / 2);
    c.fillStyle = o.primary ? 'rgba(242,194,48,0.25)' : pressed ? 'rgba(255,255,255,0.18)' : 'rgba(24,18,30,0.78)';
    c.fill();
    c.lineWidth = 2.5 * u; c.strokeStyle = o.primary ? C.accent : C.panelLine; c.stroke();
    const size = o.size || 18;
    if (o.icon !== undefined) {
      const cx = r.x + r.h / 2 + 2, cy = r.y + r.h / 2 + (pressed ? 2 : 0), cr = r.h / 2 - 6 * u;
      c.beginPath(); c.arc(cx, cy, cr, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill(); c.stroke();
      if (o.icon) {
        c.font = `${Math.round(cr * 1.1)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#fff'; c.fillText(o.icon, cx, cy + 1);
      }
      this.text(label, o.center ? r.x + r.w / 2 + r.h / 4 : r.x + r.h + 4 * u, cy, size, { align: o.center ? 'center' : 'left' });
    } else {
      this.text(label, r.x + r.w / 2, r.y + r.h / 2 + (pressed ? 2 : 0), size, { align: 'center' });
    }
    c.restore();
    const t = !o.disabled && this.hit(r);
    if (t) this.app.audio.sfx('click');
    return t;
  }

  coinPill(x: number, y: number, align: 'left' | 'right' = 'right') {
    const u = this.app.u;
    const t = String(this.app.profile.coins);
    this.ctx.font = `bold ${Math.round(18 * u)}px system-ui, sans-serif`;
    const w = this.ctx.measureText(t).width + 56 * u, h = 38 * u;
    const x0 = align === 'right' ? x - w : x;
    this.panel({ x: x0, y, w, h }, h / 2);
    this.ctx.font = `${Math.round(20 * u)}px sans-serif`; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
    this.ctx.fillText('🪙', x0 + 20 * u, y + h / 2 + 1);
    this.text(t, x0 + 38 * u, y + h / 2, 18);
  }

  backButton(): boolean {
    const u = this.app.u;
    return this.button({ x: 14 * u, y: 12 * u, w: 46 * u, h: 38 * u }, '‹', { size: 26 });
  }
}
