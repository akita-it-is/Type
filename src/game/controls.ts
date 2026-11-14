// Touch-Steuerung: links Bewegen-Stick, rechts Schießen-Stick + Knöpfe
// (Verbrauch, Item, Charakter-Fähigkeit), oben links Inventar. Dazu Tastatur & Gamepad.
import { LAYOUT } from '../core/config';
import type { Input, Ptr } from '../core/input';
import type { Profile } from '../core/save';
import { ABILITIES } from '../data/characters';
import type { ControlState } from './entities';
import type { Game } from './game';

type BtnId = 'ability' | 'item' | 'consumable' | 'cycle' | 'menu';
const BTN_IDS: BtnId[] = ['menu', 'cycle', 'ability', 'item', 'consumable'];

interface Stick { id: number | null; bx: number; by: number; x: number; y: number }

export class TouchControls {
  move: Stick = { id: null, bx: 0, by: 0, x: 0, y: 0 };
  aim: Stick = { id: null, bx: 0, by: 0, x: 0, y: 0 };
  held: Record<BtnId, boolean> = { ability: false, item: false, consumable: false, cycle: false, menu: false };
  usingTouch = true;

  buttonPos(id: BtnId, w: number, h: number): { x: number; y: number; r: number } {
    if (id === 'menu') { const [x, y] = LAYOUT.inventoryBtn.pos(w, h); return { x, y, r: LAYOUT.inventoryBtn.r }; }
    const b = LAYOUT.buttons[id];
    const [x, y] = b.pos(w, h);
    return { x, y, r: b.r };
  }

  reset() {
    this.move.id = this.aim.id = null;
    for (const k of BTN_IDS) this.held[k] = false;
  }

  /** blocked = Inventar offen: nur der Inventar-Knopf reagiert, Sticks sind aus */
  read(input: Input, w: number, h: number, prof: Profile, blocked = false): ControlState {
    const st: ControlState = { mx: 0, my: 0, ax: 0, ay: 0, shooting: false, ability: false, item: false, consumable: false, cycle: false, menu: false };

    for (const p of input.downs) {
      this.usingTouch = true;
      const hit = BTN_IDS.find((id) => {
        if (blocked && id !== 'menu') return false;
        const b = this.buttonPos(id, w, h);
        return Math.hypot(p.x - b.x, p.y - b.y) < b.r * (id === 'cycle' ? 1.6 : 1.3);
      });
      if (hit) { p.role = 'btn:' + hit; st[hit] = true; this.held[hit] = true; continue; }
      if (blocked) continue;
      if (p.x < w / 2 && this.move.id === null) this.startStick(this.move, p, 'move');
      else if (p.x >= w / 2 && this.aim.id === null) this.startStick(this.aim, p, 'aim');
    }
    for (const p of input.ups) {
      if (p.role?.startsWith('btn:')) this.held[p.role.slice(4) as BtnId] = false;
      if (p.id === this.move.id) this.move.id = null;
      if (p.id === this.aim.id) this.aim.id = null;
    }
    if (blocked) { this.move.id = this.aim.id = null; }
    const R = LAYOUT.stickRadius;
    const upd = (s: Stick) => {
      const p = s.id !== null ? input.ptrs.get(s.id) : undefined;
      if (!p) { s.id = null; return [0, 0, 0] as const; }
      let dx = p.x - s.bx, dy = p.y - s.by;
      const d = Math.hypot(dx, dy);
      if (d > R * 1.4) { s.bx += (dx / d) * (d - R * 1.4); s.by += (dy / d) * (d - R * 1.4); dx = p.x - s.bx; dy = p.y - s.by; }
      const m = Math.min(1, Math.hypot(dx, dy) / R);
      s.x = dx; s.y = dy;
      const n = Math.hypot(dx, dy) || 1;
      return [dx / n, dy / n, m] as const;
    };
    const mv = upd(this.move);
    if (mv[2] > LAYOUT.deadzone) { st.mx = mv[0] * mv[2]; st.my = mv[1] * mv[2]; }
    const am = upd(this.aim);
    if (am[2] > LAYOUT.aimThreshold) { st.shooting = true; st.ax = am[0]; st.ay = am[1]; }

    // Tastatur
    const k = input.keys, kp = input.keysPressed;
    if (kp.has('Escape') || kp.has('Tab') || kp.has('KeyI')) st.menu = true;
    if (!blocked) {
      const kx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      const ky = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
      if (kx || ky) { const n = Math.hypot(kx, ky); st.mx = kx / n; st.my = ky / n; this.usingTouch = false; }
      const sx = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
      const sy = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
      if (sx || sy) { const n = Math.hypot(sx, sy); st.ax = sx / n; st.ay = sy / n; st.shooting = true; }
      if (kp.has('Space') || kp.has('ShiftLeft')) st.ability = true;
      if (kp.has('KeyQ')) st.item = true;
      if (kp.has('KeyE')) st.consumable = true;
      if (kp.has('KeyR')) st.cycle = true;
    }

    // Gamepad
    const gp = input.pad;
    if (gp.connected) {
      if (input.padPressed(9) || input.padPressed(8)) st.menu = true;
      if (!blocked) {
        if (Math.hypot(gp.lx, gp.ly) > 0.2) { st.mx = gp.lx; st.my = gp.ly; this.usingTouch = false; }
        if (Math.hypot(gp.rx, gp.ry) > 0.4) { const n = Math.hypot(gp.rx, gp.ry); st.ax = gp.rx / n; st.ay = gp.ry / n; st.shooting = true; }
        if (input.padPressed(0)) st.ability = true;                       // A
        if (input.padPressed(2) || input.padPressed(4)) st.item = true;   // X / LB
        if (input.padPressed(3) || input.padPressed(5)) st.consumable = true; // Y / RB
        if (input.padPressed(1)) st.cycle = true;                         // B
      }
    }

    if (st.shooting && prof.settings.aimMode === '4dir') {
      if (Math.abs(st.ax) > Math.abs(st.ay)) { st.ax = Math.sign(st.ax); st.ay = 0; }
      else { st.ay = Math.sign(st.ay); st.ax = 0; }
    }
    return st;
  }

