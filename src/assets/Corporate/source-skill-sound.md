# 기술문서 양식 ① — 구현 · PART A (작성본)

> **대상 repo**: `Corporate-Agreement` (팀 프로젝트) · **작성 범위**: 이주노(git: `cozam2@naver.com` / `cozam3@gmail.com`)가 **직접 생성한 스킬 프레임워크 + 사운드 시스템**.
> **철칙 준수**: 아래 내용은 전부 실제 코드 · `git log` 에서 확인한 사실이다. 확인 불가한 항목은 `« »` 로 비워 두었다 — 사람이 채우거나 확정해야 한다.
> **PART B(YAML 조립)는 이 문서에 없다**: 양식 ②(고민·회고) · ③(스크린샷·링크)이 있어야 게이트를 통과한다. 그 둘은 사람이 채운다.

---

## A0. 메타 — git · ProjectSettings 에서

- **slug**: «projects.yaml 의 키로 확정 필요. 제안: `skill-sound` 또는 게임 실제 타이틀»
- **subtitle**: «장르 확정 필요. 코드 근거상 **2D 뱀서라이크/로그라이트 액션**으로 보임 — 근거: `AliveExistSystem.monsterList`(다수 몬스터), 스킬이 최근접 적 자동 추적, 레벨업 시 스킬 강화 선택(`OptionChoice_SkillOption`), `Stage1~5` · `StageEvent.stageClearEvent`. 확정은 사람이»
- **period**: **2025.07.07 ~ 2025.08.06** (이주노가 스킬·사운드 파일을 처음/마지막으로 커밋한 날. `git log`. 프로젝트 전체는 2025.06.30 ~ 08.13)
- **engine**: **Unity 2022.3.62f1** (`ProjectSettings/ProjectVersion.txt`) · 렌더 파이프라인 «확인 필요 — 2D 프로젝트»
- **작성 기여 범위(중요)**: 이 문서가 다루는 코드는 **본인이 생성한 파일**이다 —
  - 스킬: `SkillManager.cs`(+ `ISkillID`), `ActiveSkillBase.cs`, `ActiveSkillData.cs`(+ `SkillType` enum), `SkillPrefab/AquaBall.cs`
  - 사운드: `SFXManager.cs`, `BGMManager.cs`, `SFXData.cs`, `SoundExecel.cs`
  - **팀원(dopajac) 작성물이라 "내가 만든 것"으로 쓰지 않는다**: 스킬 데이터 SO(`ActiveSkillSO`, `BuffSO`), 개별 스킬 프리팹(`Warrior Strong Mind`, `Beast Claw`, `Huge FootPrint`, `Magic Explosion` 등). 단, 본인 프레임워크가 이들을 **로드·구동**하므로 "관계"로만 등장시킨다.
> team · vcs · ide · 유튜브/깃허브 링크 · 스크린샷은 코드로 알 수 없다 → **양식 ③**.

---

## A1. 개요 — 사실

