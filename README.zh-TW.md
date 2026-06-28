<div align="center">

<img src="doc/assets/logo-github.png" alt="DragonClaw" width="120" />

# DragonClaw

**這或許是目前最好的 OpenClaw 桌面用戶端 — 基於 Electron + Vue 3 + Vite 建置**

🌐 官方網站：[http://www.dragonclaw.cc](http://www.dragonclaw.cc)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Framework](https://img.shields.io/badge/framework-Vue%203-42B883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Build](https://img.shields.io/badge/build-Vite-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [العربية](README.ar.md) · [Deutsch](README.de.md)

</div>

---

## 📑 目錄

- [🐉 關於 DragonClaw](#-關於-dragonclaw)
- [🔍 功能詳解](#-功能詳解)
- [🏗️ 架構概覽](#%EF%B8%8F-架構概覽)
- [✅ 環境需求](#-環境需求)
- [🚀 快速開始](#-快速開始)
- [🛠️ 常用腳本](#%EF%B8%8F-常用腳本)
- [📦 打包發佈](#-打包發佈)
- [📁 目錄結構](#-目錄結構)
- [🧪 測試](#-測試)
- [🗺️ 路線圖](#%EF%B8%8F-路線圖)
- [🤝 貢獻指南](#-貢獻指南)
- [📄 授權](#-授權)
- [🙏 致謝](#-致謝)

---

## 🐉 關於 DragonClaw

**DragonClaw** 是一款專為 [OpenClaw](https://example.com/openclaw) 打造的桌面用戶端，基於 OpenClaw 官方 WebSocket 通訊協定 API 深度開發。採用 **Electron + Vue 3 + Arco Design** 現代前端技術棧建置，封裝了 OpenClaw 執行的全部必要環境，實現**一鍵安裝、即開即用**；同時自動偵測並複用本機已安裝的 OpenClaw，移轉成本為零。

在功能層面，DragonClaw 不只是 Gateway 的「圖形外殼」，更帶來了多項**創新的產品化能力**：

- 🧠 **智能體管理** — 列出、建立、更新、刪除智能體；讀寫每個智能體的工作區檔案。
- 🧩 **技能中心** — 瀏覽推薦技能，搜尋完整分類目錄，一鍵安裝 / 解除安裝。
- 💬 **多對話** — 同時維護多個工作階段，智慧分群、置頂、未讀提示，歷史訊息完整保留。
- 📁 **工作階段層級工作區** — 在對話介面內直接為目前工作階段設定工作目錄，所有產出僅作用於該工作區，不會污染任何空間。
- 🌳 **子任務** — 視覺化呈現主智能體派生的子任務與子工作階段執行過程。
- 📚 **模型設定** — 內建 OpenAI、Anthropic、DeepSeek、Grok、OpenRouter、Groq、Moonshot、Alibaba、Ollama、ModelBus、自訂等主流供應商。
- 🏪 **智能體商店** — 線上挑選合適的 Agents，及其所需要的技能一鍵安裝到本機。
- 📋 **儀表板** — 以任務板形式組織跨智能體的工作。
- 📜 **日誌面板** — 直接在應用中檢視 Gateway 即時日誌。
- ⚙️ **統一設定** — 基礎、閘道、智能體、工作階段、工具、安全等設定一站式管理。
- 🔄 **更新偵測** — 啟動時自動偵測 DragonClaw 自身、OpenClaw、Node.js 等元件的更新。
- 🌐 **遠端存取** — 透過權杖（Token）或密碼連線區域網路內或遠端伺服器上的 OpenClaw Gateway。

> 📖 完整功能詳解（對話、工作區、子任務、模型設定、智能體商店、更新偵測、遠端存取）請見下方 [🔍 功能詳解](#-功能詳解) 章節。

---

## 🔍 功能詳解

以下重點介紹 DragonClaw 幾大核心能力的細節與使用情境。

### 💬 對話（Conversation）

對話是 DragonClaw 最核心的工作面板。它不是一份簡單的聊天視窗，而是一套完整的**多工作階段協作系統**：

- **多對話並行** — 同時開啟多個工作階段，分別繫結不同智能體或不同任務，左側欄一鍵切換，狀態彼此隔離。
- **智慧分群** — 按時間維度自動將歷史工作階段歸納為「今日」「昨日」「本週」「更早」等群組，列表清爽有序。
- **置頂與未讀** — 重要工作階段可置頂，未讀工作階段有紅點提示，搭配工具列快速定位。
- **串流輸出** — 模型回覆以打字機方式即時呈現，支援思考過程、工具呼叫結果同步顯示。
- **歷史回溯** — 一鍵捲動到頂部即可載入更早的訊息，完整保留所有互動紀錄。
- **訊息操作** — 支援複製、引用、刪除、壓縮工作階段等本地化操作。
- **思考層級** — 頂部下拉可依需求切換思考強度（高 / 中 / 低），在回應速度與品質間靈活權衡。
- **子任務視覺化** — 主智能體觸發的子任務、子智能體會以緊湊列表嵌入對應訊息群組，關聯智能體、狀態一目了然。

#### 📁 工作階段層級工作區（Session-level Workspace）

> **DragonClaw 的工作區是工作階段層級的，且不會污染任何空間。** 你可以在對話介面內直接為目前工作階段繫結一個本地工作目錄，每個工作階段都擁有自己獨立的工作區——OpenClaw 的工作產出（檔案讀寫、命令執行等）只會落在該工作區之內，不會污染其他目錄或全域空間。

工作區繫結到**目前工作階段**而非全域智能體——同一個智能體的兩個不同工作階段，可以使用完全不同的資料夾：

- **在對話介面內設定** — 在輸入欄點選工作區按鈕選擇資料夾，即可立即繫結到目前工作階段。
- **工作階段層級範圍** — 工作區路徑按工作階段 Key（`projectSpace`）儲存，切換工作階段時各自顯示各自的工作目錄，而不是一個全域共享的目錄。
- **上下文跟隨** — 該工作階段中產生的所有檔案讀寫、命令執行都以工作區為根目錄，智能體無需反覆確認路徑。
- **開啟 / 切換** — 目前工作區始終顯示在輸入欄；點選即可在系統檔案管理員中開啟，或隨時重新指派新的工作目錄。
- **未設定提示** — 尚未繫結工作區時，輸入欄會醒目提示，避免誤操作。

![對話檢視](doc/assets/Session.png)

#### 🌳 子任務（Sub-tasks）

當主智能體派生子任務或子智能體時，DragonClaw 會自動追蹤並以多種方式呈現：

- **訊息內嵌檢視** — 緊貼主訊息下方展示子任務卡片，包含執行智能體、工作標題、執行狀態。
- **右側側欄彙總** — 開啟側欄即可一次看到目前工作階段觸發的所有子任務及其完成情況。
- **狀態即時同步** — 子任務從 pending 到 done 的全流程狀態會隨著 Gateway 推送即時更新。

---

### 🧠 模型設定（Model Configuration）

模型設定是 DragonClaw 的另一大亮點。傳統的 OpenClaw 使用需要手動編輯 `config.json`，而 DragonClaw 提供了**完全圖形化的模型管理面板**，並**內建了所有主流的模型供應商**：

- **內建主流供應商** — OpenAI、Anthropic、DeepSeek、Grok、OpenRouter、Groq、Moonshot、Alibaba、Ollama、ModelBus，以及可完全自訂的「自訂 Provider」——開箱即用，無需手動接入。
- **多 Provider 統一管理** — 數十家廠商在同一頁面集中管理，工作階段頂部即可秒切主模型。
- **Provider 分組檢視** — 按 Provider 自動歸組，Logo、模型數量、上下文長度等中繼資料清晰呈現。
- **完整模型中繼資料** — 自動擷取 `models.dev` 目錄，展示上下文視窗、支援能力（工具呼叫、視覺等）、價格級距等。
- **視覺化增刪改** — 新增模型只需填寫模型 ID、顯示名、最大 Token 數等少量欄位，無需手寫 JSON。
- **API Key 與 BaseURL 隔離** — 每個 Provider 獨立設定憑證與接入位址，互不污染。
- **Ollama 等本地模型** — 預設 `http://127.0.0.1:11434/v1` 端點，本地大模型開箱即用。
- **快速切換** — 在工作階段頂部即可按工作階段維度切換主模型，無需重啟 Gateway。

![模型設定](doc/assets/Models.png)

---

### 🏪 智能體商店（Agents Store）

> **線上挑選合適的 Agents，及其所需要的技能一鍵安裝到本機 — 不再需要手動從 GitHub 複製樣板。**

DragonClaw 內建了**智能體商店（Agents Store）**，讓你直接在應用內瀏覽、安裝智能體及其依賴技能：

- **線上目錄** — 在應用內瀏覽官方與社群精心維護的智能體目錄。
- **挑選合適的 Agent** — 按情境分類（開發、寫作、辦公、運維等）篩選，挑選最符合你任務的智能體，而不是將就本機已安裝的版本。
- **一鍵安裝 Agent 與技能** — 選擇目標智能體後，Agent 與其所需要的技能會被一併安裝到本機，無需手動逐一處理依賴。
- **本地化自訂** — 安裝過程完全視覺化：頭像選擇、ID 命名、工作目錄繫結、人設描述等。
- **已安裝檢視** — 獨立分頁展示「我建立的」智能體，可編輯、刪除、檢視對應工作區。
- **線上更新** — 已安裝的智能體有新版本時，可一鍵升級到最新。

![智能體商店](doc/assets/Agents-Store.png)

---

### 🔄 更新偵測（Update Detection）

DragonClaw 內建**一站式元件更新機制**，並在應用**啟動時自動偵測**，省去你四處比對版本號的麻煩：

- **啟動時自動偵測** — 每次啟動 DragonClaw 時，會自動擷取 DragonClaw 自身、OpenClaw、Node.js 等多個元件的最新版本。
- **簽章校驗** — 透過 `config.json` 中的 `api.versionCheck` 介面 + `sign=dragonclaw` 識別統一回源。
- **視覺化提示** — 存在新版本時在側邊欄與設定頁給出明確提示，附帶更新日誌連結。
- **下載與安裝** — 支援在應用內下載、安裝、替換，全程不阻塞主視窗操作。
- **回溯保護** — 下載失敗或校驗失敗不會破壞現有安裝，避免白畫面。

---

### 🌐 遠端存取（Remote Access）

無論你的 OpenClaw Gateway 部署在區域網路內的另一台機器，還是遠端伺服器、內網裝置或家用 NAS 上，DragonClaw 都能透過**權杖（Token）或密碼**安全連線：

- **一鍵切換** — 選單中選擇「遠端模式」或在側邊欄直接切換，幾秒內即可連上目標 Gateway。
- **彈性認證** — 支援權杖（Token）與密碼兩種認證方式，適配不同 Gateway 的安全策略。
- **連線狀態視覺化** — 側邊欄即時展示「遠端連線中 / 已連線 / 遠端未連線」等狀態，支援手動重連。
- **本機與遠端統一體驗** — 一旦連線成功，所有功能（智能體、工作階段、技能、設定、日誌等）與本機模式無差別。
- **連線測試** — 切換前可主動測試目標位址連通性，避免誤設浪費時間。
- **設定持久化** — 遠端位址、連接埠、Token 等設定加密儲存在本機，下次啟動自動還原。

> 💡 如果遠端裝置沒有公網 IP，可搭配 Tailscale、ZeroTier、frp 等內網穿透方案使用。

---

### 📋 儀表板（Dashboard）

當工作需要拆解到多個智能體並行協作時，DragonClaw 的**儀表板**會以任務板的形式把所有工作一覽呈現：

- **多欄工作流** — 每位智能體一欄，任務在欄內推進，跨智能體協作一目了然。
- **即時刷新** — 主智能體派發的子任務、子智能體執行結果會即時回寫到對應卡片。
- **狀態視覺化** — 閒置、執行中、異常、完成等狀態以不同標識呈現，方便快速發現卡點。
- **一鍵刷新** — 頂部「刷新」按鈕可主動擷取最新狀態，無需等待推送。

![儀表板](doc/assets/Board.png)

---

### 🧩 技能管理（Skill Management）

OpenClaw 的技能生態非常龐大，DragonClaw 提供了**完全圖形化的技能中心**，讓你無需手動設定即可使用：

- **推薦與全部分類** — 頂部按推薦 / 全部 / 管理三欄切換，新手可從推薦上手，高手可在全部分類中挖掘。
- **關鍵字搜尋** — 在搜尋框輸入關鍵字即可篩選技能，多語言標籤也參與匹配。
- **一鍵安裝 / 解除安裝** — 每個技能卡片都附帶「安裝 / 解除安裝」按鈕，回溯與重裝同樣輕量。
- **作者與更新日期** — 列表展示作者、裝機量、最近更新時間，方便判斷維護活躍度。
- **本機快取同步** — 安裝完成的技能會在本機快取，下次啟動無需重新下載。

![技能管理](doc/assets/Skills.png)

---

### 🖥️ 電腦助手（Computer Assistant）

除了和 OpenClaw Gateway 協作，DragonClaw 還內建**電腦助手**模組，把 AI 能力延伸到本機：

- **硬碟清理** — 智慧掃描磁碟大檔、暫存與可清理項，給出可釋放空間的建議。
- **電腦整理** — 讓 AI 全面了解你的本機情況，輔助檔案歸類與整理。
- **軟體管理** — 統一檢視與管理已安裝應用，按大小、更新時間、占用情況排序，可一鍵解除安裝不再需要的軟體。
- **狀態刷新** — 頂部「刷新狀態」按鈕可重新掃描本機，獲取最新軟硬體狀態。

![電腦助手](doc/assets/Computer.png)

---

### ⚙️ 統一設定（Unified Settings）

DragonClaw 把所有可調參數都收攏到一個**統一設定面板**中，讓設定不再散落在多個檔案裡：

- **基礎設定** — 時區、時間格式（24 / 12 小時制）、心跳間隔、獨立工作階段、熱載入等基礎行為。
- **閘道設定** — 執行模式（本機 / 遠端）、連線位址、權杖 / 密碼等 Gateway 連線資訊。
- **智能體設定** — 智能體預設值、人設範本、預設工作區等。
- **工作階段設定** — 歷史保留策略、訊息壓縮閾值、思考級別預設值等。
- **工具設定** — 子任務、命令執行、檔案讀寫等工具的能力開關。
- **安全設定** — 遠端連線認證、權杖管理、敏感操作二次確認等。
- **儲存與重載** — 右下角「儲存設定」一鍵套用，右上角「重新載入」可捨棄變更並重讀。

![統一設定](doc/assets/Settings.png)

---

## 🏗️ 架構概覽

DragonClaw 採用標準的 Electron 多程序架構：

```
┌──────────────────┐   預載入 / IPC    ┌──────────────────┐   WebSocket RPC   ┌──────────────┐
│     渲染程序     │ ◀──────────────▶ │   主程序         │ ◀───────────────▶ │   Gateway    │
│  Vue 3 + Vite    │  (contextBridge)  │   Electron       │                   │   OpenClaw   │
│  Arco Design     │                   │   Node.js API    │                   │              │
└──────────────────┘                   └──────────────────┘                   └──────────────┘
         ▲                                        ▲
         │                                        │
    使用者介面                                原生系統 API
                                     （檔案系統、對話框等）
```

- **渲染程序 (Renderer)** — 使用 Vue 3 與 Vite 建置的單頁應用，UI 基於 Arco Design Vue。
- **主程序 (Main)** — Electron 主程序，負責視窗管理、IPC 處理器與原生系統整合。
- **預載入 (Preload)** — 一層輕量的 `contextBridge`，向渲染程序公開最小化、型別安全的 API。
- **Gateway** — OpenClaw Gateway 程序，透過 WebSocket RPC 與桌面用戶端通訊。

---

## ✅ 環境需求

在開始之前，請確認本機具備以下環境：

| 工具 | 版本需求 | 說明 |
| --- | --- | --- |
| Node.js | `>= 22` | 推薦 LTS 版本 |
| 套件管理工具 | `pnpm >= 8`、`npm >= 9` 或 `yarn >= 1.22` | 軟體同時支援三種套件管理工具，推薦使用 pnpm |
| OpenClaw Gateway | `>= 2026.04.16`（最低支援版本） | 本機或遠端皆可，桌面端透過 WebSocket 連線 |

---

## 🚀 快速開始

### 1. 複製儲存庫

```bash
git clone https://github.com/<your-org>/dragonclaw.git
cd dragonclaw
```

### 2. 安裝相依套件

```bash
# 推薦
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

### 3. 啟動開發模式

```bash
pnpm electron:dev
```

> 該命令會同時啟動 Vite 開發伺服器 (`:5177`) 和 Electron 視窗。

### 4. 打包正式版本

```bash
# 打包目前平台
pnpm dist

# 打包 Windows 用戶端
pnpm build:win

# 打包 macOS 用戶端
pnpm build:mac

# 打包 Linux 用戶端
pnpm build:linux

# 同時打包三平台用戶端
pnpm build:all
```

打包產物會輸出到 `dist/` 目錄。

### 5. 一鍵打包目前宿主平台**所有**能出的安裝包

`pnpm build:all` 實際執行的是 [`scripts/build-all.mjs`](scripts/build-all.mjs) —— 一個
按宿主作業系統自動選擇目標集合的小腳本，免去手動指定架構參數的麻煩。

| 宿主平台 | 會打的產物 |
| --- | --- |
| macOS | `mac-arm64.dmg` + `mac-x64.dmg` + `mac-universal.dmg` |
| Linux | `linux-x64.AppImage` + `linux-arm64.AppImage` + `linux-x64.deb` |
| Windows | `win-x64.exe`（NSIS 安裝包）|

```bash
# 只列印計畫，不實際打包
pnpm build:all:dry

# 只打子集（例如跳過 universal 包以節省時間）
pnpm build:all --skip=mac-universal

# 只打一個目標
pnpm build:all --only=linux-x64

# 複用已建置的 renderer/dist（跳過 Vite 重新打包）
pnpm build:all:npm
```

> `electron-builder` **不支援跨平台編譯**（例如在 Linux CI runner 上打 `.dmg`）。
> 需要別的平臺的產物，請在對應系統的機器上分別執行本腳本；若確實要在
> 單臺機器上「盡力而為」地嘗試三平臺同時打包，可使用舊指令 `pnpm build:all:cross`。
>
> **受限網路的鏡像自動偵測。** `electron-builder` 在打包時**自己**也會下載約 110 MiB
> 的 Electron 二進位檔（不會複用 `node_modules/electron/dist/` 裡的副本）；在部分網路
> （尤其是中國大陸）下官方 GitHub Releases 不可達。每次執行本腳本時，會先對一小組
> 候選鏡像（`npmmirror.com` 與 GitHub）做並行 TCP 探測，自動選最快的來源，
> 接著把 `ELECTRON_BUILDER_BINARIES_MIRROR` 注入到 `electron-builder` 子進程。
> 也可手動指定：
>
> ```bash
> export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron
> pnpm build:all
> ```
>
> 或用 `--no-mirror-detect` 略過探測。

---

## 🛠️ 常用腳本

| 命令 | 說明 |
| --- | --- |
| `pnpm start` | 在已建置產物上啟動 Electron |
| `pnpm dev` | 僅啟動 Vite 開發伺服器 |
| `pnpm build` | 建置渲染端靜態資源到 `renderer/dist/` |
| `pnpm electron:dev` | 開發模式（Vite + Electron 熱更新） |
| `pnpm dist` | 為目前平台建置可發佈安裝包 |
| `pnpm pack` | 僅建置解壓縮目錄（用於本地驗證） |
| `pnpm build:win` | 建置 Windows 安裝包 |
| `pnpm build:mac` | 建置 macOS 安裝包 |
| `pnpm build:linux` | 建置 Linux 安裝包 |
| `pnpm build:all` | 一鍵建置目前宿主平臺**所有**可出的安裝包（按架構細分）|
| `pnpm build:all:dry` | 列出按宿主平臺劃分的打包計畫，不實際建置 |
| `pnpm build:all:npm` | 同 `build:all`，但複用已有的 `renderer/dist` |

> 軟體同時支援 `pnpm`、`npm`、`yarn` 三種套件管理工具；`npm` 使用者請將 `pnpm` 替換為 `npm run`，`yarn` 使用者請將 `pnpm` 替換為 `yarn`，例如 `npm run electron:dev` 或 `yarn electron:dev`。

---

## 📦 打包發佈

透過 [electron-builder](https://www.electron.build/) 輸出多平台安裝包：

| 平台 | 目標 | 產物 |
| --- | --- | --- |
| Windows | NSIS | `dist/*.exe` 安裝程式 |
| macOS | DMG / arm64 / x64 | `dist/*.dmg` |
| Linux | AppImage | `dist/*.AppImage` |

應用中繼資料：

- `appId`: `com.dragonclaw.app`
- `productName`: `DragonClaw`
- 最低視窗尺寸：`800 × 600`

> Windows 安裝包支援選擇安裝目錄，並自動建立桌面與開始功能表捷徑。

---

## 📁 目錄結構

```
dragonclaw/
├── src/
│   ├── main/        # Electron 主程序（視窗、IPC、資料庫、服務）
│   ├── preload/     # 預載入橋（contextBridge）
│   ├── renderer/    # Vue 3 + Arco Design 渲染端
│   │   ├── api/     #   渲染端 API 封裝
│   │   ├── views/   #   業務頁面（agent / skill / session …）
│   │   ├── components/
│   │   ├── core/    #   websocket / ipc 等核心能力
│   │   ├── utils/
│   │   └── stores/
│   └── shared/      # 主程序與渲染端共享的常數（如 IPC 通道名）
├── doc/             # Gateway 通訊協定文件
├── build/           # 圖示與品牌素材
├── config.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🧪 測試

專案提供基礎冒煙測試腳本：

```bash
./test/build.test.sh
```

該腳本會依序驗證：

1. Vite 建置產物存在；
2. 共用模組可正確載入；
3. IPC 通道名稱不重複。

---

## 🗺️ 路線圖

- [ ] 國際化多語言（預計 7 月）
- [ ] 多語言文件（預計 7 月）
- [ ] 智能體分享（預計 7 月）
- [ ] 效能監控與當機回報（預計 7 月）
- [ ] 權限控制（預計 8 月）
- [ ] Token-Plan 內建（預計 9 月）

---

## 🤝 貢獻指南

歡迎貢獻！建議流程：

1. Fork 本儲存庫並建立特性分支 (`git checkout -b feature/awesome`)。
2. 提交變更 (`git commit -m 'feat: add awesome feature'`)，遵循 [Conventional Commits](https://www.conventionalcommits.org/) 規範。
3. 推送分支 (`git push origin feature/awesome`) 並發起 Pull Request。

提交前請確保：

- 程式碼可透過 `pnpm build`；
- 涉及的 IPC 通道名稱保持唯一；
- README 與介面截圖同步更新。

---

## 📄 授權

本專案基於 [MIT](LICENSE) 授權條款開源。

---

## 🙏 致謝

本專案站在以下優秀開源專案肩膀上：

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Electron](https://www.electronjs.org/)
- [Arco Design Vue](https://arco.design/vue/en-US/docs/start)
- [Pinia](https://pinia.vuejs.org/)
- [OpenClaw](https://example.com/openclaw)
