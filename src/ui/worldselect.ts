// "Spielen": Welten-Karten. Jede Welt hat 20 Runden und bis zu 10 Prestige-Stufen.
// Die nächste Welt wird freigeschaltet, wenn die vorherige einmal geschafft wurde.
import { WORLDS, WorldDef, playableWorlds } from '../data/worlds';
import { ROUNDS_PER_WORLD, MAX_PRESTIGE } from '../core/config';
import { worldProgress } from '../core/save';
import { profilePill, sky } from './common';
import { MenuScene } from './menu';
import { LoadoutScene } from './loadout';
import { Assets } from '../core/assets';
import { App, C, Rect, Scene, UI } from './ui';

export function worldUnlocked(app: App, wd: WorldDef) {
  if (wd.locked) return false;
  const list = playableWorlds();
  const i = list.indexOf(wd);
  return i <= 0 || worldProgress(app.profile, list[i - 1].id).clears > 0;
}

export class WorldSelectScene implements Scene {
  msg = '';
  constructor(private app: App) {}

  frame(c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    const ui = new UI(app, c); ui.begin();
    sky(c, w, h, '#141020', '#221a2c');

    if (ui.backButton()) { app.setScene(new MenuScene(app)); return; }
    profilePill(ui, app, 70 * u, 12 * u);
    ui.coinPill(w - 16 * u, 12 * u);

    const top = 66 * u, pad = 16 * u, gap = 14 * u;
    const cw = (w - pad * 2 - gap * 2) / 3, ch = (h - top - pad - gap - (this.msg ? 18 * u : 0)) / 2;
    WORLDS.slice(0, 6).forEach((wd, i) => {
      const r: Rect = { x: pad + (i % 3) * (cw + gap), y: top + Math.floor(i / 3) * (ch + gap), w: cw, h: ch };
      const open = worldUnlocked(app, wd);
      this.card(ui, c, r, wd, open);
      if (ui.hit(r)) {
        if (!open) {
          app.audio.sfx('error');
          const prev = playableWorlds()[playableWorlds().indexOf(wd) - 1];
          this.msg = wd.locked ? 'Diese Welt kommt bald.' : `Schaffe zuerst alle ${ROUNDS_PER_WORLD} Runden in "${prev?.name}".`;
        } else { app.audio.sfx('click'); app.setScene(new LoadoutScene(app, wd)); }
      }
    });
    if (this.msg) ui.text(this.msg, w / 2, h - 12 * u, 12, { align: 'center', color: C.bad, bold: false });
  }

