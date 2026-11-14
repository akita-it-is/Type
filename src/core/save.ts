// Spielstand (Profil) – wird im Gerät gespeichert (localStorage).
// Später leicht austauschbar gegen Cloud-Speicher / Capacitor Preferences.

export interface Settings {
  music: number;      // 0..1
  sfx: number;        // 0..1
  aimMode: 'free' | '4dir';
  vibration: boolean;
  screenShake: boolean;
}

export interface WorldProgress {
  prestige: number; // 0..10 – wie oft die Welt komplett geschafft wurde
  round: number;    // nächste Runde, die gespielt wird (1..20)
  clears: number;   // wie oft Runde 20 besiegt wurde (insgesamt)
}

export interface Loadout {
  weapon: string | null;
  armor: { head: string | null; chest: string | null; legs: string | null };
  active: string | null;
  consumables: (string | null)[]; // 5
  passives: string[];             // max 10
  backpack: (string | null)[];    // 5
}

export interface Profile {
  version: 2;
  name: string;
  coins: number;
  ownedChars: string[];
  ownedSkins: string[];
  char: string;
  skin: string;
  stash: Record<string, number>;         // Lager: Item-ID -> Anzahl
  discovered: string[];                  // jemals gefundene Items
  worlds: Record<string, WorldProgress>;
  stats: { kills: number; bosses: number; extractions: number; deaths: number; runs: number };
  arcadeBest: number;
  lastLoadout: Loadout | null;
  pendingLoadout: Loadout | null; // Ausrüstung eines laufenden Runs (Absicherung bei App-Abbruch)
  settings: Settings;
}

const KEY = 'dc_profile_v2';

export const emptyLoadout = (): Loadout => ({
  weapon: null, armor: { head: null, chest: null, legs: null }, active: null,
  consumables: [null, null, null, null, null], passives: [], backpack: [null, null, null, null, null],
});

export function defaultProfile(): Profile {
  return {
    version: 2,
    name: 'Spieler',
    coins: 0,
    ownedChars: ['wanderer'],
    ownedSkins: ['standard'],
    char: 'wanderer',
    skin: 'standard',
    // Startausrüstung, damit das Ausrüstungsmenü nicht leer ist
    stash: { wand: 1, rustysword: 1, leather_head: 1, leather_chest: 1, potion: 3, bombitem: 2, crystalring: 1 },
    discovered: ['wand', 'rustysword', 'leather_head', 'leather_chest', 'potion', 'bombitem', 'crystalring'],
    worlds: {},
    stats: { kills: 0, bosses: 0, extractions: 0, deaths: 0, runs: 0 },
    arcadeBest: 0,
    lastLoadout: null,
    pendingLoadout: null,
    settings: { music: 0.6, sfx: 0.8, aimMode: 'free', vibration: true, screenShake: true },
  };
}

export function loadProfile(): Profile {
  const def = defaultProfile();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw);
    if (p.version !== 2) return def;
    const prof: Profile = { ...def, ...p, settings: { ...def.settings, ...(p.settings || {}) }, stats: { ...def.stats, ...(p.stats || {}) } };
    // Run wurde abgebrochen (App geschlossen) -> zählt wie Tod, Ausrüstung zurück ins Lager
    if (prof.pendingLoadout) {
      for (const id of loadoutIds(prof.pendingLoadout)) addToStash(prof, id);
      prof.pendingLoadout = null;
      saveProfile(prof);
    }
    return prof;
  } catch {
    return def;
  }
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignorieren */ }
}

export function worldProgress(p: Profile, id: string): WorldProgress {
  if (!p.worlds[id]) p.worlds[id] = { prestige: 0, round: 1, clears: 0 };
  return p.worlds[id];
}

export function loadoutIds(l: Loadout): string[] {
  return [l.weapon, l.armor.head, l.armor.chest, l.armor.legs, l.active, ...l.consumables, ...l.passives, ...l.backpack].filter(Boolean) as string[];
}

export function addToStash(p: Profile, id: string, n = 1) {
  p.stash[id] = (p.stash[id] || 0) + n;
  if (!p.discovered.includes(id)) p.discovered.push(id);
}

export function takeFromStash(p: Profile, id: string): boolean {
  if (!p.stash[id]) return false;
  p.stash[id]--;
  if (p.stash[id] <= 0) delete p.stash[id];
  return true;
}

export function vibrate(p: Profile, ms: number | number[]) {
  if (!p.settings.vibration) return;
  try { navigator.vibrate?.(ms); } catch { /* nicht unterstützt */ }
}
