// Spielbare Charaktere (Inventar + Shop). Jeder hat eigene Werte und eine
// Fähigkeit, die mit dem Fähigkeiten-Knopf ausgelöst wird.
import type { Stats } from '../core/config';

export type AbilityId = 'dash' | 'fly' | 'bomb' | 'timeslow' | 'shield';

export const ABILITIES: Record<AbilityId, { name: string; icon: string; cooldown: number; desc: string }> = {
  dash: { name: 'Sprint', icon: '💨', cooldown: 1.1, desc: 'Kurzer, unverwundbarer Sprint' },
  fly: { name: 'Fliegen', icon: '🪽', cooldown: 9, desc: '3 s fliegen: über Felsen, Stacheln und Gegner' },
  bomb: { name: 'Bombe', icon: '💣', cooldown: 3.5, desc: 'Legt eine Bombe' },
  timeslow: { name: 'Zeitlupe', icon: '🌀', cooldown: 14, desc: 'Verlangsamt Gegner 3 s' },
  shield: { name: 'Schild', icon: '🛡️', cooldown: 12, desc: '2 s unverwundbar' },
};

export interface CharacterDef {
  id: string;
  name: string;
  price: number;
  desc: string;
  mods: Partial<Stats>;
  hat: 'hood' | 'cap' | 'horns' | 'crown' | 'none';
  body: string;
  ability: AbilityId;
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'wanderer', name: 'Wanderer', price: 0, desc: 'Ausgeglichen. Fähigkeit: Sprint.', mods: {}, hat: 'hood', body: '#5d7ec9', ability: 'dash' },
  { id: 'funke', name: 'Funke', price: 300, desc: 'Schnell, aber nur 2 Herzen. Fähigkeit: Fliegen.',
    mods: { maxHp: 40, speed: 5.2, fireDelay: 0.28, damage: 3 }, hat: 'cap', body: '#e0a030', ability: 'fly' },
  { id: 'koloss', name: 'Koloss', price: 500, desc: '4 Herzen, harte Treffer, langsam. Fähigkeit: Bombe.',
    mods: { maxHp: 80, speed: 3.7, damage: 5, fireDelay: 0.46, tearSize: 0.17, armor: 5 }, hat: 'horns', body: '#8a4a3a', ability: 'bomb' },
  { id: 'seher', name: 'Seher', price: 800, desc: 'Große Reichweite, zielsuchend. Fähigkeit: Zeitlupe.',
    mods: { range: 9, homing: true, damage: 3 }, hat: 'none', body: '#6a4ab0', ability: 'timeslow' },
  { id: 'koenig', name: 'König', price: 1200, desc: 'Dreifachschuss, Glück. Fähigkeit: Schild.',
    mods: { multishot: 3, fireDelay: 0.45, damage: 3, luck: 2 }, hat: 'crown', body: '#b03040', ability: 'shield' },
];

export const charById = (id: string) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
