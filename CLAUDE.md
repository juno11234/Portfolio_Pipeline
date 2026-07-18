# Portfolio_Pipeline

기존 Unity/C# 프로젝트들을 포트폴리오 사이트로 정리하는 **빌드 파이프라인**.
이 저장소는 Unity 프로젝트가 아니다. Unity 프로젝트는 이 파이프라인의 *대상*이며, 이 저장소 밖에 있다.

## 전역 CLAUDE.md와의 관계

전역 `~/.claude/CLAUDE.md`는 Unity/C# 프로젝트 기준으로 작성되어 있다.
이 저장소에서는 **아래 항목이 적용되지 않는다.**

- **C# 코딩 규칙** (`var` 금지, 접근 제어자 명시, `/// <summary>` 등) — 이 저장소에 C# 코드는 없다. 대신 아래 "코딩 규칙"을 따른다.
- **에이전트 워크플로** (planner / builder / reviewer / advisor) — 이 저장소에서는 사용하지 않는다. 규모가 작고 코드가 단순해 에이전트 오버헤드가 더 크다. 해당 에이전트들은 Unity 프로젝트 작업 시에만 사용한다.
- **`Assets/Ignore/Task/...` 문서 경로** — 이 저장소에 `Assets/` 폴더는 없다. 작업 계획·리뷰 문서를 남기지 않는다.

**계속 적용되는 항목:**

- 파일 수정 전 사용자에게 확인한다. 명시적 허락 없이 파일을 수정하지 않는다.
- 대화 요약본의 'Optional Next Step', 'Pending Tasks' 등 제안 항목은 사용자의 명시적 지시 없이 실행하지 않는다.

## 기술 스택

- **Astro 7** — 정적 사이트 생성기. HTML 디자인을 변환 없이 레이아웃으로 흡수할 수 있고, 결과물이 순수 정적 HTML이라 무료 호스팅이 가능하다.
- **TypeScript** — 파이프라인 코드 전부.
- **Content Collections + Zod** — 콘텐츠 스키마 정의 및 검증.

Astro는 메이저 버전마다 Content Collections API가 바뀌었다. 기억에 의존하지 말고
공식 문서(`docs.astro.build`)를 확인한다. 현재 쓰는 API는 다음과 같다.

```ts
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';  // 로더 기반
import { z } from 'astro/zod';               // zod 직접 설치 아님
```

### 직접 만든 것

- **`src/lib/rich.ts`** — 문장 안 강조. `**굵게**` 와 `` `코드` `` 두 가지만 연다.
  두 디자인에서 볼드가 91군데 쓰였고 전부 수치나 핵심 용어를 짚는 용도였다.
  마크다운 전체를 열지 않은 이유: 표·목록·제목까지 허용하면 **스키마가 검사 못 하는 구조가
  문장 안으로 숨어든다.** 구조는 블록이 갖고 문장은 강조만 한다.
  HTML 을 먼저 이스케이프하고 마크업을 연다. 순서가 반대면 콘텐츠로 태그를 주입할 수 있다.

- **`src/lib/mermaid.ts`** — Mermaid 를 **빌드 시점에 SVG 로 굽는다.** 브라우저로 나가는 JS 는 0이다.
  `mermaid-isomorphic` + `playwright`(개발 의존성, 배포물에 안 들어감).
  렌더러는 모듈 수준에 하나만 두고 결과를 캐시한다 — 안 그러면 다이어그램마다 브라우저가 뜬다.
  실패하면 예외를 던진다. 깨진 채 배포되느니 빌드가 멈추는 게 낫다.
  테마는 사이트 3색에 맞춰뒀다. 기본 테마를 두면 그 다이어그램만 딴 세상이 된다.

  **손으로 배치한 그림에는 쓰지 않는다.** 계층도·UML 은 자동 배치로 같은 그림이 안 나온다.
  Mermaid 는 관계가 많아 손으로 그리면 품이 드는 것(클래스·시퀀스·플로우)에만 쓴다.

## 핵심 설계 원칙

이 파이프라인의 존재 이유는 두 가지다. **일정한 퀄리티**와 **확장 가능성**.
아래 세 원칙이 그 두 가지를 구조적으로 보장한다. 코드를 고칠 때 이 원칙을 깨뜨리지 않는지 먼저 확인한다.

### 1. 3층 분리

```
데이터층  콘텐츠 파일 (프로젝트별 메타데이터 + 본문)
   ↓
템플릿층  레이아웃 1벌 (사용자가 제공하는 디자인)
   ↓
빌드층    데이터 × 템플릿 → 정적 HTML
```

