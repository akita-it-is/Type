# Dungeon Crawler (Arbeitstitel)

Roguelike-Dungeon-Crawler fürs Handy im Querformat mit 2.5D-Perspektive.
Gebaut mit **TypeScript + Vite** und HTML5-Canvas, ohne Game-Engine.
Später lässt sich das Spiel per Capacitor als Android-/iOS-App verpacken
und per Electron/Tauri für den PC.

## Spielen / Entwickeln

```bash
npm install
npm run dev          # Entwicklungsserver (auch im WLAN erreichbar, z.B. vom Handy)
npm run build        # Produktions-Build nach dist/
npm run build:single # alles in EINER Datei: dist-single/index.html
npm run typecheck
```

**Steuerung**
- **Handy:** links = Bewegen, rechts = Schießen (Stick). Knöpfe: Item (aktiv), Verbrauch, Bombe. 🎒 oben links = Pause/Inventar.
- **Tastatur:** WASD = Bewegen, Pfeiltasten = Schießen, Leertaste = Bombe, Q = Item, E = Verbrauch, Esc = Pause.
- **Gamepad:** linker/rechter Stick, A = Bombe, LB/X = Item, RB/Y = Verbrauch, Start = Pause.

## Projektstruktur

```
src/
  main.ts            Einstieg, Hauptschleife, Querformat-Hinweis
  core/              Technik ohne Spielinhalt
    config.ts        Balancing, Kamera, Layout der Touch-Steuerung
    camera.ts        Perspektiv-Projektion (2.5D)
    input.ts         Touch/Maus, Tastatur, Gamepad
    audio.ts         Prozedurale Musik & Soundeffekte (provisorisch)
    save.ts          Profil/Spielstand (Münzen, Freischaltungen, Einstellungen)
  data/              Spielinhalte als Daten, einfach erweiterbar
    worlds.ts        Welten (Aliens, Römer, Griechenland, ...) mit Farben, Gegnern, Boss
    characters.ts    Spielbare Charaktere (Shop)
    skins.ts         Skins (Shop)
    items.ts         Passive Items, aktive Items, Verbrauchsgegenstände
    rooms.ts         Raum-Layouts
  game/              Spiel-Logik und Darstellung eines Durchlaufs
    game.ts          Regeln: Räume, Kollision, Schaden, Belohnungen
    dungeon.ts       Ebenen-Generator
    entities.ts      Spieler, Schüsse, Bomben, Pickups, Partikel
    enemies.ts       Gegner-Verhalten + Boss
    render.ts        Raum zeichnen (Boden, Wände, Türen, Tiefensortierung)
    draw.ts          Zeichen-Hilfen + Spielfigur (provisorische Grafik)
    hud.ts           Herzen, Boss-Balken, Minikarte
    controls.ts      Touch-Steuerung (Sticks + Knöpfe)
  ui/                Menüs (Canvas-UI)
    menu.ts, worldselect.ts, inventory.ts, shop.ts, settings.ts, play.ts
```

## Was es schon gibt (v0.1)
- Hauptmenü, Spielen (Weltenauswahl mit 10 Stufen je Welt), Inventar, Shop, Einstellungen, Arcade (endlos, Rekord)
- 3 Welten mit eigenem Look, eigenen Gegnernamen, eigenem Boss und eigener Musik
- 5 Gegnertypen + Boss mit mehreren Angriffsmustern
- Zufällige Ebenen: Start-, Kampf-, Item- und Bossraum, Türen, Minikarte, Falltür
- 17 Items (passiv / aktiv / Verbrauch), Bomben, Herzen, Münzen
- 5 Charaktere und 6 Skins, mit Münzen kaufbar; Spielstand wird gespeichert

## Provisorisch (wird ersetzt)
- Grafik: aus Formen gezeichnet, Item-Icons sind Emojis → später Sprites/Modelle
- Musik/Sounds: per Code erzeugt → später echte Audiodateien
- Spielname „Dungeon Crawler“

## Nächste Schritte (Vorschläge)
- Eigene Grafiken (Sprites) und Musik
- Mehr Raum-Layouts, Gegner und Bosse pro Welt, Shop-/Geheimräume im Dungeon
- Capacitor-Projekt für Android (Play Store) / iOS (App Store)
- Cloud-Spielstand, Erfolge, In-App-Käufe
