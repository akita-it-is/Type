// Skins (Shop). Ändern die Farben des Charakters und seiner Schüsse.
export interface SkinDef {
  id: string;
  name: string;
  price: number;
  cloak: string | null; // null = Farbe des Charakters
  skin: string;
  tear: string;
}

export const SKINS: SkinDef[] = [
  { id: 'standard', name: 'Standard', price: 0, cloak: null, skin: '#f1d6c4', tear: '#8fd8ff' },
  { id: 'rubin', name: 'Rubin', price: 100, cloak: '#c0283a', skin: '#f1d6c4', tear: '#ff7a8a' },
  { id: 'smaragd', name: 'Smaragd', price: 150, cloak: '#2a9a5a', skin: '#f1d6c4', tear: '#7affb0' },
  { id: 'nacht', name: 'Nacht', price: 250, cloak: '#1a1a2a', skin: '#c8c0d8', tear: '#b08aff' },
  { id: 'gold', name: 'Gold', price: 400, cloak: '#e0b030', skin: '#ffe8c8', tear: '#ffe066' },
  { id: 'neon', name: 'Neon', price: 500, cloak: '#ff40c0', skin: '#e0f8ff', tear: '#40fff0' },
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id) || SKINS[0];