각 층은 독립적으로 변경 가능해야 한다.
프로젝트를 추가할 때 템플릿을 건드리면 안 되고, 디자인을 바꿀 때 콘텐츠를 건드리면 안 된다.

### 2. 스키마가 품질 게이트다

"일정한 퀄리티"는 사람의 성실함이 아니라 **빌드 실패**로 강제한다.
필수 항목이 빠진 프로젝트는 사이트에 올라가지 않고 빌드가 깨져야 한다.

- 스키마는 `src/content.config.ts` 한 곳에서만 정의한다.
  (Astro 7 경로다. `src/content/config.ts`는 Astro 4까지의 옛 경로이므로 헷갈리지 않는다.)
- 필수 항목을 optional로 완화해서 빌드를 통과시키지 않는다. 그건 게이트를 무력화하는 것이다.
- 스키마를 바꾸는 것은 포트폴리오의 품질 기준을 바꾸는 일이다. 반드시 사용자에게 확인한다.

### 3. 프로젝트 추가 = 콘텐츠 파일 1개 추가

새 프로젝트를 넣는 데 코드 수정이 필요하다면 그 설계는 틀린 것이다.
프로젝트 개수가 10개로 늘어도 코드는 그대로여야 한다.

## 코딩 규칙

전역 CLAUDE.md의 C# 규칙을 TypeScript에 맞게 옮긴 것이다. 원 규칙의 *의도*를 유지한다.

- **타입을 명시한다.** 함수의 매개변수와 반환 타입은 항상 명시한다. 지역 변수는 추론에 맡겨도 되지만 추론 결과가 불명확하면 명시한다.
- **`any` 금지.** 타입을 모르겠으면 `unknown`으로 두고 좁힌다.
- **truthiness에 의존하지 않는다.** 불리언이 아닌 값을 조건문에 그대로 넣지 않는다. `if (list)`가 아니라 `if (list.length > 0)`, `if (value)`가 아니라 `if (value !== undefined)`처럼 무엇을 검사하는지 드러낸다. (원 규칙 "`!` 대신 `== false` 사용"의 의도 = 조건을 명시적으로 읽히게 할 것)
- **내보낼 것만 `export` 한다.** 모듈 외부에서 쓰지 않는 것은 export하지 않는다. (원 규칙 "접근 제어자 명시"의 의도 = 공개 범위를 좁게 유지할 것)
- **export하는 함수·타입에 한국어 TSDoc 주석**(`/** ... */`)을 작성한다.
- 람다(화살표 함수)는 JS에서 관용적이므로 근거 주석은 불필요하다. 단, 복잡한 체이닝은 중간 단계에 이름을 붙여 풀어쓴다.

## 원본 자료

사이트의 모든 내용은 사용자가 만든 아래 문서에서 나온다. 내용을 지어내지 않는다.

| 자료 | 위치 | 쓰임 |
| --- | --- | --- |
| 포트폴리오 (25p, 16:9) | `~/Downloads/유니티_포트폴리오_이주노.pdf` | 기술스택, 링크, 프로젝트 메타 |
| 자기소개서 (8p, 16:9) | `~/Downloads/자기소개서.pdf` | `/about` 페이지 |
| 이력서 (실제로는 EUC-KR HTML) | `~/Downloads/이력서_이주노.doc` | 메인 프로필·이력 |
| 뱀서라이크 기술 문서 (30p) | `~/Downloads/뱀서라이크.pdf` | 상세 페이지 + **스크린샷 8장** |
| Bond 기술 문서 (32p) | `~/Downloads/Bond.pdf` | 상세 페이지 + **스크린샷 4장** |
| 취업·기술문서 작성 가이드 (46p) | `~/Downloads/유니티 개발자 취업·기술 문서 작성 가이드 v2 · 발표 덱.pdf` | **품질 기준의 근거** |
| VamSirLike 기술 문서 (md, 1333줄) | `../VamSirLike/Assets/Docs/26_0717_VamSirLike_TechDoc.md` | 커밋 `819a6ca` 기준. 기술 부채의 출처 |
| 프로필 사진 | `src/assets/profile.jpg` (원본 `~/Downloads/s.jpg`) | 메인 히어로 |

**스크린샷은 PDF 에서 뽑는다.** `pdfimages -png -f N -l N <pdf> <prefix>`.
디자인 프로젝트에서 받으면 base64 가 컨텍스트를 거쳐 훨씬 비싸다.
이미 뽑아둔 것: `src/assets/vampire-like/` (8장) · `src/assets/bond/` (4장).

PDF 텍스트는 `pdftotext -enc UTF-8`, 페이지 이미지는 `pdftoppm -png` (poppler 설치됨).
Read 도구는 poppler 를 못 찾으므로 직접 렌더링한 PNG 를 읽는다.

