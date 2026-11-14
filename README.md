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
- **Handy:** links = Bewegen, rechts = Schießen (Stick). Knöpfe: Verbrauch (⟳ = wechseln), aktives Item, Charakter-Fähigkeit. 🎒 oben links = Inventar (pausiert NICHT).
- **Tastatur:** WASD = Bewegen, Pfeiltasten = Schießen, Leertaste = Fähigkeit, Q = Item, E = Verbrauch, R = Verbrauch wechseln, Tab = Inventar.
- **Gamepad:** linker/rechter Stick, A = Fähigkeit, X/LB = Item, Y/RB = Verbrauch, B = wechseln, Start = Inventar.

## Spielkonzept
- **Welten** mit je **20 Runden**. Jede Runde endet mit einem **Miniboss**, Runde 20 mit dem **Endboss**.
- Eine geschaffte Welt steigt im **Prestige** auf (max. 10): schwerere Gegner, Bosse mit mehr Leben, mehr Kugeln und zusätzlichen Fähigkeiten. Die nächste Welt wird freigeschaltet.
- Nach jedem Boss: **nächste Runde** (Falltür) oder **Welt verlassen** (Portal). Beim Verlassen kommen alle Items ins Lager und Münzen werden gutgeschrieben. Beim nächsten Mal beginnt die Welt wieder bei Runde 1 (die höchste Runde wird als Rekord gespeichert).
- **Tod:** Alle Items (auch die mitgebrachte Ausrüstung), Münzen, Fortschritt und Statistik dieses Runs sind verloren (umschaltbar: `DEATH_LOSES_LOADOUT` in `src/core/config.ts`). Ein abgebrochener Run (App geschlossen) zählt wie ein Tod.
- **Vor jedem Run:** Ausrüstungsmenü (Items aus dem Lager mitnehmen).
- **Inventar:** 1 Waffe, 3 Rüstungsteile, 1 aktives Item, 5 Verbrauch, 10 Passiv, 5 Rucksack.
- **Runden-Aufbau:** Start, Boss, Itemraum und Shop garantiert, 2–8 Kampfräume in 4 Größen, optional ein **Altar** (Item opfern → dauerhafter Bonus für den Run).
- **Münzen:** jedes Monster 1, Elite-Gegner 3–5, Bosse mehr.
- **Seltenheiten:** gewöhnlich, ungewöhnlich, selten, episch, legendär. **100 gleiche Items** lassen sich im Lager gegen ein Item der nächsten Seltenheit tauschen.
- **Item-Arten:** Waffen (ändern den Angriff: Kugeln, Schrot, Armbrust, Bumerang, Schwert, Flammen, Laser), Rüstung (Rüstungswert, Werte, Set-Boni), passive Items, aktive Items (Abklingzeit läuft nur in Räumen mit Gegnern), Verbrauchsgegenstände.
- **20 Bosse** mit verschiedenen Fähigkeiten (Kugelring, Spirale, Nekromant, Wand-zu-Wand-Sprint, Laser, Teleport, Minen, Meteorregen, Sog, Schutzschild, ...), die in allen Welten wiederverwendet werden, plus ein Endboss pro Welt.

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
    items.ts         Waffen, Rüstung + Sets, passive/aktive Items, Verbrauch, Seltenheiten
    bosses.ts        20 Bosse mit Fähigkeiten
    rooms.ts         Raum-Layouts (13x7-Vorlagen; andere Größen prozedural)
  game/              Spiel-Logik und Darstellung eines Durchlaufs
    game.ts          Regeln: Runden, Räume, Kollision, Schaden, Shop, Altar, Verlassen/Tod
    dungeon.ts       Runden-Generator (Raumtypen und -größen)
    inventory.ts     Inventar eines Runs + Werteberechnung (Rüstung, Sets, Passive)
    entities.ts      Spieler, Schüsse, Bomben, Pickups, Partikel
    enemies.ts       Gegner-Verhalten + Boss-Fähigkeiten
    render.ts        Raum zeichnen (Boden, Wände, Türen, Tiefensortierung)
    draw.ts          Zeichen-Hilfen + Spielfigur (provisorische Grafik)
    hud.ts           Herzen, Boss-Balken, Minikarte
    controls.ts      Touch-Steuerung (Sticks + Knöpfe)
  ui/                Menüs (Canvas-UI)
    menu.ts, worldselect.ts, loadout.ts (Ausrüstung vor dem Run), inventory.ts (Lager),
    shop.ts, settings.ts, play.ts (Spiel + Inventar/Altar/Ergebnis), itemui.ts
```

## Eigene Grafiken
Siehe **[ASSETS.md](ASSETS.md)**: Bilder nach `public/assets/` legen und in `manifest.json` eintragen – fehlende Bilder werden automatisch durch die Platzhalter-Grafik ersetzt.

## Provisorisch (wird ersetzt)
- Grafik: aus Formen gezeichnet, Item-Icons sind Emojis → später Sprites/Modelle
- Musik/Sounds: per Code erzeugt → später echte Audiodateien
- Spielname „Dungeon Crawler“

## Nächste Schritte (Vorschläge)
- Eigene Grafiken (Sprites) und Musik
- Mehr Raum-Layouts, Gegner und Bosse pro Welt, Shop-/Geheimräume im Dungeon
- Capacitor-Projekt für Android (Play Store) / iOS (App Store)
- Cloud-Spielstand, Erfolge, In-App-Käufe
