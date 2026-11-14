// Spiel-Szene: verbindet Spiel-Logik, Steuerung und HUD.
// Das Inventar (🎒) pausiert das Spiel NICHT. Dazu: Altar, Ergebnis-Bildschirm.
import { MAX_DT } from '../core/config';
import { Game, RunConfig, RARITY_FACTOR, scaleMods } from '../game/game';
import { TouchControls } from '../game/controls';
import { drawHud } from '../game/hud';
import { renderGame } from '../game/render';
import type { ItemRef } from '../game/inventory';
import { describeMods, RARITIES, setById } from '../data/items';
import { ABILITIES } from '../data/characters';
import { worldProgress } from '../core/save';
import { MenuScene } from './menu';
import { WorldSelectScene } from './worldselect';
import { LoadoutScene } from './loadout';
import { invGrid, itemInfo, InvView, fitText } from './itemui';
import { App, C, Scene, UI } from './ui';

export class PlayScene implements Scene {
  game: Game;
  controls = new TouchControls();
  invOpen = false;
  paused = false;      // nur wenn die App in den Hintergrund geht
  sel: ItemRef | null = null;
  altarBoost = -1;

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
    const overlay = this.invOpen || game.altarOpen;

    const ctl = this.controls.read(app.input, w, h, app.profile, overlay || this.paused);
    if (ctl.menu && !game.result && !this.paused) {
      this.invOpen = !this.invOpen; this.sel = null; this.controls.reset(); app.audio.sfx('click');
    }
    if (!this.paused && !game.result) game.update(dt, overlay ? { ...ctl, mx: 0, my: 0, shooting: false } : ctl);
    if (!game.altarOpen) this.altarBoost = -1;

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
    if (!overlay && !game.result && !this.paused) this.controls.draw(c, game, w, h);

