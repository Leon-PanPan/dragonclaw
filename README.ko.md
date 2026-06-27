<div align="center">

<img src="doc/assets/logo-github.png" alt="DragonClaw" width="120" />

# DragonClaw

**OpenClaw 데스크톱 클라이언트 — Electron + Vue 3 + Vite 기반**

🌐 공식 사이트: [http://www.dragonclaw.cc](http://www.dragonclaw.cc)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Framework](https://img.shields.io/badge/framework-Vue%203-42B883.svg?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Build](https://img.shields.io/badge/build-Vite-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [한국어](README.ko.md) · [العربية](README.ar.md) · [Deutsch](README.de.md)

</div>

---

## 🐉 DragonClaw 소개

> **지금까지 나온 OpenClaw 데스크톱 클라이언트 중 최고일지도 모릅니다.**

**DragonClaw**는 [OpenClaw](https://example.com/openclaw) 전용으로 제작된 데스크톱 클라이언트로, OpenClaw 공식 WebSocket 프로토콜 API 위에서 개발되었습니다. **Electron + Vue 3 + Arco Design** 이라는 현대적인 기술 스택으로 구축되었으며, OpenClaw 실행에 필요한 모든 런타임을 함께 제공합니다 — **설치 즉시 동작**. 로컬에 이미 OpenClaw가 설치되어 있다면 DragonClaw가 자동으로 감지해 그대로 활용하므로 마이그레이션 비용은 0 입니다.

DragonClaw는 단순히 Gateway의 "GUI 껍데기"에 그치지 않고, 다음과 같은 **혁신적인 제품 차원의 기능**을 제공합니다:

- 🧠 **에이전트 관리** — 에이전트 목록/생성/수정/삭제와 에이전트별 워크스페이스 파일 읽기/쓰기.
- 🧩 **스킬 센터** — 추천 스킬 탐색, 전체 카탈로그 검색, 원클릭 설치/제거.
- 💬 **멀티 대화** — 여러 세션을 병렬로 운영하며 스마트 그룹화, 고정, 미읽음 표시, 완전한 이력을 제공.
- 📁 **세션 단위 워크스페이스** — 대화 화면에서 현재 세션의 작업 디렉터리를 직접 설정. OpenClaw가 생성한 모든 결과물은 그 워크스페이스 안에만 머무르며 다른 공간을 오염시키지 않습니다.
- 🌳 **서브태스크** — 메인 에이전트가 생성한 서브태스크와 하위 세션의 실행 과정을 실시간으로 시각화.
- 📚 **모델 설정** — OpenAI, Anthropic, DeepSeek, Grok, OpenRouter, Groq, Moonshot, Alibaba, Ollama, ModelBus, 커스텀 등 주요 Provider를 기본 내장.
- 🏪 **Agents Store** — 온라인에서 적합한 Agents를 골라, 그 Agent가 필요로 하는 스킬까지 한 번의 클릭으로 로컬에 설치.
- 📋 **칸반** — 여러 에이전트에 걸친 작업을 정리하는 태스크 보드.
- 📜 **로그 패널** — 앱에서 바로 Gateway의 실시간 로그를 tail.
- ⚙️ **통합 설정** — 기본, 게이트웨이, 에이전트, 세션, 도구, 보안을 한 화면에 모음.
- 🔄 **업데이트 감지** — 실행 시 자동으로 DragonClaw 자체, OpenClaw, Node.js 등 구성 요소의 업데이트를 점검.
- 🌐 **원격 접속** — LAN 안 또는 원격 서버의 OpenClaw Gateway에 토큰 또는 비밀번호로 안전하게 연결.

> 📖 기능별 상세 설명(대화, 워크스페이스, 서브태스크, 모델 설정, Agents Store, 업데이트 감지, 원격 접속)은 아래 [🔍 기능 심층 살펴보기](#-기능-심층-살펴보기) 섹션을 참고하세요.

---

## 🔍 기능 심층 살펴보기

DragonClaw의 가장 차별화된 기능과 그 활용 시나리오를 좀 더 자세히 살펴봅니다.

### 💬 대화 (Conversation)

대화 패널은 DragonClaw의 핵심입니다. 단순한 채팅 창이 아니라, **완전한 멀티 세션 협업 시스템**입니다:

- **병렬 세션** — 여러 대화를 동시에 열어 각기 다른 에이전트/작업에 연결 가능. 사이드바에서 원클릭으로 전환하며 상태가 서로 격리됩니다.
- **스마트 그룹화** — 과거 세션을 *오늘*, *어제*, *이번 주*, *그 이전* 으로 자동 분류해 리스트를 깔끔하게 유지.
- **고정과 미읽음** — 중요한 세션은 고정, 미읽음 세션에는 빨간 점 표시. 툴바에서 빠르게 찾을 수 있습니다.
- **스트리밍 출력** — 모델의 답변이 타자기 효과로 실시간 렌더링되며, 사고 과정과 도구 호출 결과가 인라인으로 표시됩니다.
- **기록 스크롤백** — 상단으로 스크롤하면 더 오래된 메시지를 지연 로드; 어떤 기록도 잘리지 않습니다.
- **메시지 작업** — 복사, 인용, 삭제, 세션 압축 등 로컬 작업을 모두 지원.
- **사고 수준** — 상단 바에서 추론 강도(높음/중간/낮음)를 골라 지연 시간과 품질을 유연하게 조절.
- **서브태스크 시각화** — 메인 에이전트가 시작한 서브태스크와 하위 에이전트는 관련 메시지 그룹 안에 컴팩트한 카드로 표시되어, 담당 에이전트와 실시간 상태를 한눈에 파악.

#### 📁 세션 단위 워크스페이스 (Session-level Workspace)

> **DragonClaw의 워크스페이스는 세션 단위이며, 다른 공간을 절대 오염시키지 않습니다.** 대화 화면에서 현재 세션에 작업 디렉터리를 직접 바인딩할 수 있으며, 각 세션은 자신만의 워크스페이스를 가집니다. OpenClaw가 해당 세션에서 읽고 쓰거나 생성한 모든 결과물은 워크스페이스 안에서만 머무르며, 다른 디렉터리나 전역 공간으로 새어나가지 않습니다.

워크스페이스는 에이전트 전체에 전역으로 묶이는 것이 아니라 **현재 세션**에 바인딩됩니다. 따라서 같은 에이전트를 쓰는 두 세션이라도 완전히 다른 폴더를 사용할 수 있습니다.

- **대화 화면에서 설정** — 입력 바의 워크스페이스 버튼을 눌러 폴더를 선택하면 활성 세션에 즉시 바인딩됩니다.
- **세션 단위 스코프** — 경로는 세션 키(`projectSpace`)에 저장되어, 세션을 전환하면 전역 공유 폴더가 아니라 각 세션의 작업 디렉터리가 표시됩니다.
- **컨텍스트 자동 종속** — 그 세션에서 발생하는 모든 파일 읽기/쓰기와 셸 명령은 워크스페이스를 루트로 사용하므로, 에이전트가 "어디에 저장할까요?" 라고 반복 묻지 않아도 됩니다.
- **열기/재바인딩** — 현재 워크스페이스는 항상 입력 바에 표시되며, 클릭하면 시스템 파일 관리자에서 열거나, 언제든 새 디렉터리로 바꿀 수 있습니다.
- **미설정 경고** — 워크스페이스가 설정되지 않은 경우 입력 바가 강조 표시되어 잘못된 작업을 방지합니다.

![대화 화면](doc/assets/Session.png)

#### 🌳 서브태스크 (Sub-tasks)

메인 에이전트가 서브태스크나 하위 에이전트를 만들면 DragonClaw는 이를 자동으로 추적해 다양한 방식으로 보여줍니다:

- **메시지 인라인 보기** — 원본 메시지 바로 아래에 서브태스크 카드를 표시하며, 실행 에이전트, 태스크 제목, 실시간 상태를 함께 보여줍니다.
- **우측 사이드바 요약** — 사이드바를 열면 현재 세션에서 시작된 모든 서브태스크와 완료 상태를 한 번에 확인할 수 있습니다.
- **실시간 상태 동기화** — `pending` → `done` 으로 가는 상태 전이가 Gateway의 이벤트에 맞춰 실시간으로 갱신됩니다.

---

### 🧠 모델 설정 (Model Configuration)

모델 설정은 DragonClaw가 빛을 발하는 또 다른 영역입니다. 일반적인 OpenClaw는 `config.json`을 손으로 편집해야 하지만, DragonClaw는 **완전 그래픽 모델 관리 경험**을 제공하며, **주요 모델 공급자를 기본 내장**하고 있습니다:

- **주요 Provider 기본 내장** — OpenAI, Anthropic, DeepSeek, Grok, OpenRouter, Groq, Moonshot, Alibaba, Ollama, ModelBus, 그리고 완전히 커스터마이즈 가능한 "Custom Provider" — 모두 사전 구성되어 별도의 수동 설정이 필요 없습니다.
- **다중 Provider 통합 관리** — 수십 개 벤더를 한 화면에서 관리하고, 세션 상단에서 수 초 만에 메인 모델을 전환.
- **Provider 그룹화 보기** — Provider 별로 자동 그룹화되어 로고, 모델 수, 컨텍스트 길이가 한눈에 보입니다.
- **풍부한 모델 메타데이터** — `models.dev` 카탈로그에서 컨텍스트 윈도우, 지원 기능(도구 호출, 비전 등), 가격 등급 등을 자동 수집.
- **시각적 CRUD** — 모델 추가는 ID, 표시 이름, 최대 토큰 수 등 몇 개 필드만 채우면 끝. JSON을 직접 쓸 필요 없음.
- **API Key와 BaseURL 분리** — Provider마다 자격 정보와 접속 주소를 독립적으로 보관해 서로 섞이지 않음.
- **로컬 모델도 1등 시민** — Ollama가 `http://127.0.0.1:11434/v1` 엔드포인트로 사전 구성되어 로컬 LLM이 바로 동작.
- **세션 단위 즉시 전환** — 상단 바에서 대화별 메인 모델을 변경할 수 있으며, Gateway 재시작이 필요 없습니다.

![모델 설정](doc/assets/Models.png)

---

### 🏪 Agents Store

> **온라인에서 적합한 Agents를 골라, 필요한 스킬과 함께 한 번의 클릭으로 로컬에 설치하세요 — GitHub에서 템플릿을 손으로 클론하는 일은 이제 그만.**

DragonClaw는 내장된 **Agents Store**를 제공하여, 애플리케이션에서 바로 에이전트와 그 에이전트가 의존하는 스킬까지 함께 탐색하고 설치할 수 있습니다:

- **온라인 카탈로그** — 공식과 커뮤니티가 정성 들여 관리하는 에이전트 카탈로그를 앱에서 바로 탐색.
- **작업에 맞는 Agent 선택** — 시나리오(개발, 글쓰기, 오피스, 운영 등)로 필터링하여 로컬에 이미 깔린 에이전트에 억지로 맞추지 말고, **가장 잘 맞는 에이전트를 고르세요**.
- **Agent와 스킬을 함께 원클릭 설치** — 대상 에이전트를 선택하면 그 에이전트가 필요로 하는 모든 스킬이 함께 설치되므로, 의존성을 일일이 손으로 해결할 필요가 없습니다.
- **로컬 맞춤 설정** — 설치 과정이 완전히 시각적입니다: 아바타 선택, ID 네이밍, 작업 디렉터리 바인딩, 페르소나 설명 등.
- **"내가 만든 에이전트" 보기** — 전용 탭에서 자신이 만든 모든 에이전트를 한눈에 보고, 편집·삭제·조회.
- **온라인 업데이트** — 설치된 에이전트에 새 버전이 나오면 한 번의 클릭으로 최신 버전으로.

![에이전트 스토어](doc/assets/Agents-Store.png)

---

### 🔄 업데이트 감지 (Update Detection)

DragonClaw는 **원스톱 구성 요소 업데이터**를 내장하여, **실행 시 자동으로 점검**하므로 여러 생태계의 버전 번호를 따로 비교하는 번거로움을 덜어줍니다:

- **실행 시 자동 점검** — DragonClaw를 시작할 때마다 자동으로 DragonClaw 자체, OpenClaw, Node.js 등 여러 구성 요소의 최신 버전을 단 한 번의 요청으로 가져옵니다.
- **서명된 소스** — `config.json`의 `api.versionCheck` 엔드포인트에 `sign=dragonclaw` 식별자로 조회.
- **명확한 알림** — 새 버전이 있을 때 사이드바와 설정 페이지가 changelog 링크와 함께 명확한 알림을 표시.
- **앱 내 다운로드·설치** — 다운로드, 설치, 교체를 앱 안에서 모두 처리하며 메인 창을 막지 않습니다.
- **롤백 안전성** — 다운로드 실패나 서명 불일치가 기존 설치를 손상시키지 않으므로, 흰 화면에 갇히지 않습니다.

---

### 🌐 원격 접속 (Remote Access)

OpenClaw Gateway가 LAN 안의 다른 머신에 있든, 원격 서버·사내 장치·가정용 NAS에 있든, DragonClaw는 **토큰** 또는 **비밀번호**로 안전하고 유연하게 연결합니다:

- **원클릭 전환** — 메뉴에서 "원격 모드"를 선택하거나 사이드바에서 직접 토글. 수 초 만에 대상 Gateway에 연결됩니다.
- **유연한 인증** — 토큰 기반과 비밀번호 기반 인증을 모두 지원해 다양한 Gateway 보안 정책에 부합.
- **실시간 연결 표시기** — 사이드바에 *연결 중 / 연결됨 / 연결되지 않음* 이 실시간으로 표시되며, 수동 재연결 버튼이 제공됩니다.
- **로컬과 동일한 UX** — 일단 연결되면 모든 기능(에이전트, 세션, 스킬, 설정, 로그 등)이 로컬 모드와 똑같이 동작.
- **연결 테스트** — 전환 전에 대상 호스트의 도달 가능 여부를 미리 점검해 잘못된 설정으로 시간을 낭비하지 않습니다.
- **구성 영구 저장** — 원격 주소, 포트, 토큰은 로컬에 암호화되어 저장되며 다음 실행 때 자동으로 복원됩니다.

> 💡 원격 장치에 공인 IP가 없다면 Tailscale, ZeroTier, frp 같은 터널링/NAT 통과 솔루션과 함께 사용하세요.

---

### 📋 칸반 (Kanban)

작업을 여러 에이전트가 병렬로 협업하도록 나눠야 할 때, DragonClaw의 **칸반**은 모든 작업을 하나의 태스크 보드로 펼쳐 보여줍니다:

- **다중 칼럼 흐름** — 에이전트당 한 칼럼이며, 태스크는 칼럼 안에서 진행됩니다. 에이전트를 가로지르는 협업이 한눈에 들어옵니다.
- **실시간 새로 고침** — 메인 에이전트가 만든 서브태스크와 하위 에이전트의 실행 결과가 해당 카드에 즉시 반영됩니다.
- **상태 시각화** — 대기/실행 중/오류/완료 등을 서로 다른 마커로 보여주어 병목 지점을 빠르게 찾을 수 있습니다.
- **원클릭 새로 고침** — 헤더의 "새로 고침" 버튼으로 푸시를 기다리지 않고도 능동적으로 최신 상태를 가져옵니다.

![칸반](doc/assets/Board.png)

---

### 🧩 스킬 관리 (Skill Management)

OpenClaw의 스킬 생태계는 방대합니다. DragonClaw는 이를 **완전 그래픽 스킬 센터**로 감싸 손으로 설정할 필요 없이 다룰 수 있게 합니다:

- **추천/전체/관리 탭** — 상단의 세 탭을 오가며, 초보자는 추천에서, 숙련자는 전체에서 발굴할 수 있습니다.
- **키워드 검색** — 검색창에 키워드를 입력하면 스킬을 필터링하며, 다국어 태그도 매칭에 포함됩니다.
- **원클릭 설치/제거** — 모든 스킬 카드에 "설치/제거" 버튼이 있어 롤백과 재설치 모두 가볍게 처리됩니다.
- **작성자와 최근 업데이트** — 목록에 작성자, 설치 수, 최근 업데이트가 함께 표시되어 유지보수 활성도를 한눈에 판단할 수 있습니다.
- **로컬 캐시 동기화** — 설치가 끝난 스킬은 로컬에 캐시되어 다음 실행 시 다시 내려받지 않습니다.

![스킬 관리](doc/assets/Skills.png)

---

### 🖥️ 컴퓨터 어시스턴트 (Computer Assistant)

OpenClaw Gateway와의 협업 외에도, DragonClaw에는 로컬 머신에 AI 기능을 가져오는 **컴퓨터 어시스턴트** 모듈이 내장되어 있습니다:

- **디스크 정리** — 대용량 파일, 캐시, 정리 가능 항목을 지능적으로 스캔해 확보 가능한 공간을 알려줍니다.
- **컴퓨터 정리** — AI가 머신의 상황을 종합적으로 파악해 파일 분류와 정리를 도와줍니다.
- **소프트웨어 관리** — 설치된 앱을 한 화면에서 확인하고, 크기·최근 업데이트·점유 현황별로 정렬할 수 있으며, 더 이상 필요 없는 앱은 원클릭으로 제거할 수 있습니다.
- **상태 새로 고침** — 헤더의 "상태 새로 고침" 버튼으로 머신을 다시 스캔해 최신 소프트웨어/하드웨어 상태를 가져옵니다.

![컴퓨터 어시스턴트](doc/assets/Computer.png)

---

### ⚙️ 통합 설정 (Unified Settings)

DragonClaw는 조정 가능한 모든 항목을 하나의 **통합 설정 패널**로 모아 설정이 여러 파일에 흩어지지 않게 합니다:

- **기본 설정** — 시간대, 시간 형식(24/12시간제), 하트비트 간격, 독립 세션, 핫 리로드 등 기본 동작.
- **게이트웨이** — 실행 모드(로컬/원격), 연결 주소, 토큰/비밀번호 등 Gateway 연결 정보.
- **에이전트** — 에이전트 기본값, 페르소나 템플릿, 기본 워크스페이스 등.
- **세션** — 기록 보존 정책, 메시지 압축 임계값, 사고 수준 기본값 등.
- **도구** — 서브태스크, 명령 실행, 파일 읽기/쓰기 등 도구 기능의 활성화 여부.
- **보안** — 원격 인증, 토큰 관리, 민감 작업의 2차 확인 등.
- **저장과 다시 불러오기** — 오른쪽 아래의 "저장"으로 변경을 적용하고, 오른쪽 위의 "다시 불러오기"로 변경을 버리고 값을 다시 읽어옵니다.

![통합 설정](doc/assets/Settings.png)

---

## 🏗️ 아키텍처

DragonClaw는 표준적인 Electron 다중 프로세스 모델을 따릅니다:

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

- **Renderer** — Vite와 Arco Design Vue로 구축된 Vue 3 SPA.
- **Main** — 창, IPC 핸들러, OS 통합을 담당하는 Electron 메인 프로세스.
- **Preload** — 렌더러에 최소한의 타입 안전 API를 노출하는 얇은 `contextBridge` 계층.
- **Gateway** — WebSocket RPC로 데스크톱 클라이언트와 통신하는 OpenClaw Gateway 프로세스.

---

## ✅ 요구 사항

시작하기 전에 다음 환경이 준비되어 있는지 확인하세요:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | `>= 22` | LTS recommended |
| Package manager | `pnpm >= 8`, `npm >= 9` 또는 `yarn >= 1.22` | 세 가지 모두 지원; `pnpm` 권장 |
| OpenClaw Gateway | `>= 2026.04.16` (최소 지원 버전) | local or remote; the client connects via WebSocket |

---

## 🚀 빠른 시작

### 1. 저장소 클론

```bash
git clone https://github.com/<your-org>/dragonclaw.git
cd dragonclaw
```

### 2. 의존성 설치

```bash
# Recommended
pnpm install

# Or with npm
npm install

# Or with yarn
yarn install
```

### 3. 개발 모드로 실행

```bash
pnpm electron:dev
```

> 이 명령은 Vite 개발 서버(`:5177`)와 Electron 창을 함께 실행합니다.

### 4. 프로덕션 빌드

```bash
# 현재 플랫폼용 빌드
pnpm dist

# Windows 클라이언트 빌드
pnpm build:win

# macOS 클라이언트 빌드
pnpm build:mac

# Linux 클라이언트 빌드
pnpm build:linux

# 세 플랫폼 클라이언트를 한 번에 빌드
pnpm build:all
```

빌드 산출물은 `dist/` 디렉터리에 생성됩니다.

---

## 🛠️ 스크립트

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
| `pnpm build:all` | Build installers for all three platforms |

> `pnpm`, `npm`, `yarn` 세 가지 모두 지원합니다. `npm`을 사용한다면 `pnpm`을 `npm run`으로, `yarn`을 사용한다면 `pnpm`을 `yarn`으로 바꾸세요 (예: `npm run electron:dev` 또는 `yarn electron:dev`).

---

## 📦 빌드 및 배포

인스톨러는 [electron-builder](https://www.electron.build/)로 생성됩니다:

| Platform | Target | Output |
| --- | --- | --- |
| Windows | NSIS | `dist/*.exe` installer |
| macOS | DMG / arm64 / x64 | `dist/*.dmg` |
| Linux | AppImage | `dist/*.AppImage` |

애플리케이션 메타데이터:

- `appId`: `com.dragonclaw.app`
- `productName`: `DragonClaw`
- 최소 창 크기: `800 × 600`

> Windows 인스톨러는 설치 경로를 선택할 수 있고, 바탕화면과 시작 메뉴의 바로가기를 자동으로 만듭니다.

---

## 📁 프로젝트 구조

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

## 🧪 테스트

간단한 스모크 테스트 스크립트가 포함되어 있습니다:

```bash
./test/build.test.sh
```

이 스크립트는 다음을 차례로 확인합니다:

1. Vite 빌드 산출물의 존재 여부.
2. 공유 모듈의 정상 로드 여부.
3. IPC 채널 이름의 유일성.

---

## 🗺️ 로드맵

- [ ] 국제화 및 다국어 UI (7월 예정)
- [ ] 다국어 문서 (7월 예정)
- [ ] 에이전트 공유 (7월 예정)
- [ ] 성능 모니터링 및 크래시 리포팅 (7월 예정)
- [ ] 권한 제어 (8월 예정)
- [ ] Token-Plan 내장 (9월 예정)

---

## 🤝 기여 가이드

기여를 환영합니다! 권장 절차:

1. 이 저장소를 포크하고 기능 브랜치를 만듭니다 (`git checkout -b feature/awesome`).
2. [Conventional Commits](https://www.conventionalcommits.org/) 규칙에 따라 변경 사항을 커밋합니다 (`git commit -m 'feat: add awesome feature'`).
3. 브랜치를 푸시 (`git push origin feature/awesome`) 하고 Pull Request를 엽니다.

제출 전 확인 사항:

- `pnpm build`가 통과합니다.
- 새 IPC 채널 이름이 유일합니다.
- README와 스크린샷이 최신 상태로 유지됩니다.

---

## 📄 라이선스

이 프로젝트는 [MIT](LICENSE) 라이선스 하에 배포됩니다.

---

## 🙏 감사의 말

이 프로젝트는 다음 거인들 위에 서 있습니다:

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Electron](https://www.electronjs.org/)
- [Arco Design Vue](https://arco.design/vue/en-US/docs/start)
- [Pinia](https://pinia.vuejs.org/)
- [OpenClaw](https://example.com/openclaw)
