// Spielstand (Profil) – wird im Gerät gespeichert (localStorage).
// Später leicht austauschbar gegen Cloud-Speicher / Capacitor Preferences.

export interface Settings {
  music: number;      // 0..1
  sfx: number;        // 0..1
  aimMode: 'free' | '4dir';
  vibration: boolean;
  screenShake: boolean;
}

export interface Profile {
  version: 1;
  name: string;
  coins: number;
  ownedChars: string[];
  ownedSkins: string[];
  char: string;
  skin: string;
  discovered: string[];             // jemals gefundene Items
  progress: Record<string, number>; // Welt-ID -> abgeschlossene Stufen
  arcadeBest: number;
  settings: Settings;
}

const KEY = 'dc_profile_v1';

export function defaultProfile(): Profile {
  return {
    version: 1,
    name: 'Spieler',
    coins: 0,
    ownedChars: ['wanderer'],
    ownedSkins: ['standard'],
    char: 'wanderer',
    skin: 'standard',
    discovered: [],
    progress: {},
    arcadeBest: 0,
    settings: { music: 0.6, sfx: 0.8, aimMode: 'free', vibration: true, screenShake: true },
  };
}

export function loadProfile(): Profile {
  const def = defaultProfile();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw);
    return { ...def, ...p, settings: { ...def.settings, ...(p.settings || {}) } };
  } catch {
    return def;
  }
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignorieren */ }
}

export function vibrate(p: Profile, ms: number | number[]) {
  if (!p.settings.vibration) return;
  try { navigator.vibrate?.(ms); } catch { /* nicht unterstützt */ }
}