  card(ui: UI, c: CanvasRenderingContext2D, r: Rect, wd: WorldDef, open: boolean) {
    const u = this.app.u;
    const labelH = Math.min(40 * u, r.h * 0.3);
    c.save();
    ui.rr(r.x, r.y, r.w, r.h, 16 * u);
    c.clip();
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, wd.card.sky); g.addColorStop(1, wd.card.ground);
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
    const ix = r.x + r.w / 2, iy = r.y + (r.h - labelH) * 0.55, s = Math.min(r.w, r.h - labelH) * 0.4;
    if (!open) c.globalAlpha = 0.35;
    const card = Assets.sprites.get(`card_${wd.id}`);
    if (card) { // eigenes Bild füllt die Karte
      const f = Math.max(r.w / card.fw, (r.h - labelH) / card.fh);
      c.drawImage(card.img, 0, 0, card.fw, card.fh, r.x + r.w / 2 - (card.fw * f) / 2, r.y + (r.h - labelH) / 2 - (card.fh * f) / 2, card.fw * f, card.fh * f);
    } else drawWorldArt(c, wd.id, ix, iy, s, this.app.time);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(r.x, r.y + r.h - labelH, r.w, labelH);
    c.restore();
    ui.rr(r.x, r.y, r.w, r.h, 16 * u);
    c.lineWidth = 2.5 * u; c.strokeStyle = C.panelLine; c.stroke();
    c.beginPath(); c.moveTo(r.x, r.y + r.h - labelH); c.lineTo(r.x + r.w, r.y + r.h - labelH); c.stroke();
    const ly = r.y + r.h - labelH / 2;
    if (wd.locked) {
      ui.text('. . . . .', r.x + r.w / 2, ly, 16, { align: 'center', color: C.dim });
      c.font = `${Math.round(s * 0.6)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalAlpha = 0.6; c.fillText('🔒', ix, iy); c.globalAlpha = 1;
      return;
    }
    if (!open) { c.font = `${Math.round(s * 0.5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🔒', ix, iy); }
    const wp = worldProgress(this.app.profile, wd.id);
    ui.text(wd.name, r.x + 12 * u, ly, 17);
    const prog = `Rekord ${wp.best}/${ROUNDS_PER_WORLD}`;
    c.font = `bold ${Math.round(12 * u)}px system-ui, sans-serif`;
    const pw = c.measureText(prog).width + 16 * u, ph = 22 * u;
    const px = r.x + r.w - pw - 10 * u;
    ui.rr(px, ly - ph / 2, pw, ph, ph / 2);
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill(); c.lineWidth = 1.5 * u; c.strokeStyle = C.panelLine; c.stroke();
    ui.text(prog, px + pw / 2, ly, 12, { align: 'center' });
    // Prestige-Sterne oben
    const stars = '★'.repeat(wp.prestige) + '☆'.repeat(MAX_PRESTIGE - wp.prestige);
    ui.text(stars, r.x + r.w / 2, r.y + 14 * u, 11, { align: 'center', color: wp.prestige ? C.accent : 'rgba(255,255,255,0.35)' });
  }
}

/** Provisorische Karten-Illustrationen (später durch echte Bilder ersetzen) */
export function drawWorldArt(c: CanvasRenderingContext2D, id: string, x: number, y: number, s: number, t: number) {
  c.save();
  c.lineWidth = Math.max(2, s * 0.05);
  c.strokeStyle = '#f4ead8';
  if (id === 'aliens') {
    // Sterne
    c.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { const a = i * 2.4; c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t + i)); c.fillRect(x + Math.cos(a) * s * 1.5, y + Math.sin(a * 1.7) * s * 0.8, 2, 2); }
    c.globalAlpha = 1;
    const by = y + Math.sin(t * 2) * s * 0.06;
    c.fillStyle = 'rgba(150,230,255,0.5)';
    c.beginPath(); c.arc(x, by - s * 0.15, s * 0.35, Math.PI, 0); c.fill(); c.stroke();
    c.fillStyle = '#7cff8a';
    c.beginPath(); c.arc(x, by - s * 0.2, s * 0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8a94a8';
    c.beginPath(); c.ellipse(x, by - s * 0.1, s * 0.8, s * 0.22, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#ffe066';
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(x + i * s * 0.28, by - s * 0.08, s * 0.05, 0, Math.PI * 2); c.fill(); }
  } else if (id === 'romans') {
    // Legionär mit Speer
    c.fillStyle = '#c0302a';
    c.beginPath(); c.moveTo(x - s * 0.5, y + s * 0.9); c.quadraticCurveTo(x, y + s * 0.05, x + s * 0.5, y + s * 0.9); c.fill(); c.stroke();
    c.fillStyle = '#f1d6c4';
    c.beginPath(); c.arc(x, y - s * 0.15, s * 0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#b8b0a0';
    c.beginPath(); c.arc(x, y - s * 0.2, s * 0.32, Math.PI, 0); c.fill(); c.stroke();
    c.fillStyle = '#e8443a';
    c.beginPath(); c.ellipse(x, y - s * 0.55, s * 0.28, s * 0.1, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.moveTo(x + s * 0.65, y + s * 0.9); c.lineTo(x + s * 0.65, y - s * 0.7); c.stroke();
    c.fillStyle = '#d0d0d8';
    c.beginPath(); c.moveTo(x + s * 0.55, y - s * 0.6); c.lineTo(x + s * 0.65, y - s * 0.95); c.lineTo(x + s * 0.75, y - s * 0.6); c.fill();
  } else if (id === 'greece') {
    // Tempel auf einem Hügel
    c.fillStyle = '#7a9a5a';
    c.beginPath(); c.ellipse(x, y + s * 0.95, s * 1.3, s * 0.75, 0, Math.PI, 0); c.fill(); c.stroke();
    c.fillStyle = '#ece8de';
    c.fillRect(x - s * 0.55, y - s * 0.05, s * 1.1, s * 0.1);
    for (let i = 0; i < 5; i++) c.fillRect(x - s * 0.5 + i * s * 0.24, y - s * 0.45, s * 0.1, s * 0.42);
    c.beginPath(); c.moveTo(x - s * 0.62, y - s * 0.45); c.lineTo(x, y - s * 0.75); c.lineTo(x + s * 0.62, y - s * 0.45); c.closePath(); c.fill();
    c.strokeStyle = '#8a8478'; c.lineWidth = 1.5; c.stroke();
  }
  c.restore();
}
