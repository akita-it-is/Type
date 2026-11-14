export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const len = (x, y) => Math.hypot(x, y);

export function norm(x, y) {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : [0, 0];
}

// Deterministischer Zufallsgenerator (für reproduzierbare Ebenen per Seed)
export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return rng;
}

export const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export function safeStorage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, String(value));
  } catch (e) { /* privater Modus o.ä. */ }
  return null;
}