**가이드가 품질 게이트의 근거다.** 스키마에 뭘 필수로 둘지 헷갈리면 가이드를 본다. 핵심 문장:
- "'느리다' 대신 '로딩 15초'처럼 측정 가능한 문제로" → `overview.evidence` 필수
- "'아쉬운 점 없습니다'는 0점" → `retrospective.debt` · `plan` 필수
- "'그냥'은 금지어. 면접관이 가장 보고 싶어 하는 부분" → `decisions` 최소 1건
- "기술 스택은 별점이 아니라 경험으로" → `skills.highlights` 필수
- "폰트 2종, 색 3색" → 미니멀 테마
- "AI 가 못 하는 것: '왜' — 내 실제 의사결정" → **기술 부채·판단 근거를 내가 지어내지 않는다**

**주의:** Downloads 경로는 사라질 수 있다. 저장소로 옮길지 사용자와 정해야 한다.

## 사이트 구조

```
/                    메인 — 히어로(사진·이름·연락처) + 이력 + 기술스택
/about               자기소개서 — 성장과정 · 장단점 · 팀프로젝트 · 목표
/projects/{슬러그}    프로젝트 상세 = 기술 문서
```

**`/projects` 목록 페이지는 없다.** 사이드바가 그 역할을 한다. 사용자가 그렇게 정했다.

사이드바(`Sidebar.astro`)는 **내비게이션 전용**이다. 홈 · 자기소개서 · 대표 프로젝트 4 · 그외 2.
이름·소개·연락처는 사이드바에 두지 않는다 (사용자가 본문 히어로로 옮기라고 했다).
현재 보는 프로젝트 아래에 그 문서의 목차가 펼쳐지고, 스크롤에 따라 현재 섹션이 강조된다.
접으면 60px 레일이 된다. 모바일(≤860px)에서는 고정·접힘을 모두 푼다.

프로젝트 6개 — 대표 4개(뱀서라이크 · **Bond** · 소울라이크 · Starwars Jedi 모티브),
그외 2개(기업협약 프로젝트 · Vermintide 모티브). 키가 곧 주소다: `projects.yaml` 참조.

폭은 `--page-max: 860px` (디자인 원본과 같은 값). 상한이 없으면 사이드바를 접었을 때
카드만 넓어지고 그 안이 빈다.

## 공개하지 않는 개인정보

이력서에는 있지만 **공개 사이트에는 올리지 않는다.** 스키마에 필드 자체를 두지 않아 실수를 막는다.

- 집 상세 주소 (근무 희망 지역인 '서울'까지만 쓴다)
- 생년월일

이메일·전화번호는 사용자가 이미 포트폴리오 표지에 공개해 두었으므로 게시한다.

## 디자인은 claude.ai/design 이 원본이다

디자인을 여기서 **만들지 않는다.** 사용자가 claude.ai/design 에서 만들고, 나는 그것을 옮긴다.

- 프로젝트: `fc9cc71a-4f26-4060-a664-496f5532382e` (이름: "React 기술문서 작성 가이드")
- 파일: `VamSirLike Document.dc.html` · `Bond Document.dc.html`
- 읽는 법: `DesignSync` 도구 (`method: get_file`). 내보내기 필요 없다.
- **스냅샷: `.design-src/`** — 대조용 기준. 손대지 않는다. 자세한 건 그 폴더의 README.
- 옮기는 법: `node scripts/port-design.mjs <design.html> <slug> <title> <desc>`

테마는 **가이드 Part 3의 "미니멀"** 이다 — 3색(배경 `#f7f7f5` · 잉크 `#17181a` · 강조 `#2563eb`),
2폰트(Pretendard · JetBrains Mono). 토큰은 `src/styles/global.css` 한 곳에 있다.

### `src/components/dc/` 규칙 — 마크업을 뜬다, 다시 그리지 않는다

**원본 style 문자열을 한 글자도 바꾸지 않는다.** 눈으로 보고 "비슷하게" 만들면 매번 조금씩
깎여서 결국 원본만 못해진다. 실제로 그렇게 해서 한 번 갈아엎었다.

모양을 바꾸고 싶으면 claude.ai/design 에서 고치고 여기로 다시 떠 온다.

컴포넌트를 뜬 뒤에는 **반드시 원본과 대조한다.** 임시 페이지에 렌더 → 빌드 → `dist` 결과물과
`design.html` 조각을 정규화해 비교. 이 대조로 실제 버그를 세 번 잡았다.
(배지·제목이 딱 붙음 / 인라인 `<code>` 가 원본보다 요란함 / 속성 순서 다름)

