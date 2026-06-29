<div align="center">

<img src="doc/assets/logo-github.png" alt="DragonClaw" width="120" />

# DragonClaw

**这或许是目前最好的 OpenClaw 桌面客户端 — 基于 Electron + Vue 3 + Vite 构建**

🌐 官方网站：[http://www.dragonclaw.cc](http://www.dragonclaw.cc)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Framework](https://img.shields.io/badge/framework-Vue%203-42B883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Build](https://img.shields.io/badge/build-Vite-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [العربية](README.ar.md) · [Deutsch](README.de.md)

</div>

---

## 📑 目录

- [🐉 关于 DragonClaw](#-关于-dragonclaw)
- [🔍 功能详解](#-功能详解)
- [🏗️ 架构概览](#%EF%B8%8F-架构概览)
- [✅ 环境要求](#-环境要求)
- [🚀 快速开始](#-快速开始)
- [🛠️ 常用脚本](#%EF%B8%8F-常用脚本)
- [📦 打包发布](#-打包发布)
- [📁 目录结构](#-目录结构)
- [🧪 测试](#-测试)
- [🗺️ 路线图](#%EF%B8%8F-路线图)
- [🤝 贡献指南](#-贡献指南)
- [📄 许可证](#-许可证)
- [🙏 致谢](#-致谢)
- [🌟 Star History](#-star-history)

---

## 🐉 关于 DragonClaw

**DragonClaw** 是一款专为 [OpenClaw](https://example.com/openclaw) 打造的桌面客户端，基于 OpenClaw 官方 WebSocket 协议 API 深度开发。它采用 **Electron + Vue 3 + Arco Design** 现代前端技术栈构建，封装了 OpenClaw 运行的全部必要环境，实现**一键安装、即开即用**；同时自动检测并复用本机已安装的 OpenClaw，迁移成本为零。

在功能层面，DragonClaw 不止是 Gateway 的"图形外壳"，更带来了诸多**创新的产品化能力**：

- 🧠 **智能体管理** — 列出、创建、更新、删除智能体；读写每个智能体的工作区文件。
- 🧩 **技能中心** — 浏览推荐技能，搜索完整分类目录，一键安装 / 卸载。
- 💬 **多对话** — 同时维护多个会话，智能分组、置顶、未读提示，历史消息完整保留。
- 📁 **会话级工作区** — 在对话界面内直接为当前会话设置工作目录，所有产出仅作用于该工作区，不污染任何空间。
- 🌳 **子任务** — 可视化呈现主智能体派生的子任务与子会话执行过程。
- 📚 **模型配置** — 内置 OpenAI、Anthropic、DeepSeek、Grok、OpenRouter、Groq、Moonshot、Alibaba、Ollama、ModelBus、自定义等主流供应商。
- 🏪 **智能体商店** — 在线挑选合适的 Agents，及其所需要的技能一键安装到本地。
- 📋 **看板** — 以任务板形式组织跨智能体的工作。
- 📜 **日志面板** — 直接在应用中查看 Gateway 实时日志。
- ⚙️ **统一设置** — 基础、网关、智能体、会话、工具、安全等配置一站式管理。
- 🔄 **更新检测** — 启动时自动检测 DragonClaw 自身、OpenClaw、Node.js 等组件的更新。
- 🌐 **远程访问** — 通过令牌（Token）或密码连接局域网内或远程服务器上的 OpenClaw Gateway。

> 📖 完整功能详解（对话、工作区、子任务、模型配置、智能体商店、更新检测、远程访问）请见下方 [🔍 功能详解](#-功能详解) 章节。

---

## 🔍 功能详解

下面重点介绍 DragonClaw 几大核心能力的细节与使用场景。

### 💬 对话（Conversation）

对话是 DragonClaw 最核心的工作面板。它不是一份简单的聊天窗口，而是一套完整的**多会话协作系统**：

- **多对话并行** — 同时打开多个会话，分别绑定不同智能体或不同任务，左侧栏一键切换，状态彼此隔离。
- **智能分组** — 按时间维度自动将历史会话归纳为「今日」「昨日」「本周」「更早」等分组，列表清爽有序。
- **置顶与未读** — 重要会话可置顶，未读会话有红点提示，配合工具栏快速定位。
- **流式输出** — 模型回复以打字机方式实时渲染，支持思考过程、工具调用结果同步呈现。
- **历史回溯** — 一键滚动到顶部即可加载更早的消息，完整保留所有交互痕迹。
- **消息操作** — 支持复制、引用、删除、压缩会话等本地化操作。
- **思考级别** — 顶部下拉可按需切换思考强度（高 / 中 / 低），在响应速度与质量间灵活权衡。
- **子任务可视化** — 主智能体触发的子任务、子智能体会以紧凑列表嵌入对应消息组，关联智能体、状态一目了然。

#### 📁 会话级工作区（Session-level Workspace）

> **DragonClaw 的工作区是会话级别的，且不会污染任何空间。** 你可以在对话界面内直接为当前会话绑定一个本地工作目录，每个会话都拥有自己独立的工作区——OpenClaw 的工作产出（文件读写、命令执行等）只会落在该工作区之内，不会污染其他目录或全局空间。

工作区绑定到**当前会话**而非全局智能体——同一个智能体的两个不同会话，可以使用完全不同的工作目录：

- **在对话界面内设置** — 在输入栏点击工作区按钮选择文件夹，即可立即绑定到当前会话。
- **会话级作用域** — 工作区路径按会话 Key（`projectSpace`）保存，切换会话时各自显示各自的工作目录，而不是一个全局共享的目录。
- **上下文跟随** — 该会话中产生的所有文件读写、命令执行都以工作区为根目录，智能体无需反复确认路径。
- **打开 / 切换** — 当前工作区始终显示在输入栏；点击即可在系统文件管理器中打开，或随时重新指派新的工作目录。
- **未设置提示** — 尚未绑定工作区时，输入栏会高亮提示，避免误操作。

![会话视图](doc/assets/Session.png)

#### 🌳 子任务（Sub-tasks）

当主智能体派生子任务或子智能体时，DragonClaw 会自动追踪并以多种方式呈现：

- **消息内联视图** — 紧贴主消息下方展示子任务卡片，包含执行智能体、任务标题、运行状态。
- **右侧侧栏汇总** — 打开侧栏即可一次性看到当前会话触发的所有子任务及其完成情况。
- **状态实时同步** — 子任务从 pending 到 done 的全流程状态会随着 Gateway 推送实时刷新。

---

### 🧠 模型配置（Model Configuration）

模型配置是 DragonClaw 的另一大亮点。传统的 OpenClaw 使用需要手动编辑 `config.json`，而 DragonClaw 提供了**完全图形化的模型管理面板**，并**内置了所有主流的模型供应商**：

- **内置主流供应商** — OpenAI、Anthropic、DeepSeek、Grok、OpenRouter、Groq、Moonshot、Alibaba、Ollama、ModelBus，以及可完全自定义的"自定义 Provider"——开箱即用，无需手动接入。
- **多 Provider 统一管理** — 数十家厂商在同一页面集中管理，会话顶部即可秒切主模型。
- **Provider 分组视图** — 按 Provider 自动归组，Logo、模型数量、上下文长度等元数据清晰呈现。
- **完整模型元数据** — 自动拉取 `models.dev` 目录，展示上下文窗口、支持能力（工具调用、视觉等）、价格档位等。
- **可视化增删改** — 新增模型只需填写模型 ID、显示名、最大 Token 数等少量字段，无需手写 JSON。
- **API Key 与 BaseURL 隔离** — 每个 Provider 独立配置凭据与接入地址，互不污染。
- **Ollama 等本地模型** — 预置 `http://127.0.0.1:11434/v1` 端点，本地大模型开箱即用。
- **快速切换** — 在会话顶部即可按会话维度切换主模型，无需重启 Gateway。

![模型配置](doc/assets/Models.png)

---

### 🏪 智能体商店（Agents Store）

> **在线挑选合适的 Agents，及其所需要的技能一键安装到本地 — 不再需要手动从 GitHub 复制模板。**

DragonClaw 内置了**智能体商店（Agents Store）**，让你直接在应用内浏览、安装智能体及其依赖技能：

- **在线目录** — 在应用内浏览官方与社区精心维护的智能体目录。
- **挑选合适的 Agent** — 按场景分类（开发、写作、办公、运维等）筛选，挑选最匹配你任务的智能体，而不是将就本机已安装的版本。
- **一键安装 Agent 与技能** — 选择目标智能体后，Agent 与其所需要的技能会被一并安装到本地，无需手动逐个处理依赖。
- **本地化定制** — 安装过程完全可视化：头像选择、ID 命名、工作目录绑定、人设描述等。
- **已安装视图** — 独立 Tab 展示「我创建的」智能体，可编辑、删除、查看对应工作区。
- **在线更新** — 已安装的智能体有新版本时，可一键升级到最新。

![智能体商店](doc/assets/Agents-Store.png)

---

### 🔄 更新检测（Update Detection）

DragonClaw 内置**一站式组件更新机制**，并在应用**启动时自动检测**，省去你四处比对版本号的麻烦：

- **启动时自动检测** — 每次启动 DragonClaw 时，会自动拉取 DragonClaw 自身、OpenClaw、Node.js 等多个组件的最新版本。
- **签名校验** — 通过 `config.json` 中的 `api.versionCheck` 接口 + `sign=dragonclaw` 标识统一回源。
- **可视化提示** — 存在新版本时在侧边栏与设置页给出明确提示，附带更新日志链接。
- **下载与安装** — 支持在应用内下载、安装、替换，全程不阻塞主窗口操作。
- **回滚保护** — 下载失败或校验失败不会破坏现有安装，避免白屏。

---

### 🌐 远程访问（Remote Access）

无论你的 OpenClaw Gateway 部署在局域网内的另一台机器，还是远程服务器、内网设备或家用 NAS 上，DragonClaw 都能通过**令牌（Token）或密码**安全连接：

- **一键切换** — 菜单中选择「远程模式」或在侧栏直接切换，几秒内即可连上目标 Gateway。
- **灵活认证** — 支持令牌（Token）与密码两种认证方式，适配不同 Gateway 的安全策略。
- **连接状态可视化** — 侧栏实时展示「远程连接中 / 已连接 / 远程未连接」等状态，支持手动重连。
- **本地与远程统一体验** — 一旦连接成功，所有功能（智能体、会话、技能、设置、日志等）与本地模式无差别。
- **连接测试** — 切换前可主动测试目标地址连通性，避免误配浪费时间。
- **配置持久化** — 远程地址、端口、Token 等配置加密保存在本地，下次启动自动恢复。

> 💡 如果远程设备没有公网 IP，可结合 Tailscale、ZeroTier、frp 等内网穿透方案使用。

---

### 📋 看板（Kanban）

当工作需要拆解到多个智能体并行协作时，DragonClaw 的**看板**会以任务板的形式把所有工作一览呈现：

- **多列任务流** — 每位智能体一列，任务在列内推进，跨智能体协作一目了然。
- **实时刷新** — 主智能体派发的子任务、子智能体执行结果会即时回写到对应卡片。
- **状态可视化** — 空闲、执行中、异常、完成等状态以不同标识呈现，便于快速发现卡点。
- **一键刷新** — 顶部「刷新」按钮可主动拉取最新状态，无需等待推送。

![看板](doc/assets/Board.png)

---

### 🧩 技能管理（Skill Management）

OpenClaw 的技能生态非常庞大，DragonClaw 提供了**完全图形化的技能中心**，让你无需手动配置即可使用：

- **推荐与全部分类** — 顶部按推荐 / 全部 / 管理三栏切换，新手可从推荐上手，高手可在全部分类中挖掘。
- **关键字搜索** — 在搜索框输入关键词即可筛选技能，多语言标签也参与匹配。
- **一键安装 / 卸载** — 每个技能卡片都附带「安装 / 卸载」按钮，回滚与重装同样轻量。
- **作者与更新日期** — 列表展示作者、装机量、最近更新时间，方便判断维护活跃度。
- **本地缓存同步** — 安装完成的技能会在本地缓存，下次启动无需重新下载。

![技能管理](doc/assets/Skills.png)

---

### 🖥️ 电脑助手（Computer Assistant）

除了和 OpenClaw Gateway 协作，DragonClaw 还内置**电脑助手**模块，把 AI 能力延伸到本机：

- **硬盘清理** — 智能扫描磁盘大文件、缓存与可清理项，给出可释放空间的建议。
- **电脑整理** — 让 AI 全面了解你的本机情况，辅助文件归类与整理。
- **软件管理** — 统一查看与管理已安装应用，按大小、更新时间、占用情况排序，可一键卸载不再需要的软件。
- **状态刷新** — 顶部「刷新状态」按钮可重新扫描本机，获取最新软件与硬件状态。

![电脑助手](doc/assets/Computer.png)

---

### ⚙️ 统一设置（Unified Settings）

DragonClaw 把所有可调参数都收拢到一个**统一设置面板**中，让配置不再散落在多个文件里：

- **基础设置** — 时区、时间格式（24 / 12 小时制）、心跳间隔、独立会话、热加载等基础行为。
- **网关设置** — 运行模式（本地 / 远程）、连接地址、Token / 密码等 Gateway 连接信息。
- **智能体设置** — 智能体默认值、人设模板、默认工作区等。
- **会话设置** — 历史保留策略、消息压缩阈值、思考级别默认值等。
- **工具设置** — 子任务、命令执行、文件读写等工具的能力开关。
- **安全设置** — 远程连接认证、Token 管理、敏感操作二次确认等。
- **保存与重载** — 右下角「保存设置」一键应用，右上角「重新加载」可丢弃改动并重读。

![统一设置](doc/assets/Settings.png)

---

## 🏗️ 架构概览

DragonClaw 采用标准的 Electron 多进程架构：

```
┌──────────────────┐   预加载 / IPC    ┌──────────────────┐   WebSocket RPC   ┌──────────────┐
│     渲染进程     │ ◀──────────────▶ │   主进程         │ ◀───────────────▶ │   Gateway    │
│  Vue 3 + Vite    │  (contextBridge)  │   Electron       │                   │   OpenClaw   │
│  Arco Design     │                   │   Node.js API    │                   │              │
└──────────────────┘                   └──────────────────┘                   └──────────────┘
         ▲                                        ▲
         │                                        │
    用户界面                                原生系统 API
                                     （文件系统、对话框等）
```

- **渲染进程 (Renderer)** — 使用 Vue 3 与 Vite 构建的单页应用，UI 基于 Arco Design Vue。
- **主进程 (Main)** — Electron 主进程，负责窗口管理、IPC 处理器与原生系统集成。
- **预加载 (Preload)** — 一层轻量的 `contextBridge`，向渲染进程暴露最小化、类型安全的 API。
- **Gateway** — OpenClaw Gateway 进程，通过 WebSocket RPC 与桌面客户端通信。

---

## ✅ 环境要求

在开始之前，请确认本机具备以下环境：

| 工具 | 版本要求 | 说明 |
| --- | --- | --- |
| Node.js | `>= 22` | 推荐 LTS 版本 |
| 包管理器 | `pnpm >= 8`、`npm >= 9` 或 `yarn >= 1.22` | 软件同时支持三种包管理器，推荐使用 pnpm |
| OpenClaw Gateway | `>= 2026.04.16`（最低支持版本） | 本地或远程皆可，桌面端通过 WebSocket 连接 |

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/<your-org>/dragonclaw.git
cd dragonclaw
```

### 2. 安装依赖

```bash
# 推荐
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

> **注意：首次安装会下载 Electron 二进制（约 110 MiB）。**
> 项目内置的 `postinstall` 脚本会从 CDN 镜像下载 Electron 预编译包。
> 首次运行时会**并发探测**所有候选镜像（`npmmirror.com` / GitHub Releases
> / `gh-proxy.com`）的 RTT，自动选择最快可达的源——国内用户直接走国内 CDN，
> 海外用户直接走 GitHub，**无需 GeoIP 查询，也无需配置环境变量**。
>
> 探测全部失败的兜底顺序为 `npmmirror → gh-proxy → github`，保证国内用户在
> GitHub 限速/被墙时仍能装上。
>
> CI 或受限网络下可用环境变量强制指定：
>
> | 变量 | 作用 |
> |---|---|
> | `DRAGONCLAW_ELECTRON_MIRROR=npmmirror\|github\|gh-proxy` | 锁定指定镜像（跳过探测）。 |
> | `DRAGONCLAW_SKIP_ELECTRON=1` | 完全跳过下载（CI 矩阵只做类型检查时用）。 |
> | `ELECTRON_SKIP_BINARY_DOWNLOAD=1` | 与官方 `electron` install 脚本行为一致。 |
> | `ELECTRON_CACHE_DIR=/path` | 自定义缓存目录（默认 `~/.cache/electron`）。 |
>
> 任何时候都可以用 `node scripts/postinstall.mjs` 重试。

### 3. 启动开发模式

```bash
pnpm electron:dev
```

> 该命令会同时启动 Vite 开发服务器 (`:5177`) 和 Electron 窗口。

### 4. 打包生产版本

```bash
# 打包当前平台
pnpm dist

# 打包 Windows 客户端
pnpm build:win

# 打包 macOS 客户端
pnpm build:mac

# 打包 Linux 客户端
pnpm build:linux

# 同时打包三平台客户端
pnpm build:all
```

打包产物会输出到 `dist/` 目录。

### 5. 一键打包当前宿主平台**所有**能出的安装包

`pnpm build:all` 实际执行的是 [`scripts/build-all.mjs`](scripts/build-all.mjs) —— 一个
按宿主操作系统自动选择目标集合的小脚本，免去手动指定架构参数的麻烦。

| 宿主平台 | 会打的产物 |
| --- | --- |
| macOS | `mac-arm64.dmg` + `mac-x64.dmg` + `mac-universal.dmg` |
| Linux | `linux-x64.AppImage` + `linux-arm64.AppImage` + `linux-x64.deb` |
| Windows | `win-x64.exe`（NSIS 安装包）|

```bash
# 只打印计划，不实际打包
pnpm build:all:dry

# 只打子集（例如跳过 universal 包以节省时间）
pnpm build:all --skip=mac-universal

# 只打一个目标
pnpm build:all --only=linux-x64

# 复用已构建的 renderer/dist（跳过 Vite 重新打包）
pnpm build:all:npm
```

> `electron-builder` **不支持跨平台编译**（例如在 Linux CI runner 上打 `.dmg`）。
> 需要别的平台的产物，请在对应系统的机器上分别运行本脚本；若确实要在
> 单台机器上"尽力而为"地尝试三平台同时打包，可使用旧命令 `pnpm build:all:cross`。
>
> **受限网络的镜像自动识别。** `electron-builder` 在打包时**自己**也会下载约 110 MiB 的
> Electron 二进制（不依赖 `node_modules/electron/dist/` 里的副本）；在部分网络
> （尤其是中国大陆）下官方 GitHub Releases 不可达。每次运行本脚本时，会先对
> 一小组候选镜像（`npmmirror.com` 和 GitHub）做并发 TCP 探测，自动选最快的源，
> 然后把 `ELECTRON_BUILDER_BINARIES_MIRROR` 注入到 `electron-builder` 子进程。
> 也可手动指定：
>
> ```bash
> export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron
> pnpm build:all
> ```
>
> 或用 `--no-mirror-detect` 跳过探测。

---

## 🛠️ 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm start` | 在已构建产物上启动 Electron |
| `pnpm dev` | 仅启动 Vite 开发服务器 |
| `pnpm build` | 构建渲染端静态资源到 `renderer/dist/` |
| `pnpm electron:dev` | 开发模式（Vite + Electron 热更新） |
| `pnpm dist` | 为当前平台构建可分发安装包 |
| `pnpm pack` | 仅构建解压目录（用于本地验证） |
| `pnpm build:win` | 构建 Windows 安装包 |
| `pnpm build:mac` | 构建 macOS 安装包 |
| `pnpm build:linux` | 构建 Linux 安装包 |
| `pnpm build:all` | 一键构建当前宿主平台**所有**可出的安装包（按架构细分）|
| `pnpm build:all:dry` | 打印按宿主平台划分的打包计划，不实际构建 |
| `pnpm build:all:npm` | 同 `build:all`，但复用已有的 `renderer/dist` |

> 软件同时支持 `pnpm`、`npm`、`yarn` 三种包管理器；`npm` 用户请将 `pnpm` 替换为 `npm run`，`yarn` 用户请将 `pnpm` 替换为 `yarn`，例如 `npm run electron:dev` 或 `yarn electron:dev`。

---

## 📦 打包发布

通过 [electron-builder](https://www.electron.build/) 输出多平台安装包：

| 平台 | 目标 | 产物 |
| --- | --- | --- |
| Windows | NSIS | `dist/*.exe` 安装程序 |
| macOS | DMG / arm64 / x64 | `dist/*.dmg` |
| Linux | AppImage | `dist/*.AppImage` |

应用元数据：

- `appId`: `com.dragonclaw.app`
- `productName`: `DragonClaw`
- 最低窗口尺寸：`800 × 600`

> Windows 安装包支持选择安装目录，并自动创建桌面与开始菜单快捷方式。

---

## 📁 目录结构

```
dragonclaw/
├── src/
│   ├── main/        # Electron 主进程（窗口、IPC、数据库、服务）
│   ├── preload/     # 预加载桥（contextBridge）
│   ├── renderer/    # Vue 3 + Arco Design 渲染端
│   │   ├── api/     #   渲染端 API 封装
│   │   ├── views/   #   业务页面（agent / skill / session …）
│   │   ├── components/
│   │   ├── core/    #   websocket / ipc 等核心能力
│   │   ├── utils/
│   │   └── stores/
│   └── shared/      # 主进程与渲染端共享的常量（如 IPC 通道名）
├── doc/             # Gateway 协议文档
├── build/           # 图标与品牌素材
├── config.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🧪 测试

项目提供基础冒烟测试脚本：

```bash
./test/build.test.sh
```

该脚本会依次验证：

1. Vite 构建产物存在；
2. 共享模块可正确加载；
3. IPC 通道名不重复。

---

## 🗺️ 路线图

- [ ] 国际化多语言（预计 7 月）
- [ ] 多语言文档（预计 7 月）
- [ ] 智能体分享（预计 7 月）
- [ ] 性能监控与崩溃上报（预计 7 月）
- [ ] 权限控制（预计 8 月）
- [ ] Token-Plan 内置（预计 9 月）

---

## 🤝 贡献指南

欢迎贡献！建议流程：

1. Fork 本仓库并创建特性分支 (`git checkout -b feature/awesome`)。
2. 提交更改 (`git commit -m 'feat: add awesome feature'`)，遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。
3. 推送分支 (`git push origin feature/awesome`) 并发起 Pull Request。

提交前请确保：

- 代码可通过 `pnpm build`；
- 涉及的 IPC 通道名保持唯一；
- README 与界面截图同步更新。

---

## 📄 许可证

本项目基于 [MIT](LICENSE) 协议开源。

---

## 🙏 致谢

本项目站在以下优秀开源项目肩膀上：

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Electron](https://www.electronjs.org/)
- [Arco Design Vue](https://arco.design/vue/en-US/docs/start)
- [Pinia](https://pinia.vuejs.org/)
- [OpenClaw](https://example.com/openclaw)


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
