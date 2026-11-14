# Eigene Grafiken einbauen

Das Spiel zeichnet alles erst mal mit Platzhalter-Formen. Sobald ein Bild unter
`public/assets/` liegt **und** in `public/assets/manifest.json` eingetragen ist,
wird es automatisch statt des Platzhalters benutzt. Du kannst also Stück für Stück
ersetzen: erst den Spieler, dann die Gegner einer Welt, dann den Boden …

## Stil-Vorgaben (damit alles zusammenpasst)

**Standard: 64 px pro Kachel** (detaillierter Stil). Wichtig ist, dass ALLE Bilder
dieselbe Pixeldichte haben – also alles in diesem Raster:

| Was | Größe pro Bild/Frame | Hinweise |
|---|---|---|
| Kachel (Boden) | **64 × 64 px** | 1 Kachel = 1 Spielfeld. Mehrere Varianten |
| Spielfigur | **64 × 64** | Figur ca. 50–58 px hoch, Füße am unteren Rand. 4 Richtungen × 4–6 Lauf-Frames |
| Normale Gegner | 64 × 64 | kleine Gegner dürfen das Bild nicht ganz füllen |
| Miniboss | 128 × 128 | |
| Endboss | 192 × 192 | |
| Felsen / Hindernis | 64 × 64 (oder 64 × 80) | |
| Item-Icon | **64 × 64** | wird im Spiel kleiner angezeigt, Details trotzdem sichtbar |
| Schuss | 16 × 16 bis 32 × 32 | `shot_player`, `shot_enemy` |
| Welten-Karte | z. B. 1280 × 720 | darf auch „gemalt“ statt Pixel sein |
| Menü-Hintergrund | z. B. 1920 × 1080 | |

- **Perspektive:** „Top-Down, leicht schräg (3/4-Ansicht)“, wie in typischen Pixel-Art-RPGs. Figuren schauen in Richtung Kamera.
- **Hintergrund transparent** (PNG). Keine Schatten unter die Figuren malen, die erzeugt das Spiel.
- **Füße unten:** die Figur steht am unteren Bildrand (sonst `anchorY` anpassen).
- **Gleiche Pixelgröße, gleiche Palette, gleiche Lichtrichtung** (Licht von oben links), dunkle Outline – dann wirkt alles wie aus einem Guss.

## manifest.json

```json
{
  "pixelArt": true,
  "sprites": {
    "char_wanderer": { "file": "chars/wanderer.png", "frames": 4, "dirs": 4, "fps": 8, "height": 1.0 },
    "enemy_aliens_flyer": { "file": "enemies/aliens_flyer.png", "frames": 2, "fps": 10, "height": 0.7, "animIdle": true, "anchorY": 0.6 },
    "boss_slimeking": { "file": "bosses/slimeking.png", "frames": 4, "height": 1.6, "animIdle": true },
    "floor_aliens": { "file": "tiles/aliens_floor.png", "frames": 4 },
    "rock_aliens": { "file": "tiles/aliens_rock.png" },
    "item_wand": { "file": "items/wand.png" }
  }
}
```

| Feld | Bedeutung |
|---|---|
| `file` | Pfad relativ zu `public/assets/` |
| `frames` | Anzahl Bilder pro Zeile (Animation) |
| `dirs` | `4` = Zeilen unten/links/rechts/oben, `8` = S, SO, O, NO, N, NW, W, SW (PixelLab-Export), sonst 1 Zeile |
| `fps` | Animationsgeschwindigkeit |
| `height` | Anzeigehöhe in Kacheln (Spieler ≈ 1) |
| `anchorY` | wo die Füße sind (0 = oben, 1 = unten, Standard 0.95) |
| `flip` | bei 1 Zeile: spiegeln, wenn die Figur nach links schaut |
| `animIdle` | auch im Stand animieren (Flügel, Atmen) |
| `bob` | beim Laufen leicht wippen (für Figuren ohne Laufanimation) |