- **lead**: 2D 액션 게임의 **스킬 시스템 프레임워크와 사운드 시스템**을 설계·구현했다. 스킬은 **데이터(ScriptableObject)와 실행(프리팹)을 정수 ID 하나로 묶는 `ISkillID` 계약**으로 연결되고, `SkillManager` 가 에디터에서 스킬 에셋을 자동 수집한 뒤 런타임에 **원본을 복제**해 플레이어에 배분하고 레벨업 강화까지 처리한다. 사운드는 **AudioSource 풀링 SFX** · **상태 기반 BGM** · **에디터 자동 에셋 생성**으로 구성된다.
- **what** (이 문서가 다루는 것 = 지도): **스킬이 어떻게 로드되어 플레이어에 연결되고, 어떻게 강화되며, 한 스킬(`AquaBall`)이 런타임에 어떻게 동작하고 사운드를 내는가.** 데이터 정의(`ActiveSkillSO`/`BuffSO`)와 개별 스킬 로직은 팀원 몫이라 프레임워크가 그것들을 **어떻게 구동하는지**까지만 다룬다.
- **scope**: **다룬다** — ① `ISkillID` 기반 데이터↔실행 매칭, ② `SkillManager` 의 에디터 자동 수집 · 런타임 복제 · ID 매칭 배분, ③ 레벨업 스킬 강화(`SkillEnchant`), ④ `ActiveSkillBase` 추상 베이스와 유도 투사체 스킬 `AquaBall`, ⑤ SFX 풀 · 상태 BGM · SFXData 에디터 자동화. **다루지 않는다** — 개별 스킬 데이터/밸런싱, 플레이어·전투·몬스터·스테이지 시스템(팀원), 아트·사운드 리소스 제작, UI.
- **기술 스택** (분류 · 기술 · **사용 목적**):

  | 분류 | 기술 | 사용 목적(왜 이 기술) |
  |---|---|---|
  | 엔진 · 렌더 | Unity 2022.3.62f1 · «RP 확인» | 2D 액션 게임 |
  | 데이터 분리 | ScriptableObject | 스킬 스탯·사운드 설정을 코드 밖 에셋으로 분리. 런타임엔 **복제본**을 써 원본 에셋 보호 |
  | 데이터↔실행 결합 | `interface ISkillID` (int 계약) | 데이터 SO와 실행 프리팹이 **같은 정수 ID**를 갖게 해, 서로를 직접 참조하지 않고 매칭 |
  | 에디터 자동화 | `AssetDatabase` · `MenuItem` · LINQ | 스킬 SO 자동 수집(드래그 없이) · `SE_*.mp3` → `SFXData` 에셋 일괄 생성 |
  | 오디오 | `AudioSource` 풀링 · `Dictionary<BGMState,AudioClip>` | 겹치는 효과음 동시 재생 · 상태 전환으로 BGM 교체 |
  | 수명주기 | 싱글턴 + `DontDestroyOnLoad` | 씬 전환에도 살아남는 사운드 매니저 |
  | 데이터 테이블 | `ExelReaderBase<SkillOption>` (팀 공용, **사용만**) | 레벨업 강화 수치 테이블을 스킬 강화에 주입 |
> why(동기) · evidence(측정값)는 **양식 ②**. 개요 가운데는 WHAT/WHY 2단 또는 목표 카드 중 하나 — 사람이 ②의 why 와 짝지어 결정.

---

## A2. 시스템 구조 — 말로 서술 (그림은 PART B 가 그린다)

- **intro**: 스킬 시스템은 **"데이터(SO)"와 "실행(프리팹)"을 분리**하고, 둘을 **정수 ID(`ISkillID`)로만** 잇는다. `SkillManager` 가 중앙에서 에디터 수집 → 런타임 복제 → ID 매칭 배분 → 강화까지 담당하는 **파사드/오케스트레이터**다. 사운드 시스템은 이와 독립된 두 싱글턴(`SFXManager`, `BGMManager`)이며, 스킬 실행부(`AquaBall`)가 **`SFXManager.Play(skillSound)`** 로 사운드에 붙는 것이 유일한 접점이다.

