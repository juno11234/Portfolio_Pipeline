# 구현 문서 ① — 소울라이크 (Soul_Like_Project)

> **양식:** `Portfolio_Pipeline/templates/1-구현-AI.md` (구현 · PART A / PART B 분리판)
> **이 문서 = PART A(프로젝트 AI 산출물).** 대상 repo(`soulLike/`) 게임 코드를 읽고 *무엇을 · 어떻게 만들었나*를 **말로** 뽑은 사실이다.
>   YAML 블록 `type` · mermaid 문법은 넣지 않는다 — 그건 PART B(파이프라인 AI)가 조립할 때 한다.
> **철칙:** 코드 · git 에서 확인한 것만. 지어내지 않는다. 모르면 비우고 사람에게 묻는다. (`« »` = 채울 자리)
> **근거:** 소스 스크립트 61개 · 약 5,527줄(외부 에셋 팩 제외) · `git log`(커밋 44개) · `ProjectSettings/ProjectVersion.txt` · `Packages/manifest.json` · `README.md` · 기존 `soulslike.yaml`.
> **작성일:** 2026-07-20 · **대상 커밋:** `2e69fc79` (main, "Create TECHNICAL_DESIGN.md")

---

# PART A — 코드에서 뽑은 사실

## A0. 메타 — git · ProjectSettings 에서

- **slug**: `soulslike` (`projects.yaml` 의 키)
- **subtitle**: 3인칭 소울라이크 액션
- **period**: 2025.11.10 ~ 11.30
  - *근거:* README 명시 개발 기간이자 게임플레이 커밋이 집중된 스프린트. `git log` 전체 첫/마지막은 `2025-11-03`(Initial commit) ~ `2026-07-17`(문서 커밋)이나, 초기 셋업 커밋과 이후 README·UniTask 리팩터·기술문서 커밋(2026-01·04·07)을 제외한 실제 개발 구간으로 표기. 코어 게임플레이 커밋은 `2025-11-10`(리워크·전투) ~ `2025-12-17`.
- **engine**: Unity 6000.0.56f1 · URP 17.0.4
  - *근거:* `ProjectVersion.txt` = `6000.0.56f1`(README 표기와 일치, 불일치 없음). URP 확정 — `GraphicsSettings.asset` 의 `m_CustomRenderPipeline`(`UniversalRenderPipeline`) + `Packages/manifest.json` 의 `com.unity.render-pipelines.universal 17.0.4` + `Assets/Settings/UniversalRenderPipelineGlobalSettings.asset`.

> **team · vcs · ide · 링크 · 스크린샷은 코드로 알 수 없다 → 양식 ③.**
> (확인된 값 참고용 — README·기존 yaml: 1인 / Github Desktop / Rider 2025.1.4(PDF 표기 2025.2.1이나 실제 사용 2025.1.4로 사용자 확인) / git author `juno11234` / 유튜브·깃허브 URL 미확정 / hero 후보 `soul-gameplay.png`, 본문 후보 `soul-animator.png`)

## A1. 개요 — 사실

- **lead**: 스태미나를 소모하는 회피·공격, 화톳불 세이브, 체력 절반에서 전환되는 2페이즈 보스를 갖춘 1인 개발 3인칭 소울라이크. **플레이어는 유한 상태 머신(FSM), 몬스터는 Behaviour Tree(BT)** 로 움직이며, 전투·피격·UI 갱신은 전부 `event` 와 `Observable<T>` 로 흐르는 단방향 구조다.
- **what**: 이 문서는 게임의 **코드 아키텍처**를 다룬다 — ① 입력 2단 릴레이와 플레이어 FSM, ② 이벤트 큐 전투 시스템과 MVVM 데이터 바인딩, ③ 재귀 Behaviour Tree 몬스터 AI(콤보 끊김 버그 해결 포함), ④ 2페이즈 보스·락온 카메라·화톳불/보스방 월드, ⑤ TSV→ScriptableObject 데이터 파이프라인과 Jenkins 빌드 자동화.
- **scope**: 런타임 코드 구조와 흐름, 인터페이스 계약, 이벤트/데이터 파이프라인, 애니메이션 주도 판정, 빌드 자동화를 다룬다. **3D 모델·애니메이션 클립·VFX·사운드 등 외부 에셋(ExplosiveLLC, PolygonDungeon, GothicUI 등)과 레벨 디자인·셰이더는 이 문서의 범위가 아니다.**

### 기술 스택 — 분류 · 기술 · 사용 목적 (개요 섹션 끝에 렌더)

> PART B 참고: 본문 블록이 아니라 **개요의 `overview.stack`** 으로 렌더된다 — 무엇으로 만들었나를 먼저 보이기 위함. purpose 필수.

- **엔진 · 렌더** — Unity 6000.0.56f1 · URP 17.0.4 — 3D 소울라이크 액션 렌더링 · Universal Render Pipeline
- **입력** — Unity Input System 1.14.2 — 디바이스 저수준 콜백을 의미 있는 C# 이벤트로 변환하는 2단 릴레이
- **내비게이션** — AI Navigation(NavMesh) 2.0.8 — `NavMeshAgent` 기반 몬스터 추격·순찰·스트레이프 이동
- **비동기 처리** — UniTask (Cysharp) — GC 없는 `async/await` · 씬 페이드에 `CancellationToken`(파괴 시 자동 취소) 연동
- **UI** — uGUI · TextMeshPro — HP·스태미나 슬라이더, 월드 HP 바 빌보드, 인벤토리 드래그 앤 드롭
- **데이터** — ScriptableObject · TSV — 리플렉션 제네릭 파서로 기획 데이터를 코드와 분리한 데이터 주도 설계
- **빌드 자동화** — Jenkins + Editor 빌드 스크립트 — 1시간 주기 폴링 → 배치 모드 빌드 → `Exit` 코드 판정

