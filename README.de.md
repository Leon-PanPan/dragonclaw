<div align="center">

<img src="doc/assets/logo-github.png" alt="DragonClaw" width="120" />

# DragonClaw

**Möglicherweise der beste Desktop-Client für OpenClaw, der heute verfügbar ist — gebaut mit Electron, Vue 3 und Vite.**

🌐 Offizielle Website: [http://www.dragonclaw.cc](http://www.dragonclaw.cc)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Framework](https://img.shields.io/badge/framework-Vue%203-42B883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Build](https://img.shields.io/badge/build-Vite-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [العربية](README.ar.md) · [Deutsch](README.de.md)

</div>

---

## 📑 Inhaltsverzeichnis

- [🐉 Über DragonClaw](#-über-dragonclaw)
- [🔍 Funktionsdetails](#-funktionsdetails)
- [🏗️ Architektur](#%EF%B8%8F-architektur)
- [✅ Voraussetzungen](#-voraussetzungen)
- [🚀 Schnellstart](#-schnellstart)
- [🛠️ Skripte](#%EF%B8%8F-skripte)
- [📦 Build & Release](#-build--release)
- [📁 Projektstruktur](#-projektstruktur)
- [🧪 Tests](#-tests)
- [🗺️ Roadmap](#%EF%B8%8F-roadmap)
- [🤝 Beitragen](#-beitragen)
- [📄 Lizenz](#-lizenz)
- [🌟 Star History](#-star-history)
- [🙏 Danksagungen](#-danksagungen)

---

## 🐉 Über DragonClaw

**DragonClaw** ist ein gezielt entwickelter Desktop-Client für [OpenClaw](https://example.com/openclaw), der auf der offiziellen WebSocket-Protokoll-API von OpenClaw aufsetzt. Er wurde mit dem modernen Stack **Electron + Vue 3 + Arco Design** gebaut und liefert die komplette Laufzeitumgebung für OpenClaw direkt mit — **installieren und sofort loslegen**. Ist OpenClaw auf deinem Rechner bereits installiert, erkennt DragonClaw dies automatisch und verwendet es weiter — ohne Migrationsaufwand.

DragonClaw ist nicht nur eine „grafische Hülle" für das Gateway, sondern bringt eine Reihe **innovativer, produktnaher Funktionen** mit:

- 🧠 **Agenten-Verwaltung** — Agenten auflisten, anlegen, aktualisieren und löschen; Arbeitsbereichs-Dateien je Agent lesen/schreiben.
- 🧩 **Skill-Center** — empfohlene Skills durchstöbern, den gesamten Katalog durchsuchen, mit einem Klick installieren/deinstallieren.
- 💬 **Mehrere Konversationen** — viele Sitzungen parallel mit intelligenter Gruppierung, Anheften, Ungelesen-Markern und vollständigem Verlauf.
- 📁 **Sitzungsbezogene Workspaces** — das Arbeitsverzeichnis der aktuellen Sitzung direkt im Konversationsbereich festlegen; sämtliche von OpenClaw erzeugten Ergebnisse bleiben in diesem Workspace und verschmutzen keine anderen Bereiche.
- 🌳 **Teilaufgaben** — vom Hauptagenten ausgelöste Teilaufgaben und Untersitzungen in Echtzeit visualisieren.
- 📚 **Modellkonfiguration** — OpenAI, Anthropic, DeepSeek, Grok, OpenRouter, Groq, Moonshot, Alibaba, Ollama, ModelBus, benutzerdefiniert u. v. m. bereits eingebunden.
- 🏪 **Agents Store** — passende Agents online auswählen und gemeinsam mit den benötigten Skills mit einem Klick lokal installieren.
- 📋 **Dashboard** — Aufgaben-Board, um Arbeit über Agenten hinweg zu organisieren.
- 📜 **Logs** — Gateway-Logs in Echtzeit direkt in der App mitlesen.
- ⚙️ **Einheitliche Einstellungen** — Grundlagen, Gateway, Agenten, Sitzungen, Werkzeuge und Sicherheit in einer einzigen Ansicht.
- 🔄 **Update-Erkennung** — prüft beim Start automatisch DragonClaw selbst, OpenClaw, Node.js und mehr auf neue Versionen.
- 🌐 **Fernzugriff** — verbindet sich per Token oder Passwort mit einem OpenClaw-Gateway im LAN oder auf einem entfernten Server.

> 📖 Ausführliche Funktionserläuterungen (Konversationen, Workspaces, Teilaufgaben, Modellkonfiguration, Agents Store, Update-Erkennung, Fernzugriff) findest du im Abschnitt [🔍 Funktionsdetails](#-funktionsdetails) unten.

---

## 🔍 Funktionsdetails

Im Folgenden ein genauerer Blick auf DragonClaws wichtigste Funktionen und deren Einsatzszenarien.

### 💬 Konversationen (Conversation)

Das Konversationspanel ist das Herzstück von DragonClaw. Es ist kein einfaches Chat-Fenster, sondern ein **vollständiges Multi-Session-Kollaborationssystem**:

- **Parallele Sitzungen** — mehrere Konversationen gleichzeitig öffnen, jede an einen anderen Agenten oder Task gebunden. Wechsel über die Seitenleiste ohne Übersprechen.
- **Intelligente Gruppierung** — vergangene Sitzungen werden automatisch in *Heute*, *Gestern*, *Diese Woche*, *Früher* einsortiert — übersichtlich und vorhersehbar.
- **Anheften & Ungelesen** — wichtige Sitzungen können angeheftet werden; ungelesene Sitzungen zeigen einen roten Punkt, damit nichts untergeht.
- **Streaming-Ausgabe** — Modellantworten streamen in Echtzeit, mit parallel sichtbarem Reasoning-Pfad und Tool-Aufruf-Ergebnissen inline.
- **Verlauf zurückscrollen** — nach oben scrollen, um ältere Nachrichten träge nachzuladen; nichts wird abgeschnitten.
- **Nachrichten-Aktionen** — Kopieren, Zitieren, Löschen und „Komprimieren" von Sitzungen sind lokal verfügbar.
- **Denkstufe** — über die obere Leiste Reasoning-Intensität (hoch / mittel / niedrig) wählen, um Latenz und Qualität flexibel abzuwägen.
- **Teilaufgaben-Visualisierung** — vom Hauptagenten ausgelöste Teilaufgaben und Unteragenten erscheinen als kompakte Karten innerhalb der zugehörigen Nachrichtengruppe, mit zuständigem Agenten und Live-Status auf einen Blick.

#### 📁 Sitzungsbezogene Workspaces (Session-level Workspace)

> **Workspaces in DragonClaw sind sitzungsbezogen und verschmutzen keine anderen Bereiche.** Du kannst direkt im Konversationsbereich ein Arbeitsverzeichnis an die aktuelle Sitzung binden — jede Sitzung hat ihren eigenen Workspace, und sämtliche Dateien, die OpenClaw innerhalb dieser Sitzung liest, schreibt oder erzeugt, bleiben in diesem Workspace und gelangen weder in andere Verzeichnisse noch in globale Bereiche.

Ein Workspace wird an die **aktuelle Sitzung** gebunden, nicht global an den Agenten — zwei Sitzungen mit demselben Agenten können völlig unterschiedliche Ordner verwenden.

- **Aus dem Konversationsbereich setzen** — im Eingabebereich auf die Workspace-Schaltfläche klicken, einen Ordner wählen, und er ist sofort an die aktive Sitzung gebunden.
- **Sitzungsweiter Geltungsbereich** — der Pfad wird am Sitzungsschlüssel (`projectSpace`) gespeichert; beim Wechsel zeigt jede Sitzung ihr eigenes Arbeitsverzeichnis — kein global geteilter Ordner.
- **Kontext folgt mit** — alle Lese-/Schreiboperationen auf Dateien und alle Shell-Befehle in dieser Sitzung nutzen den Workspace als Wurzel, der Agent muss nicht ständig fragen „wohin soll ich speichern?".
- **Öffnen / neu binden** — der aktuelle Workspace ist stets im Eingabebereich sichtbar; Klick öffnet ihn im System-Dateimanager, jederzeit neu zuweisbar.
- **Leere-Zustand-Warnung** — ist kein Workspace gesetzt, hebt der Eingabebereich dies hervor, um Fehlbedienung zu vermeiden.

![Konversationsansicht](doc/assets/Session.png)

#### 🌳 Teilaufgaben (Sub-tasks)

Wenn der Hauptagent Teilaufgaben oder Unteragenten erzeugt, verfolgt DragonClaw sie automatisch und stellt sie auf zwei komplementäre Arten dar:

- **Inline-Ansicht in der Nachricht** — Teilaufgaben-Karten erscheinen direkt unter der auslösenden Nachricht, mit ausführendem Agenten, Aufgabentitel und Live-Status.
- **Zusammenfassung im rechten Panel** — das rechte Panel zeigt alle Teilaufgaben der aktuellen Sitzung samt Abschlussstatus auf einen Blick.
- **Echtzeit-Synchronisation** — Statusübergänge (pending → done) aktualisieren sich live, sobald das Gateway Events pusht.

---

### 🧠 Modellkonfiguration (Model Configuration)

Modellkonfiguration ist ein weiterer Bereich, in dem DragonClaw glänzt. Wo Vanilla-OpenClaw dich zwingt, `config.json` manuell zu editieren, liefert DragonClaw ein **vollständig grafisches Modell-Management** und **bündelt alle gängigen Modellanbieter bereits eingebaut**:

- **Gängige Anbieter eingebaut** — OpenAI, Anthropic, DeepSeek, Grok, OpenRouter, Groq, Moonshot, Alibaba, Ollama, ModelBus sowie ein vollständig anpassbarer „Custom Provider" — alles vorkonfiguriert, kein manuelles Verdrahten nötig.
- **Einheitliche Multi-Provider-Verwaltung** — Dutzende Anbieter auf einem Bildschirm, das Hauptmodell jeder Sitzung in Sekunden umschaltbar.
- **Provider-Gruppierung** — Einträge werden automatisch nach Provider gruppiert, mit Logo, Modellanzahl und Kontextlänge auf einen Blick.
- **Reichhaltige Modell-Metadaten** — aus dem `models.dev`-Katalog: Kontextfenster, unterstützte Fähigkeiten (Tools, Vision, …), Preisstufe u. v. m.
- **Visuelles CRUD** — ein Modell anlegen braucht nur wenige Felder (ID, Anzeigename, max. Tokens …) — kein JSON-Schreiben nötig.
- **Pro-Provider-Zugangsdaten isoliert** — API-Keys und Base-URLs sind pro Provider isoliert und vermischen sich nicht.
- **Lokale Modelle als Erstbürger** — Ollama ist mit `http://127.0.0.1:11434/v1` vorkonfiguriert; lokale LLMs laufen sofort.
- **Sitzungsweises Umschalten** — das Hauptmodell einer Konversation direkt in deren oberer Leiste wechseln, ohne Gateway-Neustart.

![Modellkonfiguration](doc/assets/Models.png)

---

### 🏪 Agents Store

> **Passende Agents online auswählen und gemeinsam mit den benötigten Skills mit einem Klick lokal installieren — Schluss mit dem manuellen Klonen von Vorlagen aus GitHub.**

DragonClaw liefert einen eingebauten **Agents Store**, mit dem du Agenten — zusammen mit den Skills, die sie brauchen — direkt in der Anwendung durchsuchen und installieren kannst:

- **Online-Katalog** — kuratierter Katalog offizieller und Community-Agenten direkt in der App.
- **Den passenden Agenten finden** — nach Szenario filtern (Entwicklung, Schreiben, Office, Ops, …) und genau den Agenten wählen, der zu deiner Aufgabe passt — statt dich mit dem lokal vorhandenen Modell zu begnügen.
- **Ein-Klick-Installation für Agents & Skills** — wählst du einen Zielagenten aus, wird er gemeinsam mit sämtlichen Skills installiert, von denen er abhängt — keine mühsame manuelle Auflösung von Abhängigkeiten.
- **Lokale Anpassung** — die Installation ist komplett visuell: Avatar, ID, Arbeitsverzeichnis, Persona-Beschreibung usw.
- **„Meine Agenten"-Ansicht** — ein eigener Tab listet alles, was du erstellt hast, zum Bearbeiten, Löschen oder Inspizieren.
- **Online-Updates** — veröffentlicht ein installierter Agent eine neue Version, aktualisierst du mit einem Klick.

![Agents Store](doc/assets/Agents-Store.png)

---

### 🔄 Update-Erkennung (Update Detection)

DragonClaw bündelt einen **One-Stop-Komponenten-Updater**, der **beim Start automatisch ausgeführt** wird und dir den Versionsvergleich über verschiedene Ökosysteme hinweg erspart:

- **Automatischer Check beim Start** — bei jedem Start von DragonClaw holt eine einzige Anfrage automatisch die aktuellen Versionen von DragonClaw, OpenClaw, Node.js und mehr.
- **Signierte Quelle** — geht über den `api.versionCheck`-Endpunkt in `config.json` mit dem Identifikator `sign=dragonclaw`.
- **Sichtbare Hinweise** — ist eine neue Version verfügbar, zeigen Seitenleiste und Einstellungsseite einen klaren Hinweis mit Link zum Changelog.
- **In-App-Download & Installation** — Download, Installation und Ersetzung komplett in der App, ohne das Hauptfenster zu blockieren.
- **Rollback-sicher** — fehlgeschlagene Downloads oder Signaturfehler beschädigen die bestehende Installation nicht; kein Weißer-Bildschirm-Lock.

---

### 🌐 Fernzugriff (Remote Access)

Egal, ob dein OpenClaw-Gateway auf einer anderen Maschine im LAN oder auf einem entfernten Server, einem internen Gerät oder einem Heim-NAS läuft — DragonClaw verbindet sich sicher und flexibel per **Token** oder **Passwort**:

- **Ein-Klick-Wechsel** — „Remote Mode" im Menü wählen oder in der Seitenleiste umschalten; in Sekunden mit dem Ziel-Gateway verbunden.
- **Flexible Authentifizierung** — sowohl Token-basierte als auch Passwort-basierte Authentifizierung werden unterstützt, passend zu unterschiedlichen Gateway-Sicherheitsrichtlinien.
- **Live-Statusanzeige** — die Seitenleiste zeigt *Connecting / Connected / Disconnected* in Echtzeit, mit manueller Wiederverbindungsschaltfläche.
- **Identische lokale & entfernte UX** — nach der Verbindung verhält sich jede Funktion (Agenten, Sitzungen, Skills, Einstellungen, Logs …) genau wie im lokalen Modus.
- **Verbindungstest** — vor dem Wechsel kannst du die Erreichbarkeit des Ziels prüfen, um bei Fehlkonfiguration keine Zeit zu verlieren.
- **Persistente Konfiguration** — Remote-Adresse, Port und Token werden verschlüsselt lokal gespeichert und beim nächsten Start automatisch wiederhergestellt.

> 💡 Hat dein entferntes Gerät keine öffentliche IP, kombiniere DragonClaw mit Tailscale, ZeroTier, frp oder einer anderen Tunneling-/NAT-Traversal-Lösung.

---

### 📋 Dashboard

Wenn eine Aufgabe auf mehrere parallel arbeitende Agenten aufgeteilt werden muss, breitet DragonClaws **Dashboard** alle Aufgaben auf einem einzigen Board aus:

- **Mehrspaltiger Fluss** — eine Spalte pro Agent; Aufgaben wandern innerhalb ihrer Spalte voran, und die Zusammenarbeit zwischen Agenten ist sofort sichtbar.
- **Echtzeit-Aktualisierung** — vom Hauptagenten ausgelöste Teilaufgaben und Unteragenten werden sofort auf den entsprechenden Karten zurückgeschrieben.
- **Status-Visualisierung** — Leerlauf, läuft, Fehler und fertig werden mit unterschiedlichen Markierungen dargestellt, sodass Engpässe sofort auffallen.
- **Ein-Klick-Aktualisierung** — die Schaltfläche **Aktualisieren** in der Kopfzeile zieht den aktuellen Status jederzeit aktiv nach, ohne auf Push-Events zu warten.

![Dashboard](doc/assets/Board.png)

---

### 🧩 Skill-Verwaltung (Skill Management)

Das Skill-Ökosystem von OpenClaw ist riesig — DragonClaw verpackt es in ein **vollständig grafisches Skill-Center**, sodass du nie wieder Konfigurationen von Hand anfasst:

- **Tabs „Empfohlen / Alle / Verwaltet"** — wechsle oben zwischen ihnen; Einsteiger starten bei den Empfehlungen, Profis suchen im vollständigen Katalog.
- **Stichwortsuche** — das Suchfeld filtert über Namen und mehrsprachige Tags hinweg.
- **Ein-Klick-Installation / Deinstallation** — jede Skill-Karte hat eine Schaltfläche **Installieren / Deinstallieren**; Rollback und Neuinstallation sind ebenso leichtgewichtig.
- **Autor- und Update-Metadaten** — die Liste zeigt Autor, Installationszahl und letztes Update, sodass du die Wartungsaktivität auf einen Blick einschätzen kannst.
- **Lokale Cache-Synchronisierung** — installierte Skills werden lokal gecached; beim nächsten Start ist kein erneutes Herunterladen nötig.

![Skill-Verwaltung](doc/assets/Skills.png)

---

### 🖥️ Computer-Assistent (Computer Assistant)

Über die Zusammenarbeit mit dem OpenClaw-Gateway hinaus bringt DragonClaw ein Modul **Computer-Assistent** mit, das KI-Fähigkeiten auf deinen lokalen Rechner bringt:

- **Festplattenbereinigung** — scannt intelligent große Dateien, Caches und entrümpelbare Elemente und schätzt, wie viel Speicherplatz freigegeben werden kann.
- **Computer aufräumen** — die KI erhält ein umfassendes Bild deines Rechners und hilft beim Sortieren und Aufräumen von Dateien.
- **Software-Verwaltung** — eine einheitliche Ansicht aller installierten Apps, sortierbar nach Größe, letztem Update oder Belegung; nicht mehr benötigte Apps werden mit einem Klick deinstalliert.
- **Status aktualisieren** — die Schaltfläche **Status aktualisieren** in der Kopfzeile scannt den Rechner erneut und holt den aktuellen Software- und Hardware-Stand.

![Computer-Assistent](doc/assets/Computer.png)

---

### ⚙️ Einheitliche Einstellungen (Unified Settings)

DragonClaw bündelt alle einstellbaren Parameter in einer einzigen **zentralen Einstellungsansicht**, damit Konfigurationen nicht mehr über mehrere Dateien verstreut sind:

- **Grundlagen** — Zeitzone, Zeitformat (24 / 12 Stunden), Heartbeat-Intervall, isolierte Sitzungen, Hot Reload und weiteres Grundverhalten.
- **Gateway** — Betriebsmodus (lokal / entfernt), Verbindungsadresse, Token / Passwort und weitere Gateway-Verbindungsinformationen.
- **Agenten** — Standardwerte für Agenten, Persona-Vorlagen, Standard-Workspace und mehr.
- **Sitzungen** — Strategie zur Verlaufsspeicherung, Schwellenwert für die Nachrichtenkomprimierung, Standard-Denkstufe und mehr.
- **Werkzeuge** — Schalter für Teilaufgaben, Befehlsausführung, Datei-Lese-/Schreibzugriff und mehr.
- **Sicherheit** — Remote-Authentifizierung, Token-Verwaltung, zweite Bestätigung für sensible Aktionen.
- **Speichern und neu laden** — die Schaltfläche **Speichern** unten rechts übernimmt Änderungen; **Neu laden** oben rechts verwirft die Bearbeitungen und liest die Werte erneut ein.

![Einheitliche Einstellungen](doc/assets/Settings.png)

---

## 🏗️ Architektur

DragonClaw folgt dem klassischen Electron-Multi-Prozess-Modell:

```
┌──────────────────┐   preload/IPC    ┌──────────────────┐   WebSocket RPC   ┌──────────────┐
│     Renderer     │ ◀──────────────▶ │   Main Process   │ ◀───────────────▶ │   Gateway    │
│  Vue 3 + Vite    │   (contextBridge)│   Electron       │                   │   OpenClaw   │
│  Arco Design     │                  │   Node.js APIs   │                   │              │
└──────────────────┘                  └──────────────────┘                   └──────────────┘
         ▲                                       ▲
         │                                       │
    User Interface                       Native OS APIs
                                    (file system, dialogs, etc.)
```

- **Renderer** — Vue 3 SPA, gebaut mit Vite und Arco Design Vue.
- **Main** — Electron-Hauptprozess für Fenster, IPC-Handler und native Integration.
- **Preload** — eine schlanke `contextBridge`-Schicht, die dem Renderer eine minimale, typsichere API bereitstellt.
- **Gateway** — der OpenClaw-Gateway-Prozess, erreichbar über einen WebSocket-RPC-Kanal.

---

## ✅ Voraussetzungen

Bevor du startest, stelle sicher, dass dein Rechner Folgendes mitbringt:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>= 22` | LTS recommended |
| Package manager | `pnpm >= 8`, `npm >= 9` oder `yarn >= 1.22` | alle drei werden unterstützt; `pnpm` empfohlen |
| OpenClaw Gateway | `>= 2026.04.16` (minimal unterstützte Version) | local or remote; the client connects via WebSocket |

---

## 🚀 Schnellstart

### 1. Repository klonen

```bash
git clone https://github.com/<your-org>/dragonclaw.git
cd dragonclaw
```

### 2. Abhängigkeiten installieren

```bash
# Recommended
pnpm install

# Or with npm
npm install

# Or with yarn
yarn install
```

### 3. Im Entwicklungsmodus starten

```bash
pnpm electron:dev
```

> Dieser Befehl startet den Vite-Dev-Server (`:5177`) und das Electron-Fenster gleichzeitig.

### 4. Produktions-Build erstellen

```bash
# Build für die aktuelle Plattform
pnpm dist

# Windows-Client bauen
pnpm build:win

# macOS-Client bauen
pnpm build:mac

# Linux-Client bauen
pnpm build:linux

# Clients für alle drei Plattformen gleichzeitig bauen
pnpm build:all
```

### 5. **Alle** Installer bauen, die der aktuelle Host erzeugen kann

`pnpm build:all` führt [`scripts/build-all.mjs`](scripts/build-all.mjs) aus — ein
kleines Skript, das pro Host-Betriebssystem automatisch die richtige
Zielmenge auswählt, sodass du nicht jedes Mal die Architektur-Flags
zusammenbauen musst.

| Host-OS | Erzeugte Artefakte |
| --- | --- |
| macOS | `mac-arm64.dmg` + `mac-x64.dmg` + `mac-universal.dmg` |
| Linux | `linux-x64.AppImage` + `linux-arm64.AppImage` + `linux-x64.deb` |
| Windows | `win-x64.exe` (NSIS-Installer) |

```bash
# Plan nur anzeigen, ohne tatsächlich zu bauen
pnpm build:all:dry

# Nur eine Teilmenge bauen (z. B. Universal überspringen)
pnpm build:all --skip=mac-universal

# Nur ein einzelnes Ziel bauen
pnpm build:all --only=linux-x64

# Vorhandenes renderer/dist wiederverwenden (Vite-Rebuild überspringen)
pnpm build:all:npm
```

> `electron-builder` unterstützt kein Cross-Compiling (z. B. ein `.dmg` auf
> einem Linux-CI-Runner zu erzeugen ist nicht möglich). Erzeuge die jeweiligen
> Artefakte auf dem passenden Host. Wenn du auf einer einzigen Maschine
> „best-effort" alle drei Plattformen versuchen willst, verwende den alten
> Befehl `pnpm build:all:cross`.
>
> **Mirror-Auto-Erkennung für eingeschränkte Netze.** `electron-builder`
> lädt beim Paketieren **selbst** nochmals ca. 110 MiB Electron-Binaries
> herunter (es verwendet nicht die Kopie unter `node_modules/electron/dist/`).
> In manchen Netzen (insbesondere dem chinesischen Festland) ist der
> offizielle GitHub-Releases-Host praktisch unerreichbar. Bei jedem Aufruf
> misst das Skript parallel per TCP-Handshake eine kleine Mirror-Liste
> (`npmmirror.com` und GitHub), wählt den schnellsten aus und injiziert
> `ELECTRON_BUILDER_BINARIES_MIRROR` in den `electron-builder`-Subprozess.
> Manuell festlegen:
>
> ```bash
> export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron
> pnpm build:all
> ```
>
> Mit `--no-mirror-detect` lässt sich die Erkennung komplett überspringen.

Das Build-Ergebnis wird in den Ordner `dist/` geschrieben.

---

## 🛠️ Skripte

| Command | Description |
| --- | --- |
| `pnpm start` | Launch Electron against an existing build |
| `pnpm dev` | Start the Vite dev server only |
| `pnpm build` | Build the renderer into `renderer/dist/` |
| `pnpm electron:dev` | Dev mode (Vite + Electron with HMR) |
| `pnpm dist` | Build a distributable installer for the current platform |
| `pnpm pack` | Build an unpacked directory (for local inspection) |
| `pnpm build:win` | Build a Windows installer |
| `pnpm build:mac` | Build a macOS installer |
| `pnpm build:linux` | Build a Linux installer |
| `pnpm build:all` | **Alle** Installer bauen, die der aktuelle Host erzeugen kann (aufgeschlüsselt nach Architektur) |
| `pnpm build:all:dry` | Per-Host-Buildplan anzeigen, ohne tatsächlich zu bauen |
| `pnpm build:all:npm` | Wie `build:all`, aber vorhandenes `renderer/dist` wiederverwenden |

> Es werden alle drei Paketmanager unterstützt: `pnpm`, `npm` und `yarn`. Wenn du `npm` verwendest, ersetze `pnpm` durch `npm run` (z. B. `npm run electron:dev`); wenn du `yarn` verwendest, ersetze `pnpm` durch `yarn` (z. B. `yarn electron:dev`).

---

## 📦 Build & Release

Installer werden mit [electron-builder](https://www.electron.build/) erzeugt:

| Platform | Target | Output |
| --- | --- | --- |
| Windows | NSIS | `dist/*.exe` installer |
| macOS | DMG / arm64 / x64 | `dist/*.dmg` |
| Linux | AppImage | `dist/*.AppImage` |

Anwendungsmetadaten:

- `appId`: `com.dragonclaw.app`
- `productName`: `DragonClaw`
- Mindestfenstergröße: `800 × 600`

> Das Windows-Installationsprogramm lässt dich den Installationsort wählen und legt automatisch Desktop- und Startmenü-Verknüpfungen an.

---

## 📁 Projektstruktur

```
dragonclaw/
├── src/
│   ├── main/        # Electron main process (windows, IPC, database, services)
│   ├── preload/     # Preload bridge (contextBridge)
│   ├── renderer/    # Vue 3 + Arco Design renderer
│   │   ├── api/     #   Renderer-side API wrappers
│   │   ├── views/   #   Business pages (agent / skill / session …)
│   │   ├── components/
│   │   ├── core/    #   WebSocket / IPC primitives
│   │   ├── utils/
│   │   └── stores/
│   └── shared/      # Constants shared between main and renderer (e.g. IPC channel names)
├── doc/             # Gateway protocol documentation
├── build/           # Icons and brand assets
├── config.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🧪 Tests

Ein kleines Smoke-Test-Skript ist enthalten:

```bash
./test/build.test.sh
```

Es prüft der Reihe nach:

1. Dass das Vite-Build-Artefakt existiert.
2. Dass das Shared-Modul korrekt lädt.
3. Dass IPC-Kanalnamen eindeutig sind.

---

## 🗺️ Roadmap

- [ ] Internationalisierung & mehrsprachige UI (erwartet im Juli)
- [ ] Mehrsprachige Dokumentation (erwartet im Juli)
- [ ] Agenten teilen (erwartet im Juli)
- [ ] Performance-Monitoring & Crash-Reporting (erwartet im Juli)
- [ ] Rechteverwaltung (erwartet im August)
- [ ] Eingebauter Token-Plan (erwartet im September)

---

## 🤝 Beitragen

Beiträge sind willkommen! Empfohlener Ablauf:

1. Repository forken und einen Feature-Branch anlegen (`git checkout -b feature/awesome`).
2. Änderungen committen (`git commit -m 'feat: add awesome feature'`) gemäß [Conventional Commits](https://www.conventionalcommits.org/).
3. Branch pushen (`git push origin feature/awesome`) und einen Pull Request öffnen.

Vor dem Einreichen bitte sicherstellen:

- `pnpm build` läuft durch.
- Neue IPC-Kanalnamen sind eindeutig.
- README und Screenshots sind aktuell.

---

## 📄 Lizenz

Dieses Projekt steht unter der [MIT](LICENSE)-Lizenz.

---


## 🌟 Star History

⭐ If you like this project, please give us a Star!

<a href="https://www.star-history.com/?repos=Leon-PanPan%2Fdragonclaw&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Leon-PanPan/dragonclaw&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Leon-PanPan/dragonclaw&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Leon-PanPan/dragonclaw&type=date&legend=top-left" />
 </picture>
</a>


---

## 🙏 Danksagungen

Gebaut auf den Schultern von Giganten:

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Electron](https://www.electronjs.org/)
- [Arco Design Vue](https://arco.design/vue/en-US/docs/start)
- [Pinia](https://pinia.vuejs.org/)
- [OpenClaw](https://example.com/openclaw)