측정 근거: 두 디자인의 인라인 style 713개 중 **581개(81%)가 반복**이다. 서로 다른 모양은 283가지뿐.
디자인 자체가 이미 컴포넌트로 짜여 있다는 뜻이라 이 방식이 성립한다.

## 기술 문서 구조 = 가이드 Part 2의 5단

```
① overview       개요        최상위 필수. what · why · evidence · scope
② architecture   시스템 구조  문서당 정확히 하나
③ features[]     핵심 기능    1..N 그룹  ← 배열인 것이 요점
④ decisions      고민과 선택  features[].decisions 또는 최상위. 문서 전체에 최소 1건
⑤ retrospective  결과·회고    최상위 필수. results · troubleshooting · debt · plan
```

**`features` 가 배열인 이유:** 뱀서라이크는 '핵심 기능' 한 덩어리로 끝나지만, Bond 는 기간이 길고
규모가 커서 넷(AI 활용 개발 · 절차적 맵 생성 · 전투 · 연출·이펙트)으로 나눴다.
가운데가 자유로운 게 아니라 **같은 ③ 단계를 프로젝트 크기가 쪼갠 것**이다.
문서 하나만 보고 '가운데는 자유'로 잘못 잡았다가 두 번째 문서가 바로 반증했다.

**`decisions` 배치가 둘인 이유:** Bond 는 결정을 해당 기능 섹션 안에 두고, 뱀서라이크는 규모가 작아
'04 고민과 선택'으로 모아놨다. 둘 다 허용하되 **문서 전체에 하나도 없으면 빌드가 깨진다.**
가이드: "'그냥'은 금지어. 신입에게 기대하는 건 기술력이 아니라 사고 과정."

## 지금 상태

**세 방식이 공존한다. 하나로 줄여야 한다.** 조립본이 두 문서 다 격차 0에 도달했다.

| 경로 | 방식 | 운명 |
| --- | --- | --- |
| `/projects/vampire-like` · `/projects/bond` | 디자인 마크업을 **통째로 박은** 정적 페이지 (각 80KB) | 대조 기준. YAML 이전 후 삭제 |
| `/cmp-vampire-like` · `/cmp-bond` | dc 컴포넌트 **조립본**. 내용이 파일 안에 박혀 있다 | 임시. YAML 이전 후 삭제 |
| `[slug].astro` + `docs/*.yaml` | 스키마 기반. 정적 라우트에 가려 화면에 안 나옴 | **목적지** |

정적 페이지는 `node scripts/port-design.mjs .design-src/vampire-like.dc.html vampire-like "..." "..."`
로 만들었다. dc 런타임 문법과 우리 사이트와 겹치는 부분(문서 사이드바·바깥 여백)만 걷어낸다.

### 대조 결과 — 두 문서 모두 격차 0

정규화 후 **글자 단위 비교**다. 정규화가 접는 것은 문서화된 의도적 차이뿐이다(`.design-src/README.md`).

| 문서 | 섹션 | 챕터 구분선 · 푸터 |
| --- | --- | --- |
| 뱀서라이크 | 01–05 전부 **0** | 4개 · **0** |
| Bond | 01–07 전부 **0** | 6개 · **0** |

파란 볼드(뱀서 66B)는 `rich()` 에 `==해법==` 문법을 더해 해결했다 — 아래 "문장 안 강조" 참조.

### 뜬 컴포넌트 50개

```
구조   SectionHead  ChapterDivider  DocFooter  PartTitle  Lede
개요   Pills  Figure  WhatWhy  GoalCards  OverviewLede  Tldr  StackTable
표     DataTable  MetricsTable  DebtTable  WeightTable  ChannelTable  FormulaTable
그림   Layers  ClassBox  ClassDiagram  Timeline  TurnFlow  EventFlow
       Pipeline  FlowStrip  StepGrid
알약   StateChips  LoopChips  FlowChips  ConditionPills
카드   PrincipleCards  NoteCards  CheckCards  MiniCards  FlowCards  RetroCards
결정   Decision  Counter  DefectList
회고   LessonCard  BeforeAfter  ContrastBox  InsightBox  PlanList
기타   ApiList  Callout  Code  FigureAside  FigureGrid
```

**한 문서만 보고 뜬 컴포넌트를 Bond 가 줄줄이 반증했다.** 이게 "Bond 를 먼저 올려본" 이유이고,
실제로 스키마를 확정하기 전에 올려본 판단이 맞았다. 무엇이 반증됐는지 남긴다:

