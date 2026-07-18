# 기술문서 양식 ① — 구현

> **여기엔 두 AI 가 관여한다. 역할이 다르니 서술도 나눈다:**
> - **프로젝트 AI** — 대상 프로젝트 repo(이 저장소 **밖**, 예: `../{프로젝트}/`)에 연결. 그 **게임 코드**를 읽고
>   *무엇을 · 어떻게 만들었나*를 뽑는다. 파이프라인의 스키마 · YAML · mermaid 문법은 **몰라도 된다.** → **PART A**
> - **파이프라인 AI** — 이 저장소(Portfolio_Pipeline)에 연결. 스키마 · dc 블록 · mermaid · 게이트 · 빌드를 안다.
>   PART A 가 뽑은 것을 **블록으로 매핑해 YAML 로 조립**하고 빌드 · 검증한다. 게임 코드는 PART A 산출물로만 본다. → **PART B**
>
> 같은 세션이 둘 다 할 수도 있다. 하지만 **PART A 는 "코드에서 뽑기", PART B 는 "블록으로 조립하기"** 로 머리를 나눈다 —
> 프로젝트 AI 에게 mermaid 문법을 시키거나, 파이프라인 AI 에게 없는 코드를 상상하게 하지 않기 위해서다.
>
> **PDF 는 읽지도 만들지도 않는다.** PDF 포트폴리오를 손으로 만드는 과정을 없애려고 만든 파이프라인이다 — 입력은 **소스 코드**.
> 레이아웃은 이미 만든 dc 컴포넌트(`src/components/dc/`)로 고정 — 프로젝트마다 새 디자인도 만들지 않는다.
> **철칙:** 코드 · git 에서 확인한 것만. 지어내지 않는다. 모르면 비우고 사람에게 묻는다. (`« »` = 채울 자리)

## 흐름 (누가 언제)
1. **프로젝트 AI** 가 대상 repo 코드를 읽고 **PART A** 를 채운다.
2. 사람이 양식 ②(판단 · 회고)를 쓰고, 양식 ③(스크린샷 · 링크 · 확인용 메타)로 자산을 넘긴다.
3. **파이프라인 AI** 가 **PART B** 를 따라 PART A + ② + ③ 을 `src/content/docs/{slug}.yaml` 로 조립한다.
4. `npx astro build` → 정적 페이지가 없으니 `/projects/{slug}` 가 `[slug]`+YAML 로 선다. 마커로 검증한다.

---

# PART A — 프로젝트 AI 가 채운다 (대상 repo 의 코드에서)
> 게임 코드를 읽고 **사실을 말로** 뽑는다. YAML 블록 type · mermaid 문법은 신경 쓰지 마라 — PART B 가 한다.
> 강조는 `**굵게**` · `` `코드` `` 만.

## A0. 메타 — git · ProjectSettings 에서
- **slug**: «projects.yaml 의 키. 예: soulslike» · **subtitle**: «장르 한 줄. 예: 3인칭 소울라이크 액션»
- **period**: «`git log` 첫/마지막 커밋. 예: 2025.11.10 ~ 11.30»
- **engine**: «`ProjectSettings/ProjectVersion.txt` 버전 + 렌더 파이프라인. 예: Unity 6000.0.56f1 · URP»
> team · vcs · ide · 링크 · 스크린샷은 코드로 알 수 없다 → 양식 ③.

## A1. 개요 — 사실
- **lead**(선택): «대표 요약 한 문단»
- **what**: «이 문서가 다루는 것 = 지도» (양식 ②의 why 와 짝이 되어 WHAT/WHY 2단)
- **scope**: «다루지 않는 것까지 그어라. 예: …를 다룬다. 아트 · 사운드는 범위가 아니다»
- **기술 스택**: 분류 · 기술 · **사용 목적(왜 이 기술)** 을 줄줄이. **개요 섹션 끝**에 들어간다(세 디자인 공통 —
  무엇으로 만들었나를 먼저 보인다). 목적 없이 기술 이름만 나열 금지.
> why · evidence(동기 · 측정값)는 양식 ②. 개요 가운데는 WHAT/WHY 2단 또는 목표 카드 중 하나.

## A2. 시스템 구조 — 말로 서술 (그림은 PART B 가 그린다)
- **intro**(선택): «섹션 첫 문단»
- **계층 구성**: 위→아래 계층과 각 계층의 노드. + **구성요소**(무엇으로) · **관계**(누가 누구를 알고 · 제어) · **흐름**(입력→…→출력) 세 줄.
- **핵심 클래스 관계**: 어떤 인터페이스 · 추상 · 상속 계약이 있고 누가 구현하나. (관계만 적는다 — 그림은 PART B)

