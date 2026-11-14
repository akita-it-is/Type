// Einstellungen: Lautstärke, Zielmodus, Vibration, Bildschirmwackeln, Name, Reset.
import { defaultProfile, saveProfile } from '../core/save';
import { sky } from './common';
import { MenuScene } from './menu';
import { App, C, Scene, UI } from './ui';

export class SettingsScene implements Scene {
  confirmReset = false;
  constructor(private app: App) {}

  frame(c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    const ui = new UI(app, c); ui.begin();
    sky(c, w, h, '#141020', '#221a2c');
    const s = app.profile.settings;
    const save = () => { saveProfile(app.profile); app.audio.setVolumes(s.music, s.sfx); };

    if (ui.backButton()) { app.setScene(new MenuScene(app)); return; }
    ui.text('Einstellungen', 74 * u, 31 * u, 24);

    const pw = Math.min(560 * u, w - 32 * u);
    const x = w / 2 - pw / 2;
    const rowH = Math.min(46 * u, (h - 80 * u) / 7);
    let y = 64 * u;
    ui.panel({ x, y, w: pw, h: rowH * 6.6 }, 20 * u);
    y += rowH * 0.3;
    const lx = x + 20 * u, rx = x + pw - 20 * u;
    const bh = rowH * 0.78;

    const volume = (label: string, key: 'music' | 'sfx') => {
      ui.text(label, lx, y + rowH / 2, 17);
      const v = Math.round(s[key] * 10);
      ui.text(`${v * 10}%`, rx - 85 * u, y + rowH / 2, 17, { align: 'center' });
      if (ui.button({ x: rx - 170 * u, y: y + (rowH - bh) / 2, w: 50 * u, h: bh }, '–', { size: 22 })) { s[key] = Math.max(0, v - 1) / 10; save(); }
      if (ui.button({ x: rx - 50 * u, y: y + (rowH - bh) / 2, w: 50 * u, h: bh }, '+', { size: 22 })) { s[key] = Math.min(10, v + 1) / 10; save(); }
      y += rowH;
    };
    const toggle = (label: string, value: string, onTap: () => void) => {
      ui.text(label, lx, y + rowH / 2, 17);
      if (ui.button({ x: rx - 190 * u, y: y + (rowH - bh) / 2, w: 190 * u, h: bh }, value, { size: 15 })) { onTap(); save(); }
      y += rowH;
    };

    volume('Musik', 'music');
    volume('Effekte', 'sfx');
    toggle('Zielen', s.aimMode === 'free' ? 'Frei (360°)' : '4 Richtungen', () => { s.aimMode = s.aimMode === 'free' ? '4dir' : 'free'; });
    toggle('Vibration', s.vibration ? 'An' : 'Aus', () => { s.vibration = !s.vibration; });
    toggle('Bildschirmwackeln', s.screenShake ? 'An' : 'Aus', () => { s.screenShake = !s.screenShake; });
    toggle('Spielstand', this.confirmReset ? 'Wirklich löschen?' : 'Zurücksetzen', () => {
      if (!this.confirmReset) { this.confirmReset = true; return; }
      const fresh = defaultProfile();
      Object.assign(app.profile, fresh);
      this.confirmReset = false;
    });

    ui.text('Version 0.1 – Prototyp  ·  Tastatur: WASD + Pfeiltasten, Leertaste = Bombe, Q = Item, E = Verbrauch',
      w / 2, h - 16 * u, 11, { align: 'center', color: C.dim, bold: false });
  }
}