- `Overview` — 개요 가운데가 문서마다 다르다(뱀서 WHAT/WHY · Bond 목표 카드). 넷으로 쪼갰다.
- `Layers` — 뱀서만 보고 뜬 게 세 군데 틀렸다(세로선 누락 · note 색 · 노드 변종).
  Bond 가 또 셋을 반증했다(헤더 letter-spacing · **카드 계층** · **엣지 라벨**).
- `ClassDiagram`·`ClassBox` — Bond 가 descriptor 상자 · subType 줄 · muted leaf · 캡션 칩 ·
  범례 글리프를 반증. 클래스 다이어그램은 문서마다 가장 많이 다른 블록이다.
- `StackTable` 열 폭 · `PartTitle` margin · `Lede` line-height · `FigureAside` 값 묶음 ·
  `NoteCards` 열·padding·line-height — 전부 뱀서 값을 박아뒀다가 Bond 가 반증해 prop 으로 뺐다.
- `Callout` — 뱀서는 흰·제목 하나뿐인 줄 알았는데 Bond 가 tint · 흰-제목없음 두 조합을 더 드러냈다.

**교훈(두 번 확인됨): 한 사례만 보고 뜨면 그 사례가 예외일 수 있다.** 같은 모양이 문서에
몇 번 나오는지 먼저 세고, 값이 갈리면 그게 prop 이다. 그리고 **두 문서로도 부족할 수 있다** —
나머지 4개 프로젝트가 또 반증할 값이 남아 있다고 보고, prop 을 넉넉히 열어둔다.

### 대조하는 법

```
node <scratchpad>/diff.mjs <슬러그> <섹션id>     예: node diff.mjs vampire-like sec-2
```

베이스라인(`baseline.<슬러그>.html` = 정적 페이지의 dist 결과)과 조립본(`dist/cmp-<슬러그>`)의
같은 섹션을 정규화해 비교한다. 베이스라인이 `.design-src` 원본과 같은지는 확인했다
(뱀서 5섹션 · Bond 7섹션 전부 일치). **기준이 흔들리면 그 위의 판단이 전부 무너지므로
베이스라인을 먼저 검증하고 시작한다.**

정규화는 **문서화된 의도적 차이만** 접는다(`.design-src/README.md`). 정규화를 늘려서
격차를 없애는 것은 대조를 무력화하는 것이다.

### 3번째 문서(SoulLike)로 스키마를 검증했다

두 문서로 스키마를 확정하기 전에 **장르가 다른 3번째(3인칭 소울라이크 액션)** 를 올려봤다.
CLAUDE.md 규율("두 문서로도 부족할 수 있다") 그대로다. 스냅샷 `.design-src/soulslike.dc.html`,
슬러그 `soulslike`(projects.yaml), 베이스라인 `baseline.soulslike.html`(7섹션 원본과 일치 확인).

**결과: 78.3% 가 기존 컴포넌트로 재사용됐다.** 장르가 완전히 다른데도. 남은 새 모양 13개 중
7개는 일회성 도식(FSM·행동트리·타입 계층), 6개는 prop 반증(카드 2열·Code margin 등).
**통 1(규칙 있는 블록)은 하나도 안 늘었다** — 게이트가 안정적이라는 증거다.
개요는 세 번째 조합이 나왔다(리드 문단 + WHAT/WHY 2단) → 개요 가운데를 유연하게 열 근거.

### 스키마를 확정했다 (`content.config.ts`)

**핵심 통찰: 스키마(데이터층)와 dc 컴포넌트 50개(템플릿층)는 다른 것이다.** 기존
`vampire-like.yaml`(482줄, 완성 콘텐츠)이 이미 lean 한 의미 블록 세트를 쓰고 **클래스
다이어그램을 `mermaid` 로** 그리고 있었다. 즉 "그래프는 mermaid" 는 새 정책이 아니라 이미
사용자의 콘텐츠 관행이었다. 그래서 스키마에 그래프 dc 블록(class-diagram·event-flow 등)을
**넣지 않았다** — 그건 mermaid 다. byte-0 로 뜬 손그림 그래프 컴포넌트는 디자인 검증이었고,
파이프라인은 mermaid 로 그린다.

세 통 원칙("검사할 규칙이 있으면 타입, 모양만 다르면 variant, 데이터 모양 다르면 분리")으로
기존 10블록에 **additive** 로 얹었다(기존 YAML 이 계속 통과하도록):

- **추가 블록 3종:** `api-list`(시그니처+반환 필수 — 규칙) · `callout`(곁가지) ·
  `chips`(단방향 인라인 상태/흐름; 분기 생기면 mermaid).
- **variant 필드:** `points`(plain·numbered·check·mini·flow·defect + columns 2/3) ·
  `table`(plain·weight·channel) · `image`(below·aside + width). 모양만 다르고 데이터는 하나.
