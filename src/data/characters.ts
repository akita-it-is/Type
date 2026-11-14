// Spielbare Charaktere (Inventar + Shop). Werte verändern die Grund-Stats.
import type { Stats } from '../core/config';

export interface CharacterDef {
  id: string;
  name: string;
  price: number;
  desc: string;
  mods: Partial<Stats>;
  hat: 'hood' | 'cap' | 'horns' | 'crown' | 'none';
  body: string;   // Grundfarbe Umhang (wird vom Skin überschrieben, wenn Skin != Standard)
  startActive: string | null;
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'wanderer', name: 'Wanderer', price: 0, desc: 'Ausgeglichen. Startet mit dem Kristallring.',
    mods: {}, hat: 'hood', body: '#5d7ec9', startActive: 'crystalring' },
  { id: 'funke', name: 'Funke', price: 300, desc: 'Schnell, schießt schnell, aber nur 2 Herzen.',
    mods: { maxHp: 4, speed: 5.3, fireDelay: 0.26, damage: 2.8 }, hat: 'cap', body: '#e0a030', startActive: 'phase' },
  { id: 'koloss', name: 'Koloss', price: 500, desc: '4 Herzen und harte Treffer, aber langsam.',
    mods: { maxHp: 8, speed: 3.6, damage: 5.5, fireDelay: 0.48, tearSize: 0.18 }, hat: 'horns', body: '#8a4a3a', startActive: 'thunder' },
  { id: 'seher', name: 'Seher', price: 800, desc: 'Große Reichweite und zielsuchende Schüsse.',
    mods: { range: 9, homing: true, damage: 3 }, hat: 'none', body: '#6a4ab0', startActive: 'crystalring' },
  { id: 'koenig', name: 'König', price: 1200, desc: 'Dreifachschuss von Anfang an.',
    mods: { multishot: 3, fireDelay: 0.45, damage: 3 }, hat: 'crown', body: '#b03040', startActive: 'thunder' },
];

export const charById = (id: string) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