- **계층 구성** (위→아래):
  - **오케스트레이션** — `SkillManager`(MonoBehaviour). 스킬 수집·복제·연결·강화·이름조회.
  - **데이터 계층** — `ActiveSkillSO` · `BuffSO`(팀원) : `ScriptableObject`, `ISkillID`. 스탯·쿨타임·데미지·프리팹 참조 보유. 본인이 정의한 `ActiveSkillData`/`PassiveSkillData` 추상 베이스와 `SkillType` enum 이 데이터 스키마의 뼈대.
  - **실행 계층** — `ActiveSkillBase`(추상 MonoBehaviour) → `AquaBall` 등 프리팹 스크립트. `owner`(Player)와 런타임 `SkillStat` 보유, `ISkillID` 구현.
  - **사운드 계층** — `SFXManager`(풀) · `BGMManager`(상태 dict) · `SFXData`(SO) · `SoundExecel`(에디터 툴).
  - **구성요소(무엇으로)**: 인터페이스 1(`ISkillID`) · 추상 클래스 2(`ActiveSkillBase`, `ActiveSkillData`/`PassiveSkillData`) · 매니저 3(`SkillManager`, `SFXManager`, `BGMManager`) · SO 1(`SFXData`) · 에디터 툴 2(`AutoAssignSkillObjects`, `SoundExecel`).
  - **관계(누가 누구를 아나)**: `SkillManager` 는 `Player`·`ActiveSkillSO`·`BuffSO`·`OptionChoice_SkillOption` 을 안다. 실행 프리팹(`AquaBall`)은 `owner.skills[]` 를 통해 자기 데이터 SO를 역참조하고, `SFXManager`·`CombatSystem`·`AliveExistSystem`(팀원)을 싱글턴으로 호출한다. **데이터 SO와 실행 프리팹은 서로를 직접 참조하지 않고 ID로만 만난다.**
  - **흐름(입력→출력)**: (에디터) 폴더 스캔 → `Origin_skillObjects` → (런타임 시작) 복제 → `ISkillID` 필터 → `SetSkillID()` → `ConnectSkills()` 로 `player.skills[]` 배분 → (게임 중) 레벨업 선택 → `SkillEnchant()` 로 복제본 스탯 갱신 → (시전) 프리팹 생성 → `Initialize()` 로 스탯 확정 → 동작 + `SFXManager.Play`.

- **핵심 클래스 관계** (계약/상속 — 그림은 PART B):
  - **`ISkillID`** (interface): `int SkillID { get; set; }` + `void SetSkillID()`. **구현자**: `ActiveSkillSO`, `BuffSO`(데이터 쪽) **그리고** `AquaBall`(실행 쪽). → 데이터와 실행이 같은 계약을 공유하는 것이 이 시스템의 핵심.
  - **`ActiveSkillBase`** (abstract MonoBehaviour): `owner`, `skillSound(SFXData)`, 중첩 클래스 `SkillStat`, `abstract Initialize()`. **상속자**: `AquaBall`(+ 팀원 스킬 프리팹들).
  - **`ActiveSkillData` / `PassiveSkillData`** (abstract ScriptableObject): 스킬 데이터 스키마(ID·이름·타입·레벨·쿨타임·데미지·범위 / 버프는 지속·발동확률 등)와 `SkillType{active,buff}` enum 정의. → 실제 런타임 SO(`ActiveSkillSO`/`BuffSO`)가 이 스키마·enum 을 따른다.

---

## A3. 핵심 기능 — 1..N

### 기능 1: `ISkillID` — 데이터와 실행을 정수 ID 하나로 묶는 계약

- **무엇을 · 어떻게 만들었나**
  - 스킬의 "데이터"(밸런싱용 ScriptableObject)와 "실행"(씬에 뜨는 프리팹 스크립트)은 서로를 몰라야 한다. 그래서 **양쪽 모두 `ISkillID` 를 구현**하게 하고, `SetSkillID()` 안에서 자신의 `Skill_ID`(에셋에 박힌 int)를 런타임 `SkillID` 로 복사한다.
  - 결과: `SkillManager` 는 "이 플레이어가 가진 스킬 ID" 배열만 보고, 같은 ID를 가진 데이터 SO/실행 프리팹을 **직접 참조 없이** 이어붙일 수 있다. **한 줄 요약** — "이름·타입이 아니라 int ID 계약으로 데이터↔실행을 매칭한다."
