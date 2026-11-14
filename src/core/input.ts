// Rohe Eingabe: Touch/Maus (Pointer Events), Tastatur und Gamepad.
// Szenen lesen daraus, was sie brauchen (Taps für Menüs, Sticks im Spiel).

export interface Ptr {
  id: number;
  x: number; y: number;   // aktuelle Position (CSS-Pixel)
  sx: number; sy: number; // Startposition
  t0: number;
  role?: string;          // von der Steuerung vergeben (move/aim/btn:...)
  bx?: number; by?: number; // Stick-Basis
}

export interface PadState {
  connected: boolean;
  lx: number; ly: number; rx: number; ry: number;
  buttons: boolean[];
  pressed: boolean[]; // in diesem Frame neu gedrückt
}

export class Input {
  ptrs = new Map<number, Ptr>();
  downs: Ptr[] = [];
  ups: Ptr[] = [];
  keys = new Set<string>();
  keysPressed = new Set<string>();
  pad: PadState = { connected: false, lx: 0, ly: 0, rx: 0, ry: 0, buttons: [], pressed: [] };
  private prevPad: boolean[] = [];
  /** wird beim ersten Kontakt aufgerufen (Audio freischalten, Vollbild) */
  onFirstInteract: (() => void) | null = null;
  private interacted = false;

  constructor(private el: HTMLElement) {
    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener('pointerdown', (e) => this.pDown(e), opts);
    window.addEventListener('pointermove', (e) => this.pMove(e), opts);
    window.addEventListener('pointerup', (e) => this.pUp(e), opts);
    window.addEventListener('pointercancel', (e) => this.pUp(e), opts);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.keysPressed.add(e.code);
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.first();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.ptrs.clear(); });
  }

  private first() {
    if (!this.interacted) { this.interacted = true; this.onFirstInteract?.(); }
  }

  private pDown(e: PointerEvent) {
    e.preventDefault();
    this.first();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* egal */ }
    const p: Ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now() };
    this.ptrs.set(e.pointerId, p);
    this.downs.push(p);
  }
  private pMove(e: PointerEvent) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
  }
  private pUp(e: PointerEvent) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    this.ptrs.delete(e.pointerId);
    this.ups.push(p);
  }

  /** Kurze Berührungen, die in diesem Frame losgelassen wurden */
  taps(): { x: number; y: number }[] {
    return this.ups
      .filter((p) => Math.hypot(p.x - p.sx, p.y - p.sy) < 18 && performance.now() - p.t0 < 600)
      .map((p) => ({ x: p.x, y: p.y }));
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find((g) => g && g.connected);
    if (!gp) { this.pad.connected = false; return; }
    const dz = (v: number) => (Math.abs(v) < 0.2 ? 0 : v);
    this.pad.connected = true;
    this.pad.lx = dz(gp.axes[0] || 0); this.pad.ly = dz(gp.axes[1] || 0);
    this.pad.rx = dz(gp.axes[2] || 0); this.pad.ry = dz(gp.axes[3] || 0);
    this.pad.buttons = gp.buttons.map((b) => b.pressed);
    this.pad.pressed = this.pad.buttons.map((b, i) => b && !this.prevPad[i]);
    this.prevPad = this.pad.buttons.slice();
    if (this.pad.buttons.some((b) => b)) this.first();
  }

  padPressed(i: number) { return !!this.pad.pressed[i]; }

  endFrame() {
    this.downs.length = 0;
    this.ups.length = 0;
    this.keysPressed.clear();
  }
}
