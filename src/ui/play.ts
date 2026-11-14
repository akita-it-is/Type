// Spiel-Szene: verbindet Spiel-Logik, Steuerung, HUD sowie Pause-/Ergebnis-Bildschirm.
import { MAX_DT } from '../core/config';
import { Game, RunConfig } from '../game/game';
import { TouchControls } from '../game/controls';
import { drawHud } from '../game/hud';
import { renderGame } from '../game/render';
import { itemById } from '../data/items';
import { MenuScene } from './menu';
import { WorldSelectScene } from './worldselect';
import { App, C, Scene, UI } from './ui';

export class PlayScene implements Scene {
  game: Game;
  controls = new TouchControls();
  paused = false;

  constructor(private app: App, private cfg: RunConfig) {
    this.game = new Game(cfg, app.audio, app.profile);
    this.onResize();
  }

  onResize() {
    const { w, h } = this.app;
    this.game.camera.fit(w, h, Math.max(30, h * 0.07), 6, 6);
  }

  onHidden() { if (!this.game.result) this.paused = true; }

  frame(c: CanvasRenderingContext2D, rawDt: number) {
    const { app, game } = this, { w, h } = app;
    const dt = Math.min(rawDt, MAX_DT);
    const ui = new UI(app, c);

    const ctl = this.controls.read(app.input, w, h, app.profile);
    const wasPaused = this.paused;
    if (!this.paused && !game.result) {
      if (ctl.menu) { this.paused = true; this.controls.reset(); app.audio.sfx('click'); }
      else game.update(dt, ctl);
    }

    c.fillStyle = game.world.theme.bg;
    c.fillRect(0, 0, w, h);
    renderGame(c, game);
    if (game.transition) {
      const t = game.transition.t;
      c.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - Math.abs(t - 0.16) / 0.16)})`;
      c.fillRect(0, 0, w, h);
    }
    if (game.player.hp <= 0 && !game.result) {
      c.fillStyle = `rgba(60,0,0,${Math.min(0.5, game.deathT * 0.4)})`;
      c.fillRect(0, 0, w, h);
    }
    drawHud(c, game, w, h);
    if (!this.paused && !game.result) this.controls.draw(c, game, w, h);

    ui.begin();
    if (game.result) this.resultScreen(ui, c);
    else if (this.paused) this.pauseScreen(ui, c, wasPaused && ctl.menu);
  }

  private pauseScreen(ui: UI, c: CanvasRenderingContext2D, menuPressed: boolean) {
    const { app, game } = this, { w, h, u } = app;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, w, h);
    const pw = Math.min(640 * u, w - 40 * u), ph = Math.min(330 * u, h - 30 * u);
    const r = { x: w / 2 - pw / 2, y: h / 2 - ph / 2, w: pw, h: ph };
    ui.panel(r, 22 * u);
    ui.text('Pause – Inventar', r.x + 20 * u, r.y + 28 * u, 22);
    const p = game.player, s = p.stats;
    // Werte
    const stats = [
      ['Schaden', s.damage.toFixed(1)], ['Feuerrate', (1 / s.fireDelay).toFixed(1) + '/s'],
      ['Tempo', s.speed.toFixed(1)], ['Reichweite', s.range.toFixed(1)],
    ];
    stats.forEach(([k, v], i) => {
      ui.text(k, r.x + 20 * u, r.y + 64 * u + i * 24 * u, 14, { bold: false, color: C.dim });
      ui.text(v, r.x + 130 * u, r.y + 64 * u + i * 24 * u, 14);
    });
    // Items
    const ix = r.x + 200 * u;
    ui.text('Gesammelte Items', ix, r.y + 64 * u, 15);
    const all = [...p.items.map((id) => itemById(id)!), ...(p.active ? [p.active] : []), ...(p.consumable ? [p.consumable] : [])];
    if (!all.length) ui.text('Noch keine', ix, r.y + 92 * u, 13, { bold: false, color: C.dim });
    all.forEach((it, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = ix + col * ((pw - 220 * u) / 2), y = r.y + 92 * u + row * 26 * u;
      c.font = `${Math.round(16 * u)}px sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(it.icon, x, y);
      ui.text(it.name, x + 26 * u, y, 13, { bold: false });
    });
    const bw = (pw - 60 * u) / 2, by = r.y + ph - 62 * u;
    if (ui.button({ x: r.x + 20 * u, y: by, w: bw, h: 46 * u }, 'Weiter', { primary: true }) || menuPressed) { this.paused = false; return; }
    if (ui.button({ x: r.x + 40 * u + bw, y: by, w: bw, h: 46 * u }, 'Aufgeben')) {
      this.paused = false;
      game.player.hp = 0;
      game.deathT = 10;
      game.update(0.016, { mx: 0, my: 0, ax: 0, ay: 0, shooting: false, bomb: false, item: false, consumable: false, menu: false });
    }
  }

  private resultScreen(ui: UI, c: CanvasRenderingContext2D) {
    const { app, game } = this, { w, h, u } = app;
    const res = game.result!;
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(0, 0, w, h);
    const pw = Math.min(520 * u, w - 40 * u), ph = Math.min(300 * u, h - 30 * u);
    const r = { x: w / 2 - pw / 2, y: h / 2 - ph / 2, w: pw, h: ph };
    ui.panel(r, 22 * u);
    const won = res.type === 'won';
    const arcade = this.cfg.mode === 'arcade';
    ui.text(won ? 'Stufe geschafft!' : arcade ? 'Run beendet' : 'Gestorben', w / 2, r.y + 36 * u, 28, { align: 'center', color: won ? C.good : C.bad });
    const lines = [
      `Besiegte Gegner: ${res.kills}`,
      `Geschaffte Räume: ${res.rooms}`,
      arcade ? `Ebene: ${res.floors}   ·   Punkte: ${res.score}${res.newBest ? '  (Neuer Rekord!)' : ''}` : '',
      `Münzen verdient: 🪙 ${res.coins}`,
    ].filter(Boolean);
    lines.forEach((l, i) => ui.text(l, w / 2, r.y + 80 * u + i * 26 * u, 16, { align: 'center', bold: false }));
    const bw = (pw - 60 * u) / 2, by = r.y + ph - 62 * u;
    const nextStage = won && this.cfg.stage < this.cfg.world.stages;
    const again = nextStage ? 'Nächste Stufe' : 'Nochmal';
    if (ui.button({ x: r.x + 20 * u, y: by, w: bw, h: 46 * u }, again, { primary: true })) {
      app.setScene(new PlayScene(app, { ...this.cfg, stage: nextStage ? this.cfg.stage + 1 : this.cfg.stage }));
      return;
    }
    if (ui.button({ x: r.x + 40 * u + bw, y: by, w: bw, h: 46 * u }, 'Menü')) {
      app.setScene(arcade ? new MenuScene(app) : new WorldSelectScene(app));
    }
  }
}