- **핵심 코드**: 계약과, 데이터/실행 양쪽의 동일한 구현
  ```csharp
  // SkillManager.cs — 계약
  public interface ISkillID
  {
      public int SkillID { get; set; }
      public void SetSkillID();
  }
  // ActiveSkillSO.cs (데이터) · AquaBall.cs (실행) 둘 다 동일 패턴
  public int Skill_ID;                       // 에셋/인스펙터에 박힌 고정 ID
  public int SkillID { get; set; }
  public void SetSkillID() { SkillID = Skill_ID; }  // 런타임에 복사
  ```
  - 「어디가·왜」: `SetSkillID()` 가 **에셋 값(`Skill_ID`) → 런타임 값(`SkillID`)** 을 복사하는 지점. 데이터 SO와 실행 프리팹이 같은 계약을 공유하므로, 매니저는 구체 타입을 몰라도 `ISkillID.SkillID` 만으로 짝을 찾는다.
- **필요한 그래프**: **[종류: classDiagram]** 질문 "데이터·실행 두 축은 무슨 계약을 공유하고 누가 구현하나?" · 노드: `ISkillID`(interface), `ActiveSkillSO`, `BuffSO`, `ActiveSkillBase`(abstract), `AquaBall` · 엣지: `ISkillID <|.. ActiveSkillSO`, `<|.. BuffSO`, `<|.. AquaBall`; `ActiveSkillBase <|-- AquaBall`.
- **표/카드 거리**: `ISkillID` 구현자 표(구현자 · 역할[데이터/실행]) — points 카드로 낼 수 있음.

### 기능 2: `SkillManager` — 에디터 자동 수집 · 런타임 복제 · ID 매칭 배분

- **무엇을 · 어떻게 만들었나**
  - **① 에디터 자동 수집**: `AutoAssignSkillObjects()` 가 `Assets/00.Resources/DataBase/Skills/Active`·`/Buff` 폴더를 `AssetDatabase.FindAssets` + LINQ 로 훑어 `Origin_skillObjects` 를 채운다 → **인스펙터에 스킬을 일일이 드래그하지 않는다.** (`#if UNITY_EDITOR`)
  - **② 런타임 복제**: 시작 시 각 원본 SO를 `Instantiate` 로 **복제**해 `skillObjects` 로 쓴다. 이후 강화가 복제본만 바꾸므로 **프로젝트 원본 에셋이 오염되지 않는다.**
  - **③ ID 매칭 배분**: 복제본 중 `ISkillID` 만 필터 → `SetSkillID()` → `ConnectSkills()` 가 `players[i].data.skill_possed[]`(플레이어가 보유한 스킬 ID)와 스킬 ID를 대조해 `players[i].skills[]` 슬롯(0/1)에 꽂는다. **한 줄 요약** — "수집·복제·연결을 매니저 한 곳이 책임진다."
- **핵심 코드**: 복제 + 필터 + 배분
  ```csharp
  // 1) 원본 SO 복제 — 런타임 강화가 원본 에셋을 건드리지 않도록
  foreach (var origin in Origin_skillObjects)
      clonedList.Add(Instantiate(origin));
  skillObjects = clonedList.ToArray();

  // 2) ISkillID 만 골라 런타임 ID 세팅
  foreach (var obj in skillObjects)
      if (obj is ISkillID id) temp.Add(id);
  skills = temp.ToArray();
  foreach (var skill in skills) skill.SetSkillID();

  // 3) 플레이어 보유 ID ↔ 스킬 ID 대조 후 슬롯 배분
  if (players[i].data.skill_possed[0] == skills[j].SkillID)
      players[i].skills[0] = skills[j];
  ```
  - 「어디가·왜」: `Instantiate(origin)` — SO 복제로 **원본 보호**(강화가 세션 한정). `obj is ISkillID id` — 타입 불문 계약만으로 필터. `skill_possed[k] == SkillID` — 보유 목록과 실제 스킬을 int 로 연결.
