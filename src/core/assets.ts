// Grafik-Assets (Sprites). Eigene Bilder kommen nach public/assets/ und werden in
// public/assets/manifest.json eingetragen. Fehlt ein Sprite, zeichnet das Spiel
// automatisch die provisorische Form-Grafik. Details: ASSETS.md
//
// Sprite-Sheets: Spalten = Animations-Frames, Zeilen = Richtungen (bei dirs: 4
// in der Reihenfolge unten, links, rechts, oben).

export interface SpriteDef {
  file: string;       // Pfad relativ zu assets/
  frames?: number;    // Frames pro Zeile (Standard 1)
  fps?: number;       // Animationsgeschwindigkeit (Standard 8)
  dirs?: 1 | 4 | 8;   // 1 = eine Zeile, 4 = unten/links/rechts/oben,
                      // 8 = S, SO, O, NO, N, NW, W, SW (wie der PixelLab-Export)
  height?: number;    // Anzeigehöhe in Kacheln (Standard 1)
  anchorY?: number;   // wo die Füße sind (0 = oben, 1 = unten; Standard 0.95)
  flip?: boolean;     // bei dirs 1: spiegeln, wenn die Figur nach links schaut
  animIdle?: boolean; // auch im Stand animieren (z. B. Flügelschlag)
  bob?: boolean;      // beim Laufen leicht wippen (für Figuren ohne Laufanimation)
  layer?: 'back' | 'front'; // Set-Effekte: hinter oder vor der Figur
  particles?: boolean;      // Set-Effekte: Platzhalter-Partikel zusätzlich behalten
}

interface Loaded { def: SpriteDef; img: HTMLImageElement; fw: number; fh: number; white?: HTMLCanvasElement }

export interface DrawOpts {
  t?: number; dirX?: number; dirY?: number; moving?: boolean;
  flash?: boolean; alpha?: number; scale?: number;
}

class AssetStore {
  sprites = new Map<string, Loaded>();
  pixelArt = true;
  loaded = false;

  async load(base = 'assets/') {
    try {
      const res = await fetch(base + 'manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const m = await res.json();
      this.pixelArt = m.pixelArt !== false;
      const entries = Object.entries(m.sprites || {}) as [string, SpriteDef][];
      await Promise.all(entries.map(([key, def]) => new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const frames = def.frames || 1, rows = def.dirs || 1;
          this.sprites.set(key, { def, img, fw: img.width / frames, fh: img.height / rows });
          resolve();
        };
        img.onerror = () => { console.warn('Sprite fehlt:', def.file); resolve(); };
        img.src = base + def.file;
      })));
    } catch { /* kein Manifest -> nur provisorische Grafik */ }
    this.loaded = true;
  }

  has(key: string) { return this.sprites.has(key); }

  /** ersten vorhandenen Schlüssel aus einer Liste liefern */
  pick(keys: string[]): string | null {
    for (const k of keys) if (this.sprites.has(k)) return k;
    return null;
  }

  private whiteOf(l: Loaded) {
    if (l.white) return l.white;
    const c = document.createElement('canvas');
    c.width = l.img.width; c.height = l.img.height;
    const x = c.getContext('2d')!;
    x.drawImage(l.img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    l.white = c;
    return c;
  }

  /** Figur zeichnen: (x,y) = Fußpunkt auf dem Bildschirm, s = Pixel pro Kachel */
  draw(ctx: CanvasRenderingContext2D, key: string | null, x: number, y: number, s: number, o: DrawOpts = {}): boolean {
    if (!key) return false;
    const l = this.sprites.get(key);
    if (!l) return false;
    const d = l.def;
    const frames = d.frames || 1;
    const animate = frames > 1 && (o.moving || d.animIdle);
    const frame = animate ? Math.floor((o.t || 0) * (d.fps || 8)) % frames : 0;
    let row = 0, flip = false;
    const dx = o.dirX || 0, dy = o.dirY ?? 1;
    if (d.dirs === 4) row = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
    else if (d.dirs === 8) {
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      row = (((Math.round((90 - deg) / 45) % 8) + 8) % 8);
    }
    else if (d.flip && dx < -0.1) flip = true;
    const h = (d.height || 1) * s * (o.scale || 1);
    const w = h * (l.fw / l.fh);
    let top = y - h * (d.anchorY ?? 0.95);
    let sq = 1;
    if (d.bob && o.moving) {
      const ph = (o.t || 0) * 11;
      top -= Math.abs(Math.sin(ph)) * h * 0.05;
      sq = 1 + Math.sin(ph * 2) * 0.03;
    }
    ctx.save();
    // beim Verkleinern glätten (sonst flimmern feine Pixel), beim Vergrößern scharf
    ctx.imageSmoothingEnabled = !this.pixelArt || h < l.fh;
    ctx.imageSmoothingQuality = 'high';
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    const src = o.flash ? this.whiteOf(l) : l.img;
    ctx.drawImage(src, frame * l.fw, row * l.fh, l.fw, l.fh, x - (w * sq) / 2, top + h * (1 - 1 / sq), w * sq, h / sq);
    ctx.restore();
    return true;
  }

  /** Bild zentriert in ein Quadrat zeichnen (Item-Icons) */
  icon(ctx: CanvasRenderingContext2D, key: string, cx: number, cy: number, size: number): boolean {
    const l = this.sprites.get(key);
    if (!l) return false;
    const f = Math.min(size / l.fw, size / l.fh);
    ctx.save();
    ctx.imageSmoothingEnabled = !this.pixelArt || f < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(l.img, 0, 0, l.fw, l.fh, cx - (l.fw * f) / 2, cy - (l.fh * f) / 2, l.fw * f, l.fh * f);
    ctx.restore();
    return true;
  }

  /** Kachel-Textur in ein Bildschirm-Rechteck zeichnen (Boden) */
  tile(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, variant = 0): boolean {
    const l = this.sprites.get(key);
    if (!l) return false;
    const frames = l.def.frames || 1;
    ctx.imageSmoothingEnabled = !this.pixelArt || w < l.fw;
    ctx.drawImage(l.img, (variant % frames) * l.fw, 0, l.fw, l.fh, x, y, w + 0.6, h + 0.6);
    return true;
  }
}

export const Assets = new AssetStore();

/** Item-Icon: eigenes Bild (item_<id>) oder Emoji als Ersatz */
export function drawItemIcon(ctx: CanvasRenderingContext2D, item: { id: string; icon: string }, cx: number, cy: number, size: number) {
  if (Assets.icon(ctx, 'item_' + item.id, cx, cy, size)) return;
  ctx.font = `${Math.round(size * 0.85)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(item.icon, cx, cy + 1);
}