- **overview 유연화:** `lead?` + (`what`+`why` | `goals`) + evidence·scope 필수.
  superRefine 에 **"what·why 2단 또는 goals 중 하나는 필수"** 게이트 추가.
- **retrospective 유연화:** 서술을 자유 `parts[]` 로 열되 **debt·plan 은 필수 유지**(게이트).
  `results` 는 optional 로 완화(Bond 처럼 수치 결과 없는 문서 허용).
- **`points` 이름 유지** — 기존 YAML 이 쓰고 있어 안 바꿨다. Counter(역제안)는 decision 으로,
  DefectList 는 `points` variant='defect' 로 흡수(새 블록 아님).

게이트는 **빌드 실패로 실증**했다 — debt 를 비우니 `retrospective.debt: Too small` 로 빌드가 깨졌다.

### 파이프라인이 실제로 돈다 — `[slug]` 재배선 + Bond YAML 완료

**`docs/*.yaml` × `[slug].astro` × dc 컴포넌트 → 정적 HTML** 이 작동한다. 검증:
- 뱀서라이크: `vampire-like.yaml` → `[slug]` 렌더 17/17 마커 통과.
- Bond: `bond.yaml`(새로 씀) → `[slug]` 렌더 **21/21 마커 통과**. mermaid 2개(클래스도·전투 플로우) 파랑 테마로 구워짐.

**`DocBlock.astro` 가 이제 dc 디스패처다.** 블록 `type`+`variant` → dc 컴포넌트로 보내고,
스키마↔dc 모양 차이를 어댑터로 잇는다(예: `code.api`→Code `source`, `table` string[][]→DataTable
`{label,cells}`, `image.variant`→Figure/FigureAside). `[slug].astro` 는 구조(SectionHead·
ChapterDivider·PartTitle·DocFooter)와 개요 조각(Pills·Figure·WhatWhy/OverviewLede/GoalCards·Tldr)을
dc 로 그리고 본문은 DocBlock 에 넘긴다.

**이 턴에 스키마를 additive 로 더 넓혔다**(기존 YAML 계속 통과):
`part.badge?`(없으면 h3) · `layers` 아이템 `kind`(점선)·`body`(카드) · 섹션 `intro?`(헤더 아래 문단).

**Bond 매핑에서 내린 판단**(다음 문서도 일관되게):
- 역제안(Counter) → `decision`(A=AI제안 vs B=역제안 채택). 게이트도 만족.
- 아쉬운 점(RetroCards) → `debt`·`plan` 리스트. 잘한점(대조·통찰) → retrospective `parts`.
- 셰이더 2장(FigureGrid) → `image` 2개 세로. Code `notes` → 코드 주석에서 유도(지어낸 것 아님).
- **손실 인정:** layers 노드 `note`(«IFighter» 등)는 dc 알약이 안 보여줘 드롭. 그래프는 전부 mermaid.

### 아직 실행 안 한 것 (다음 할 일)

1. **`soulslike.yaml` 을 쓴다.** `#2` 의 나머지 절반. Bond 와 같은 방식(그래프=mermaid).
   내용 출처: `.design-src/soulslike.dc.html`(7섹션) + gap 분석(78.3% 재사용). FSM·행동트리·타입
   계층은 손그림 조립 없이 **mermaid**(stateDiagram·flowchart·classDiagram)로 그린다.
   **meta 는 PDF 에서 확인함**(지어내지 말 것): `1인 · 2025.11.10 ~ 11.30 · Github Desktop ·
   Unity 6000.0.56f1 · URP · Rider 2025.1.4`. 빌드는 `Jenkins CI`(sec-7). 슬러그 `soulslike`.
2. **여백을 렌더러로 옮긴다** — 사실 `[slug]`/`DocBlock` 에서 이미 블록 종류·위치별 규칙으로 준다.
   미세 조정만 남았다(디자인의 자리별 값과 정확히는 다름).
3. **정적 페이지 · `cmp-*` 를 지운다.** vampire·bond·soulslike 정적 페이지, cmp-vampire-like·
   cmp-bond, `src/pages/cmp-*` 전부. YAML 세 개가 다 서고 나면. **삭제라 사용자 확인 필수.**
   (참고: 검증하며 vampire·bond 정적 페이지를 잠시 옆으로 치웠다가 원복했다. 백업이 scratchpad 에
   `vampire-like.static.astro.bak`·`bond.static.astro.bak` 로 있다. git 에도 있으니 삭제는 안전.)