> **why · evidence(동기 · 측정값)는 양식 ②.** 개요 가운데(WHAT/WHY 2단 또는 목표 카드)의 WHY 쪽은 사람이 ②에 쓴다.

## A2. 시스템 구조 — 말로 서술 (그림은 PART B 가 그린다)

- **intro**: 시스템은 **입력 → 상태 → 전투 → 데이터 → UI** 방향의 단방향 흐름을 갖는다. 역방향 통신(피격·UI 갱신)은 전부 `event` 또는 `Observable<T>` 로 이루어져, 하위 계층이 상위 계층을 직접 참조하지 않는다. 플레이어와 몬스터는 서로 다른 두뇌(FSM vs BT)를 쓰지만 **전투 파이프라인(무기 콜라이더 → `CombatSystem` → `FighterView`)은 완전히 동일**하게 공유한다.

### 계층 구성 (위→아래)

- **입력 계층 · INPUT** — `PlayerInput.inputactions`(액션 맵) · `InputManager`(저수준 콜백 → 의미 이벤트)
- **액터 계층 · ACTOR** — `PlayerStateMachine`(FSM 허브 겸 파사드) · `IState` 8종(Walk·Sprint·Roll·BackStep·Attack·Hit·Fall·Die) · `EnemyAIBase` → `SkeletonAI`/`BossMonsterAI`(BT) · `EnemyState`/`BossState` · `BtNode` 트리
- **전투 코어 · COMBAT** — `CombatSystem`(Collider→FighterView 레지스트리 + 이벤트 큐, 프레임당 10건) · `AttackTiming`/`SkillTiming`(StateMachineBehaviour) · `PlayerWeapon`/`EnemyWeapon`/`BossSkill` · `InGameEvent`(`CombatEvent`/`HealthEvent`)
- **데이터 계층 · MVVM** — `FighterView`(View) ↔ `FighterViewModel`(Model, 순수 C#) ↔ `Observable<T>` · `FighterStats`(SO)
- **UI · 월드 계층 · PRESENTATION** — HP/스태미나 Slider · `UI_Inventory` · 락온 인디케이터 · `BoneFire`(화톳불) · `BossWall`(보스방) · `CameraControl`
- **데이터 자산 · 빌드** — `DatabaseBase`(추상 SO)→`ItemDatabase` · `TSVImporter`(리플렉션 파서) · `Item`→`WeaponItem`(SO) · `BuildAuto`(Editor, Jenkins 진입점)

세 줄 요약:

- **구성요소**: 입력·액터·전투 코어·데이터(MVVM)·UI/월드 다섯 계층. 입력은 `InputManager`, 액터는 FSM 플레이어 + BT 몬스터, 전투 코어는 `CombatSystem` 레지스트리·이벤트 큐, 데이터는 MVVM + `Observable<T>`, 표현은 UI/월드.
- **관계**: 하위 계층은 상위 계층을 직접 참조하지 않는다. 애니메이터는 대상이 플레이어인지 몬스터인지 모른 채 `IAttackAble` 만 호출하고, UI는 `Observable` 만 구독한다. 액터·판정·데이터 세 축이 모두 인터페이스 계약에 의존한다.
- **흐름**: 입력 → 상태 → 전투 → 데이터 → UI 한 방향으로 흐르고, 역방향은 전부 `event` · `Observable<T>` 로 통신한다. 부팅 순서상 `CombatSystem.Instance` 는 `Awake` 에서 할당되고 `FighterView.Start` 에서 등록·사용되므로, **싱글턴 할당이 등록보다 먼저** 일어나야 한다.

> PART B 참고: 이 계층 구성은 사람이 강조(`PlayerStateMachine`, `CombatSystem`)를 정했으므로 자동 배치 mermaid 가 아니라 `layers` 블록으로 그린다. 런타임에 없는 것(SO·InGameEvent·BtNode 계층)은 점선.

### 핵심 클래스 관계 (계약만 — 그림은 PART B 가 클래스 계층으로)

- **`IState`** (interface) — `Enter()` · `UpdateLogic()` · `Exit()`. **8개 상태 클래스가 구현**(Walk·Sprint·Roll·BackStep·Attack·Hit·Fall·Die). 상태는 `new` 로 생성되는 순수 C# 객체이며 `PlayerStateMachine` 을 컨텍스트로 받는다.
- **`IAttackAble`** (interface) — `AttackForCollEnable()` · `AttackForCollDisEnable()`. **`PlayerStateMachine` 과 `EnemyState`(→`BossState`)가 구현.** `AttackTiming`(StateMachineBehaviour)이 이 계약으로 플레이어·적을 다형적으로 호출한다.
- **`ISkillAble`** (interface) — `UseSkillFirstTiming(int)` · `UseSkillSecondTiming(int)`. **`BossState` 가 구현.** `SkillTiming` 이 호출.
- **`BtNode`** (abstract) — `Evaluate() : NodeState`(Success/Running/Failure), `Children`. **조합 노드 4종**(Selector · Selector_Random · Sequence · Sequence_Memory)과 **리프 노드 10종**이 상속.
- **`EnemyAIBase`** (abstract MonoBehaviour) — `ConstructBehaviorTree()`, `nodeDict`(공용 리프 사전). **`SkeletonAI` · `BossMonsterAI` 가 상속**해 서로 다른 트리를 조립.
- **`EnemyState`** → **`BossState`** (상속, `virtual Dead()`/`Initialized()` 오버라이드).
- **`InGameEvent`** (abstract) → `CombatEvent`(Damage:int · HitPosition · Collider) / `HealthEvent`(HealAmount:int).
- **`DatabaseBase`** (abstract SO) — `LoadData()` → `ItemDatabase`/`TestDatabase`. `Item`(SO) → `WeaponItem`.
- **`Observable<T>`** — 제네릭 반응형 프로퍼티(값 변경 시 통지, 구독 즉시 현재값 1회 전달).

## A3. 핵심 기능

### 기능 ①: 입력 · 플레이어 FSM

**무엇을 · 어떻게** — 입력은 **디바이스 → 의미 → 소비자**의 2단 릴레이를 거친다. `InputManager` 가 Input System 저수준 콜백을 `OnLMBInput`·`OnSpaceBarInput` 같은 의미 이벤트로 바꾸고, `PlayerStateMachine` 이 일부를 `OnLMBAction`·`OnRInput` 으로 다시 방송한다 — 상태·월드·카메라는 이 파사드(또는 InputManager)만 구독한다. 플레이어는 매 전이마다 `new` 로 생성되는 순수 C# 상태 객체로 움직이며, 구독/해제가 각 상태의 `Enter()`/`Exit()` 안에 자연스럽게 캡슐화된다.

**핵심 코드 — Space 한 키로 3갈래 분기** (`WalkState.UpdateLogic`)

```csharp
if (_player.SpaceBarPressed) _timer += Time.deltaTime;

if (_timer > 0.3f && _player.SpaceBarPressed)                           // 홀드 0.3s↑ → 질주
    _player.ChangeState(new SprintState(_player));
else if (_timer is > 0f and < 0.3f && _player.SpaceBarPressed == false) // 짧게 탭(뗌)
{
    if (_player.MoveAmount > 0) _player.ChangeState(new RollState(_player));  // 이동 중 → 구르기
    else                        _player.ChangeState(new BackStepState(_player)); // 정지 → 백스텝
}
```

- **어디:** `_timer` 누적 후 임계 0.3s 비교 — **왜:** 같은 스페이스 키의 '누른 시간'으로 질주/회피를 가른다. 소울라이크의 "탭=구르기, 홀드=달리기"를 별도 키 없이 한 키로 구현. `_timer` 는 `WalkState` 로컬 필드이고 `Exit()` 에서 0으로 초기화된다.

**핵심 코드 — 구르기 무적(i-frame)** (`RollState`)

```csharp
public void Enter() { ...; _player.ActiveInvisible(true); }   // 구르기 시작 = 무적 ON
public void Exit()  { _player.ActiveInvisible(false); }        // 구르기 끝 = 무적 OFF
```

- **어디:** `ActiveInvisible` — **왜:** `FighterView.Invincible` 를 켠다. `FighterView.TakeDamage` 는 `Invincible` 이면 즉시 `return` → 구르기 동안 피해 무효. Enter/Exit 대칭이라 상태를 벗어나면 반드시 무적이 풀린다.

**핵심 코드 — 3타 콤보 (애니 90% + 입력 선행)** (`AttackState.UpdateLogic`)

```csharp
if (stateInfo.shortNameHash == _attack1 && stateInfo.normalizedTime >= 0.9f) {
    if (_secondAttackReady && _animationPlayed == false) {           // 1타 재생 중 클릭이 버퍼됨 → 2타 연결
        LookAtTarget(); _player.StaminaChange(_player.AttackStamina);
        _player.PlayTargetAniClip(_attack2, 0.2f); _animationPlayed = true;
    } else if (_secondAttackReady == false)                          // 버퍼 없음 → 대기 상태 복귀
        _player.ChangeState(new WalkState(_player));
}
```

- **어디:** `_secondAttackReady`/`_thirdAttackReady` 플래그 — **왜:** `OnLMBAction` 이벤트로 다음 입력을 미리 받아 두고(입력 선행/버퍼링), 현재 클립이 90% 재생됐을 때 연결한다. `ThirdAttackReady` 는 `_animationPlayed == true`(2타 진입 후)일 때만 세워져 — **2타 모션이 시작된 이후의 클릭만** 3타를 예약한다(1타 도중 연타는 3타를 예약하지 않음).

**필요한 그래프** — *질문:* 플레이어 상태는 `WalkState` 허브에서 어떤 조건으로 전이하고, 피격·사망은 어디서 진입하나? · *종류:* **상태 머신(FSM, `stateDiagram-v2`)**. *노드:* Walk · Sprint · Roll · BackStep · Attack · Fall · Hit · Die. *엣지(조건):* Walk→Sprint(Space 홀드 0.3s↑) · Walk→Roll(Space 탭+이동) · Walk→BackStep(Space 탭+정지) · Walk→Attack(좌클릭, 3타 콤보) · Walk→Fall(`IsGrounded` 실패) · Sprint/Roll/BackStep/Attack/Fall→Walk(종료·착지·애니 90%) · Walk→Hit(`OnTakeDamage`) · Hit→Walk · Walk→Die(`OnDied`) · Die→[*].

**표 · 카드로 낼 사실**
- **상태 8종**(카드): Walk(허브)·Sprint·Roll·BackStep·Attack·Hit·Fall·Die.
- **스태미나**(표/계약): 질주는 `StaminaChange(-20f * Time.deltaTime)` 로 지속 소모, 구르기/백스텝/공격은 인스펙터 값(`rollStamina`·`backStepStamina`·`attackStamina`)을 소모. `StaminaChange()` 는 값을 **가산**하므로 이 인스펙터 값들은 **반드시 음수**여야 소모로 동작한다. 리젠은 `WalkState` 에서만(`staminaRegenRateAmount`), 0 도달 시 `OnStaminaZero` → `_noStamina` 탈진 락 → `staminaRegenRateTime` 경과 후 해제.

### 기능 ②: 전투 · MVVM

**무엇을 · 어떻게** — 개별 객체가 대상을 직접 때리지 않는다. 무기 콜라이더의 `OnTriggerEnter` 는 `CombatEvent` 를 만들어 `CombatSystem`(싱글턴)의 **큐**에 넣고, 시스템이 매 프레임 **최대 10건**만 꺼내 `FighterView` 로 라우팅한다. 체력·스태미나 UI는 `Observable<T>` 를 구독하는 MVVM 으로만 갱신되고, 규칙 계층인 `FighterViewModel` 은 `MonoBehaviour` 를 상속하지 않는 **순수 객체**다.

**핵심 코드 — 이벤트 큐 소비 (프레임당 10건)** (`CombatSystem.Update`)

```csharp
private const int Max_Event_Count = 10;
...
int processCount = 0;
while (eventQueue.Count > 0 && processCount < Max_Event_Count) {  // 큐가 비거나 10건까지
    var e = eventQueue.Dequeue();
    switch (e.Type) {
        case InGameEvent.EventType.Combat: e.Receiver.TakeDamage(e as CombatEvent); break;
        case InGameEvent.EventType.Heal:   e.Receiver.TakeHeal(e as HealthEvent);   break;
    }
    processCount++;
}
```

- **어디:** `Max_Event_Count = 10` 가드 — **왜:** 프레임당 처리량을 상한해 다수 히트가 몰려도 스파이크를 막는다. 남은 이벤트는 다음 프레임으로 이월. 처리 지점이 한 곳이라 피격 이펙트·사운드를 여기서 일괄 후킹할 수 있다.
- **어디:** `switch (e.Type)` + `as` 캐스트 — **왜:** `InGameEvent` 를 `CombatEvent`/`HealthEvent` 로 다운캐스트해 수신자(`FighterView`)의 `TakeDamage`/`TakeHeal` 로 분기.

**핵심 코드 — Observable<T> (변경 통지 + 구독 즉시 동기화)** (`Observable.cs`)

```csharp
public T Value {
    get => _value;
    set { if (Equals(_value, value)) return;   // 같은 값이면 통지 안 함 → 중복 UI 갱신 차단
          _value = value; OnValueChanged?.Invoke(_value); }
}
public void Subscribe(Action<T> listener) {
    OnValueChanged += listener;
    listener?.Invoke(_value);                  // 구독 즉시 현재값 1회 전달 → 초기화 코드 불필요
}
```

- **어디:** `Subscribe` 가 등록과 동시에 현재값 통지 — **왜:** HP 바가 시작부터 올바른 값으로 세팅되고, 이후엔 변경 시에만 갱신. 폴링이 사라진다.

**핵심 코드 — 애니메이션 주도 히트박스** (`AttackTiming` : StateMachineBehaviour)

```csharp
public override void OnStateEnter(...) { _self = animator.gameObject.GetComponentInParent<IAttackAble>(); }
public override void OnStateUpdate(Animator a, AnimatorStateInfo info, int layer) {
    if (!_passStartTime && startNormalizedTime < info.normalizedTime) { _self.AttackForCollEnable();    _passStartTime = true; }
    if (!_passEndTime   && endNormalizedTime   < info.normalizedTime) { _self.AttackForCollDisEnable(); _passEndTime   = true; }
}
```

- **어디:** `GetComponentInParent<IAttackAble>()` — **왜:** 히트박스 활성 타이밍을 코드가 아니라 **애니 클립 상태**가 소유한다. 대상이 플레이어든 스켈레톤이든 보스든 `IAttackAble` 만 맞으면 같은 컴포넌트가 동작. 활성 구간은 인스펙터 슬라이더(0~1)로 코드 수정 없이 튜닝. 무기(`PlayerWeapon`/`EnemyWeapon`)는 `HashSet<FighterView>` 로 **한 휘두름에 같은 대상 1회만** 타격하고 `DisableCollider` 에서 `Clear`.

**필요한 그래프**
- *질문:* 전투 이벤트는 어떤 생산자에서 큐로 쌓이고 프레임당 어떻게 소비되나? · *종류:* **흐름(flowchart)**. *노드/엣지:* 생산자(PlayerWeapon · EnemyWeapon · BossSkill · Heal) —`AddInGameEvent()`→ `eventQueue` —`Update, 프레임당 ≤10건`→ `Dequeue`+`switch` → (Combat→`TakeDamage` / Heal→`TakeHeal`) → 수신자 `FighterView`.
- *질문:* 전투 이벤트는 어떤 공통 계약을 상속해 피해·회복으로 갈라지나? · *종류:* **타입 계층(classDiagram)**. *노드:* `InGameEvent`(abstract; Sender·Receiver·Type) → `CombatEvent`(**Damage:int** · HitPosition · Collider) / `HealthEvent`(**HealAmount:int**).

**표로 낼 사실**
- MVVM 계층(표): Model=`FighterStats`(SO, 데이터만) · ViewModel=`FighterViewModel`(규칙·사망/페이즈 판정, Unity 의존 없음) · View=`FighterView`(슬라이더·콜라이더·이벤트 중계, Unity 의존) · 바인딩=`Observable<T>`(변경 통지, Unity 의존 없음).
- 대미지 산식(표): 플레이어 = `stat.Damage + str·StrengthBonus()/2 + dex·DexterityBonus()/2`, 최종 = `CombatCalculator.CalculateDamage` = `max(1, 공격력 − defender.Defense)` · 일반 몬스터 = `attackData[0].damage`(고정) · 보스 스킬 = `attackData.damage`(프리팹별 SO).

**곁가지(사실)**
- `CombatEvent.Damage` 와 `HealthEvent.HealAmount` 는 **`int`** 다(소스 `InGameEvent.cs` 확인). *기존 `soulslike.yaml` 의 `classDiagram` 은 `float Damage`/`float HealAmount` 로 표기 — PART B 에서 `int` 로 정정 필요.*
- `HitPosition` · `Collider` 는 히트 이펙트·데칼 스폰용 **예약 필드**(현재 소비처 없음).
- `CombatSystem.GetFighter` 는 `fightersDict[coll]` **인덱서**를 그대로 쓴다. 미등록 콜라이더가 들어오면 `null` 이 아니라 `KeyNotFoundException` 이 발생 — 호출부 `if (monster != null)` 는 도달하지 못하는 방어 코드다(`TryGetValue` 로 바꾸면 계약 일치). 실사용에선 적/플레이어가 `Start` 에서 등록되고 레이어 마스크로 걸러 문제되지 않음. *(판단은 ②)*

### 기능 ③: 적 AI · 행동 트리

**무엇을 · 어떻게** — 상태가 늘수록 전이 조건이 폭발하는 상태 패턴 대신, **항상 트리 구조를 유지하는 행동 트리**를 재귀 `Evaluate()` 로 구현했다. 플레이어는 FSM, 몬스터는 BT 를 쓰는 **의도적 비대칭** — 몬스터는 "상황 판단 + 확률적 행동 선택"이 필요하기 때문이다. `EnemyAIBase` 가 공용 리프를 `nodeDict` 로 준비하고, `SkeletonAI`/`BossMonsterAI` 가 이를 조립해 서로 다른 트리를 만든다.

**핵심 코드 — 콤보 끊김 버그 해결** (`Sequence_Memory.Evaluate`)

```csharp
if (State != NodeState.Running) _lastRunningChildIndex = 0;   // 새로 시작이면 처음부터
for (int i = _lastRunningChildIndex; i < Children.Count; i++) {
    switch (Children[i].Evaluate()) {
        case NodeState.Failure: _lastRunningChildIndex = 0; return State = NodeState.Failure;
        case NodeState.Running: _lastRunningChildIndex = i;              // 실행 위치 기억 → 다음 프레임 재개
                                return State = NodeState.Running;
        case NodeState.Success: continue;                               // 다음 자식으로
    }
}
_lastRunningChildIndex = 0; return State = NodeState.Success;
```

- **어디:** `_lastRunningChildIndex = i` — **왜:** 적이 콤보 도중 플레이어가 사거리를 벗어나 앞 조건이 실패해도, 일반 `Sequence` 는 매 프레임 처음부터 재평가해 진행 중이던 콤보가 즉시 끊긴다. `Sequence_Memory` 는 Running 이던 자식 인덱스를 기억했다가 그 자리에서 재개 → 진입 조건을 다시 통과할 필요 없이 진행 중인 타부터 이어져 콤보가 완성된다. (중단되면 안 되는 연속 행동은 전부 `Sequence_Memory`, 순수 조건 검사만 필요한 곳은 기존 `Sequence`.)

**핵심 코드 — 공격을 프레임 데이터로 분해** (`Leaf_PerformAttack.Evaluate`)

```csharp
if (_timer < _attackData.windupTime) { RotateTowardsTarget(); return Running; }              // 선딜: 조준 보정
if (_timer < windup + activeTime)     { if(!_isDamaged){ _animator.CrossFade(...); }          // 타격
                                        /* useRoot ? 루트모션 : 수동 전진 */ return Running; }
if (_timer < windup + activeTime + recoveryTime) return Running;                              // 후딜
_isAttacking = false; return Success;                                                         // 종료
```

- **어디:** `_attackData.windupTime`/`activeTime`/`recoveryTime` — **왜:** 공격 템포가 코드가 아니라 `AttackData`(SO) 값에 있으므로, 같은 리프로 몬스터마다 다른 리듬의 공격을 만든다(= 프로젝트 핵심 목표 "공격 템포 조절"). 루트모션 공격은 `applyRootMotion` 을 켜고 `RootMotionHandler.DeltaPos/DeltaRot` 를 수동 적용, 끝나면 반드시 원복.

**필요한 그래프**
- *질문:* 행동 트리 노드는 무슨 계약을 공유하고 조합·리프로 어떻게 갈라지나? · *종류:* **타입 계층(classDiagram)**. *노드:* `BtNode`(abstract; State·Children·`Evaluate()`) → 조합 4종(Selector · Selector_Random · Sequence · Sequence_Memory) + 리프 10종.
- *질문:* 보스는 스킬과 근접 교전을 어떤 우선순위로 고르고 접근은 어떻게 처리하나? · *종류:* **행동 트리(flowchart)**. *루트:* `actions`(Selector) → [`skillOrCombo`(Selector), `randomOutAction`(Selector_Random)]. `skillOrCombo` → [`skillUseSequence`(Seq_Memory: CheckSkillRange→CheckSkillAble→Cleaner→스킬 2종 랜덤), 근접 `a`(Seq_Memory: CheckAttackRange→Cleaner→`comboOrStrafe`(Selector_Random: 3타콤보·2타콤보·Strafe·BackMove→Wait))]. `randomOutAction` → [walkCheck(Chase→Wait)·Strafe].

**표로 낼 사실**
- 노드 종류(표): Selector(OR, 첫 성공/실행 채택) · Selector_Random(무작위 자식, Running 기억) · Sequence(AND, 하나 실패 시 중단) · Sequence_Memory(실행 위치 기억).
- 리프 카탈로그(표, 반환 규칙·부수효과): `Leaf_WatchPlayer`(시야각+거리+LOS 레이캐스트→Success, **`findPlayer=true` 래치**) · `Leaf_CheckAttackRange`(거리≤range→Success, 순수 조건) · `Leaf_CheckSkillAble`(`secondPhase && !skillCool`→Success, **`skillCool=true`**) · `Leaf_Cleaner`(항상 Success, 애니 0·agent 정지·경로 리셋) · `Leaf_Chase`(3초 경과→Success, `SetDestination`·Vertical=1) · `Leaf_Strafe`(원 궤도 스트레이프) · `Leaf_BackMove` · `Leaf_Wait` · `Leaf_Patrol`(웨이포인트 순회) · `Leaf_PerformAttack`(선딜·타격·후딜 경과→Success).

**곁가지(사실)** — **걷기 애니 버그**도 같은 계열이었다: 정지 상태에서 `Vertical` 이 1로 남아 걷기 모션이 재생됨. 애니 파라미터·`NavMeshAgent` 를 0으로 되돌리고 항상 Success 를 반환하는 `Leaf_Cleaner` 를 시퀀스 중간에 삽입해 해결. 스켈레톤은 `Leaf_WatchPlayer` 로 발견을 판정하고 한 번 발견하면 `findPlayer` 래치가 유지돼 시야에서 벗어나도 어그로가 풀리지 않는다(해제는 화톳불 `Respawn()` 에서만). 보스는 `BossWall` 로 입장을 통제하므로 시야 판정 자체가 없다.

### 기능 ④: 보스 · 카메라 · 월드

**무엇을 · 어떻게** — 보스는 체력 절반에서 **2페이즈**로 전환(스킬 분기 개방 + 파티클)되고, 카메라·락온은 **LateUpdate 순서**로 위치→회전→충돌을 확정하며, 화톳불·보스방은 **트리거 구독**만으로 상호작용한다.

**핵심 코드 — 2페이즈 트리거** (`FighterViewModel.TakeDamage`)

```csharp
CurrentHealth.Value -= damage;
if (CurrentHealth.Value <= _stats.MaxHealth / 2) OnSecondPhase?.Invoke();  // 체력 절반 이하 → 2페이즈 발행
```

- **어디:** `OnSecondPhase` — **왜:** MVVM 의 느슨한 결합 덕분에 이벤트 하나로 보스 2페이즈를 연동한다. `BossState.Initialized` 가 이 이벤트를 `BossMonsterAI.SecondPhase`(스킬 분기 개방)와 파티클 활성에 함께 연결. 절반 이하 모든 피격마다 반복 발행되지만 수신 측이 멱등(bool 세팅·SetActive)이라 문제되지 않는다. 스킬 쿨다운은 `BossMonsterAI.Update` 에서 `skillCool` 이 15초 경과 시 해제되는 별도 루프.

**핵심 코드 — 화톳불(세이브 포인트)** (`BoneFire`)

```csharp
private void OnTriggerEnter(Collider other) { if (플레이어 레이어) _player.OnRInput += BoneFireLit; }  // 범위 진입 = 구독
private void BoneFireLit(bool _) {
    FadeManager.Instance.StartFade(Heal, fadeImage);              // 페이드 → 완전 회복 콜백
    foreach (var enemy in _allEnemies) enemy.Respawn();           // 모든 몬스터 리스폰(findPlayer 해제)
}
```

- **어디:** `OnRInput += / -=`(진입/이탈) — **왜:** "범위 안인지"를 매 프레임 폴링하지 않고 **트리거 구독/해제**로 상호작용을 표현. 화톳불 상호작용은 페이드 후 `HealthEvent`(1000) 를 큐에 넣어 완전 회복 + 전 몬스터 리스폰(소울라이크의 세이브·리셋 규칙).

**필요한 그래프**
- *질문:* 락온 카메라는 한 프레임에 어떤 순서로 확정되나? · *종류:* **단계 흐름(chips/points)**. *노드(순서):* Update `HandleCamera`(마우스 델타→yaw·pitch) → LateUpdate `FollowPlayer`(Lerp 추적+락온 높이) → `LockOnCamControl`(타겟 방향 회전·인디케이터) → `CameraCollision`(피벗 기준 SphereCast→SmoothDamp). *왜 순서가 중요:* 충돌 보정이 위치·회전 확정 뒤에 와야 함.
- *질문:* 보스방 진행도는 어떻게 게이팅되나? · *종류:* **단계 흐름(chips)**. *노드:* 보스방 외부(벽 활성) → 입장 컷신(R 키, 걸어 들어감) → 보스전(벽 재봉인, 이탈 불가) → 클리어(보스 사망 → `Destroy(bossWall)` + 화톳불 개방).

**표 · 카드로 낼 사실**
- 락온(카드): 토글 락온(휠 클릭→`OverlapSphere` 최근접, 재클릭 해제) · 자동 해제(몬스터 사망→`LockOnTarget` 비활성→다음 프레임 `UnlockOn`) · **Q/E 스크린 공간 좌/우 차로 다음 타겟 전환**(화면에서 보는 방향과 일치). 카메라는 `Cinemachine` 없이 커스텀 `CameraControl`.
- 무참조 통신(곁가지): `EnemyState.Dead()` 와 `LockOnCamControl` 은 서로를 직접 참조하지 않고 **`LockOnTarget` 활성 상태만으로** 통신.

### 기능 ⑤: 데이터 · 빌드

**무엇을 · 어떻게** — 기획 데이터(스탯·아이템)를 TSV 로 관리하고 **리플렉션 제네릭 파서**로 어떤 데이터 클래스든 로드한다. 빌드는 Jenkins 가 폴링부터 exit 코드까지 자동화한다.

**핵심 코드 — 리플렉션 제네릭 파서** (`TSVImporter.Parse<T>`)

```csharp
string[] headers = lines[0].Split('\t');
for (int j = 0; j < headers.Length; j++) {
    FieldInfo field = typeof(T).GetField(headers[j].Trim(), BindingFlags.Public | BindingFlags.Instance);
    if (field != null)                                            // 헤더 이름 == 필드 이름이면 자동 매핑
        field.SetValue(entry, ConvertType(values[j].Trim(), field.FieldType));  // int/float/bool/enum/string 변환
}
```

- **어디:** `GetField(header)` + `ConvertType` — **왜:** 컬럼↔필드를 이름으로 매칭하므로 열 순서가 무관하고 없는 열은 조용히 무시된다. 스키마가 바뀌어도 파서 코드는 그대로. 파싱 예외는 `try/catch` 로 **필드 단위 격리**돼 한 셀이 잘못돼도 나머지는 살아남는다.

**핵심 코드 — 상속 SO 전체에 로드 버튼** (`DatabaseEditor`)

```csharp
[CustomEditor(typeof(DatabaseBase), true)]                       // true = 자식 SO 전부 포함
public class DatabaseEditor : Editor {
    public override void OnInspectorGUI() {
        base.OnInspectorGUI();
        if (GUILayout.Button("TSV 데이터 로드하기", GUILayout.Height(40))) {
            ((DatabaseBase)target).LoadData(); EditorUtility.SetDirty(target); AssetDatabase.SaveAssets();
        }
    }
}
```

- **어디:** `[CustomEditor(typeof(DatabaseBase), true)]` 의 **true 인자** — **왜:** `DatabaseBase` 를 상속한 모든 자식 SO 가 자동으로 로드 버튼을 갖는다. 새 DB 타입을 추가해도 에디터 코드를 건드릴 필요가 없다.

**필요한 그래프**
- *질문:* TSV 한 장이 런타임 데이터 객체가 되기까지? · *종류:* **흐름(flowchart)/단계(chips)**. *노드:* TSV(TextAsset, 에디터 타임) → `DatabaseBase`(SO) → 버튼 클릭 `LoadData` → `TSVImporter.Parse<T>`(리플렉션) → `List<T>` → `SetDirty`·`SaveAssets`.
- *질문:* 빌드는 어떻게 자동화되나? · *종류:* **단계(chips)**. *노드:* GitHub → Jenkins(1시간 주기 폴링) → `BuildAuto.Build()` → `EditorApplication.Exit(0/1)`.

**표로 낼 사실**
- 빌드 설정(표): 출력 = `Builds/StandaloneWindows64/SoulLike.exe` · 타겟 = `BuildTarget.StandaloneWindows64` · 씬 소스 = `EditorBuildSettings.scenes` 중 `enabled` 만.
- 무기 랭크 보너스(표): S=3 · A=2 · B=1(`WeaponItem.StrengthBonus()`/`DexterityBonus()`). `WeaponItem.OnValidate` 가 타입=Weapon·MaxAmount=1 자동 세팅.

**곁가지(사실)** — CI 연동의 핵심은 `EditorApplication.Exit(코드)` 다. Jenkins 는 프로세스 종료 코드로 성공/실패를 판단하므로 명시적 exit 코드 없이는 빌드 실패가 CI 에 전달되지 않는다.

## A4. 부록 — 그 밖의 사실 (기존 yaml 과 대조 포함)

**기존 `soulslike.yaml`(PART B) 과 정정할 코드 사실** *(사실만 — PART B 에서 반영)*

| 항목 | 코드 사실(검증) | 기존 yaml 표기 |
| --- | --- | --- |
| `CombatEvent.Damage` | `int` | `float Damage` (classDiagram) |
| `HealthEvent.HealAmount` | `int` | `float HealAmount` (classDiagram) |
| `IState` 구현 상태 수 | **8종**(Walk·Sprint·Roll·BackStep·Attack·Hit·Fall·Die) | 액터 계층 `layers` 에 "IState ×9" |

**코드엔 있으나 기존 yaml 이 크게 다루지 않은 시스템** *(사실만 — 노출 여부는 사람 판단)*

| 시스템 | 파일 | 사실 |
| --- | --- | --- |
| 인벤토리·장비 | `Inventory` · `PlayerInventory` · `PlayerEquipment` · `WeaponSlotManager` · `WeaponHolderSlot` · `UI_Inventory` | 20슬롯 인벤토리(스택·이벤트 콜백), 좌/우 손 무기 슬롯 장착, 드래그 앤 드롭 UI. `Inventory` 는 순수 C# 클래스 |
| UniTask 페이드 리팩터 | `FadeManager_UniTask` | 코루틴 `FadeManager` 를 `async UniTask` 로 이관(2026-04-26 커밋). `GetCancellationTokenOnDestroy()` 로 파괴 시 자동 취소. **현재 `BoneFire` 는 코루틴판 `FadeManager` 를 사용** — 두 버전 공존 |
| 테스트 스캐폴딩 | `Test.cs` · `TestData`/`TestDatabase` | TSV 파싱 연습용(2025-12-14·2026-01-25 커밋). 런타임 게임플레이 미참여 |

---

# 다른 양식으로 넘길 것 (PART A 에는 쓰지 않는다)

- **→ 양식 ②(사람 작성):** 개요 why · evidence · **고민과 선택 최소 1건**(예: 몬스터 AI를 FSM vs BT — 기존 yaml 의 `decisions` 가 이미 이 결정을 담고 있음: 상태 폭발 회피·확률적 선택·리프 재사용을 근거로 BT 채택) · **retrospective 의 learnings·improvements**(기존 yaml 회고: 같은 원리의 노드 중단을 `Sequence_Memory`/`Cleaner` 로 각각 해결, 시각화의 가치, 데이터 주도 BT 가능성 / 개선: 완전한 데이터 주도 구조·비선형 자료구조 사전 도식화·`conditional abort` 중단 매커니즘). README 의 이슈 2건(콤보 끊김·걷기 모션)과 회고 2건이 ② 원자료.
- **→ 양식 ③(자산):** team · vcs · ide(Rider 2025.1.4) · 링크(유튜브·깃허브 URL 미확정) · hero 스크린샷(`soul-gameplay.png`)과 본문 이미지(`soul-animator.png`, ANIMATOR Blend Tree) + 각 **caption**.

---

# PART B — 파이프라인 AI 조립 안내 (이 repo 에서 실행)

> 이 문서(PART A) + 양식 ② + ③ 을 **스키마 블록**으로 매핑해 `src/content/docs/soulslike.yaml` 로 조립한다. **조립 대상은 기존 `soulslike.yaml`(갱신)** 이다 — 이미 7섹션 디자인 HTML 기반으로 조립돼 있으니, 위 A4 의 정정(Damage/HealAmount `int`, IState 8종)과 누락 시스템만 반영하면 된다. 스키마: `src/content.config.ts`. 본보기: `src/content/docs/{vampire-like,bond}.yaml`.

**블록 매핑 (PART A 서술 → YAML `type`)**

- A1 기술 스택 → **개요의 `overview.stack`** {title, rows[category·tech·purpose]}(본문 블록 아님, purpose 필수) · A2 계층 구성+세 줄 → `layers`(강조 `PlayerStateMachine`·`CombatSystem`, 점선=SO·InGameEvent·BtNode) · A2 핵심 클래스 관계 → `mermaid`(`classDiagram`, 제네릭 `~T~`)
- A3 핵심 코드 → `code`(api · code · **notes** 필수) · 그래프 서술 → `mermaid`(FSM=`stateDiagram-v2`, 흐름·행동트리=`flowchart`, 타입계층=`classDiagram`) 각 `question` 캡션
- 표로 낼 사실 → `table`(행 칸 수 = 헤더 수) · 단계 흐름 → `chips` · 항목 카드 → `points`(2개+) · 곁가지(주의·계약·관찰) → `callout` · 콤보 끊김 이슈 → `before-after`
- 스크린샷 → 최상위 `screenshot`(hero=`soul-gameplay.png`) · 본문 `image`(`soul-animator.png`, variant aside) — src·caption 은 ③ 에서

**게이트 상기** — 개요 (what+why) 또는 goals 중 하나 · evidence·scope 필수 / decisions 최소 1건·각 정확히 1개 채택·기준의 값 수 = 선택지 수 / retrospective learnings·improvements 필수 / code 는 notes · stack-table 은 purpose · api-list 는 returns · image/screenshot 은 caption · table 은 행 칸 수 = 헤더 수. 필수 항목을 optional 로 완화해 통과시키지 않는다.