- **필요한 그래프**: **[종류: flowchart]** 질문 "스킬은 어떻게 로드되어 플레이어에 연결되나?" · 노드/엣지: `에디터 폴더 스캔 → Origin_skillObjects →(Instantiate)→ 복제 skillObjects → ISkillID 필터 → SetSkillID() → ConnectSkills()(skill_possed 대조) → players[i].skills[0/1]`.
- **표/카드 거리**: 스캔 대상 폴더 표(Active/Buff 경로), 배분 슬롯 규칙(슬롯 0/1) 카드.
- **주의(callout 후보)**: `AutoAssignSkillObjects` 는 `#if UNITY_EDITOR` — 빌드에는 포함되지 않으므로 런타임 전 에디터에서 수집이 끝나 있어야 한다.

### 기능 3: `SkillEnchant` — 레벨업 강화(액티브/버프 분기)

- **무엇을 · 어떻게 만들었나**
  - 레벨업 시 `SetSelectionID(id)` → `GameManager` 의 선택 버튼에서 `selectID` 를 받아 `OptionChoice_SkillOption`(엑셀 테이블)에서 강화 수치 한 줄(`Skill_LvUP`, `Cooldown_Reduction`, `Damage_Increase`, `Duration_Increase`, `Activation_Rate_Increase`)을 조회한다.
  - 대상 스킬 ID를 가진 플레이어 스킬을 찾아 **타입별로 다르게 적용** — `ActiveSkillSO` 면 레벨/쿨감/데미지, `BuffSO` 면 레벨/쿨감/지속/발동확률. **버프 쿨타임은 하한 0.1초로 클램프.** **한 줄 요약** — "테이블 값을 타입에 맞춰 복제본 스탯에 누적한다."
- **핵심 코드**: 타입 분기 강화 + 쿨타임 하한
  ```csharp
  var a = skillOption.GetValue(Selection_ID);   // 엑셀 테이블 한 줄
  if (player.skills[i] is ActiveSkillSO active) {
      active.Skill_current_LV += a.Skill_LvUP;
      active.Skill_Cooldown   -= a.Cooldown_Reduction;
      active.Skill_Damage     += a.Damage_Increase;
  }
  if (player.skills[i] is BuffSO buff) {
      buff.Skill_current_LV += a.Skill_LvUP;
      buff.Skill_Cooldown   -= a.Cooldown_Reduction;
      if (buff.Skill_Cooldown - a.Cooldown_Reduction <= 0.1f) buff.Skill_Cooldown = 0.1f; // 하한
      buff.Skill_Duration        += a.Duration_Increase;
      buff.Skill_Activation_Rate += a.Activation_Rate_Increase;
  }
  ```
  - 「어디가·왜」: `is ActiveSkillSO`/`is BuffSO` 분기 — 액티브엔 데미지, 버프엔 지속·발동확률처럼 **의미 있는 필드만** 강화. `0.1f` 클램프 — 쿨타임이 0 이하로 내려가 즉시 재발동되는 것 방지.
- **표로 낼 사실** (table 후보):

  | 강화 수치 | Active 적용 | Buff 적용 |
  |---|---|---|
  | Skill_LvUP(레벨) | ○ | ○ |
  | Cooldown_Reduction(쿨감) | ○ | ○ (하한 0.1s) |
  | Damage_Increase(데미지) | ○ | — |
  | Duration_Increase(지속) | — | ○ |
  | Activation_Rate_Increase(발동확률) | — | ○ |
- **필요한 그래프**: **[종류: flowchart]** 질문 "레벨업 선택이 어떻게 스킬 강화로 이어지나?" · 노드: `SetSelectionID → GameManager.selectID → skillOption.GetValue → (skill 타입 분기) → 복제본 스탯 누적`.

### 기능 4: `ActiveSkillBase` + `AquaBall` — 추상 실행 베이스와 유도 투사체