**정적 페이지가 라우트를 가린다.** `/projects/{슬러그}` 는 정적 페이지(우선순위 높음)가 먼저 서고
`[slug]`+YAML 은 가려진다. YAML 렌더를 화면에서 보려면 정적 페이지를 잠깐 치우고 빌드한다
(`mv src/pages/projects/{슬러그}.astro <scratchpad>/`). 빌드 경고가 "conflicts with higher priority
route" 로 알려준다. 최종 정리(3번)에서 정적 페이지를 지우면 자동으로 [slug] 로 전환된다.

**대조 하네스는 그대로 쓸 수 있다** — `<scratchpad>/diff.mjs <슬러그> <섹션>`.
베이스라인 `baseline.{vampire-like,bond,soulslike}.html` 셋 다 원본과 일치 확인됨.
단 이건 **cmp 조립본**(디자인 byte-0)용이다. YAML→[slug] 렌더는 콘텐츠가 더 풍부해 디자인과
byte-0 가 아니다(그래프도 mermaid). YAML 렌더는 마커 검증으로 확인한다.

### 확정된 결정

- **파란/빨간 볼드는 `rich()` 문법이다.** `==해법==`(#1d4ed8) · `!!실패!!`(#b91c1c).
  세 문서 대조로 색이 무슨 일을 하는지 세어 정했다 — 파랑=내가 고른 해법·기제, 빨강=실패·버그.
  자세한 건 `src/lib/rich.ts` 주석.
- **그래프 도식은 mermaid 다.** 반복되는 것(Layers 는 규칙 있어 dc 유지)만 예외. 손그림 그래프
  컴포넌트(ClassDiagram·EventFlow·TurnFlow·FSM…)는 디자인 검증용이고 파이프라인엔 안 들어간다.
- **여백은 렌더러가 규칙으로 정한다** (아직 실행 전). 지금은 컴포넌트가 원본 값을 `margin`
  prop 으로 받고 있다. 이대로 YAML 에 가면 콘텐츠 파일이 CSS 를 들게 되어 "프로젝트 추가 =
  콘텐츠 파일 1개" 와 3층 분리가 둘 다 깨진다. 값에 규칙이 있다 — 섹션 첫 꼭지 vs 나머지,
  그림·표 앞뒤 등. **다만 원본에 흔들림이 있다**(34↔36 · 40↔44 · Bond 의 `8px 0 6px`).
  통일하면 그만큼 격차가 남는다(화면엔 안 보인다). 렌더러 규칙으로 옮길 때 이 흔들림을
  어떻게 처리할지 사용자와 정한다.

### 개요는 넷으로 쪼갰다 — Bond 가 반증한 것을 반영

개요의 **가운데가 문서마다 다르다**(뱀서 WHAT/WHY 2단 · Bond 요약 문단 + 목표 카드).
바깥 격자는 같은데 안에 든 카드가 딴 물건이었다. 그래서 `Overview` 를
`Pills` + `Figure(hero)` + `[WhatWhy | OverviewLede+GoalCards]` + `Tldr` 로 쪼갰다.
의미론으로 스키마(`overview.what`/`why`)는 살아 있다 — Bond 요약 문단이 what, 목표 2장이 why.
깨졌던 건 렌더링이지 데이터 모양이 아니다. YAML 스키마를 짤 때 이 대응을 유지한다.

## 함정 (전부 한 번씩 당한 것)

- **`js-yaml` 은 주석을 보존하지 않는다.** YAML 을 프로그램으로 고치면 주석이 통째로 날아간다.
  세 번 당했다. 고친 뒤 반드시 주석을 되살린다.
- **`node_modules/.astro/data-store.json` 이 콘텐츠를 캐시한다.** `dist` 와 `.astro` 를 지워도
  남는다. 콘텐츠 파일을 옮기거나 지웠는데 반영이 안 되면 이걸 지운다.
- **dev 서버는 새 콘텐츠 파일을 못 잡는다.** 404 가 나면 서버를 재시작한다.
- **Astro 는 태그 사이 개행을 지운다.** 원본에 공백이 있으면 `{' '}` 로 명시해야 한다.
- **브라우저 미리보기가 프레임을 안 그릴 때가 있다.** 그러면 CSS 트랜지션이 진행되지 않아
  측정값이 시작값에 얼어붙는다. 레이아웃을 잴 때는 트랜지션을 끄고 최종값만 본다.
  스크린샷이 통째로 타임아웃 나기도 한다. 그럴 땐 `get_page_text` · 콘솔 · 서버 로그로 확인한다.
  어차피 **마크업 대조가 스크린샷보다 강한 검증**이다.
- **Read 도구는 poppler 를 못 찾는다.** PDF 는 `pdftoppm` 으로 직접 PNG 를 만들어 읽는다.
- **`<section>` 안만 훑으면 섹션 *사이* 를 놓친다.** 챕터 구분선(`CHAPTER 02 / 05`)이 섹션
  바깥에 있어서 처음 구조를 뽑을 때 통째로 빠졌다. 문서 뼈대를 셀 때 최상위를 훑는다.
- **`port-design.mjs` 에 순서 버그가 있다.** `style-hover` 를 CSS 로 뽑는 게 2단계, 디자인 자체
  사이드바를 걷어내는 게 4단계인데 — hover 가 붙어 있던 요소가 전부 그 사이드바 안이었다.
  그래서 정적 페이지에 **아무 요소에도 안 붙는 죽은 CSS 4줄**이 남아 있다. 조립본엔 없다.
- **`set:html` 에 넣기 전에 반드시 이스케이프한다.** `rich()` 를 안 거치는 자리
  (ClassBox 의 필드·메서드 칸처럼 `<br>` 로 잇는 곳)는 `escapeHtml()` 을 직접 부른다.
  C# 제네릭(`Queue<InGameEvent>`)이 태그로 샌다. 실제로 그랬다.

## 아직 정해지지 않은 것

작업 전 이 항목들이 필요하면 사용자에게 물어본다. 추측으로 채우지 않는다.

- **나머지 4개 프로젝트** (소울라이크 · 스타워즈 · 기업협약 · 버민타이드) — 기술 문서도 디자인도 없다.
- **Unity 저장소의 md 와 YAML 이 같은 내용을 복제하고 있다.**
  `VamSirLike/Assets/Docs/26_0717_VamSirLike_TechDoc.md` 가 커밋 기준 원본인데 YAML 이 따로 산다.
  고칠 곳이 두 군데라 언젠가 어긋난다. 문서가 3개쯤 쌓이면 md 에서 뽑는 스크립트를 만든다.
- **배포처** — GitHub Pages 를 전제로 논의했으나 확정되지 않았다. 확정 전까지
  `astro.config.mjs` 의 `site`/`base` 는 비워 둔다.
  확정 시 CI 에 `npx playwright install chromium` 을 넣어야 한다 (Mermaid 빌드용).
- **`favicon.svg`** 가 없어서 404 다.

## 사용자에게 알린 문제 (사용자가 처리할 일)

- **포트폴리오 PDF 의 Bond '기술 문서' 링크가 Canva 편집 링크다.**
  `canva.com/design/DAHAC5CHv_Y/.../edit?...` — 다른 다섯 개는 `canva.link/...` 보기 전용이다.
  받은 사람이 원본을 고칠 수 있다. 사이트에는 넣지 않았다.
- **원본 PDF 오타** — `ShaderLap`(→ShaderLab) `VContiner` `SorceTree` `Github Desktob`
  `Instatiate` `Bohem GC`(→Boehm). 사이트에서는 바로잡았다.
- **4인 팀프로젝트의 실제 이름은 Bond** 다. 자기소개서에 그렇게 쓰여 있다. PDF 는 인원수로만 부른다.
- **md 에 ④ 고민과 선택이 없다.** PDF 에는 있던 A/B 비교가 md 에서 빠졌다.
  md 를 갱신할 때 다시 넣어야 한다. 사이트의 결정 2건은 PDF 에서 가져온 것이다.
- **파란 볼드는 `<code>` 로 고칠 게 아니었다** (판단 정정). 처음엔 뱀서라이크 섹션 02 '관계'
  lede 의 `IFighter`·`SkillBase`·`CombatSystem` 을 "그 문단만 어긋난 것"으로 보고 `<code>` 로
  고치자고 했는데, Bond 를 올려보니 파란 볼드가 문서 전체에 15곳(규칙: 내가 고른 해법·기제)이라
  드리프트가 아니었다. `rich()` 에 `==해법==` 문법을 넣어 해결했다. **디자인은 안 고쳐도 된다.**
- **푸터 이메일이 `cozam2@naver.com`** 이다. 사용자가 의도한 주소가 맞다고 확인했다.
  다만 지금은 디자인 마크업에 박혀 있어 3층 분리가 깨져 있다 — YAML 이전 때 `profile.yaml`
  에서 오도록 정리한다. 프로젝트가 6개면 연락처가 6곳에 살게 되고 언젠가 어긋난다.
  (Bond 푸터엔 전화번호도 있다: `이주노 · cozam2@naver.com · 010-7682-9921 · Unity · C#`.
  뱀서 푸터엔 전화번호가 없다. 이것도 `profile.yaml` 로 모으면 문서마다 다를 일이 없다.)