    ui.begin();
    if (game.result) this.resultScreen(ui, c);
    else if (this.paused) this.pauseScreen(ui, c);
    else if (game.altarOpen) this.altarScreen(ui, c);
    else if (this.invOpen) this.inventoryScreen(ui, c);
  }

  private view(): InvView {
    const inv = this.game.inv;
    return { weapon: inv.weapon, armor: inv.armor, active: inv.active, consumables: inv.consumables, passives: inv.passives, backpack: inv.backpack };
  }

  /** Inventar während des Spiels – das Spiel läuft weiter! */
  private inventoryScreen(ui: UI, c: CanvasRenderingContext2D) {
    const { app, game } = this, { w, h, u } = app;
    const inv = game.inv, p = game.player;
    const pw = Math.min(w - 16 * u, 900 * u), ph = Math.min(h - 56 * u, 340 * u);
    const r = { x: w / 2 - pw / 2, y: 50 * u, w: pw, h: ph };
    ui.panel(r, 18 * u, 'rgba(18,14,24,0.9)');
    ui.text('Inventar', r.x + 16 * u, r.y + 18 * u, 18);
    ui.text('Das Spiel läuft weiter!', r.x + 110 * u, r.y + 19 * u, 11, { color: C.bad, bold: false });
    if (ui.button({ x: r.x + pw - 50 * u, y: r.y + 6 * u, w: 40 * u, h: 30 * u }, '✕', { size: 16 })) { this.invOpen = false; return; }

    const S = Math.min(44 * u, (pw - 300 * u) / 11);
    const grid = invGrid(ui, r.x + 16 * u, r.y + 36 * u, S, this.view(), this.sel);
    if (grid.tapped) { this.sel = grid.tapped; app.audio.sfx('click'); }

    // Werte + Sets rechts
    const sx = r.x + 16 * u + grid.width + 18 * u, s = p.stats;
    const lines = [
      `Schaden ${s.damage.toFixed(1)}`, `Feuerrate ${(1 / (s.fireDelay * p.weapon.delayMult)).toFixed(1)}/s`,
      `Tempo ${s.speed.toFixed(1)}`, `Reichweite ${s.range.toFixed(1)}`, `Rüstung ${Math.round(s.armor)} %`,
      `Krit ${Math.round(s.crit * 100)} %  ·  Glück ${s.luck.toFixed(1)}`, `Fähigkeit: ${ABILITIES[p.ability].name}`,
    ];
    lines.forEach((l, i) => ui.text(l, sx, r.y + 52 * u + i * 17 * u, 12, { bold: false }));
    const sets = Object.entries(inv.setCounts()).filter(([, n]) => n >= 2).map(([id, n]) => `${setById(id)?.name} ${n}/3`);
    if (sets.length) ui.text(`Sets: ${sets.join(', ')}`, sx, r.y + 52 * u + lines.length * 17 * u, 12, { color: C.good });

    // Details + Aktionen
    const dy = r.y + 36 * u + grid.height + 10 * u;
    const item = this.sel ? inv.get(this.sel) : null;
    if (!item) { ui.text('Tippe auf ein Item für Details.', r.x + 16 * u, dy + 10 * u, 12, { color: C.dim, bold: false }); return; }
    itemInfo(ui, item, r.x + 16 * u, dy + 8 * u, pw - 300 * u);
    const acts: [string, () => void][] = [];
    const ref = this.sel!;
    if (ref.area === 'backpack' && (item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'active'))
      acts.push(['Ausrüsten', () => inv.equipFromBackpack(ref.key)]);
    if (ref.area === 'weapon' || ref.area === 'active' || ref.area === 'armor')
      acts.push(['In Rucksack', () => { if (!inv.unequip(ref.area === 'armor' ? ref.key : ref.area)) game.showToast('Rucksack voll'); }]);
    if (ref.area === 'consumables') acts.push(['Benutzen', () => { inv.selConsumable = ref.key; game.useConsumable(); }]);
    acts.push(['Ablegen', () => { game.dropItem(ref); this.sel = null; }]);
    const bw = 120 * u;
    acts.forEach(([label, fn], i) => {
      if (ui.button({ x: r.x + pw - (acts.length - i) * (bw + 8 * u) - 8 * u, y: dy + 4 * u, w: bw, h: 36 * u }, label, { size: 14 })) {
        fn(); game.player.recalc();
      }
    });
  }

  /** Altar: Bonus wählen, dann ein Item opfern */
  private altarScreen(ui: UI, c: CanvasRenderingContext2D) {
    const { app, game } = this, { w, h, u } = app;
    const pw = Math.min(w - 16 * u, 900 * u), ph = Math.min(h - 56 * u, 340 * u);
    const r = { x: w / 2 - pw / 2, y: 50 * u, w: pw, h: ph };
    ui.panel(r, 18 * u, 'rgba(30,14,40,0.92)', '#b070ff');
    ui.text('🔮 Altar – opfere ein Item für einen dauerhaften Bonus in diesem Run', r.x + 16 * u, r.y + 18 * u, 15);
    if (ui.button({ x: r.x + pw - 50 * u, y: r.y + 6 * u, w: 40 * u, h: 30 * u }, '✕', { size: 16 })) { game.altarOpen = false; game.player.y += 1.2; return; }
    const item = this.sel ? game.inv.get(this.sel) : null;
    const f = item ? RARITY_FACTOR[RARITIES.indexOf(item.rarity)] : 1;
    const bw = (pw - 48 * u) / 3;
    game.altarOffers.forEach((b, i) => {
      const label = `${b.icon} ${b.name}: ${describeMods(scaleMods(b.mods, f))}`;
      ui.panel({ x: r.x + 16 * u + i * (bw + 8 * u), y: r.y + 36 * u, w: bw, h: 40 * u }, 12 * u,
        this.altarBoost === i ? 'rgba(176,112,255,0.35)' : 'rgba(0,0,0,0.3)', this.altarBoost === i ? '#d0a0ff' : C.panelLine);
      fitText(ui, label, r.x + 26 * u + i * (bw + 8 * u), r.y + 56 * u, bw - 20 * u, 13);
      if (ui.hit({ x: r.x + 16 * u + i * (bw + 8 * u), y: r.y + 36 * u, w: bw, h: 40 * u })) { this.altarBoost = i; app.audio.sfx('click'); }
    });
    const S = Math.min(40 * u, (pw - 60 * u) / 11);
    const grid = invGrid(ui, r.x + 16 * u, r.y + 86 * u, S, this.view(), this.sel);
    if (grid.tapped) { this.sel = grid.tapped; app.audio.sfx('click'); }
    const dy = r.y + 86 * u + grid.height + 8 * u;
    ui.text(item ? `Opfer: ${item.icon} ${item.name} → Bonus x${f} (seltener = stärker)` : 'Wähle einen Bonus und ein Item zum Opfern.', r.x + 16 * u, dy + 14 * u, 13, { bold: false });
    const ready = this.altarBoost >= 0 && !!item;
    if (ui.button({ x: r.x + pw - 170 * u, y: dy, w: 154 * u, h: 38 * u }, 'Opfern', { primary: true, disabled: !ready, size: 15 }) && ready) {
      game.altarTrade(game.altarOffers[this.altarBoost], this.sel!);
      this.sel = null; this.altarBoost = -1;
    }
  }

  private pauseScreen(ui: UI, c: CanvasRenderingContext2D) {
    const { app } = this, { w, h, u } = app;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, w, h);
    ui.text('Pausiert', w / 2, h / 2 - 40 * u, 28, { align: 'center' });
    if (ui.button({ x: w / 2 - 110 * u, y: h / 2 - 10 * u, w: 220 * u, h: 48 * u }, 'Weiter', { primary: true })) this.paused = false;
  }

  private resultScreen(ui: UI, c: CanvasRenderingContext2D) {
    const { app, game } = this, { w, h, u } = app;
    const res = game.result!;
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(0, 0, w, h);
    const pw = Math.min(540 * u, w - 40 * u), ph = Math.min(300 * u, h - 30 * u);
    const r = { x: w / 2 - pw / 2, y: h / 2 - ph / 2, w: pw, h: ph };
    ui.panel(r, 22 * u);
    const arcade = this.cfg.mode === 'arcade';
    const title = res.type === 'worldclear' ? `Welt geschafft! Prestige ${res.prestige}` : res.type === 'extract' ? 'Welt verlassen' : arcade ? 'Run beendet' : 'Gestorben';
    ui.text(title, w / 2, r.y + 36 * u, 26, { align: 'center', color: res.type === 'dead' ? C.bad : C.good });
    const lines = arcade
      ? [`Runden: ${res.rounds}  ·  Gegner: ${res.kills}`, `Punkte: ${res.score}${res.newBest ? '  (Neuer Rekord!)' : ''}`, `Münzen: 🪙 ${res.coins}`]
      : res.type === 'dead'
        ? ['Alle Items (auch die mitgebrachte Ausrüstung)', 'und alle Münzen dieses Runs sind verloren.', 'Der Fortschritt dieses Runs zählt nicht.']
        : [`Geschaffte Runden: ${res.rounds}  ·  Gegner: ${res.kills}`, `Ins Lager übernommen: ${res.items} Items`, `Münzen: 🪙 ${res.coins}`];
    lines.forEach((l, i) => ui.text(l, w / 2, r.y + 82 * u + i * 26 * u, 15, { align: 'center', bold: false }));
    const bw = (pw - 60 * u) / 2, by = r.y + ph - 62 * u;
    const againLabel = arcade ? 'Nochmal' : 'Weiterspielen';
    if (ui.button({ x: r.x + 20 * u, y: by, w: bw, h: 46 * u }, againLabel, { primary: true })) {
      if (arcade) app.setScene(new PlayScene(app, { ...this.cfg, round: 1 }));
      else app.setScene(new LoadoutScene(app, this.cfg.world));
      return;
    }
    if (ui.button({ x: r.x + 40 * u + bw, y: by, w: bw, h: 46 * u }, 'Menü')) {
      app.setScene(arcade ? new MenuScene(app) : new WorldSelectScene(app));
    }
    void worldProgress;
  }
}
