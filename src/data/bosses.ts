// 20 provisorische (Mini-)Bosse mit unterschiedlichen Fähigkeiten.
// Sie werden in allen Welten wiederverwendet (Farben/Accessoire der Welt).
// Mit steigendem Prestige werden sie stärker und bekommen zusätzliche Fähigkeiten.

export type SkillId =
  | 'burst' | 'spray' | 'spiral' | 'jump' | 'summon' | 'necro' | 'dashSide' | 'charge' | 'laser' | 'teleport'
  | 'bounce' | 'homing' | 'mines' | 'rain' | 'orbit' | 'clone' | 'puddle' | 'vacuum' | 'shieldMinions' | 'wave';

export const SKILL_NAMES: Record<SkillId, string> = {
  burst: 'Kugelring', spray: 'Fächerschuss', spiral: 'Spirale', jump: 'Sprungangriff', summon: 'Beschwörung',
  necro: 'Totenerweckung', dashSide: 'Wand-zu-Wand-Sprint', charge: 'Ansturm', laser: 'Laserstrahl', teleport: 'Teleport',
  bounce: 'Abpraller', homing: 'Suchkugeln', mines: 'Minen', rain: 'Meteorregen', orbit: 'Kugelschild',
  clone: 'Doppelgänger', puddle: 'Giftspur', vacuum: 'Sog', shieldMinions: 'Schutzschild', wave: 'Kugelwand',
};

export type BossShape = 'blob' | 'eye' | 'brute' | 'spider' | 'ghost' | 'skull' | 'worm' | 'crystal';

export interface BossDef {
  id: string;
  name: string;
  shape: BossShape;
  color: string;
  hp: number;
  speed: number;
  size: number;
  move: 'chase' | 'wander' | 'hover' | 'still';
  skills: SkillId[];
  split?: boolean; // teilt sich beim Tod
}

export const BOSSES: BossDef[] = [
  { id: 'slimeking', name: 'Schleimkönig', shape: 'blob', color: '#6ad06a', hp: 90, speed: 1.2, size: 0.85, move: 'chase', skills: ['burst', 'jump'] },
  { id: 'broodmother', name: 'Brutmutter', shape: 'blob', color: '#c07ad0', hp: 95, speed: 0.9, size: 0.9, move: 'wander', skills: ['summon', 'spray'] },
  { id: 'necromancer', name: 'Nekromant', shape: 'ghost', color: '#7a6ab0', hp: 85, speed: 1.0, size: 0.7, move: 'hover', skills: ['necro', 'homing', 'teleport'] },
  { id: 'berserker', name: 'Wüterich', shape: 'brute', color: '#c05a3a', hp: 110, speed: 1.3, size: 0.8, move: 'chase', skills: ['dashSide', 'charge'] },
  { id: 'whirler', name: 'Wirbler', shape: 'crystal', color: '#4ad0d0', hp: 90, speed: 0, size: 0.75, move: 'still', skills: ['spiral', 'wave'] },
  { id: 'watcher', name: 'Späher', shape: 'eye', color: '#e0e0f0', hp: 80, speed: 1.0, size: 0.7, move: 'hover', skills: ['laser', 'spray'] },
  { id: 'spidermom', name: 'Spinnenmutter', shape: 'spider', color: '#5a4a4a', hp: 100, speed: 1.4, size: 0.8, move: 'wander', skills: ['summon', 'puddle', 'bounce'] },
  { id: 'phantom', name: 'Phantom', shape: 'ghost', color: '#c0d8ff', hp: 80, speed: 1.2, size: 0.7, move: 'hover', skills: ['teleport', 'clone', 'burst'] },
  { id: 'bombardier', name: 'Bombardier', shape: 'brute', color: '#8a8a5a', hp: 105, speed: 0.9, size: 0.85, move: 'wander', skills: ['mines', 'rain'] },
  { id: 'stormeye', name: 'Sturmauge', shape: 'eye', color: '#6a8aff', hp: 90, speed: 0.8, size: 0.8, move: 'hover', skills: ['vacuum', 'spiral'] },
  { id: 'twinslime', name: 'Zwillingsschleim', shape: 'blob', color: '#e0c040', hp: 70, speed: 1.4, size: 0.85, move: 'chase', skills: ['jump', 'burst'], split: true },
  { id: 'boneworm', name: 'Knochenwurm', shape: 'worm', color: '#e8dcc0', hp: 110, speed: 1.6, size: 0.7, move: 'chase', skills: ['puddle', 'charge', 'wave'] },
  { id: 'guardian', name: 'Hüter', shape: 'crystal', color: '#a0f0a0', hp: 95, speed: 0, size: 0.8, move: 'still', skills: ['shieldMinions', 'orbit', 'laser'] },
  { id: 'flashrunner', name: 'Blitzläufer', shape: 'brute', color: '#f0e050', hp: 90, speed: 1.8, size: 0.7, move: 'chase', skills: ['dashSide', 'bounce', 'spray'] },
  { id: 'souleater', name: 'Seelenfresser', shape: 'skull', color: '#d0c8b8', hp: 100, speed: 1.0, size: 0.75, move: 'hover', skills: ['homing', 'vacuum', 'necro'] },
  { id: 'golem', name: 'Kristallgolem', shape: 'crystal', color: '#b080ff', hp: 130, speed: 0.8, size: 0.95, move: 'wander', skills: ['orbit', 'jump', 'wave'] },
  { id: 'shadowblade', name: 'Schattenklinge', shape: 'ghost', color: '#3a3050', hp: 85, speed: 1.6, size: 0.7, move: 'chase', skills: ['teleport', 'dashSide', 'spray'] },
  { id: 'plaguebringer', name: 'Pestbringer', shape: 'blob', color: '#90a040', hp: 105, speed: 1.0, size: 0.9, move: 'wander', skills: ['puddle', 'rain', 'summon'] },
  { id: 'deathgaze', name: 'Todesblick', shape: 'eye', color: '#ff5050', hp: 95, speed: 0, size: 0.85, move: 'still', skills: ['laser', 'spiral', 'homing'] },
  { id: 'ancient', name: 'Der Uralte', shape: 'skull', color: '#a08a6a', hp: 120, speed: 0.9, size: 0.85, move: 'hover', skills: ['clone', 'rain', 'burst', 'shieldMinions'] },
];

/** Miniboss für Runde r (1..19) einer Welt */
export function miniBossFor(worldIndex: number, round: number): BossDef {
  return BOSSES[(round - 1 + worldIndex * 5) % BOSSES.length];
}

export const ALL_SKILLS = Object.keys(SKILL_NAMES) as SkillId[];