- **무엇을 · 어떻게 만들었나**
  - **베이스**: `ActiveSkillBase`(추상 MonoBehaviour)가 모든 실행 스킬의 공통 뼈대 — `owner`(시전자), `skillSound`, 런타임 계산용 `SkillStat`(중첩 클래스), `abstract Initialize()`.
  - **AquaBall(유도 투사체)**: 최근접 적을 향해 **처음엔 곡선(유도), 목표에 가까워지면 직선**으로 접근한다. 곡선 속도는 시간의 거듭제곱(`Mathf.Pow(t, curvefloat)`)을 `maxSpeed` 로 클램프해 점점 빨라지고, 회전 속도는 거리로 `Lerp`(가까울수록 빠르게). 목표 0.5 이내에서 **터짐** — 카메라 흔들림(`DamgeEvent.OnTriggerShake`) + 콜라이더 ON. 적 충돌 시 `CombatEvent` 를 `CombatSystem` 에 넣어 데미지, 이펙트 후 파괴. `Initialize()` 에서 `owner.skills[]` 중 자기 ID의 SO를 찾아 **데미지 = `owner.Damage × skill.Skill_Damage`**, 범위로 콜라이더/이펙트 크기를 확정한다. 스테이지 클리어 이벤트 구독으로 자동 정리. **한 줄 요약** — "데이터 SO의 스탯을 자기 ID로 끌어와 유도·타격·정리까지 자립적으로 수행하는 실행 스킬."
- **핵심 코드**: 곡선→직선 유도 + 스탯 확정
  ```csharp
  // MoveToEnemyHurt() — 곡선형 가속, 거리로 직선 전환
  float curveSpeed = Mathf.Min(Mathf.Pow(timeSinceStart, curvefloat), maxSpeed);
  float dynamicRotateSpeed = Mathf.Lerp(180f, 90f, distanceToTarget / 5f); // 가까울수록 빠른 회전
  velocity = curveSpeed * initialSpeed * Time.deltaTime;
  // distanceToTarget < 0.5f → 터짐: 카메라 흔들림 + 콜라이더 ON (한 번만)

  // Initialize() — 자기 ID의 SO에서 스탯 확정
  if (owner.skills[0].SkillID == SkillID && owner.skills[0] is ActiveSkillSO skill) {
      stat.Damage = owner.Damage * skill.Skill_Damage;
      coll.size   = new Vector2(skill.Skill_Range_width, skill.Skill_Range_height);
  }
  ```
  - 「어디가·왜」: `Mathf.Pow(t, curvefloat)` — 발사 직후 느리다 점점 빨라지는 유도감. `Lerp(180,90, dist/5)` — 가까울수록 급회전해 명중률↑. `owner.Damage * skill.Skill_Damage` — 스킬 SO는 **배율**만 갖고 실제 데미지는 시전자 능력치와 곱해 산출.
- **필요한 그래프**: **[종류: stateDiagram 또는 flowchart]** 질문 "투사체는 생성부터 소멸까지 어떤 단계를 거치나?" · 노드/전이: `생성(Initialize) → 곡선 유도(거리>straight) → 직선 유도(거리<straight) → 터짐(거리<0.5: 카메라흔들림·콜라이더ON) → 적 충돌(CombatSystem에 데미지) → 이펙트 딜레이 → 파괴`. 타겟 소실 시 `TempTarget` 으로 폴백하는 분기도 노드로.
- **접점(callout 후보)**: `Start()` 에서 `SFXManager.Instance.Play(skillSound)` — **스킬 시스템이 사운드 시스템에 붙는 유일한 지점**.

### 기능 5: 사운드 시스템 — SFX 풀 · 상태 BGM · 에디터 자동화

