<div align="center">

<img src="doc/assets/logo-github.png" alt="DragonClaw" width="120" />

# DragonClaw

**The desktop client for OpenClaw — built with Electron, Vue 3 and Vite.**

🌐 Official site: [http://www.dragonclaw.cc](http://www.dragonclaw.cc)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Framework](https://img.shields.io/badge/framework-Vue%203-42B883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Build](https://img.shields.io/badge/build-Vite-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [العربية](README.ar.md) · [Deutsch](README.de.md)

</div>

---

## 📑 Contents

- [🐉 About DragonClaw](#-about-dragonclaw)
- [🔍 Feature Deep-Dive](#-feature-deep-dive)
- [🏗️ Architecture](#%EF%B8%8F-architecture)
- [✅ Requirements](#-requirements)
- [🚀 Quick Start](#-quick-start)
- [🛠️ Scripts](#%EF%B8%8F-scripts)
- [📦 Build & Release](#-build--release)
- [📁 Project Layout](#-project-layout)
- [🧪 Testing](#-testing)
- [🗺️ Roadmap](#%EF%B8%8F-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)

---

## 🐉 About DragonClaw

> **Possibly the best desktop client for OpenClaw, available today.**

**DragonClaw** is a purpose-built desktop client for [OpenClaw](https://example.com/openclaw), developed on top of OpenClaw's official WebSocket protocol API. It is built with a modern **Electron + Vue 3 + Arco Design** stack and ships with the complete runtime required by OpenClaw — **install once, run instantly**. If you already have OpenClaw installed locally, DragonClaw detects and reuses it automatically, with zero migration cost.

Beyond being a graphical shell for the Gateway, DragonClaw introduces a number of **innovative, product-grade capabilities**:

- 🧠 **Agents** — list, create, update and delete agents; read & write per-agent workspace files.
- 🧩 **Skills** — browse recommended skills, search the full catalog, install / uninstall with a single click.
- 💬 **Multi-conversation** — run many sessions in parallel with smart grouping, pinning, unread markers and full history.
- 📁 **Session-level Workspaces** — set the working directory for the current session directly inside the conversation panel; every artifact OpenClaw produces stays inside that workspace and never pollutes any other space.
- 🌳 **Sub-tasks** — visualize sub-tasks and sub-sessions spawned by the main agent in real time.
- 📚 **Model Configuration** — built-in support for all major providers: OpenAI, Anthropic, DeepSeek, Grok, OpenRouter, Groq, Moonshot, Alibaba, Ollama, ModelBus, custom and more.
- 🏪 **Agent Store** — browse the online catalog, pick the right Agent and install it together with the skills it depends on, in one click.
- 📋 **Dashboard** — a task board to organize work across agents.
- 📜 **Logs** — tail gateway logs directly from the app.
- ⚙️ **Unified settings** — basics, gateway, agents, sessions, tools and security in a single pane.
- 🔄 **Update detection** — automatically checks for updates to DragonClaw, OpenClaw, Node.js and more at startup.
- 🌐 **Remote access** — connect to an OpenClaw Gateway on your LAN or on a remote server, authenticated via Token or password.

> 📖 For full feature walkthroughs (Conversations, Workspaces, Sub-tasks, Model Configuration, Agent Store, Update Detection, Remote Access) see the [🔍 Feature Deep-Dive](#-feature-deep-dive) section below.

---

## 🔍 Feature Deep-Dive

Below is a closer look at DragonClaw's most distinctive capabilities and the use cases they unlock.

### 💬 Conversations (Workspaces & Sub-tasks)

The conversation panel is the heart of DragonClaw. It is not just a chat window — it is a **full multi-session collaboration system**:

- **Parallel sessions** — open multiple conversations at once, each bound to a different agent or task. Switch from the left sidebar with zero cross-talk.
- **Smart grouping** — historical sessions are automatically organized into *Today*, *Yesterday*, *This Week*, *Earlier* — clean and predictable.
- **Pin & unread** — important sessions can be pinned; unread sessions show a red dot so nothing slips through.
- **Streaming output** — model replies stream in real time, with reasoning traces and tool-call results rendered inline.
- **Historical scrollback** — scroll to the top to lazy-load older messages; nothing is ever truncated.
- **Message actions** — copy, quote, delete and "compact" sessions are all available locally.
- **Thinking level** — pick a reasoning intensity (high / medium / low) from the top bar to balance latency against quality.
- **Sub-task visualization** — sub-tasks and sub-agents triggered by the main agent appear as compact cards inside the related message group, with the responsible agent and live status at a glance.

#### 📁 Session-level Workspaces

> **Workspaces in DragonClaw are set at the conversation level and never pollute any other space.** Each session can carry its own working directory, configured directly from the conversation panel — every file OpenClaw reads, writes or produces inside that session stays inside that workspace, with no leakage into other directories or global locations.

A workspace is bound to the **current session**, not to the agent globally — so two conversations with the same agent can use completely different folders:

- **Set from the conversation panel** — click the workspace button in the input bar to pick a folder; it is attached to the active session immediately.
- **Per-session scope** — the path is stored against the session key (`projectSpace`), so switching sessions shows each conversation's own workspace, not a global one.
- **Context that follows** — every file read / write and shell command the agent runs inside that session uses the workspace as its root, so the agent never has to ask "where should I save?".
- **Open or rebind** — the current workspace is always visible in the input bar; click to open it in the system file manager, or rebind to a new directory at any time.
- **Empty-state guard** — when no workspace is set, the input bar highlights the gap to prevent mis-operations.

![Conversation view](doc/assets/Session.png)

#### 🌳 Sub-tasks

When the main agent spawns sub-tasks or sub-agents, DragonClaw tracks and presents them in two complementary views:

- **Inline message view** — sub-task cards sit directly beneath the originating message, with the executing agent, task title and live status.
- **Right-side summary** — open the right panel to see every sub-task in the current session and its completion state at once.
- **Real-time sync** — status transitions (pending → done) refresh live as the Gateway pushes events.

---

### 🧠 Model Configuration

Model Configuration is another area where DragonClaw shines. Where vanilla OpenClaw forces you to hand-edit `config.json`, DragonClaw delivers a **fully graphical model management experience** — and ships with **built-in support for all major model providers** out of the box:

- **Built-in major providers** — OpenAI, Anthropic, DeepSeek, Grok, OpenRouter, Groq, Moonshot, Alibaba, Ollama, ModelBus, plus a fully customizable "Custom" provider — all preconfigured, no manual wiring required.
- **Unified multi-Provider management** — manage dozens of vendors in one place; switch the active model for any session in seconds.
- **Provider grouping** — entries are auto-grouped by Provider with logo, model count and context length in plain view.
- **Rich model metadata** — pulled from the `models.dev` catalog: context window, supported capabilities (tools, vision, …), pricing tier and more.
- **Visual CRUD** — adding a model is a few fields (ID, display name, max tokens…) — no JSON editing required.
- **Per-Provider credentials** — API keys and base URLs are isolated per Provider so they never bleed into each other.
- **Local models first-class** — Ollama is preconfigured with `http://127.0.0.1:11434/v1`; local LLMs work out of the box.
- **Per-session switching** — change the primary model for a conversation from its top bar, no Gateway restart needed.

![Model Configuration](doc/assets/Models.png)

---

### 🏪 Agent Store (Agents Store)

> **Browse Agents online and install them together with the skills they depend on — no more hand-cloning templates from GitHub.**

DragonClaw ships with a built-in **Agent Store** that lets you browse and install agents — along with the skills they need — directly from the application:

- **Online catalog** — explore a curated catalog of official and community agents, all browsable from inside the app.
- **Find the right fit** — filter by scenario (development, writing, office, ops, …) and pick the agent that best matches your task, rather than settling for whatever happens to be installed locally.
- **One-click install for Agents & skills** — choose a target agent and it gets installed together with every skill it depends on, so you never have to chase down dependencies by hand.
- **Localized customization** — installation is fully visual: avatar, ID, working directory, persona description, etc.
- **"My agents" view** — a dedicated tab lists everything you have created, ready to edit, delete or inspect.
- **Online updates** — when an installed agent publishes a new version, upgrade with a single click.

![Agent Store](doc/assets/Agents-Store.png)

---

### 🔄 Update Detection

DragonClaw bundles a **one-stop component updater** that automatically runs **at startup**, sparing you the chore of comparing version numbers across ecosystems:

- **Automatic check at startup** — every time DragonClaw launches, it pulls the latest versions of DragonClaw, OpenClaw, Node.js and more in a single request.
- **Signed source** — goes through `config.json`'s `api.versionCheck` endpoint with the `sign=dragonclaw` identifier.
- **Visible prompts** — when a new version is available, the sidebar and settings page show a clear notice with a link to the changelog.
- **In-app download & install** — download, install and replace entirely from inside the app, without blocking the main window.
- **Rollback-safe** — failed downloads or signature mismatches never corrupt the existing installation, so you never get stuck on a blank screen.

---

### 🌐 Remote Access

Whether your OpenClaw Gateway lives on another machine on your LAN or on a remote server, internal device or home NAS, DragonClaw can connect to it securely using a **Token** or **password**:

- **One-click switch** — pick "Remote Mode" from the menu or flip it in the sidebar; you're connected to the target Gateway in seconds.
- **Flexible authentication** — both Token-based and password-based authentication are supported, matching different Gateway security policies.
- **Live status indicator** — the sidebar shows *Connecting / Connected / Disconnected* in real time, with a manual reconnect button.
- **Identical local & remote UX** — once connected, every feature (agents, sessions, skills, settings, logs…) behaves exactly as in local mode.
- **Connection test** — before switching, you can probe the target host to avoid wasting time on a misconfiguration.
- **Persistent configuration** — remote address, port and Token are stored encrypted locally and restored automatically on next launch.

> 💡 If your remote device has no public IP, pair DragonClaw with Tailscale, ZeroTier, frp or any other tunneling / NAT-traversal solution.

---

### 📋 Dashboard

When a task needs to be split across multiple agents working in parallel, DragonClaw's **Dashboard** surfaces every work item on a single task board:

- **Multi-column flow** — one column per agent, work pushes forward inside its column and cross-agent collaboration is immediately visible.
- **Real-time refresh** — sub-tasks and sub-agents spawned by the main agent are written back to the corresponding card instantly.
- **Status visualization** — idle, running, error and done are shown with distinct markers so bottlenecks stand out.
- **One-click refresh** — the **Refresh** button in the header pulls the latest state on demand without waiting for a push.

![Dashboard](doc/assets/Board.png)

---

### 🧩 Skill Management

OpenClaw's skill ecosystem is huge — DragonClaw wraps it in a **fully graphical Skill Center** so you never have to hand-edit configurations:

- **Recommended / All / Managed tabs** — start from the curated recommendations or browse the full catalog when you know what you want.
- **Keyword search** — the search box filters across names and multilingual tags.
- **One-click install / uninstall** — every skill card has an **Install / Uninstall** button; rollback and reinstall are equally lightweight.
- **Author & last-updated metadata** — the list shows the author, install count and last update so you can judge maintenance activity at a glance.
- **Local cache sync** — installed skills are cached locally so the next launch doesn't redownload anything.

![Skill Management](doc/assets/Skills.png)

---

### 🖥️ Computer Assistant

Beyond collaborating with the OpenClaw Gateway, DragonClaw also ships a **Computer Assistant** module that brings AI capability to your local machine:

- **Disk cleanup** — intelligently scans for large files, caches and reclaimable items, and estimates how much space you can free up.
- **Computer tidy-up** — lets AI get a complete picture of your machine to help with file categorization and cleanup.
- **Software management** — a unified view of every installed app, sortable by size, last update or usage, with one-click uninstall for apps you no longer need.
- **Status refresh** — the **Refresh status** button in the header re-scans the machine to pick up the latest software and hardware state.

![Computer Assistant](doc/assets/Computer.png)

---

### ⚙️ Unified Settings

DragonClaw funnels every tunable into a single **Unified Settings** panel — no more scattered config files:

- **Basics** — timezone, time format (24 / 12 hour), heartbeat interval, isolated sessions, hot reload and other base behaviors.
- **Gateway** — run mode (local / remote), connection address, Token / password and other Gateway connection info.
- **Agents** — agent defaults, persona templates, default workspace and more.
- **Sessions** — history retention, message compaction threshold, default thinking level and more.
- **Tools** — capability switches for sub-tasks, command execution, file read / write, etc.
- **Security** — remote authentication, Token management, second-factor confirmations for sensitive actions.
- **Save & reload** — the **Save** button at the bottom-right applies changes; **Reload** at the top-right discards edits and re-reads the values.

![Unified Settings](doc/assets/Settings.png)

---

## 🏗️ Architecture

DragonClaw follows the standard Electron multi-process model:

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

- **Renderer** — Vue 3 SPA built with Vite and Arco Design Vue.
- **Main** — Electron main process handling windows, IPC handlers, and native integration.
- **Preload** — a thin `contextBridge` layer that exposes a minimal, typed API to the renderer.
- **Gateway** — the OpenClaw Gateway process, reached over a WebSocket RPC channel.

---

## ✅ Requirements

Before you start, make sure your machine has the following:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>= 22` | LTS recommended |
| Package manager | `pnpm >= 8`, `npm >= 9` or `yarn >= 1.22` | All three are supported; `pnpm` is recommended |
| OpenClaw Gateway | `>= 2026.04.16` (minimum supported) | local or remote; the client connects via WebSocket |

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/dragonclaw.git
cd dragonclaw
```

### 2. Install dependencies

```bash
# Recommended
pnpm install

# Or with npm
npm install

# Or with yarn
yarn install
```

> **Heads up — first-time install downloads Electron (~110 MiB).**
> The bundled `postinstall` script downloads the Electron prebuilt binary.
> On first run it measures the round-trip time of every configured mirror
> in parallel (`npmmirror.com` / GitHub Releases / `gh-proxy.com`) and
> picks the fastest reachable one — so mainland-China users get the
> Chinese CDN automatically, and overseas users get GitHub directly. No
> GeoIP lookup, no environment variable required.
>
> If a probe fails, the order falls back to `npmmirror → gh-proxy → github`
> to make sure someone in mainland China can always install even when
> GitHub is rate-limiting or blocked.
>
> Override the picker for CI / restricted networks:
>
> | Variable | Effect |
> |---|---|
> | `DRAGONCLAW_ELECTRON_MIRROR=npmmirror\|github\|gh-proxy` | Pin a specific mirror (skip the probe). |
> | `DRAGONCLAW_SKIP_ELECTRON=1` | Don't download the binary at all (useful for CI matrix builds that only need to typecheck / lint). |
> | `ELECTRON_SKIP_BINARY_DOWNLOAD=1` | Honoured for parity with the official `electron` install script. |
> | `ELECTRON_CACHE_DIR=/path` | Override the default cache location (`~/.cache/electron`). |
>
> Retry anytime with `node scripts/postinstall.mjs`.

### 3. Run in development mode

```bash
pnpm electron:dev
```

> This command starts the Vite dev server (`:5177`) and the Electron window together.

### 4. Build a production bundle

```bash
# Build for the current platform
pnpm dist

# Build a Windows client
pnpm build:win

# Build a macOS client
pnpm build:mac

# Build a Linux client
pnpm build:linux

# Build clients for all three platforms at once
pnpm build:all
```

The build output is written to the `dist/` directory.

### 5. Build **every** installer the current host can produce

`pnpm build:all` runs [`scripts/build-all.mjs`](scripts/build-all.mjs) — a small
script that picks the right target set per host OS so you don't have to
remember which arch flags go with which target.

| Host OS | What gets built |
| --- | --- |
| macOS | `mac-arm64.dmg` + `mac-x64.dmg` + `mac-universal.dmg` |
| Linux | `linux-x64.AppImage` + `linux-arm64.AppImage` + `linux-x64.deb` |
| Windows | `win-x64.exe` (NSIS installer) |

```bash
# See the plan without actually building
pnpm build:all:dry

# Build only a subset (e.g. skip the universal binary to save time)
pnpm build:all --skip=mac-universal

# Build only one target
pnpm build:all --only=linux-x64

# Reuse an existing renderer/dist (skip the Vite rebuild)
pnpm build:all:npm
```

> Cross-compiling a different OS (e.g. producing a `.dmg` on a Linux
> CI runner) isn't supported by `electron-builder` — run the script on
> the matching host, or use the legacy `pnpm build:all:cross` command
> for a "best-effort, single-host" build.

---

## 🛠️ Scripts

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
| `pnpm build:all` | Build every installer the current host can produce (per-architecture) |
| `pnpm build:all:dry` | Print the per-host build plan without building |
| `pnpm build:all:npm` | Same as `build:all` but reuse an existing `renderer/dist` |

> `pnpm`, `npm` and `yarn` are all supported. If you use `npm`, replace `pnpm` with `npm run` (e.g. `npm run electron:dev`); if you use `yarn`, replace `pnpm` with `yarn` (e.g. `yarn electron:dev`).

---

## 📦 Build & Release

Installers are produced via [electron-builder](https://www.electron.build/):

| Platform | Target | Output |
| --- | --- | --- |
| Windows | NSIS | `dist/*.exe` installer |
| macOS | DMG / arm64 / x64 | `dist/*.dmg` |
| Linux | AppImage | `dist/*.AppImage` |

Application metadata:

- `appId`: `com.dragonclaw.app`
- `productName`: `DragonClaw`
- Minimum window size: `800 × 600`

> The Windows installer lets you pick the install location and creates desktop / Start-menu shortcuts automatically.

---

## 📁 Project Layout

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

## 🧪 Testing

A small smoke-test script is included:

```bash
./test/build.test.sh
```

It verifies, in order:

1. The Vite build artifact exists.
2. The shared module loads correctly.
3. IPC channel names are unique.

---

## 🗺️ Roadmap

- [ ] Internationalization & multi-language UI (expected July)
- [ ] Multi-language documentation (expected July)
- [ ] Agent sharing (expected July)
- [ ] Performance monitoring & crash reporting (expected July)
- [ ] Permission controls (expected August)
- [ ] Built-in Token-Plan (expected September)

---

## 🤝 Contributing

Contributions are welcome! Suggested flow:

1. Fork this repository and create a feature branch (`git checkout -b feature/awesome`).
2. Commit your changes (`git commit -m 'feat: add awesome feature'`) following the [Conventional Commits](https://www.conventionalcommits.org/) spec.
3. Push the branch (`git push origin feature/awesome`) and open a Pull Request.

Before submitting, please make sure:

- `pnpm build` passes.
- Any new IPC channel names are unique.
- README and screenshots are kept in sync.

---

## 📄 License

This project is released under the [MIT](LICENSE) License.

---

## 🙏 Acknowledgments

Built on the shoulders of giants:

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Electron](https://www.electronjs.org/)
- [Arco Design Vue](https://arco.design/vue/en-US/docs/start)
- [Pinia](https://pinia.vuejs.org/)
- [OpenClaw](https://example.com/openclaw)
