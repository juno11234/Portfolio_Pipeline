# Bond — 구현 기술문서 (양식 ① · PART A)

> **이 문서**: `Portfolio_Pipeline/templates/1-구현-AI.md` 양식의 **PART A**(프로젝트 AI — 대상 repo 코드에서 사실을 말로 뽑는 단계)를 `98_LeeJuno_기술문서.md`를 바탕으로 채운 것이다.
> **작성 기준**: 코드·git 에서 확인한 것만 적었다. YAML 블록 `type`·mermaid 문법은 PART B 몫이라 신경 쓰지 않았고, 강조는 `**굵게**`·`` `코드` `` 만 썼다. 그래프는 그리지 않고 **"필요한 그래프" 명세**(종류 + 무슨 질문에 답하나 + 노드·엣지)로만 남겼다 — PART B 가 mermaid 로 그린다.
> **다음 단계**: 양식 ②(판단·회고 — 왜·측정값·고민과 선택)와 양식 ③(스크린샷·링크·팀·IDE)은 이 문서 범위 밖이다. 문서 끝의 [PART B 로 넘길 때](#part-b-로-넘길-때-파이프라인-ai-용-매핑-힌트) 참고.

---

## A0. 메타 — git · ProjectSettings 에서

- **slug**: `bond` (`Portfolio_Pipeline/.../projects.yaml` 에 이미 등록된 키)
- **subtitle**: 로그라이크 턴제 RPG — 원정(맵 진행)·이벤트·전투 연출 시스템
- **period**: **2026.04.02 ~ 2026.07.17** (`Assets/98. LeeJuno/` 경로 첫/마지막 커밋, 총 204 커밋)
- **engine**: **Unity 6000.3.10f1 · URP 17.3.0** (`ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`)

> team(projects.yaml 상 **4인 팀**)·vcs·ide·저장소 링크·스크린샷은 코드로 확인할 수 없다 → **양식 ③**.

---

## A1. 개요 — 사실

- **lead**: Bond 의 **원정(Expedition) 모드** — 로그라이크 노드 맵을 축으로 이벤트 씬·전투 씬·컷씬 씬이 **Additive** 로 붙는 구조를 설계·구현했다. **VContainer** DI 로 씬별 서브시스템의 초기화·해제 순서를 선언적으로 관리하고, DI 스코프가 넘지 못하는 씬 경계는 **정적 채널 패턴**으로 잇는다. 맵은 **시드 기반**으로 절차 생성되고, 이벤트 효과는 **책임 연쇄(Chain of Responsibility)** 로, 스킬 컷씬은 **델리게이트 데코레이터**로 전투 행동에 주입된다.

- **what**: 이 문서는 (1) 맵 절차 생성·탐색·UI, (2) 스테이지(Additive 씬) 로딩과 씬 경계 컨텍스트 전달, (3) 이벤트 씬(선택지·효과 적용·2차 선택지·저널 로그), (4) 턴 진행, (5) 전투 연출(오브젝트 풀·스프라이트 애니메이션·타임라인 커스텀 트랙), (6) 스킬 컷씬 로딩을 다룬다. **C# 스크립트 103개**(`Assets/98. LeeJuno/`)의 실제 구현이 근거다.

- **scope**: 이 문서는 **원정/맵 서브시스템**만 다룬다. 캐릭터 스탯·전투 판정 로직(`BaseCharacter`, `BattleManager` — `Assets/97. Moon/`·`Assets/02. Scripts/`), 저널 UI 내부, 스킬 이펙트의 실제 타격 적용, 아트·사운드는 **팀원 담당이라 범위가 아니다**. 본문에서 "외부 코드"로 표기한 지점이 그 경계다(예: `ITurnUseUnit` 구현체 `BaseCharacter`, `onBattleAction` 원본 로직, `SkillEffectPool.Play()` 의 실제 호출부).

- **기술 스택** (분류 · 기술 · 목적):

| 분류 | 기술 | 목적 (왜 이 기술) |
|---|---|---|
| DI 컨테이너 | **VContainer** | `EntryPoint`(IAsyncStartable/IStartable) 생명주기로 씬별 서브시스템의 초기화·해제 순서를 선언적으로 관리하고, 책임 연쇄 핸들러를 `AsImplementedInterfaces()` 로 자동 조립하기 위해 |
| 비동기 | **UniTask** | GC 부담 없는 async/await·TCS·WhenAll 로 로딩·턴 루프·효과 적용의 비동기 흐름을 코루틴 없이 표현하기 위해 |
| 에셋/씬 로드 | **Addressables** | Config·스프라이트·씬·프리팹을 비동기 로드하고 **핸들 수명**으로 메모리를 명시적으로 해제하기 위해 |
| 연출 | **Unity Timeline (Playables)** | 카메라 흔들림·실루엣을 **커스텀 트랙 2종**으로 만들어 컷씬을 타임라인에서 편집 가능하게 하기 위해 |
| UI | **UI Toolkit + uGUI** | 이벤트 씬을 프로덕션(uGUI 저널 팝업)과 테스트(UI Toolkit UIDocument) 두 구현체로 병용하기 위해 |
| 카메라 | **Cinemachine** | 컷씬의 카메라 흔들림을 `CinemachineBasicMultiChannelPerlin` 노이즈 채널로 타임라인에서 제어하기 위해 |
| 입력 | **Input System** | 테스트 유닛(`TestPlayer`)의 입력을 액션맵으로 분리하기 위해 |
| 직렬화 | **Newtonsoft.Json** | 스킬(`SkillBase`)의 세이브/로드 직렬화를 위해 (`[JsonProperty]`/`[JsonIgnore]` 병용) |

---

## A2. 시스템 구조 — 말로 서술 (그림은 PART B 가 그린다)

- **intro**: 전체는 **맵(로그라이크 노드 진행)을 축으로**, 그 아래 이벤트·전투·컷씬 씬이 Additive 로 붙는 5계층이다. 설정(ScriptableObject)을 로딩 계층이 Addressables 로 읽어 캐시에 풀어 두고, 순수 C# 도메인 계층(생성·탐색·저장)이 이를 소비하며, 오케스트레이션 계층이 씬 전환을 조율한다.

### 계층 구성 (위 → 아래)

| 계층 | 노드 |
|---|---|
| **L0 설정 (SO)** | `MapGeneratorConfig`, `StageConfig`, `MonsterGroupConfig`, `EventConfig`, `EventBattleConfig`, `SkillCutSceneConfig` |
| **L1 로딩** | `MapConfigLoader`(Addressables 병렬 로드) → `MapConfigPackage`(DTO) → `MapConfigCache`(핸들 해제 후 참조 보관) |
| **L2 도메인 (순수 C#·동기)** | `MapGenerator`(DAG 절차 생성), `MapNavigator`(노드 상태 전이), `MapRepository`(JSON 저장) |
| **L3 오케스트레이션** | `MapInitializer`(IAsyncStartable 진입점), `StageLoader`(Additive 씬 전환), `MapUIController`(맵 UI 조율) |
| **L4 씬 (Additive)** | 이벤트 씬(`EventSceneController`), 전투 씬(`TurnManager`), 컷씬 씬(`SkillCutSceneController`) |

- **구성요소(무엇으로)**: 설정은 SO, 로딩은 Addressables 핸들, 도메인은 무의존 POCO/서비스, 오케스트레이션은 VContainer EntryPoint, 씬 계층은 각 씬의 MonoBehaviour + 자체 LifetimeScope.
- **관계(누가 누구를 알고·제어)**: `MapInitializer` 가 로딩→생성→탐색→UI 초기화를 순차 구동한다. `MapNavigator` 가 노드 진입을 `OnNodeEntered` 이벤트로 올리면 `MapUIController` 가 받아 `StageLoader` 에 씬 로드를 지시한다. 도메인은 상위를 모른다(단방향).
- **흐름(입력→출력)**: `StartAsync()` → Config 로드 → `GenerateMap(seed)` → 배경 채널 세팅 → `Navigator.Initialize` → `ShowMap` → (플레이어 노드 클릭) → `MoveToNode` → `LoadStage` → Additive 씬 → 씬이 `StageCompletionChannel.Invoke(result)` 로 결과 반환 → 언로드 → 맵 복귀.

### 핵심 클래스 관계 (계약과 구현)

- **주요 인터페이스 ↔ 구현체**: `IMapGenerator`(`MapGenerator` / 테스트용 `FixedMapGenerator`), `IStageLoader`(`StageLoader`), `IMapNavigator`(`MapNavigator`), `IEventContext`(`EventContextService` / 테스트용 `FakeEventContext`), `IEventEffectApplier`(`EventEffectApplier`), `IEventChoiceView`(프로덕션 `EventJournalChoiceView` / 테스트 `EventSceneView`), `ISpriteLoader`(`SpriteLoader`), `ISkillEffectPool`(`SkillEffectPool`), `ITurnManager`(`TurnManager`), `ITurnUseUnit`(외부 `BaseCharacter` / 테스트 `TestPlayer`).
- **책임 연쇄 계약**: `IEventEffectHandler` 를 4개 구현체(`HpChange`/`ItemReward`/`StatusEffect`/`Battle`)가 구현하고, VContainer 가 `IReadOnlyList<IEventEffectHandler>` 로 자동 수집해 `EventEffectApplier` 에 주입한다 → **DI 로 체인이 조립**된다.
- **정적 채널(씬 경계 우회)**: DI 스코프는 씬을 넘지 못하고 `Addressables.LoadSceneAsync` 는 씬에 파라미터를 못 넘긴다. 이 두 제약 때문에 **정적 채널 5종**이 씬 사이를 잇는다:

| 채널 | 자료구조 | 방향 | 발행자 → 구독자 |
|---|---|---|---|
| `StageCompletionChannel` | `Stack<Action<StageResult>>` | 스테이지 씬 → 맵 씬 | 스테이지/이벤트 씬 → `StageLoader` |
| `CutSceneCompletionChannel` | `Stack<Action>` | 컷씬 씬 → 로더 | `SkillCutSceneController` → `CutSceneLoader` |
| `EventBattleContext` | static 프로퍼티 | 이벤트 씬 → 맵 씬 | `EventSceneController` → `StageLoader` |
| `MapBgChannel` | static 프로퍼티 | 맵 씬 → 모든 씬 | `MapInitializer` → `SceneBgLoader` |
| `CharacterSelectChannel` | static event + TCS | 핸들러 → UI | `HpChangeEventEffectHandler` → `EventSceneController` |

  두 Completion 채널이 **`Stack`** 인 이유: 콜백을 최상위에 Push/Pop 해 중첩을 지원하기 위해서다. `Invoke()` 는 `Peek()` 만 하고, 제거는 `Unregister()`(Pop) 의 책임이다.
- **DI 스코프 계층**: `RootScope`(외부) → `MapLifetimeScope` → `EventSceneLifetimeScope`(parentReference 수동 연결). 전투 씬 `BattleFlowManagerScope` 는 `LifetimeScope.EnqueueParent` 로 부모를 지정하고, `TurnLifetimeScope` 가 그 아래에 붙는다. `PartyDeathHandlerScope` 는 `MapLifetimeScope` 를 부모로 삼는다.

### 필요한 그래프 (A2)

1. **계층도** — *종류: `layers`(사람이 강조를 정하는 계층도라 자동 배치 mermaid 아님)*. 질문: "설정→씬까지 5계층이 무엇으로·어떻게 흐르나?" 노드: 위 표의 L0~L4. 강조: L2 도메인(순수 C#). 점선: `MapRepository → MapNavigator`(주입되나 현재 미호출 — 런타임에 없는 관계).
2. **채널 흐름도** — *종류: flowchart*. 질문: "어느 씬이 어느 채널로 누구에게 신호를 보내나?" 노드: 맵/이벤트/전투/컷씬 씬 + 5개 채널. 엣지: 위 채널 표의 발행자→구독자.
3. **DI 스코프 계층** — *종류: flowchart*. 질문: "스코프 부모-자식 관계와 각 스코프가 무엇을 등록하나?" 노드: Root/Map/EventScene/BattleFlow/Turn/PartyDeath 스코프. 엣지: parent 관계(실선) + `EnqueueParent`(점선).

---

## A3. 핵심 기능

### 기능 1: 시드 기반 절차적 맵 생성 (`MapGenerator`)

- **무엇을 · 어떻게 만들었나**
  - **재현 가능한 절차 생성** — Slay the Spire 식 DAG(방향 비순환 그래프) 맵을 **10단계 파이프라인**으로 만든다. `GenerateMap(seed)` 안에서 `System.Random` **인스턴스 하나를 만들어 10단계 전체가 공유**한다. 같은 시드 → 항상 같은 맵. *한 줄: 시드 하나로 맵 전체가 결정된다.*
  - **10단계 파이프라인** — 노드 수 결정 → 노드 생성/열 배치(Fisher-Yates) → 엣지 연결(열 거리 ≤1) → **교차 엣지 제거**(스왑) → 스테이지 타입 가중치 배정 → 배치 규칙 5종 강제 → 노드 상태 초기화 → 몬스터/이벤트/보스 그룹 각인. *한 줄: 무작위로 뽑되, 규칙으로 다듬어 항상 플레이 가능한 맵을 보장한다.*
  - **층별 가중치 테이블** — 초반 층(`layer<4`, `layer<EliteMinLayer`)은 하드코딩 가중치, 그 외는 Config 값. `WeightedRandom` 이 **합계로 내부 정규화**하므로 가중치 합이 1이 아니어도 동작한다. *한 줄: 초반엔 쉬운 방을, 후반엔 데이터로 조율한다.*
  - **배치 규칙 5종** — ①마지막 층=Boss ②보스 직전 층=Camping ③Elite 최소 1개 보장 ④Camping 최소 개수 보장 ⑤나머지 Boss 는 Normal 강등. 규칙 3·4 전처리는 **단일 순회로 통합**(중복 순회 제거). *한 줄: "휴식 없는 맵"·"엘리트 없는 맵" 같은 파탄 케이스를 규칙으로 봉쇄한다.*
  - **테스트 대체재** — `IMapGenerator` 를 `FixedMapGenerator`(고정 4층 DAG)로 바꾸면 `MapInitializer` 파이프라인이 그대로 돈다. DI 바인딩만 `TestMapLifetimeScope` 에서 교체.

- **핵심 코드** — 시드 공유가 재현성의 핵심이다. `rng` 를 한 번 만들어 10단계에 그대로 넘긴다(`MapGenerator.cs`):
  ```csharp
  // 시드 고정 난수 — 같은 시드면 항상 동일한 맵 생성
  System.Random rng = new System.Random(seed);
  MapData data = new MapData { Seed = seed, TotalLayers = config.TotalLayers, MaxNodesPerLayer = config.MaxNodesPerLayer };

  int[] nodeCounts = DetermineNodeCounts(rng, data.TotalLayers, config);
  CreateNodes(data, nodeCounts, rng);
  ConnectNodes(data, rng, config);
  RemoveCrossings(data);
  AssignStageTypes(data, rng, config);
  ApplyPlacementRules(data, rng, config);
  InitializeNodeStates(data);
  AssignMonsterGroups(data, rng, monsterGroupConfig);   // ← rng 공유라 호출 순서가 곧 재현성 계약
  AssignEvents(data, rng, eventConfig);
  AssignBossGroups(data, rng, _mapConfigCache.BossMonsterGroupConfig);
  ```
  > **어디가·왜**: 각 단계에 `new System.Random(...)` 을 따로 만들지 않고 **하나의 `rng` 를 관통**시킨다. 그래서 "같은 시드 → 같은 맵" 이 성립하고, 배정 메서드 주석에도 "rng 는 파이프라인 전체에서 공유되므로 이전 단계 완료 후 호출해야 한다"고 명시돼 있다. (대조군: `FixedMapGenerator` 는 배정 메서드마다 `new System.Random` 을 따로 써서 이 계약이 없다.)

  가중치 롤은 **합계 정규화 + 누적합** 방식이다:
  ```csharp
  float total = 0f; foreach (float w in weights) total += w;
  float roll = (float)rng.NextDouble() * total;   // 합이 1이 아니어도 정규화됨
  float cumulative = 0f;
  for (int i = 0; i < weights.Length; i++) {
      cumulative += weights[i];
      if (roll <= cumulative) return WeightTypeOrder[i];  // 인덱스↔타입은 단일 배열로 고정
  }
  return StageType.Normal;   // 폴백
  ```
  > **어디가·왜**: `WeightTypeOrder`(`{Normal, Elite, Event, Camping}`)를 `static readonly` 단일 배열로 두어 **가중치 인덱스와 타입 매핑을 한 곳에서 관리**한다. 주석대로 "열거형에 새 값이 추가돼도 이 배열만 고치면 두 메서드에 동시 반영"된다.

- **필요한 그래프**
  1. *종류: flowchart*. 질문: "GenerateMap 은 어떤 순서로 맵을 빚나?" 노드: `IsReady?` 가드 → 10단계 → `MapData 반환`. 엣지: 순차 + `IsReady==false → null`.
  2. *종류: stateDiagram(FSM)*. 질문: "노드 상태는 어떻게 전이하나?" 노드: `Locked / Available / Current / Visited`. 엣지: `InitializeNodeStates → Locked`, `0층/UnlockNextNodes → Available`, `MoveToNode(가드 통과) → Current`, `다음 이동 시 → Visited`, `선택 안 된 형제 → Locked`.
  3. *종류: flowchart(DAG)*. 질문: "테스트용 고정 맵의 노드-엣지 형태는?" 노드: Id 0(Normal)→100(Event)→{200(Elite),201(Camping)}→300(Boss). 엣지: 위 화살표.

- **표·알약·카드로 낼 사실**
  - *표*: 층별 가중치 테이블 — 헤더 `조건 | Normal | Elite | Event | Camping | 출처`, 행 3개(`layer<4` = 0.70/0/0.30/0 하드코딩, `layer<EliteMinLayer` = 0.55/0/0.25/0.15 하드코딩, 그 외 = Config 값).
  - *표*: 배치 규칙 5종 — 헤더 `# | 규칙 | 구현`, 행 5개.
  - *알약(chips)*: 10단계 파이프라인 이름을 순서대로.

---

### 기능 2: 스테이지 로딩과 씬 경계 컨텍스트 전달 (`StageLoader` + 정적 채널)

- **무엇을 · 어떻게 만들었나**
  - **가장 무거운 조율자** — `StageLoader` 는 책임이 5가지다: ①Addressables Additive 씬 로드/언로드 ②씬 경계 컨텍스트 기록(`IEventContext`/`IStageMonsterContext`) ③맵 씬 컴포넌트 비활성/복원(Camera·EventSystem) ④이벤트 전투 전환 ⑤전투 결과 로그 기록. *한 줄: 맵 씬과 하위 씬 사이의 모든 왕복을 이 클래스가 책임진다.*
  - **재진입·순서 방어** — `_isLoading` 가드로 중복 로드를 차단하고, **언로드보다 컴포넌트 비활성을 먼저** 해 "복구→재비활성" 왕복을 막는다. 로드 실패 시 `RestoreMapComponents()` 후 예외를 재전파한다.
  - **타입별 컨텍스트 분기** — Normal/Elite 는 `MonsterGroupConfig`(Elite 는 `IsElite` 플래그로 같은 Config 공유), Boss 는 `BossMonsterGroupConfig`, Event 는 `EventConfig` 를 선형 탐색해 컨텍스트에 기록한다. Camping 은 아무 컨텍스트도 안 남긴다. *한 줄: 씬은 파라미터를 못 받으므로, 들어가기 전에 정적 컨텍스트에 "미리 적어" 둔다.*
  - **씬 3개를 가로지르는 이벤트 전투** — 이벤트 씬에서 Battle 선택 → `EventBattleContext.Set()`(static) → 맵 씬으로 결과 반환 → 맵 씬이 컨텍스트를 전투 씬용 `IStageMonsterContext` 로 옮겨 담아 전투 씬을 로드. **정적 채널 없이는 불가능한 경로**다.
  - **풀 인스턴스 직접 주입** — 씬 로드 시 `LifetimeScope.EnqueueParent(부모)` 와 동시에 `LifetimeScope.Enqueue(builder => builder.RegisterInstance(_skillEffectPool))` 로 풀을 하위 씬 스코프에 넣는다. 후자가 필요한 이유는 주석에 있다 — 전투 씬 스코프가 Inspector 에서 RootScope 를 부모로 직접 지정하면 `EnqueueParent` 가 무시되기 때문.

- **핵심 코드** — 컨텍스트를 못 넘기는 씬에 "미리 적어두는" 정적 프로퍼티 채널. `CurrentStageType` 은 사망 로그 문구 선택에 쓰이는데, 실제 반환은 2+null 가지뿐이다(`StageLoader.cs`):
  ```csharp
  public StageType? CurrentStageType
      => _hasLoadedScene == false ? null
         : (_isBattleStage ? StageType.Normal : StageType.Event);
  ```
  > **어디가·왜**: Elite·Boss 스테이지 중에도 `Normal` 을, Camping 중에는 `Event` 를 반환한다(Elite/Boss/Camping 은 절대 반환 안 됨). `PartyDeathHandler` 가 이 값으로 사망 로그 문구("전투에서"/"이벤트에서"/"탐사 중")를 고르므로, **문구 3종 이상의 세분화는 현재 불가능**하다는 점을 알고 설계에 반영해야 하는 지점이다.

- **필요한 그래프**
  1. *종류: flowchart*. 질문: "LoadStage 는 어떤 가드·순서로 씬을 여나?" 노드: `_isLoading?` → `node==null?` → `DisableMapComponents`(언로드보다 먼저) → 컨텍스트 분기(Normal/Elite/Boss/Event/Camping) → `Register(콜백)` → `EnqueueParent`+`Enqueue(풀)` → `LoadSceneAsync`. 엣지: 성공/예외(RestoreMapComponents+throw)/finally(_isLoading=false).
  2. *종류: sequenceDiagram*. 질문: "이벤트→전투 전환이 씬 3개를 어떻게 가로지르나?" 참가자: StageLoader·IEventContext·EventSceneController·EventBattleContext(static)·IStageMonsterContext·BattleStageEntry(외부). 핵심 엣지: `Set→로드→읽기/Clear`, `EventBattleContext.Set → Invoke(IsBattleTriggered) → 맵 씬이 IStageMonsterContext 로 옮겨담기 → 전투 씬 로드`.

- **표·알약·카드로 낼 사실**
  - *표*: 컨텍스트 분기별 조회 경로 — 헤더 `StageType | 조회 Config | 조회 방식`, 행 4개(Normal/Elite = MonsterGroupConfig·헬퍼, Boss = BossMonsterGroupConfig·인라인, Event = EventConfig·헬퍼, Camping = 없음).

---

### 기능 3: 이벤트 시스템 (MVP + 책임 연쇄 + 2차 선택지)

- **무엇을 · 어떻게 만들었나**
  - **MVP 3분할 + 프레임워크 독립 View** — `EventSceneController`(로직) · `EventChoicePresenter`(배선) · `IEventChoiceView`(UI 추상). View 구현체는 프로덕션 `EventJournalChoiceView`(uGUI 저널 팝업)와 테스트 `EventSceneView`(UI Toolkit) 두 종. *한 줄: 로직을 UI 프레임워크에서 떼어내 프로덕션/테스트 두 화면을 같은 컨트롤러로 굴린다.*
  - **실행 순서 무보장 대응** — `EventSceneController.Start()`(MonoBehaviour)와 `EventChoicePresenter.Start()`(IStartable)의 순서가 보장되지 않아, **양쪽 모두 방어 코드**를 둬 "둘 중 어느 순서든 정확히 한 번" 선택지를 표시한다. *한 줄: 프레임워크가 순서를 안 정해줘도 화면은 딱 한 번 뜬다.*
  - **효과 적용 = 책임 연쇄** — `EventEffectApplier` 가 switch 없이 `IEventEffectHandler` 체인에 위임한다. 새 `EffectType` 는 이 클래스를 안 고치고 핸들러만 추가하면 된다(OCP). 체인은 **DI 가 조립**한다.
  - **2차 선택지(저널 템플릿)** — `EventData.JournalData` 가 있으면 효과를 바로 안 쓰고 저널 기반 2차 선택지를 띄운다. 상태기계 `EventSceneState { Primary, Secondary }` 로 관리하며, ItemReward 롤을 2차 진입 시점에 확정한다.
  - **스코프를 넘는 캐릭터 선택** — HpChange-ChooseOne 은 핸들러(`MapLifetimeScope`)와 UI(`EventSceneLifetimeScope`)가 다른 스코프에 있어, **`CharacterSelectChannel`(static + TCS)** 로 요청/응답한다. 구독자가 없으면 0번 인덱스로 폴백.

- **핵심 코드** — switch 를 없앤 자리에 "첫 매칭에서 멈추는" 체인이 들어간다(`EventEffectApplier.cs`):
  ```csharp
  // switch 분기 대신 IEventEffectHandler Chain 에 위임한다. 새 EffectType 추가 시 이 클래스를 수정하지 않고 Handler 만 추가. (OCP)
  foreach (IEventEffectHandler handler in _handlers) {
      if (handler.CanHandle(effect.EffectType)) {
          await handler.HandleAsync(effect);
          handled = true;
          break;   // 첫 번째 매칭 핸들러에서 처리 후 중단
      }
  }
  if (handled == false)
      Debug.LogWarning($"[EventEffectApplier] 처리되지 않은 EffectType: {effect.EffectType}");
  ```
  > **어디가·왜**: `_handlers` 는 생성자에서 `IReadOnlyList<IEventEffectHandler>` 로 주입되는데, VContainer 가 4개 핸들러를 `AsImplementedInterfaces()` 로 등록해 두어 **체인 자체가 DI 로 조립**된다. `break` 로 첫 매칭만 실행하는 게 이 경로의 규약이다(대조: 2차 선택지 경로 `ExecuteSecondaryActionAndCompleteAsync` 는 **매칭 핸들러를 전부 실행**해 break 가 없다).

- **필요한 그래프**
  1. *종류: classDiagram*. 질문: "이벤트 시스템의 타입 구조(데이터·MVP·체인)는?" 노드: `EventData→EventChoice→EventEffectData`(데이터), `EventSceneController/EventChoicePresenter/IEventChoiceView`(MVP), `IEventEffectApplier→EventEffectApplier→핸들러 4종`(체인). 엣지: 구성/구현/의존.
  2. *종류: flowchart*. 질문: "선택 하나가 어디로 분기하나?" 노드: `OnChoiceSelectedFromView` → `Secondary면 무시` → `effect.EffectType` → (a)Battle (b)ItemReward+JournalData (c)그 외. 엣지: 3갈래.
  3. *종류: stateDiagram*. 질문: "이벤트 씬 상태는?" 노드: `Primary / Secondary`. 엣지: `ItemReward&&Journal!=null → Secondary`(역전이 없음, 리셋은 씬 재생성에 의존).
  4. *종류: sequenceDiagram*. 질문: "스코프를 넘는 캐릭터 선택은 어떻게 성사되나?" 참가자: HpChangeHandler·CharacterSelectChannel(static)·EventSceneController·View. 핵심 엣지: `RequestAsync → OnSelectionRequired → View 표시 → Complete(index) → TCS 재개`.

- **표·알약·카드로 낼 사실**
  - *표*: 효과 핸들러 매핑 — 헤더 `EffectType | 핸들러 | 동작 | async`, 행 5개(None=없음, HpChange, StatusEffect=스텁, ItemReward, Battle=가드 throw).
  - *표*: TargetType 매핑(HpChange) — All/RandomOne/ChooseOne/None.
  - *표*: View 구현체 비교 — 프로덕션 vs 테스트(UI 기반·타입·버튼 비활성 방식·콜백 관리).

---

### 기능 4: 스킬 컷씬 데코레이터 주입 (`SkillCutSceneInjector` + `CutSceneLoader`)

- **무엇을 · 어떻게 만들었나**
  - **전투 행동을 감싸는 데코레이터** — 전투 시작 시 각 플레이어의 `onBattleAction`(`Func<BattleContext, UniTask>`)을 **교체 대입**해, 컷씬이 등록된 스킬이면 컷씬을 먼저 재생한 뒤 원본을 호출한다. 원본은 클로저로 캡처. *한 줄: 전투 로직을 안 건드리고, 델리게이트를 감싸 컷씬을 끼워 넣는다.*
  - **이중 래핑 2중 방지** — ①`_wrapperDelegates`(캐릭터별 직전 래퍼 추적)로 재래핑 전 제거 ②`static _current`(직전 인스턴스 `Cleanup()` 호출)로 씬 재로드 시 잔류 래퍼 제거. *한 줄: 스테이지마다 씬이 새로 생겨도 래퍼가 겹겹이 쌓이지 않는다.*
  - **자기완결형 로더** — `CutSceneLoader.Load` 가 씬 로드 → 완료 대기(TCS) → 언로드까지 한 메서드로 끝낸다. `_isLoading` 가드로 이중 호출을 막고, 컷씬 씬은 `CutSceneCompletionChannel`(Stack) 로 완료를 통보한다.
  - **`timeScale = 0` 3중 대응** — 컷씬은 게임을 멈춘 채 재생되므로 unscaled 시간을 세 곳에서 쓴다: Timeline(`DirectorUpdateMode.UnscaledGameTime`), Cinemachine(`UniformDeltaTimeOverride = unscaledDeltaTime`), 스프라이트(`DelayType.UnscaledDeltaTime`). *한 줄: 멈춘 시간 위에서도 연출만 흐르게 한다.*

- **핵심 코드** — 핵심은 `+=` 가 아니라 **대입**으로 체인을 갈아끼우는 것이다(`SkillCutSceneInjector.cs`):
  ```csharp
  Func<BattleContext, UniTask> original = character.onBattleAction;   // 원본을 클로저로 캡처

  Func<BattleContext, UniTask> wrapper = async (BattleContext context) => {
      if (context.runtimeSkill != null && context.runtimeSkill.Data != null) {
          string skillId = context.runtimeSkill.Data.Id;
          if (_config.TryGetSceneId(skillId, out string sceneId)) {   // 컷씬 등록 스킬이면
              string[] spriteAddresses = CollectTargetSpriteAddresses(context, allEnemies);
              await _cutSceneLoader.Load(sceneId, spriteAddresses);   // 컷씬 먼저
          }
      }
      if (original != null) await original.Invoke(context);           // 그 다음 원본
  };

  character.onBattleAction = wrapper;          // ★ += 가 아닌 대입 — 원본 체인을 교체
  _wrapperDelegates[character] = wrapper;      // 다음 래핑 때 제거하려고 기억
  ```
  > **어디가·왜**: 주석대로 "람다로 원본 delegate 참조를 클로저에 가둬 래핑 전후 참조를 분리"한다. `=` 대입이라 **원본을 잃지 않으면서 순서를 보장**(컷씬→원본)하고, `_wrapperDelegates` 에 저장해 두어 재래핑 시 `-=` 로 정확히 이전 래퍼만 떼어낸다.

- **필요한 그래프**
  1. *종류: flowchart*. 질문: "래퍼는 언제 컷씬을 끼우고 언제 원본만 부르나?" 노드: `WrapBattleActions` → `_config==null?` → 캐릭터별 `이전 래퍼 제거 → original 캡처 → wrapper 대입`. 런타임: `runtimeSkill.Data!=null && TryGetSceneId?` → Yes(컷씬 로드) / No(원본). 엣지: 위.
  2. *종류: sequenceDiagram*. 질문: "CutSceneLoader.Load 전체 수명은?" 참가자: wrapper·CutSceneLoader·CutSceneCompletionChannel·Addressables·SkillCutSceneController. 핵심 엣지: `_isLoading 가드 → timeScale=0 → 컴포넌트 비활성 → Register → LoadSceneAsync → (스프라이트 주입) → await TCS → NotifyCompletion → UnloadInternal → finally(복원/timeScale=1)`.

- **표·알약·카드로 낼 사실**
  - *표*: `timeScale=0` 3중 장치 — 헤더 `대상 | 처리 | 위치`, 행 3개(Timeline/Cinemachine/스프라이트).
  - *카드(points)*: 이중 래핑 2중 방지(`_wrapperDelegates` / `static _current`).

---

### 기능 5: 전투 연출 오브젝트 풀 + 스프라이트 애니메이션 핸드셰이크 (`SkillEffectPool` ↔ `EffectSpritePlayer`)

- **무엇을 · 어떻게 만들었나**
  - **주소당 4개 오브젝트 풀** — `POOL_SIZE=4`. `_idle`(대기 큐)·`_active`(사용 중)·`_warmUpAddresses`(등록 주소 집합)·`_handles`(Instantiate 핸들) 4개 자료구조로 관리. 큐가 비면 폴백 없이 `LogWarning` 후 return. *한 줄: 스킬 이펙트를 미리 4개씩 찍어두고 돌려쓴다.*
  - **씬을 넘나드는 싱글턴 풀** — 인스턴스를 `DontDestroyOnLoad` 로 두고, `StageLoader` 가 `RegisterInstance` 로 같은 인스턴스를 하위 전투 씬 스코프에 넣는다. 결과적으로 **맵 씬 단위 싱글턴이 전투 씬을 넘나들며 재사용**된다.
  - **WarmUp vs AddCharacters** — `WarmUpAsync`(맵 진입)는 주소 집합이 같으면 재생성을 스킵(`AddressSetEquals`), 다르면 `Clear()` 후 재구축한다. `AddCharactersAsync`(전투 직전, 적 확정)는 `Clear()` 없이 **증분 추가**. *한 줄: 장착 스킬이 안 바뀌면 풀을 다시 안 만든다.*
  - **`enabled` 플래그 핸드셰이크** — 풀은 `Play()` 후 `ReturnAfterPlayAsync` 로 반납을 예약하는데, 반납 시점을 **`EffectSpritePlayer.enabled == false` 폴링**으로 잡는다. `EffectSpritePlayer` 는 1사이클 재생 후 `this.enabled = false` 로 스스로 꺼진다. 이 한 플래그가 **두 클래스의 유일한 접점**이다. *한 줄: "연출 끝"을 이벤트가 아니라 enabled 한 칸으로 주고받는다.*
  - **세대 카운터 취소** — `EffectSpritePlayer` 는 토큰(`destroyCancellationToken`)과 **세대 카운터(`_playGeneration`)** 이중 안전장치를 쓴다. `Play()` 가 세대를 올려 지역 변수로 캡처하고, 매 프레임 불일치면 즉시 종료 → 재생 재시작·비활성화 시 이전 루프가 조용히 끝난다.

- **핵심 코드** — 반납 시점을 잡는 폴링(풀 쪽)과, 그 신호를 만드는 자기 비활성화(플레이어 쪽):
  ```csharp
  // SkillEffectPool.ReturnAfterPlayAsync — 재생 종료를 enabled 플래그로 감지
  EffectSpritePlayer player = instance.GetComponent<EffectSpritePlayer>();
  if (player != null)
      await UniTask.WaitUntil(() => player.enabled == false,          // ← 이 폴링이 반납 트리거
                              cancellationToken: instance.GetCancellationTokenOnDestroy());
  else
      await UniTask.Delay(1000, cancellationToken: instance.GetCancellationTokenOnDestroy());  // 컴포넌트 없으면 1초 폴백
  Return(prefabAddress, instance);
  ```
  ```csharp
  // EffectSpritePlayer.PlayAsync — 1사이클 후 스스로 꺼져 '반납 신호'를 만든다
  if (_playGeneration != generation) return;   // 세대 불일치 → 조용히 종료 (재시작/비활성 대응)
  if (_loop == false) {
      this.enabled = false;                    // ★ 이 한 줄이 SkillEffectPool 의 반납 신호
      return;
  }
  ```
  > **어디가·왜**: 두 클래스가 이벤트/콜백 대신 **`enabled` 한 플래그**로 느슨하게 붙는다 — 풀은 `EffectSpritePlayer` 의 내부를 모른 채 "꺼졌나"만 보고, 플레이어는 풀을 전혀 모른다. `_playGeneration` 은 토큰 없이도 "다른 `Play()` 나 `OnDisable()` 이 끼어들면 이전 루프를 무효화"하는 경량 취소 수단이다.

- **필요한 그래프**
  1. *종류: stateDiagram*. 질문: "풀 인스턴스의 수명은?" 노드: `미생성 / Idle / Active`. 엣지: `WarmUp/AddCharacters → Idle`(Instantiate×4, SetActive(false), DontDestroyOnLoad), `Play → Active`(Dequeue), `ReturnAfterPlay 완료/ReturnAll → Idle`, `Clear → 미생성`(ReleaseInstance).
  2. *종류: flowchart*. 질문: "반납 트리거는 어떻게 갈리나?" 노드: `Play` → `EffectSpritePlayer 있나?` → Yes(`WaitUntil enabled==false`) / No(`Delay 1000`) → `Return`.
  3. *종류: stateDiagram*. 질문: "스프라이트 플레이어의 재생 상태는?" 노드: `대기 / 재생중 / 중단`. 엣지: `OnEnable&&_playOnStart → 재생중`, `1사이클&&!_loop → 대기(enabled=false)`, `_playGeneration 불일치/토큰 취소 → 중단`.

- **표·알약·카드로 낼 사실**
  - *표*: WarmUp vs AddCharacters — 헤더 `항목 | WarmUpAsync | AddCharactersAsync`, 행 3개(호출 시점·기존 풀 처리·중복 처리).
  - *표*: 풀 자료구조 4종 — `_idle / _active / _warmUpAddresses / _handles`.

---

### 기능 6: 턴 시스템 (`TurnManager`)

- **무엇을 · 어떻게 만들었나**
  - **토글식 전투 스위치** — 외부 `IBattleFlowManager.OnBattle` 이벤트에 `SwitchBattle` 을 구독한다. `m_cts` 가 이미 있으면 **두 번째 발화 = 전투 종료**(`BattleEnd`)로 해석하는 토글. 시작 시 컷씬 래퍼를 장착(`WrapBattleActions`)하고 라운드 루프를 돌린다. *한 줄: 같은 이벤트를 켜기/끄기 스위치처럼 쓴다.*
  - **속도 + 난수 정렬 큐** — 매 라운드 생존 유닛만 `RandomSpeed = Random.Range(0,10000)` 로 흔든 뒤 `_turnQueue.Sort()`. 정렬은 `ITurnUseUnit : IComparable` 의 `CompareTo`(속도 내림차순, 동률 시 RandomSpeed)에 위임. *한 줄: 속도로 줄 세우되, 동률은 매 라운드 새로 뽑은 난수로 가른다.*
  - **자기 턴 시작 처리 순서** — `BaseCharacter` 유닛은 `TickBuffs → TickSeals → TickDistrust → ClearRecentAnomaly` 후, **강제 휴식(ConsumeSkipTurn) → 돌발 행동(TryRunSelfTurnAnomalyAsync)** 순으로 판정하고, 마지막에 `ResetReactionCount`. 둘 중 하나라도 발동하면 계획 행동을 생략. *한 줄: 버프 감소→행동 억제 판정→행동, 순서 자체가 규칙이다.*
  - **큐 동일성 확인 제거** — 턴 도중 큐가 바뀔 수 있어, 제거 전 `_turnQueue[0] == unit` 을 확인한 뒤 `RemoveAt(0)` 하고, 죽은 유닛은 뒤→앞으로 순회하며 정리.

- **핵심 코드** — 하나의 이벤트를 토글로 쓰는 진입부와, 순서가 곧 규칙인 자기 턴 처리(`TurnManager.cs`):
  ```csharp
  public void SwitchBattle(BaseCharacter[] characters, BaseCharacter[] targets) {
      if (m_cts != null) { BattleEnd(); return; }   // ← 두 번째 발화 = 전투 종료 (토글)
      m_cts = new CancellationTokenSource();
      ...
      _skillCutSceneInjector?.WrapBattleActions(characters, targets);  // 전투 직전 컷씬 래퍼 장착
      StartBattleAsync(m_cts.Token).Forget();
  }
  ```
  ```csharp
  // 자기 턴 시작: 지속효과 감소 → 억제 판정(강제 휴식/돌발) → 리액션 리셋. 순서가 규칙이다.
  ownerChar.TickBuffs(); ownerChar.TickSeals(); ownerChar.TickDistrust();
  ownerChar.ClearRecentAnomaly();
  if (ownerChar.ConsumeSkipTurn()) skipNormalTurn = true;               // 강제 휴식 우선
  else skipNormalTurn = await ownerChar.TryRunSelfTurnAnomalyAsync();   // 아니면 돌발 판정
  ownerChar.ResetReactionCount();                                       // 돌발 판정 이후에 리셋
  if (!skipNormalTurn) await unit.TakeTurnAsync();                      // 억제 안 됐을 때만 행동
  ```
  > **어디가·왜**: `TickDistrust()` 를 봉인과 같은 타이밍에 두고, `ResetReactionCount()` 를 **돌발 판정 이후**에 두는 게 의도된 순서다(주석 명시 — "자기 턴 도달 → 연속 리액션 카운트 리셋, 돌발 판정 이후"). 순서를 바꾸면 돌발/리액션 판정 결과가 달라진다.

- **필요한 그래프**
  1. *종류: flowchart*. 질문: "OnBattle 한 번/두 번이 각각 무엇을 하나?" 노드: `SwitchBattle` → `m_cts!=null?` → Yes(`BattleEnd`) / No(`cts 생성 → 유닛 구성 → WrapBattleActions → StartBattleAsync`). 엣지: 토글 + `null 인자 → LogError`.
  2. *종류: sequenceDiagram*. 질문: "한 라운드가 유닛 하나를 어떻게 처리하나?" 참가자: TurnManager·_turnQueue·CharacterSelector·Unit. 핵심 엣지: `PrepareTurnQueue(흔들고 Sort) → 각 유닛: Select/Deselect → Tick 4종 → 억제 판정 → TakeTurnAsync → RemoveAt(동일성 확인) → RemoveDead`.

- **표·알약·카드로 낼 사실**
  - *표*: `TestPlayer` 입력 매핑 — `Space`(턴 완료)·`F`(강제 사망).
  - *카드(points)*: 자기 턴 처리 6단계 순서(Tick 4종 → 억제 판정 → ResetReactionCount).

---

### 기능 7: 타임라인 커스텀 트랙 — Playables API (`CameraShakeTrack` · `SilhouetteTrack`)

- **무엇을 · 어떻게 만들었나**
  - **동일한 4파일 구조 2벌** — 두 트랙 모두 `Track`(TrackAsset) → `Clip`(PlayableAsset) → `ClipBehaviour`(데이터 홀더) → `MixerBehaviour`(실제 적용). Timeline 에서 클립을 얹어 편집하고, `MixerBehaviour.ProcessFrame` 이 바인딩 객체에 값을 적용한다. *한 줄: 카메라 흔들림·실루엣을 타임라인에 얹을 수 있는 "트랙"으로 만들었다.*
  - **내장 블렌드 대신 직접 페이드** — 두 Clip 모두 `clipCaps => ClipCaps.None` 이라 Timeline 내장 블렌드/루프를 안 쓰고, `CalculateFadeWeight`(fadeIn/fadeOut 구간을 Clamp01)로 **페이드를 직접 계산**한다. *한 줄: 페이드를 프레임워크에 맡기지 않고 손으로 쥔다.*
  - **바인딩 타입으로 대상 지정** — CameraShake 는 `CinemachineBasicMultiChannelPerlin` 을, Silhouette 는 `SpriteRenderer` 를 `TrackBindingType` 으로 받아, 원본 값을 캐시했다가 클립이 없으면 복원한다.
  - **트랙→믹서 머티리얼 주입** — `SilhouetteTrack` 은 `CreateTrackMixer` 에서 Inspector 머티리얼을 믹서에 주입한다(`Shader.Find` 미사용 — 에셋 참조라야 빌드에 자동 포함). 실루엣 적용은 `MaterialPropertyBlock` 으로 `_BlendFactor` 를 보간한다.

- **핵심 코드** — 트랙이 믹서를 만들 때 머티리얼을 함께 주입한다(`SilhouetteTrack.cs`):
  ```csharp
  public override Playable CreateTrackMixer(PlayableGraph graph, GameObject go, int inputCount) {
      ScriptPlayable<SilhouetteMixerBehaviour> playable =
          ScriptPlayable<SilhouetteMixerBehaviour>.Create(graph, inputCount);
      playable.GetBehaviour().SetMaterial(silhouetteMaterial);   // ← Inspector 머티리얼 주입 (Shader.Find 대신)
      return playable;
  }
  ```
  ```
  // 두 Mixer 공통 페이드 계산 (내장 블렌드 대신)
  fadeIn  > 0 && clipTime < fadeIn                 → Clamp01(clipTime / fadeIn)
  fadeOut > 0 && clipTime > clipDuration - fadeOut → Clamp01((clipDuration - clipTime) / fadeOut)
  그 외                                            → 1f
  ```
  > **어디가·왜**: `Shader.Find` 는 빌드에서 셰이더가 스트립되면 null 이 될 수 있어, **Inspector 에셋 참조**를 쓴다(주석 명시 — 에셋 참조는 빌드에 자동 포함). 두 Mixer 는 `totalWeight` 누적식이 다른데(CameraShake 는 `+= weight`, Silhouette 는 `+= weight × fadeWeight`), 이는 "가중 합"과 "페이드 반영 누적"이라는 의도 차이다.

- **필요한 그래프**
  1. *종류: flowchart*. 질문: "커스텀 트랙 4파일이 어떻게 맞물리나?" 노드: `TrackAsset.CreateTrackMixer → MixerBehaviour`, `Clip.CreatePlayable → ClipBehaviour`, `ClipBehaviour → Mixer(GetInput)`, `바인딩 객체 → Mixer(playerData)`. 엣지: 위.
  2. *종류: flowchart*. 질문: "Mixer.ProcessFrame 이 프레임마다 무엇을 하나?" 노드: `playerData 캐스트 가드 → 초기화 시 CacheTarget → 입력 순회(weight>0: fadeWeight·blend 누적) → totalWeight>0? → Apply / RestoreOriginal`. 엣지: 위.

- **표·알약·카드로 낼 사실**
  - *표*: 두 트랙 어트리뷰트 — 헤더 `트랙 | TrackColor | ClipType | BindingType`, 행 2개.
  - *표*: 두 Mixer 차이 3가지 — `totalWeight 누적식 | 트랙→믹서 주입 | OnPlayableDestroy 복원 판정`.

---

## PART B 로 넘길 때 (파이프라인 AI 용 매핑 힌트)

> 아래는 PART A 를 `src/content/docs/bond.yaml` 로 조립할 때의 **참고**일 뿐, 스키마 확정은 PART B 담당이다.

- **개요** → `overview.stack` 에 위 기술 스택 표(분류·기술·**목적 필수**)를 그대로 넣는다. `what` 은 A1, `why`·`evidence`·`scope` 중 **why/evidence 는 양식 ②** 에서 온다(scope 는 A1 에 있음).
- **A2 계층 구성** → `type: layers`(components·relations·flow 필수, 강조=L2, 점선=`MapRepository→MapNavigator`). 채널 흐름도·DI 스코프도는 mermaid(flowchart).
- **각 기능의 핵심 코드** → `type: code`(**notes 필수** — 위 "어디가·왜" 문장을 notes 로).
- **각 기능의 필요한 그래프** → B2 규칙대로: 상태 전이=`stateDiagram-v2`, 흐름/분기=`flowchart`, 타입 계층=`classDiagram`. 각 그래프에 위 "질문" 문장을 `question` 캡션으로.
- **표/알약/카드** → 수치·항목 표=`type: table`(행 칸 수=헤더 수), 순서 흐름=`type: chips`, 항목 카드=`type: points`(2개+), 곁가지=`type: callout`.
- **게이트 주의**: 개요는 (what+why) 또는 goals 중 하나 + **evidence·scope 필수**, retrospective 의 learnings·improvements 필수 — 모두 **양식 ②** 가 채워야 통과한다. 이 PART A 만으로는 빌드 게이트를 통과하지 못한다.

> **채워지지 않은 자리(양식 ②·③ 필요)**: 고민과 선택(결정 근거), 측정값/evidence, 회고(learnings·improvements), 팀 구성·역할, 스크린샷·저장소 링크·IDE.
