// Welten (aus der "Spielen"-Skizze). Jede Welt hat 10 Stufen, eigenes Farbschema,
// eigene Gegner-Namen und eigene Musik. Neue Welten einfach hier ergänzen.
import type { MusicName } from '../core/audio';

export type EnemyKind = 'flyer' | 'hopper' | 'shooter' | 'charger' | 'runner';

export interface Theme {
  bg: string;
  floorA: string; floorB: string;
  wallFace: string; wallTop: string;
  rockTop: string; rockFront: string; rockSide: string;
  accent: string;
  decal: string; // Farbe von Gegner-Flecken am Boden
}

export interface EnemyLook { name: string; color: string; accent: string }

export interface WorldDef {
  id: string;
  name: string;
  locked: boolean;
  stages: number;
  music: MusicName;
  accessory: 'antenna' | 'helmet' | 'laurel' | 'none';
  theme: Theme;
  enemies: Record<EnemyKind, EnemyLook>;
  boss: EnemyLook;
  card: { sky: string; ground: string };
}

export const WORLDS: WorldDef[] = [
  {
    id: 'aliens', name: 'Aliens', locked: false, stages: 10, music: 'aliens', accessory: 'antenna',
    theme: {
      bg: '#05070d', floorA: '#2b3440', floorB: '#27303b', wallFace: '#3a4656', wallTop: '#55657a',
      rockTop: '#6f8299', rockFront: '#4f6075', rockSide: '#435266', accent: '#5dffb0', decal: 'rgba(80,255,170,0.35)',
    },
    enemies: {
      flyer: { name: 'Drohne', color: '#9ad7ff', accent: '#5dffb0' },
      hopper: { name: 'Glibber', color: '#7cff8a', accent: '#2a9a4a' },
      shooter: { name: 'Laserauge', color: '#c88cff', accent: '#ffe066' },
      charger: { name: 'Rammbot', color: '#a0a8b8', accent: '#ff5a4a' },
      runner: { name: 'Krabbler', color: '#5ad1a0', accent: '#1a5a40' },
    },
    boss: { name: 'Mutterhirn', color: '#d08cff', accent: '#5dffb0' },
    card: { sky: '#101a3a', ground: '#2b3440' },
  },
  {
    id: 'romans', name: 'Römer', locked: false, stages: 10, music: 'romans', accessory: 'helmet',
    theme: {
      bg: '#0c0806', floorA: '#6b5338', floorB: '#634c33', wallFace: '#7d6247', wallTop: '#9a7b5a',
      rockTop: '#b39a7a', rockFront: '#8a7255', rockSide: '#77614a', accent: '#e8443a', decal: 'rgba(140,20,20,0.35)',
    },
    enemies: {
      flyer: { name: 'Adler', color: '#c9a36b', accent: '#f4e3c0' },
      hopper: { name: 'Sklavenfrosch', color: '#8fae5a', accent: '#4e6a2a' },
      shooter: { name: 'Bogenschütze', color: '#d8b48a', accent: '#b02a2a' },
      charger: { name: 'Legionär', color: '#c9b28a', accent: '#c0302a' },
      runner: { name: 'Wolf', color: '#8a8580', accent: '#4a4542' },
    },
    boss: { name: 'Gladiator', color: '#d9b080', accent: '#e8443a' },
    card: { sky: '#3a2414', ground: '#6b5338' },
  },
  {
    id: 'greece', name: 'Griechenland', locked: false, stages: 10, music: 'greece', accessory: 'laurel',
    theme: {
      bg: '#070a10', floorA: '#b8b4aa', floorB: '#aeaaa0', wallFace: '#9a978e', wallTop: '#d4d0c6',
      rockTop: '#e8e4da', rockFront: '#bdb8ad', rockSide: '#a9a59b', accent: '#4a8cff', decal: 'rgba(60,40,80,0.3)',
    },
    enemies: {
      flyer: { name: 'Harpyie', color: '#b08ad0', accent: '#f0d080' },
      hopper: { name: 'Satyr', color: '#a07850', accent: '#f0d080' },
      shooter: { name: 'Gorgonenkopf', color: '#6fae6f', accent: '#ffe066' },
      charger: { name: 'Minotaurus', color: '#8a5a3a', accent: '#e8e0d0' },
      runner: { name: 'Skelettkrieger', color: '#e8e4d8', accent: '#4a8cff' },
    },
    boss: { name: 'Zyklop', color: '#c89a6a', accent: '#4a8cff' },
    card: { sky: '#2a4a8a', ground: '#b8b4aa' },
  },
  // Platzhalter für kommende Welten
  ...[1, 2, 3].map((n) => ({
    id: `locked${n}`, name: '?????', locked: true, stages: 10, music: 'menu' as MusicName, accessory: 'none' as const,
    theme: undefined as unknown as Theme, enemies: undefined as unknown as Record<EnemyKind, EnemyLook>,
    boss: undefined as unknown as EnemyLook, card: { sky: '#1a1a22', ground: '#26262e' },
  })),
];

export const playableWorlds = () => WORLDS.filter((w) => !w.locked);
export const worldById = (id: string) => WORLDS.find((w) => w.id === id)!;