## Alle Namen (Schlüssel)

- **Spieler:** `char_<id>` oder für einen Skin `char_<id>_<skin>`
  - Charaktere: `wanderer`, `funke`, `koloss`, `seher`, `koenig`
  - Skins: `standard`, `rubin`, `smaragd`, `nacht`, `gold`, `neon`
- **Gegner:** `enemy_<welt>_<art>` (oder `enemy_<art>` für alle Welten)
  - Welten: `aliens`, `romans`, `greece`
  - Arten: `flyer`, `hopper`, `shooter`, `charger`, `runner`
- **Bosse:** `boss_<id>`: `slimeking broodmother necromancer berserker whirler watcher spidermom phantom bombardier stormeye twinslime boneworm guardian flashrunner souleater golem shadowblade plaguebringer deathgaze ancient`
- **Endbosse:** `boss_motherbrain`, `boss_emperor`, `boss_cyclops`
- **Boden / Felsen:** `floor_<welt>` / `rock_<welt>` (oder `floor` / `rock` für alle)
- **Waffen in der Hand:** `weapon_<item-id>` – Waffe zeigt **waagerecht nach rechts**, Griff links-mittig, 64 × 64. `height` = Länge in Kacheln (Standard 0.75). Das Icon fürs Inventar ist `item_<item-id>` (kann dasselbe Bild sein).
- **Set-Effekte:** `setfx_<set>` – erscheint nur bei vollem Set (3/3). Gleiches Raster wie die Spielfigur (64 × 64, gerne 8 Richtungen), z. B. Heiligenschein, Flügel, Aura. `"layer": "back"` = hinter der Figur, sonst davor; `"particles": true` behält zusätzlich die Platzhalter-Partikel.
- **Sonstiges:** `coin`, `heart`, `halfheart`, `shot_player`, `shot_enemy`, `card_<welt>`, `menu_bg`
- **Items:** `item_<id>`
  - Waffen: `wand rustysword scatter boomerang twinwand crossbow runeblade dragonbreath starlaser`
  - Rüstung: `<set>_head|chest|legs` mit Sets `leather iron shadow dragon celestial`
  - Passiv: `shard boots scope magnet quick stoneheart bigtears clover thornmail trident ghost eye critlens vampire regenring twinsoul phoenix`
  - Aktiv: `crystalring healhand thunder phase bombrain timesand starfall`
  - Verbrauch: `potion bombitem rage shieldscroll hourglass elixir`

## Mit KI erstellen – empfohlener Ablauf

1. **Stil festlegen:** ein Referenzbild (z. B. dein Screenshot) + feste Palette + feste Größe (32 px).
2. **Spielfigur zuerst** – sie definiert den Stil. Danach alle anderen Bilder mit der Figur als Stil-Referenz erzeugen.
3. **Mit Pixel-Art-Werkzeugen erzeugen** (siehe unten), nicht mit allgemeinen Bild-KIs – die liefern „falsche“ Pixel (unscharf, ungleich große Pixel).
4. **Aufräumen** in einem Pixel-Editor: Hintergrund entfernen, Kanten säubern, Frames auf gleiche Größe bringen, zu einem Sheet zusammensetzen.
5. **Einbauen:** PNG nach `public/assets/...`, Eintrag in `manifest.json` – oder einfach mir die Bilder schicken.

**Beispiel-Prompt (Figur):**
> pixel art, 32x32, top-down 3/4 view RPG character, small hooded wanderer with blue cloak, facing camera, dark outline, limited palette, light from top left, transparent background, no shadow

**Beispiel-Prompt (Gegner, gleiche Welt):**
> same style as reference, pixel art 32x32, top-down 3/4 view, small flying alien drone with green glowing eye, dark outline, transparent background

**Achtung Lizenz:** Für den App Store nur Tools nutzen, deren Bedingungen kommerzielle Nutzung erlauben (meist nur im bezahlten Abo). Die Bedingungen beim Erstellen sichern.