## A3. 핵심 기능 — 1..N (규모가 크면 여러 개로 쪼갠다)
기능마다:
### 기능: «제목»
- **무엇을 · 어떻게 만들었나** — 꼭지별로: 무엇에 대한 이야기 + 그 안에서 무슨 판단/내용 + 한 줄 요약.
- **핵심 코드**: '아하!' 가 오는 부분만(1000줄 금지). 각 스니펫에 「어디가 · 왜 그런가」 = **코드 주석 · 실제 의도에서**. 없으면 사람에게 묻는다.
- **필요한 그래프**: 손으로 그리지 말고 **무슨 질문에 답하는 그림인지 + 노드 · 엣지(전이 조건 · 상속 관계 등)** 만 남긴다.
  종류를 표시한다 — 상태 머신(FSM) · 흐름/행동 트리 · 클래스/타입 계층. (PART B 가 mermaid 로 그린다)
- **표 · 알약 · 카드로 낼 사실**(수치 표 · 단계 흐름 · 항목 카드)이 있으면 적어둔다.

---

# PART B — 파이프라인 AI 가 조립 · 검증한다 (이 repo 에서)
> PART A + 양식 ② + ③ 을 **스키마 블록**으로 매핑해 `docs/{slug}.yaml` 로 조립하고 빌드한다.
> 스키마: `src/content.config.ts`. 본보기로 삼는다: `src/content/docs/{vampire-like,bond,soulslike}.yaml`.

## B1. 블록 매핑 — PART A 의 서술을 YAML `type` 으로
- 기술 스택 → **개요의 `overview.stack`** {title, rows[분류·기술·목적]} (purpose 필수). 본문 블록이 아니라 **개요 섹션**에 렌더된다.
- 계층 구성 + 세 줄 → `type: layers` (components · relations · flow 필수. 강조=핵심 하나, 점선=런타임에 없는 것)
- 핵심 코드 → `type: code` (api · code · **notes 필수**)
- 수치/항목 표 → `type: table` (행 칸 수 = 헤더 수) · 단계 흐름 → `type: chips`(분기 생기면 mermaid) · 항목 카드 → `type: points`(2개+)
- 곁가지(주의 · 핵심 · 규칙) → `type: callout` · 시그니처+반환 목록 → `type: api-list`(returns 필수)
- 스크린샷 → 최상위 `screenshot`(hero) · 본문은 `type: image` — src · caption 은 **양식 ③** 에서(캡션 비면 이미지 열어 보고 초안)

## B2. 그래프 → mermaid — PART A 가 남긴 그래프 서술을 그린다
- 상태 머신 · 상태 전이 → `stateDiagram-v2`
- 흐름 · 행동 트리 · 이벤트 → `flowchart`
- 클래스 · 타입 계층 → `classDiagram`
- 각 그래프에 `question`(무슨 질문에 답하나) 캡션. 라벨에 `<` `>` 원시 금지(파싱 깨짐), classDiagram 제네릭은 `~T~`.
- **예외:** 사람이 강조를 정한 계층도는 mermaid 가 아니라 `layers`(B1). 자동 배치는 강조를 못 한다.

## B3. 게이트 — 어기면 빌드가 깨진다
- [ ] 개요: (what+why) 또는 goals 중 하나 · **evidence · scope 필수**
- [ ] **고민과 선택 최소 1건**(②) · 각 결정 정확히 1개 채택 · 기준의 값 수 = 선택지 수
- [ ] **retrospective 의 learnings(깨달음) · improvements(개선) 필수**(②)
- [ ] code 는 notes · stack-table 은 purpose · api-list 는 returns · image/screenshot 은 caption 필수 · table 은 행 칸 수 = 헤더 수
- [ ] 필수 항목을 optional 로 완화해 통과시키지 않는다 — 그건 게이트를 무력화하는 것이다.

## B4. 조립 · 빌드 · 검증
- ① + ② + ③ → `src/content/docs/{slug}.yaml`. ③ 의 스크린샷은 `src/assets/{slug}/` 에 있고, 캡션 표대로 wire.
- `npx astro build` → mermaid 가 SVG 로 구워지고, `/projects/{slug}` 가 `[slug]`+YAML 로 선다. 마커로 검증.
