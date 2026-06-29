<div align="center">

<img src="doc/assets/logo-github.png" alt="DragonClaw" width="120" />

# DragonClaw

**おそらく現在最も優れた OpenClaw デスクトップクライアント — Electron + Vue 3 + Vite で構築**

🌐 公式サイト：[http://www.dragonclaw.cc](http://www.dragonclaw.cc)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Framework](https://img.shields.io/badge/framework-Vue%203-42B883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Build](https://img.shields.io/badge/build-Vite-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [العربية](README.ar.md) · [Deutsch](README.de.md)

</div>

---

## 📑 目次

- [🐉 DragonClaw について](#-dragonclaw-について)
- [🔍 機能詳細](#-機能詳細)
- [🏗️ アーキテクチャ](#%EF%B8%8F-アーキテクチャ)
- [✅ 動作要件](#-動作要件)
- [🚀 クイックスタート](#-クイックスタート)
- [🛠️ スクリプト](#%EF%B8%8F-スクリプト)
- [📦 ビルドとリリース](#-ビルドとリリース)
- [📁 プロジェクト構成](#-プロジェクト構成)
- [🧪 テスト](#-テスト)
- [🗺️ ロードマップ](#%EF%B8%8F-ロードマップ)
- [🤝 コントリビュート](#-コントリビュート)
- [📄 ライセンス](#-ライセンス)
- [🌟 Star History](#-star-history)
- [🙏 謝辞](#-謝辞)

---

## 🐉 DragonClaw について

**DragonClaw** は [OpenClaw](https://example.com/openclaw) 専用に作られたデスクトップクライアントで、OpenClaw 公式の WebSocket プロトコル API に基づいて開発されています。**Electron + Vue 3 + Arco Design** というモダンな技術スタックで構築されており、OpenClaw の実行に必要なすべてのランタイムを同梱しています — **インストールしたらすぐに動作**。ローカルにすでに OpenClaw が入っている場合は DragonClaw が自動検出・再利用するたため、移行コストはゼロです。

Gateway の「GUI の殻」に留まらず、DragonClaw は数多くの**革新的で製品化された機能**を提供します：

- 🧠 **エージェント管理** — エージェントの一覧／作成／更新／削除と、エージェントごとのワークスペースファイルの読み書き。
- 🧩 **スキルセンター** — おすすめスキルのブラウズ、フルカタログの検索、ワンクリックでのインストール／アンインストール。
- 💬 **マルチ会話** — 多数のセッションを並行運用。スマートグルーピング、ピン留め、未読マーカー、完全な履歴を備えます。
- 📁 **セッションレベルのワークスペース** — 会話画面内から現在のセッションの作業ディレクトリを直接設定。OpenClaw が生成する成果物はすべてそのワークスペース内に収まり、他の場所を汚染しません。
- 🌳 **サブタスク** — メインエージェントが派生したサブタスク／サブセッションをリアルタイムに可視化。
- 📚 **モデル設定** — OpenAI、Anthropic、DeepSeek、Grok、OpenRouter、Groq、Moonshot、Alibaba、Ollama、ModelBus、カスタムなど、主要プロバイダーを標準搭載。
- 🏪 **Agents Store** — オンラインから最適な Agents を選び、それが必要とするスキルと一緒にワンクリックでローカルにインストール。
- 📋 **ダッシュボード** — 複数エージェントに渡るタスクを整理するタスクボード。
- 📜 **ログパネル** — アプリ内から Gateway のリアルタイムログを tail。
- ⚙️ **統合設定** — 基本、ゲートウェイ、エージェント、セッション、ツール、セキュリティを単一ペインに集約。
- 🔄 **更新検出** — DragonClaw 自身、OpenClaw、Node.js などの更新を起動時に自動チェック。
- 🌐 **リモートアクセス** — LAN 内やリモートサーバー上の OpenClaw Gateway に、Token またはパスワードで安全に接続。

> 📖 詳細な機能の解説（会話、ワークスペース、サブタスク、モデル設定、Agents Store、更新検出、リモートアクセス）は下記の [🔍 機能詳細](#-機能詳細) セクションをご覧ください。

---

## 🔍 機能詳細

ここでは DragonClaw の特に重要な機能について、詳細と活用シーンを紹介します。

### 💬 会話（Conversation）

会話パネルは DragonClaw の中核です。単なるチャットウィンドウではなく、**完全なマルチセッション協業システム**です：

- **複数セッションの並行** — 複数の会話を同時に開いて、それぞれを異なるエージェントやタスクに割り当て可能。サイドバーからワンクリックで切替でき、状態は互いに分離されています。
- **スマートグルーピング** — 履歴セッションを自動的に「今日」「昨日」「今週」「それ以前」に分類し、リストをすっきりと保ちます。
- **ピン留めと未読** — 重要なセッションはピン留め、未読セッションは赤いドットで表示。ツールバーからすばやくアクセスできます。
- **ストリーミング出力** — モデルの応答をタイプライター風にリアルタイム描画。思考過程やツール呼び出し結果もインラインで表示されます。
- **履歴の遡行** — 顶部までスクロールすれば過去のメッセージが遅延ロードされ、やりとりの履歴は失われません。
- **メッセージ操作** — コピー、引用、削除、セッションの圧縮といったローカル操作をすべてサポート。
- **思考レベル** — トップバーから推論の強度（高／中／低）を選択でき、応答速度と品質を柔軟にバランスできます。
- **サブタスクの可視化** — メインエージェントが起動したサブタスク／サブエージェントは、対応するメッセージグループ内にコンパクトなカードとして表示され、実行エージェントと状態がひと目でわかります。

#### 📁 セッションレベルのワークスペース（Session-level Workspace）

> **DragonClaw のワークスペースはセッションレベルで動作し、他の場所を一切汚染しません。** 会話画面内から現在のセッションに作業ディレクトリを直接バインドでき、各セッションが独立したワークスペースを持ちます。OpenClaw がそのセッション内で読み書き・生成するすべての成果物はワークスペース内に閉じ込められ、他のディレクトリやグローバル領域に漏れることはありません。

ワークスペースは**現在のセッション**にバインドされ、エージェント全体に対するグローバル設定ではありません — 同じエージェントを使う 2 つのセッションが、完全に異なるフォルダを使い分けられます。

- **会話画面から設定** — 入力バーのワークスペースボタンをクリックしてフォルダを選ぶと、即座に現在のセッションにバインドされます。
- **セッション単位のスコープ** — パスはセッションキー（`projectSpace`）に保存されるため、セッションを切り替えると、それぞれが自分の作業ディレクトリを表示します（グローバル共有ディレクトリにはなりません）。
- **コンテキスト追従** — そのセッションで発生するすべてのファイル読み書きやコマンド実行はワークスペースをルートとして扱うため、エージェントがパスを何度も確認する必要がありません。
- **開く／再バインド** — 現在のワークスペースは常に入力バーに表示されます。クリックでシステムファイルマネージャで開くことも、随时新しいディレクトリに付け替えることもできます。
- **未設定ガード** — ワークスペースが未設定の場合、入力バーがハイライトされて誤操作を防ぎます。

![会話ビュー](doc/assets/Session.png)

#### 🌳 サブタスク（Sub-tasks）

メインエージェントがサブタスクやサブエージェントを派生させたとき、DragonClaw はそれらを自動的に追跡し、複数の方法で表示します：

- **メッセージ内インライン表示** — 発生元のメッセージ直下にサブタスクカードを表示し、実行エージェント、タスクのタイトル、状態を提示します。
- **右側サイドバーでの一覧** — サイドバーを開けば、現在のセッションで起動されたすべてのサブタスクとその完了状態を一覧できます。
- **状態のリアルタイム同期** — `pending` から `done` までの遷移は、Gateway からのイベントに応じて即時に更新されます。

---

### 🧠 モデル設定（Model Configuration）

モデル設定も DragonClaw の大きな強みです。従来の OpenClaw では `config.json` を手で編集する必要がありましたが、DragonClaw は**完全にグラフィカルなモデル管理体験**を提供し、**主要なモデルプロバイダーを標準で内蔵**しています：

- **主要プロバイダーを標準搭載** — OpenAI、Anthropic、DeepSeek、Grok、OpenRouter、Groq、Moonshot、Alibaba、Ollama、ModelBus、そして完全にカスタマイズ可能な「Custom Provider」 — いずれも事前設定済みで、手動セットアップは不要です。
- **複数 Provider の一元管理** — 数十社のベンダーを 1 つの画面で管理し、セッション顶部から数秒でメインモデルを切り替えられます。
- **Provider グルーピング表示** — Provider ごとに自動グルーピングされ、ロゴ、モデル数、コンテキスト長がひと目でわかります。
- **豊富なモデルメタデータ** — `models.dev` カタログからコンテキストウィンドウ、対応機能（ツール呼び出し、ビジョンなど）、価格ティアなどを自動取得。
- **視覚的な CRUD** — モデルの追加は ID、表示名、最大トークン数などわずかな項目を入力するだけ。JSON を手書きする必要はありません。
- **API Key と BaseURL の分離** — Provider ごとに資格情報と接続 URL を個別に保持し、相互に干渉しません。
- **Ollama などのローカルモデル** — `http://127.0.0.1:11434/v1` エンドポイントをプリセット。ローカル LLM がそのまま動作します。
- **セッション単位の切替** — トップバーから会話ごとにメインモデルを変更でき、Gateway の再起動は不要です。

![モデル設定](doc/assets/Models.png)

---

### 🏪 Agents Store

> **オンラインで最適な Agents を選び、それが必要とするスキルと一緒にワンクリックでローカルへ — GitHub からテンプレートを手でクローンする日々は終わりです。**

DragonClaw には** Agents Store **が標準搭載されており、アプリケーション内から直接エージェントと、それが依存するスキルもまとめてインストールできます：

- **オンラインカタログ** — 公式とコミュニティが丁寧に保守するエージェントのカタログをアプリ内からブラウズ。
- **最適な Agent を選ぶ** — シナリオ別（開発、ライティング、事務、運用など）に絞り込み、ローカルにあるものに手を出すのではなく、**タスクに最も合ったエージェントを選べます**。
- **Agent とスキルをまとめてワンクリックインストール** — 対象エージェントを選ぶと、それが必要とするスキルもすべて一緒にインストールされるため、依存関係を一つひとつ手動で解決する手間がありません。
- **ローカルカスタマイズ** — インストールは完全に視覚的：アバター選択、ID 命名、作業ディレクトリのバインド、人格記述など。
- **「自分のエージェント」ビュー** — 専用のタブで自分が作成したエージェントを一覧し、編集・削除・参照が可能。
- **オンラインアップデート** — インストール済みエージェントの新バージョンが公開されたら、ワンクリックで最新版へ。

![Agents Store](doc/assets/Agents-Store.png)

---

### 🔄 更新検出（Update Detection）

DragonClaw には**ワンストップのコンポーネントアップデーター**が組み込まれており、**起動時に自動実行**されるため、いたるところでバージョン番号を比べる手間から解放されます：

- **起動時の自動チェック** — DragonClaw を起動するたびに、DragonClaw 自身、OpenClaw、Node.js など複数のコンポーネントの最新バージョンを 1 回のリクエストで取得します。
- **署名付きソース** — `config.json` の `api.versionCheck` エンドポイントに `sign=dragonclaw` 識別子でアクセス。
- **視覚的な通知** — 新バージョンがある場合、サイドバーと設定ページに明確な通知と更新履歴リンクを表示。
- **アプリ内ダウンロードとインストール** — ダウンロード、インストール、置換までをアプリ内で完結。メインウィンドウをブロックしません。
- **ロールバック保護** — ダウンロード失敗や署名不一致が既存インストールを破壊することはなく、白画面には陥りません。

---

### 🌐 リモートアクセス（Remote Access）

OpenClaw Gateway が LAN 内の別のマシンにあっても、リモートサーバー、社内のデバイス、家庭用 NAS にあっても、DragonClaw は **Token** または**パスワード**で安全かつ柔軟に接続できます：

- **ワンクリック切替** — メニューから「リモートモード」を選択するか、サイドバーから直接切替。ほんの数秒で目的の Gateway に接続されます。
- **柔軟な認証** — Token ベースとパスワードベースの両方の認証方式をサポートし、さまざまな Gateway のセキュリティポリシーに対応します。
- **接続ステータスの可視化** — サイドバーに「接続中／接続済み／未接続」がリアルタイム表示され、手動再接続ボタンも用意されています。
- **ローカルと同一の UX** — 接続が完了すれば、すべての機能（エージェント、セッション、スキル、設定、ログなど）はローカルモードと全く同じ動作をします。
- **接続テスト** — 切替前にターゲットへの到達性を能動的にテストでき、設定ミスで時間を浪費しません。
- **設定の永続化** — リモートアドレス、ポート、Token などは暗号化してローカルに保存され、次回起動時に自動で復元されます。

> 💡 リモートデバイスにパブリック IP がない場合は、Tailscale、ZeroTier、frp などのトンネリング／NAT トラバーサルソリューションと組み合わせてご利用ください。

---

### 📋 ダッシュボード（Dashboard）

作業を複数のエージェントに分割して並走させたいとき、DragonClaw の**ダッシュボード**がすべてのタスクを一つのボードにまとめて表示します：

- **複数カラムのフロー** — エージェントごとに 1 カラム。タスクはカラム内で進み、エージェント横断のコラボレーションが一目でわかります。
- **リアルタイム更新** — メインエージェントが派生したサブタスク／サブエージェントの結果は即座に対応するカードへ書き戻されます。
- **状態の可視化** — アイドル／実行中／エラー／完了などが異なるマーカーで示され、ボトルネックをすぐに発見できます。
- **ワンクリック更新** — ヘッダーの「リフレッシュ」ボタンで能動的に最新状態を取得でき、プッシュを待つ必要はありません。

![ダッシュボード](doc/assets/Board.png)

---

### 🧩 スキル管理（Skill Management）

OpenClaw のスキルエコシステムは非常に大きく、DragonClaw はそれを**完全グラフィカルなスキルセンター**にまとめ、手動設定なしに扱えるようにします：

- **おすすめ・すべて・管理タブ** — 上部の 3 タブで切り替え、初心者はおすすめから、上級者はすべてから掘り出せます。
- **キーワード検索** — 検索ボックスにキーワードを入力すればスキルが絞り込まれ、多言語タグも対象に含まれます。
- **ワンクリックインストール／アンインストール** — 各スキルカードに「インストール／アンインストール」ボタンを用意。ロールバックと再インストールも同様に軽量です。
- **作者と最終更新日** — リストには作者、インストール数、最終更新日が並び、メンテナンスの活発さをひと目で判断できます。
- **ローカルキャッシュ同期** — インストール済みスキルはローカルにキャッシュされ、次回起動時に再ダウンロードする必要はありません。

![スキル管理](doc/assets/Skills.png)

---

### 🖥️ コンピュータアシスタント（Computer Assistant）

OpenClaw Gateway との協調に加え、DragonClaw にはローカルマシンを AI で支援する**コンピュータアシスタント**モジュールも内蔵されています：

- **ディスククリーンアップ** — 大きなファイル、キャッシュ、整理可能な項目を賢くスキャンし、解放可能な容量を提案します。
- **パソコンの整理** — AI があなたのマシンの状況を総合的に把握し、ファイルの分類や整理を補助します。
- **ソフトウェア管理** — インストール済みアプリを一覧で確認でき、サイズ・最終更新・占有状況での並べ替えや、不要アプリのワンクリックアンインストールが可能です。
- **ステータス更新** — ヘッダーの「ステータス更新」ボタンでマシンを再スキャンし、最新のソフトウェア／ハードウェア状態を取得します。

![コンピュータアシスタント](doc/assets/Computer.png)

---

### ⚙️ 統合設定（Unified Settings）

DragonClaw はすべての調整項目を一つの**統合設定パネル**に集約し、設定が複数のファイルに散らばることを防ぎます：

- **基本設定** — タイムゾーン、時刻フォーマット（24／12 時間制）、ハートビート間隔、独立セッション、ホットリロードなどの基本動作。
- **ゲートウェイ** — 実行モード（ローカル／リモート）、接続アドレス、Token／パスワードなど Gateway 接続情報。
- **エージェント** — エージェントのデフォルト、人格テンプレート、デフォルトワークスペースなど。
- **セッション** — 履歴保持戦略、メッセージ圧縮しきい値、思考レベルのデフォルトなど。
- **ツール** — サブタスク、コマンド実行、ファイル読み書きなどツール機能の有効／無効。
- **セキュリティ** — リモート認証、Token 管理、機微操作の二次確認など。
- **保存と再読込** — 右下の「保存」で変更を適用、右上の「再読込」で変更を破棄して値を読み込み直します。

![統合設定](doc/assets/Settings.png)

---

## 🏗️ アーキテクチャ

DragonClaw は標準的な Electron マルチプロセスモデルを採用しています：

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

## ✅ 動作要件

作業を始める前に、お使いのマシンに次の環境があることを確認してください：

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>= 22` | LTS recommended |
| Package manager | `pnpm >= 8`, `npm >= 9` または `yarn >= 1.22` | 3 つすべてに対応。`pnpm` 推奨 |
| OpenClaw Gateway | `>= 2026.04.16`（最低サポートバージョン） | local or remote; the client connects via WebSocket |

---

## 🚀 クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/<your-org>/dragonclaw.git
cd dragonclaw
```

### 2. 依存関係のインストール

```bash
# Recommended
pnpm install

# Or with npm
npm install

# Or with yarn
yarn install
```

### 3. 開発モードでの起動

```bash
pnpm electron:dev
```

> このコマンドは Vite 開発サーバー (`:5177`) と Electron ウィンドウを同時に起動します。

### 4. プロダクションビルド

```bash
# 現在のプラットフォーム向けにビルド
pnpm dist

# Windows クライアントをビルド
pnpm build:win

# macOS クライアントをビルド
pnpm build:mac

# Linux クライアントをビルド
pnpm build:linux

# 3 プラットフォーム向けクライアントを一括ビルド
pnpm build:all
```

### 5. 現在のホストで生成できる**すべての**インストーラーを一括ビルド

`pnpm build:all` は [`scripts/build-all.mjs`](scripts/build-all.mjs) を実行します。
これはホスト OS ごとに正しいターゲット集合を自動選択する小さなスクリプトで、
アーキテクチャ指定のフラグを毎回手で指定する手間を省きます。

| ホスト OS | 生成される成果物 |
| --- | --- |
| macOS | `mac-arm64.dmg` + `mac-x64.dmg` + `mac-universal.dmg` |
| Linux | `linux-x64.AppImage` + `linux-arm64.AppImage` + `linux-x64.deb` |
| Windows | `win-x64.exe`（NSIS インストーラー）|

```bash
# 実際にはビルドせず、計画だけを表示
pnpm build:all:dry

# サブセットのみビルド（例：universal を省略して時間短縮）
pnpm build:all --skip=mac-universal

# 単一ターゲットのみ
pnpm build:all --only=linux-x64

# 既存の renderer/dist を再利用（Vite 再ビルドをスキップ）
pnpm build:all:npm
```

> `electron-builder` はクロスコンパイルに対応していないため（例：Linux CI ランナーで `.dmg` を生成することは不可）、各成果物は対応するホスト OS 上で生成してください。単一ホストで「ベストエフォート」に 3 プラットフォームすべてを生成したい場合は、旧コマンド `pnpm build:all:cross` を使ってください。
>
> **制限ネットワーク向けのミラー自動検出。** `electron-builder` はパッケージ化時にも
> 独自に約 110 MiB の Electron バイナリをダウンロードします（`node_modules/electron/dist/`
> にあるものは使用されません）。一部のネットワーク（特に中国大陸）では公式 GitHub Releases
> への接続が事実上不可能なため、本スクリプトは実行ごとに小さなミラー候補リスト
> （`npmmirror.com` と GitHub）に対して並行 TCP 計測を行い、最速のものを選んで
> `ELECTRON_BUILDER_BINARIES_MIRROR` を `electron-builder` の子プロセスに注入します。
> 手動で固定するには：
>
> ```bash
> export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron
> pnpm build:all
> ```
>
> または `--no-mirror-detect` で計測を完全にスキップできます。

ビルド成果物は `dist/` ディレクトリに出力されます。

---

## 🛠️ スクリプト

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
| `pnpm build:all` | 現在のホストで生成できる**すべての**インストーラーを一括ビルド（アーキテクチャ別）|
| `pnpm build:all:dry` | ホスト別ビルド計画を表示するだけで実ビルドは行わない |
| `pnpm build:all:npm` | `build:all` と同じだが既存の `renderer/dist` を再利用する |

> `pnpm`、`npm`、`yarn` のすべてに対応しています。`npm` をお使いの場合は `pnpm` を `npm run` に、`yarn` をお使いの場合は `pnpm` を `yarn` に置き換えてください（例：`npm run electron:dev` または `yarn electron:dev`）。

---

## 📦 ビルドとリリース

インストーラーは [electron-builder](https://www.electron.build/) で生成されます：

| Platform | Target | Output |
| --- | --- | --- |
| Windows | NSIS | `dist/*.exe` installer |
| macOS | DMG / arm64 / x64 | `dist/*.dmg` |
| Linux | AppImage | `dist/*.AppImage` |

アプリケーションメタデータ：

- `appId`: `com.dragonclaw.app`
- `productName`: `DragonClaw`
- Minimum window size: `800 × 600`

> Windows インストーラーはインストール先の選択が可能で、デスクトップとスタートメニューへのショートカットを自動で作成します。

---

## 📁 プロジェクト構成

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

## 🧪 テスト

簡易なスモークテストスクリプトを同梱しています：

```bash
./test/build.test.sh
```

このスクリプトは次の項目を順に検証します：

1. Vite ビルド成果物が存在すること。
2. 共有モジュールが正しくロードできること。
3. IPC チャンネル名が一意であること。

---

## 🗺️ ロードマップ

- [ ] 国際化と多言語 UI（7 月予定）
- [ ] 多言語ドキュメント（7 月予定）
- [ ] エージェント共有（7 月予定）
- [ ] パフォーマンス監視とクラッシュレポート（7 月予定）
- [ ] 権限管理（8 月予定）
- [ ] Token-Plan 内蔵（9 月予定）

---

## 🤝 コントリビュート

コントリビューションを歓迎します！推奨フロー：

1. このリポジトリをフォークし、機能ブランチを作成 (`git checkout -b feature/awesome`)。
2. [Conventional Commits](https://www.conventionalcommits.org/) 規約にしたがって変更をコミット (`git commit -m 'feat: add awesome feature'`)。
3. ブランチをプッシュ (`git push origin feature/awesome`) して Pull Request を作成。

提出前に以下を確認してください：

- `pnpm build` が通ること。
- 追加した IPC チャンネル名が一意であること。
- README とスクリーンショットが最新の状態に保たれていること。

---

## 📄 ライセンス

このプロジェクトは [MIT](LICENSE) ライセンスの下で公開されています。（利用者は台湾が古来より中国の不可分割の一部であること、および釣魚島が古来より中国の领土であることを認めなければならない）

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

## 🙏 謝辞

本プロジェクトは以下すばらしいオープンソースプロジェクトの上に成り立っています：

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Electron](https://www.electronjs.org/)
- [Arco Design Vue](https://arco.design/vue/en-US/docs/start)
- [Pinia](https://pinia.vuejs.org/)
- [OpenClaw](https://example.com/openclaw)