  private startStick(s: Stick, p: Ptr, role: string) {
    s.id = p.id; s.bx = p.x; s.by = p.y; s.x = 0; s.y = 0;
    p.role = role;
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number) {
    if (!this.usingTouch) return;
    const R = LAYOUT.stickRadius;
    const [mx, my] = LAYOUT.moveStick(w, h);
    this.drawStick(ctx, this.move.id !== null ? this.move : null, mx, my, R, false);
    const [ax, ay] = LAYOUT.aimStick(w, h);
    this.drawStick(ctx, this.aim.id !== null ? this.aim : null, ax, ay, R, true);

    const p = g.player, inv = g.inv;
    // Fähigkeit
    const ab = ABILITIES[p.ability];
    this.drawButton(ctx, 'ability', w, h, ab.icon, '', p.abilityCd <= 0, 1 - p.abilityCd / ab.cooldown);
    // aktives Item (Abklingzeit läuft nur im Kampf)
    const act = inv.active;
    this.drawButton(ctx, 'item', w, h, act ? act.icon : '', act && inv.activeCd > 0 ? String(Math.ceil(inv.activeCd)) : '', !!act && inv.activeCd <= 0,
      act ? 1 - inv.activeCd / act.cooldown : 0);
    // Verbrauch (+ Wechsel-Knopf)
    const con = inv.currentConsumable();
    const count = inv.consumables.filter(Boolean).length;
    this.drawButton(ctx, 'consumable', w, h, con ? con.icon : '', count > 1 ? String(count) : '', !!con, 1, true);
    if (count > 1) this.drawButton(ctx, 'cycle', w, h, '⟳', '', true, 1);
  }

  private drawStick(ctx: CanvasRenderingContext2D, s: Stick | null, dx: number, dy: number, R: number, cross: boolean) {
    const bx = s ? s.bx : dx, by = s ? s.by : dy;
    ctx.save();
    ctx.globalAlpha = s ? 0.55 : 0.28;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (cross) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.translate(bx, by); ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.14); ctx.lineTo(R * 0.85, 0); ctx.lineTo(R * 0.55, R * 0.14); ctx.fill();
        ctx.restore();
      }
    }
    let kx = 0, ky = 0;
    if (s) { const d = Math.hypot(s.x, s.y); const m = Math.min(d, R) / (d || 1); kx = s.x * m; ky = s.y * m; }
    ctx.globalAlpha = s ? 0.85 : 0.45;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(bx + kx, by + ky, R * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawButton(ctx: CanvasRenderingContext2D, id: BtnId, w: number, h: number, icon: string, badge: string, ready: boolean, fill: number, double = false) {
    const b = this.buttonPos(id, w, h);
    ctx.save();
    ctx.globalAlpha = this.held[id] ? 0.9 : 0.65;
    ctx.fillStyle = this.held[id] ? 'rgba(255,255,255,0.3)' : 'rgba(20,16,28,0.5)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
    if (double) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 5, 0, Math.PI * 2); ctx.stroke(); }
    if (id !== 'cycle' && id !== 'consumable' && icon) {
      ctx.strokeStyle = fill >= 1 ? '#7affb0' : '#f2c230';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, fill))); ctx.stroke();
    }
    ctx.globalAlpha = ready ? 1 : 0.4;
    ctx.font = `${Math.round(b.r * 0.95)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, b.x, b.y + 2);
    if (badge) {
      ctx.globalAlpha = 1;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(b.x + b.r * 0.72, b.y + b.r * 0.72, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(badge, b.x + b.r * 0.72, b.y + b.r * 0.72 + 1);
    }
    ctx.restore();
  }
}