- **무엇을 · 어떻게 만들었나**
  - **`SFXData`(SO)**: `clip` + `volume`(0~2). `[CreateAssetMenu]` 로 에셋화 → 효과음을 코드 밖 데이터로.
  - **`SFXManager`(싱글턴 풀)**: `Awake` 에서 `AudioSource` 를 `poolSize(10)` 개 미리 생성. `Play(SFXData)` 는 **재생 중이 아닌 소스**를 찾아 클립·볼륨을 세팅해 재생 → 효과음이 겹쳐도 서로 끊지 않는다. `DontDestroyOnLoad`.
  - **`BGMManager`(싱글턴)**: `BGMState{Lobby, Stage1~5}` 를 `BGMData[]` → `Dictionary<BGMState,AudioClip>` 로 구축. `ChangeBGM(state)` 는 **현재 클립과 다를 때만** 교체·루프 재생(같은 곡 재시작 방지). `DontDestroyOnLoad`.
  - **`SoundExecel`(에디터 툴)**: `MenuItem("Tools/Create SFXData (From Path)")` — `Assets/00.Resources/Sound/` 의 `SE_*.mp3` 를 훑어 `SFXData` 에셋을 **일괄 자동 생성**. **한 줄 요약** — "효과음은 풀로 겹쳐 재생, BGM은 상태로 교체, 에셋은 버튼 하나로 생성."
- **핵심 코드**: 풀에서 빈 소스 재생 + 상태 dict 교체
  ```csharp
  // SFXManager — 재생 중이 아닌 소스에 실어 재생 (겹침 허용)
  foreach (var s in audioSources)
      if (s.isPlaying == false) { s.clip = sfxData.clip; s.volume = sfxData.volume; s.Play(); return; }

  // BGMManager — 상태로 조회, 현재와 다를 때만 교체
  if (bgmDict.TryGetValue(newState, out AudioClip clip) && bgmSource.clip != clip) {
      bgmSource.clip = clip; bgmSource.loop = true; bgmSource.Play();
  }
  ```
  - 「어디가·왜」: `isPlaying == false` 탐색 — 고정 풀에서 빈 채널만 재사용(동시 발음 수 = poolSize). `bgmSource.clip != clip` 가드 — 같은 스테이지 재진입 시 BGM 이 처음부터 다시 시작하는 것 방지.
- **표로 낼 사실** (table 후보): `BGMState` 매핑

  | BGMState | 상황 |
  |---|---|
  | Lobby | 로비/시작(`Awake` 에서 기본 재생) |
  | Stage1~5 | 각 스테이지 BGM |
- **필요한 그래프**: 대체로 표/카드로 충분. 필요 시 **[종류: flowchart]** "효과음 재생 경로"(`AquaBall.Start → SFXManager.Play → 빈 AudioSource 탐색 → 재생`).

---

## 다음 단계 — 사람이 채워야 PART B(YAML) 로 간다

이 PART A 는 **코드 사실**만 담았다. 아래는 코드로 알 수 없어 반드시 사람이 채워야 한다(게이트 필수):

- **양식 ② (판단·회고)** — `2-판단-직접.md`
  - **고민과 선택 최소 1건**: 예) "스킬 데이터-실행 결합을 왜 상속/직접참조가 아니라 `ISkillID` 정수 계약으로 했나", "런타임에 SO를 왜 복제했나", "효과음을 단일 AudioSource 가 아니라 풀로 한 이유" — 선택지·기준·채택 이유를 **본인 실제 판단으로** 적어야 함.
  - **retrospective**: 만족한 점 · 배운 점(learnings) · 개선 계획(improvements) — 필수.
- **양식 ③ (자산)** — `3-자산.md`
  - **slug 확정 · subtitle(장르) 확정**, team · vcs · ide, 유튜브/깃허브 링크, **스크린샷**(hero + 본문: 스킬 발동 장면, 인스펙터 자동 수집 결과 등)과 캡션.

이후 **파이프라인 AI** 가 `Portfolio_Pipeline` 에서 이 셋(①+②+③)을 `src/content/docs/{slug}.yaml` 로 조립하고 `npx astro build` 로 검증한다.
