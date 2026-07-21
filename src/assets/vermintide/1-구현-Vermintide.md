# PART A — 구현 (Vermintide_Motive_Project)

> 대상 repo `3D-Vermintide` 의 게임 코드(`Assets/2_Scripts/`)를 읽고 **사실**만 뽑았다.
> 외부 에셋(`Assets/0_ASSET/`), 플러그인(`Assets/Plugins/`), 자동 생성 코드(`Assets/5_InputSystem/PlayerInput.cs`)는 범위 밖.
> mermaid 문법·YAML 블록 type 은 PART B 담당이므로 그래프는 **말로만** 서술한다.

---

## A0. 메타 — git · ProjectSettings 에서

- **slug**: `vermintide`
- **subtitle**: 1인칭 액션 — **오브젝트 풀** 기반 대규모 적 웨이브 · **상속** 몬스터 바리에이션 · **전략 패턴** 무기 교체 (Warhammer: Vermintide 모티브)
- **period**: 2025.04.14 ~ 2025.12.28 (`git log -- "*.cs"` 첫/마지막 커밋 기준) · 집중 개발 2025.04.15 ~ 05.02 (README 기재)
- **engine**: Unity **2022.3.62f1** · **Built-in Render Pipeline** (`Packages/manifest.json` 에 URP/HDRP 패키지 없음)

> team · vcs · ide · 링크 · 스크린샷은 코드로 확정 불가 → **양식 ③**.
> 참고로 README 기재값: 개발 인원 1인 · 형상관리 Github Desktop · IDE Rider 2024.3.6.

---

## A1. 개요 — 사실

- **lead**: 1인칭 시점에서 근접 대검·총·회복 물약을 교체하며 끝없이 밀려오는 고블린 웨이브를 버티고 보스 골렘을 처치한 뒤 탈출하는 **웨이브 생존 액션**. 4대 설계 축은 **이벤트 큐 전투 · 전략 패턴 무기 · 상속 몬스터 · 상태 패턴 보스**이며, 그 위에 오브젝트 풀·웨이브 스폰·상호작용 미션 진행이 얹혀 있다.

- **what**: 이 문서는 `Assets/2_Scripts/` 의 **게임 런타임 로직**(전투·무기·몬스터/보스 AI·오브젝트 풀·웨이브·상호작용·사운드·UI)을 다룬다. 클래스 간 통신 방식과 확장 구조가 지도의 중심이다.

- **scope**: **다루는 것** — 플레이어 입력/이동/전투, 무기 3종, 고블린 4종 + 보스 1종의 행동, 이벤트 기반 피격 처리, 오브젝트 풀·웨이브 스폰, `IInteractable` 상호작용과 미션 진행, GameState 기반 사운드, 인게임 HUD. **다루지 않는 것** — 외부 에셋 스크립트(`0_ASSET/GothicUI`, `Melee Warrior Animations` 등)와 플러그인(DOTween·RootMotion), Input System 자동 생성 코드, 아트·애니메이션 클립·씬 배치. **미구현** — `SavingSystem`/`SavingWrapper` 는 `print` 만 하는 **스텁**이라 실제 세이브/로드 기능은 없다.

- **기술 스택** *(→ B1: `overview.stack`, purpose 필수)*

| 분류 | 기술 | 사용 목적 (왜 이 기술) |
|---|---|---|
| 엔진/렌더 | Unity 2022.3.62f1 · Built-in RP | 3D 액션 런타임·렌더링 기반 |
| 입력 | Unity Input System 1.14.0 | 액션 맵으로 이동·시점·공격·가드·스킬·슬롯·상호작용·메뉴를 분리 바인딩하고 콜백으로 처리 |
| AI 이동 | Unity AI Navigation / NavMesh 1.1.6 | 고블린·보스의 플레이어 추격 경로탐색, `OffMeshLink` 로 낙차 구간 점프 |
| UI 텍스트 | TextMeshPro 3.0.7 | 상호작용 프롬프트·미션 문구·탄약 카운트 HUD 렌더 |
| 트위닝 | DOTween (Demigiant, Plugins) | 피격 넉백 이동·사망 시 쓰러지는 회전 연출 |
| 사운드 | Unity Audio (`AudioSource` 수동 풀) | SFX 다중 동시재생·중복 방지, `GameState` 별 BGM 전환 |
| 오클루전 | Umbra (`com.unity.modules.umbra`) | 비가시 메쉬 컬링으로 GPU 부하 절감 (README: GPU 병목 해결책) |
| 자료구조 | `Queue`·`Dictionary`·`HashSet` (System.Collections.Generic) | 이벤트 큐·오브젝트 풀(FIFO)·콜라이더↔전투주체 매핑·단일 스윙 중복타격 필터 |

> why · evidence(측정값·동기)는 **양식 ②**. (README 의 "데미지 중복 → HashSet", "GPU 병목 → Occlusion Culling" 이슈가 여기 해당)

---

## A2. 시스템 구조 — 말로 서술

- **intro**: 모든 전투 상호작용은 각 객체가 서로를 직접 호출하지 않고 **`CombatSystem` 싱글턴의 이벤트 큐**를 경유한다. 엔티티는 `IFighter`, 상호작용물은 `IInteractable`, 풀 대상은 `IObjectPoolItem` 이라는 **인터페이스 계약**으로 묶여, 구체 타입을 몰라도 같은 타입으로 다뤄진다. 확장 지점마다 추상 클래스(무기·몬스터·보스 상태)를 두어 기존 코드 수정 없이 종류를 늘리는 것을 목표로 했다.

- **계층 구성** (위 → 아래)
  - **매니저 계층 (전역 싱글턴)**: `CombatSystem`, `ObjectPoolManager`, `WaveSystem`, `SFXManager`, `BGMManager`(DontDestroyOnLoad), `MissionText`
  - **엔티티 계층 (`IFighter`)**: `Player`, `GoblinBase` 파생(고블린 4종), `Boss`
  - **행동/상태 계층**: `WeaponBase` 파생(무기 전략), `BossState` 파생(보스 FSM), `StateMachineBehaviour` 파생(애니메이션 타격 타이밍 통지)
  - **상호작용/월드 계층 (`IInteractable`)**: `NPC`·`Cannon`·`CannonBall`·`CaveCrystal`·`GetAmmo`·`GetPotion`·`BossSpawn`·`InteractionMissionBook`, 그리고 `Portal`·`WaveTrigger`·`Fall`
  - **표현 계층**: `PlayerUI`, `BloodControl`+파티클, 사운드 트리거(`TitleBGM`/`LobbyBGM`/`DungeonBGM`)

  - **구성요소**: 전역 서비스를 제공하는 싱글턴 매니저 + `IFighter` 전투 주체 + 세 개의 인터페이스 계약 + 확장용 추상 클래스.
  - **관계**: 엔티티끼리는 서로를 **직접 참조하지 않고** `CombatSystem` 을 통해 이벤트로만 통신한다. 무기는 자신을 소유한 `Player`, 보스 상태는 자신의 `Boss` 만 안다. UI·이펙트·게이지는 `CombatSystem.Events` 를 **구독**해 역참조 없이 반응한다.
  - **흐름**: 입력(`InputManager`) → 이동/무기 발동 → 콜라이더 접촉 → `CombatEvents` 생성·큐 적재 → `CombatSystem.Update` 가 프레임당 최대 10건 처리 → `Receiver.TakeDamage()` + `Events` 브로드캐스트 → HP/스킬 게이지·혈흔·웨이브 카운트 갱신.

- **핵심 클래스 관계** (인터페이스·추상·상속 계약)
  - `IFighter` (`MainCollider`, `GameObject`, `TakeDamage`, `bloodType`) — **구현**: `Player`, `GoblinBase`(→파생 전체), `Boss`. `CombatSystem` 이 `Dictionary<Collider, IFighter>` 로 콜라이더→주체를 역매핑.
  - `InGameEvent`(추상) — **파생**: `CombatEvents`(Damage·HitPosition·Collider), `EnemyDieEvents`. `EventType` enum 으로 분기.
  - `WeaponBase`(추상: `RMBClick`/`Skill`/`RightClick`/`Reload`/`CanGuard`/`CanSkill`) — **파생**: `GreatSword`, `Gun`, `Potion`. → **전략 패턴**.
  - `GoblinBase`(추상, `IFighter`+`IObjectPoolItem`) — **파생**: `WaveGoblin`, `PatrolGoblin`, `EliteGoblin`, `ShamanGoblin`. 공통 추격/공격/피격/풀 반납을 부모가, 차이(정찰·파티클·원거리 화염구)를 자식이 `override`.
  - `BossState`(추상: `Name`/`Initialize`/`Enter`/`Exit`) — **파생**: `ChaseState`, `JumpAttackState`, `FootAttackState`. `Boss` 가 `Dictionary<StateName, BossState>` 로 소유·전이. → **상태 패턴**.
  - `IObjectPoolItem` (`Key`, `GameObject`, `ReturnToPool`) — **구현**: `GoblinBase`, `BloodParticle`.
  - `IInteractable` (`Interact`, `InteractText`) — **구현**: 상호작용물 8종.
  - `StateMachineBehaviour` — `PlayerAttackSender`·`PlayerSkillSender`·`GoblinAttackSender` 가 애니메이션 정규화 시간에 타격 판정 콜라이더를 켜고 끔.
  - `TextButtonUI`(추상, `IPointerEnter/ExitHandler`) — **파생**: `StartTextButton`, `ExitTextButton`.

---

## A3. 핵심 기능

### 기능 1: 이벤트 큐 기반 전투 시스템

- **무엇을 · 어떻게 만들었나**
  - **중앙 이벤트 큐** — 공격 주체(무기·고블린 무기·보스 발·화염구)는 피해를 직접 적용하지 않고 `CombatEvents` 객체를 만들어 `CombatSystem` 의 `Queue` 에 넣는다. `CombatSystem.Update` 가 큐를 꺼내 `Receiver.TakeDamage()` 를 호출하고, 프레임당 처리량을 **최대 10건**으로 제한해 폭주를 막는다.
  - **콜라이더 → 전투주체 역매핑** — 물리 충돌은 `Collider` 만 주는데, 피해를 받을 주체는 `IFighter`. `CombatSystem` 이 `Dictionary<Collider, IFighter>` 를 들고 등록/조회(`GetMonsterOrNull`)로 O(1) 변환한다. 보스는 몸·양팔·양다리 **5개 콜라이더**를 같은 `Boss` 인스턴스에 매핑(`RegisterBossMonster`)해 부위 피격을 지원.
  - **브로드캐스트 이벤트** — 처리 시 `Events.OnCombatEvent` / `OnEnemyDieEvents` 를 발행해 혈흔(`BloodControl`)·스킬 게이지(`WeaponCool`)·웨이브 카운트(`WaveSystem`)가 서로를 모른 채 반응.

- **핵심 코드**
```csharp
// CombatSystem.Update — 큐에서 꺼내 처리 + 프레임당 상한
while (inGameEventQueue.Count > 0 && processCount < MAX_EVENT_PROCESS_COUNT)
{
    var inGameEvent = inGameEventQueue.Dequeue();
    switch (inGameEvent.Type)
    {
        case InGameEvent.EventType.Combat:
            var combatEvent = inGameEvent as CombatEvents;
            inGameEvent.Receiver.TakeDamage(combatEvent);   // 어디가: 실제 피해 적용
            Events.OnCombatEvent?.Invoke(combatEvent);      // 왜: 구독자(혈흔 등)에게 통지
            break;
        case InGameEvent.EventType.EnemyDie:
            Events.OnEnemyDieEvents?.Invoke(inGameEvent as EnemyDieEvents);
            break;
    }
    processCount++;
}
```
  - 「어디가·왜」: `MAX_EVENT_PROCESS_COUNT`(=10) — 한 프레임에 이벤트가 몰려도 처리량을 나눠 스파이크를 방지하려는 의도. 즉시 호출 대신 **큐**를 쓴 이유가 여기.

- **필요한 그래프**
  - 종류: **흐름 (flowchart)**. 질문: "타격 한 번이 피해·이펙트·게이지로 어떻게 퍼지는가?"
  - 노드/엣지: `무기·화염구 OnTriggerEnter/Raycast` → `GetMonsterOrNull(Collider)` → `CombatEvents 생성` → `AddInGameEvent(Queue)` → `CombatSystem.Update Dequeue` →(분기)→ `Receiver.TakeDamage` / `Events.OnCombatEvent` → 구독자 `BloodControl`·`WeaponCool`·`WaveSystem`.

- **표/카드 사실**
  - 이벤트 종류 표(2행): `Combat`(Damage·HitPosition·Collider 보유) / `EnemyDie`(추가 필드 없음).
  - 상수: 프레임당 최대 처리 이벤트 = **10**.

---

### 기능 2: 전략 패턴 무기 교체 시스템

- **무엇을 · 어떻게 만들었나**
  - **공통 인터페이스로서의 추상 무기** — `WeaponBase` 가 `RMBClick`/`Skill`/`RightClick`/`Reload` 등을 `virtual`/`abstract` 로 선언. `Player` 는 구체 무기를 모른 채 `currentWeapon` 부모 타입으로만 호출한다.
  - **슬롯 교체** — 숫자 키 1·2·3 → `EquipWeaponByIndex` 가 이전 무기를 비활성화하고 새 무기를 활성화하며, 무기가 지정한 `RuntimeAnimatorController` 로 애니메이터를 교체한다. 슬롯 3(물약)은 `hasPotion` 이 있을 때만 진입.
  - **무기별 전략**
    - `GreatSword` — 근접 스윙(콜라이더 On/Off), **가드**(스태미나 소모·쿨다운), **스킬**(게이지 충전 시 광역). 가드는 `Player.TakeDamage` 진입부에서 `TryGuard` 로 먼저 가로채 피해를 무효화.
    - `Gun` — `Raycast` 히트스캔, 탄약/재장전(코루틴), 머즐 플래시, 탄약 HUD.
    - `Potion` — 즉시 회복 50 후 자동으로 슬롯 0 으로 복귀.

- **핵심 코드**
```csharp
// Player.TakeDamage — 무기 전략이 피해 처리에 개입(가드 우선)
public void TakeDamage(CombatEvents combatEvent)
{
    if (currentWeapon is GreatSword sword && sword.TryGuard(combatEvent.Damage))
    {
        SFXManager.Instance.Play(guard);   // 어디가: 가드 성공 시
        return;                            // 왜: 피해를 완전히 흡수하고 조기 반환
    }
    if (isDead) return;
    stat.hp -= combatEvent.Damage;
    if (stat.hp <= 0) Die();
}
```
```csharp
// GreatSword.TryGuard — 데미지 비례 스태미나 소모 + 소진 시 쿨다운 진입
int staminaConsume = damage / 5;           // 어디가: 큰 피해일수록 더 소모
cool.currentStamina -= staminaConsume;
if (cool.currentStamina <= 0) { cool.inCooldown = true; ... }  // 왜: 무한 가드 방지
```
  - 「어디가·왜」: `currentWeapon is GreatSword sword` 패턴 매칭 — 오직 대검만 가드를 가지므로, 전략별 특수 행동을 `Player` 가 최소한으로만 안다.

- **필요한 그래프**
  - 종류: **클래스/타입 계층 (classDiagram)**. 질문: "무기를 어떻게 확장 가능하게 추상화했나?"
  - 노드/엣지: `WeaponBase`(abstract) ◁── `GreatSword`, `Gun`, `Potion`. `Player` ──> `WeaponBase`(currentWeapon, weaponSlots[]) 로 **부모 타입 의존**.
  - (선택) **흐름 (flowchart)**: 키 1/2/3 입력 → `EquipWeaponByIndex` → 이전 무기 SetActive(false) → 새 무기 SetActive(true) + AnimatorController 교체.

- **표/카드 사실**
  - 무기 스펙 표(헤더: 무기 · 공격 방식 · 데미지 · 특수):
    | 무기 | 공격 방식 | 데미지 | 특수 |
    |---|---|---|---|
    | GreatSword | 근접 스윙(콜라이더) | 10 (스킬 100) | 가드(스태미나4)·스킬(게이지 90) |
    | Gun | Raycast 히트스캔 | 30 | 탄약 5/재장전 2초 |
    | Potion | 사용 즉시 | — | 회복 +50, 사용 후 슬롯0 복귀 |
  - 스킬 게이지: 시간당 자동 충전 + 적 처치 시 `+0.5`(`OnEnemyDieEvents` 구독).

---

### 기능 3: 애니메이션 구동 타격 판정 (StateMachineBehaviour)

- **무엇을 · 어떻게 만들었나**
  - **타격 창(hit window)을 애니메이션에 귀속** — 코드 타이머가 아니라 애니메이션 상태의 `normalizedTime` 으로 타격 콜라이더를 켜고 끈다. `PlayerAttackSender`/`PlayerSkillSender`/`GoblinAttackSender` 가 `StateMachineBehaviour` 를 상속해 각 상태의 진행도를 감시.
  - **시작/종료 정규화 시간** — 인스펙터에서 `startNormalizedTime`·`endNormalizedTime` 을 잡아, 스윙 모션의 실제 칼이 지나가는 구간에서만 판정이 열리도록 함. `GoblinAttackSender` 는 2단 히트(두 번째 시작/종료)까지 지원.
  - 플레이어 공격 시작에 SFX 재생, 종료에 콜라이더 Off. 스킬도 동일 패턴으로 스킬 콜라이더를 On/Off.

- **핵심 코드**
```csharp
// PlayerAttackSender.OnStateUpdate — 정규화 시간으로 타격 창 개폐
if (passStartNormalizedTime == false && startNormalizedTime < stateInfo.normalizedTime)
{
    SFXManager.Instance.Play(attack1);
    player.AttackStart();          // 어디가: 무기 콜라이더 On
    passStartNormalizedTime = true; // 왜: 한 상태에서 한 번만 열도록 플래그
}
if (passEndNormalizedTime == false && endNormalizedTime < stateInfo.normalizedTime)
{
    player.AttackEnd();            // 무기 콜라이더 Off
    passEndNormalizedTime = true;
}
```
  - 「어디가·왜」: `passStart/EndNormalizedTime` 플래그 — `OnStateUpdate` 는 매 프레임 호출되므로 중복 On/Off 를 막기 위한 1회성 래치.

- **필요한 그래프**
  - 종류: **흐름 (flowchart)** 또는 타임라인. 질문: "애니메이션 진행도에 따라 타격 판정이 언제 열리고 닫히나?"
  - 노드/엣지: `OnStateEnter(플래그 리셋)` → `normalizedTime ≥ start → WeaponCollOn` → `normalizedTime ≥ end → WeaponCollOff`(고블린은 second start/end 추가).

---

### 기능 4: 상속 기반 몬스터 바리에이션

- **무엇을 · 어떻게 만들었나**
  - **공통 골격을 부모에 집약** — `GoblinBase` 가 NavMesh 추격, 사거리 진입 시 공격, 피격/사망, 오브젝트 풀 반납, 거리 기반 그르렁 사운드를 모두 담당. `VirtualUpdate`·`WeaponCollOn/Off`·`OffParticle`·`PoolDeque` 를 `virtual` 로 열어 자식이 차이만 덮어씀.
  - **낙차 점프** — 추격 중 `agent.isOnOffMeshLink` 이면 코루틴으로 `Sin` 곡선 포물선 점프 후 `CompleteOffMeshLink`.
  - **파생 4종**: `WaveGoblin`(순수 기본형) · `PatrolGoblin`(순찰 경로 + 시야각·시야거리·레이캐스트로 발각 시 추격, 피격당하면 즉시 추격) · `EliteGoblin`(오라 파티클) · `ShamanGoblin`(근접 대신 `WeaponCollOn` 을 화염구 생성으로 오버라이드 = 원거리).
  - **사망 → 풀 반납** — 사망 시 `EnemyDieEvents` 발행, 3초 후 풀로 반납(`WaveGoblin` 계열). `PatrolGoblin` 은 풀이 아니라 `CombatSystem` 에서 등록 해제.

- **핵심 코드**
```csharp
// ShamanGoblin — 부모의 '무기 콜라이더 켜기'를 원거리 투사체 생성으로 대체
public override void WeaponCollOn()
{
    Instantiate(fireBallPrefabs, firePoint.position, Quaternion.identity);
}
public override void WeaponCollOff() { }   // 왜: 샤먼은 근접 콜라이더가 없음
```
```csharp
// GoblinBase.VirtualUpdate — 거리 기반 추격/공격 분기(암묵적 FSM)
float distance = Vector3.Distance(player.transform.position, transform.position);
if (distance < goblinStat.range) Attack();
else { animator.ResetTrigger(ATTACK); Chase(); }
```
  - 「어디가·왜」: `WeaponCollOn` 오버라이드 하나로 근접→원거리 종을 파생 — 애니메이션 이벤트(`GoblinAttackSender`)는 부모와 동일하게 재사용된다는 점이 핵심.

- **필요한 그래프**
  - 종류 A: **클래스/타입 계층 (classDiagram)**. 질문: "고블린 종을 어떻게 상속으로 확장했나?"
    - 노드/엣지: `GoblinBase`(abstract; `IFighter`, `IObjectPoolItem`) ◁── `WaveGoblin`·`PatrolGoblin`·`EliteGoblin`·`ShamanGoblin`. 오버라이드 지점 표기: `VirtualUpdate`(Patrol), `WeaponCollOn/Off`(Shaman), `OffParticle`(Elite/Shaman), `PoolDeque`(Patrol).
  - 종류 B: **상태 머신 (stateDiagram)** — 고블린 행동. 질문: "고블린은 언제 순찰/추격/공격/점프하나?"
    - 상태·전이: `Patrol` ─(시야 내 or 피격)→ `Chase` ─(distance < range)→ `Attack` ─(distance > range)→ `Chase`; `Chase` ─(OffMeshLink)→ `Jump` → `Chase`. (`WaveGoblin` 은 `Patrol` 없이 `Chase` 시작)

- **표/카드 사실**
  - 종별 카드(4개): WaveGoblin(기본) / PatrolGoblin(순찰·시야 발각) / EliteGoblin(오라) / ShamanGoblin(원거리 화염구, damage 10·speed 10).
  - PatrolGoblin 파라미터: 시야각 120°, 시야거리 10, 순찰 속도 2 → 추격 속도 6.

---

### 기능 5: 상태 패턴 보스 FSM

- **무엇을 · 어떻게 만들었나**
  - **상태를 GameObject 컴포넌트로** — `BossState` 파생 스크립트들을 자식 오브젝트에 붙이고, `Boss.Start` 가 `GetComponentsInChildren<BossState>()` 로 모아 `Dictionary<StateName, BossState>` 에 등록·초기화한다. 전이는 `ChageState(StateName)` 하나로 이전 상태 비활성화 + 새 상태 활성화·`Enter`.
  - **부위 피격** — `BossParts` 가 몸/양팔/양다리 콜라이더를 노드 배열로 모으고, 각 콜라이더를 같은 `Boss` 에 등록해 어느 부위를 맞아도 단일 HP(500)에 반영.
  - **상태 내부 전이** — `ChaseState` 는 추격하다 사거리 안에서 `JumpAttack`/`FootAttack` 를 무작위 선택해 트리거 + 상태 전환. 공격 상태는 `normalizedTime > exitTime` 이면 다시 `ChaseState` 로. 공격 판정은 `FootAttack`/`JumpAttack` 콜라이더가 담당하며 명중 시 넉백까지.

- **핵심 코드**
```csharp
// Boss.ChageState — 딕셔너리 기반 상태 교체(활성/비활성 토글)
public void ChageState(BossState.StateName enterState)
{
    if (CurrentState != null) { CurrentState.Exit(); CurrentState.gameObject.SetActive(false); }
    BossState targetState = stateDictionary[enterState];   // 어디가: 이름→상태 조회
    CurrentState = targetState;
    targetState.gameObject.SetActive(true);
    targetState.Enter();                                   // 왜: 각 상태를 독립 오브젝트로 캡슐화
}
```
```csharp
// ChaseState.Update — 사거리 진입 시 무작위 공격 선택 후 전이
int nextAttackTrigger = Random.Range(0, bossAttacks.Length);
int stateValue = nextAttackTrigger + 1;                  // 어디가: enum 순서와 트리거 배열을 맞춤
animator.SetTrigger(bossAttacks[nextAttackTrigger]);
boss.ChageState((StateName)stateValue);                  // 왜: 트리거와 상태를 함께 전환
```
  - 「어디가·왜」: 상태를 클래스+오브젝트로 분리 → README 회고의 "기존 코드 수정 없이 클래스 추가로 확장"이 실제로 이 구조에서 나온다.

- **필요한 그래프**
  - 종류 A: **상태 머신 (stateDiagram)**. 질문: "보스는 어떤 조건으로 상태를 오가나?"
    - 상태·전이: `[*] → ChaseState`; `ChaseState ─(distance < attackRange, 무작위)→ JumpAttackState / FootAttackState`; `JumpAttackState ─(normalizedTime > exitTime)→ ChaseState`; `FootAttackState ─(normalizedTime > exitTime)→ ChaseState`; 어느 상태든 `HP ≤ 0 → Dead`.
  - 종류 B: **클래스 계층 (classDiagram)**: `BossState`(abstract) ◁── `ChaseState`·`JumpAttackState`·`FootAttackState`; `Boss ──> Dictionary<StateName, BossState>`.

- **표/카드 사실**
  - 보스 스탯: HP **500**. 공격 2종 — FootAttack(데미지 20), JumpAttack(데미지 30), 둘 다 명중 시 플레이어 넉백.
  - 부위 콜라이더 5개: Body·LeftArm·RightArm·LeftLeg·RightLeg.

---

### 기능 6: 오브젝트 풀

- **무엇을 · 어떻게 만들었나**
  - **키 기반 다중 풀** — `ObjectPoolManager` 가 `Dictionary<string, ObjectPool>` 로 프리팹별 풀을 보유. 각 풀은 `IObjectPoolItem` 을 담는 `Queue`(FIFO). 시작 시 `ExpandSize` 만큼 미리 `Instantiate` 해 런타임 생성 부하를 초기 로딩으로 몰아준다.
  - **부족 시 자동 확장** — `GetItem` 시 큐가 비면 `Expand()` 로 추가 생성 후 반환. 반납은 `SetActive(false)` + `Enqueue`.
  - **적용 대상** — 고블린(`GoblinBase`), 혈흔 파티클(`BloodParticle`, 재생 종료를 감지해 자동 반납).

- **핵심 코드**
```csharp
// ObjectPool.GetItem — 비었으면 확장 후 Dequeue (재사용 우선)
public IObjectPoolItem GetItem()
{
    if (Pool.Count == 0) Expand();   // 어디가: 초기 예열분 소진 시
    return Pool.Dequeue();           // 왜: Destroy/Instantiate 대신 재활용해 GC 스파이크 방지
}
```
  - 「어디가·왜」: `Queue`(FIFO) 선택 — README 회고의 "중간 접근을 포기하고 입출력 속도를 얻음"이 이 자료구조 선택과 직결.

- **필요한 그래프**
  - 종류: **흐름 (flowchart)**. 질문: "풀에서 객체가 어떻게 나가고 돌아오나?"
  - 노드/엣지: `GetObjectOrNull(key)` → `Pool 비었나?` ─Y→ `Expand(Instantiate)` ─N→ `Dequeue` → `SetActive(true)` … 사용 후 → `ReturnToPool` → `SetActive(false)` → `Enqueue`.

- **표/카드 사실**
  - `ObjectPoolData` 필드: Key · Prefab · ExpandSize · Parent.
  - 등록 풀 키 예시(코드에서 사용): `Goblin_1`, `Goblin_2`, `Goblin_Elite`, `Goblin_Shaman`, `Blood`, `BossBlood`.

---

### 기능 7: 웨이브 스폰 시스템

- **무엇을 · 어떻게 만들었나**
  - **가장 가까운 스폰 지점 2곳** — `SpawnPointSet` 이 모든 스폰 포인트와 플레이어 거리를 재 **최소 2개**를 한 번의 순회로 선별(1·2등 갱신). 플레이어 주변에서 협공하듯 소환.
  - **웨이브 종류** — 타이머 웨이브(`waveDelay` 마다 자동), 트리거 웨이브(`WaveTrigger` 접촉 시), 엘리트 웨이브(확률). 일반 웨이브는 두 지점에 `Goblin_1`/`Goblin_2` 를 섞어 소환하고, 확률에 따라 엘리트/샤먼을 섞음.
  - **BGM·카운트 연동** — 웨이브 시작 시 `GameState.Wave` BGM, 남은 적이 1 이하로 줄면 `Dungeon` 으로 복귀. `waveCounter` 는 `OnEnemyDieEvents` 구독으로 감소.

- **핵심 코드**
```csharp
// WaveSystem.SpawnPointSet — 단일 순회로 최근접 2지점 선택
if (distance[i] < min) { min2 = min; second = first; min = distance[i]; first = i; }
else if (distance[i] < min2) { min2 = distance[i]; second = i; }
// 왜: 정렬 없이 O(n) 으로 1·2등만 추려 플레이어 양쪽에서 소환
```

- **필요한 그래프**
  - 종류: **흐름 (flowchart)**. 질문: "웨이브가 어떤 판단으로 무엇을 소환하나?"
  - 노드/엣지: `타이머/트리거` → `SpawnPointSet(최근접 2)` → `엘리트 웨이브 확률?` ─Y→ `엘리트 N` ─N→ `일반 웨이브(두 지점 × (엘리트확률 ? 엘리트/샤먼 : Goblin_1/2))` → `풀에서 꺼내 SetActive`.

- **표/카드 사실**
  - `WaveSetting` 파라미터: spawnPoint[] · waveDelay · timerWaveAmount · waveEliteRate(개체 내 엘리트 비율) · eliteWaveRate(엘리트 웨이브 확률) · eliteSpawnAmount.

---

### 기능 8: 인터페이스 기반 상호작용 & 미션 진행

- **무엇을 · 어떻게 만들었나**
  - **`IInteractable` 단일 계약** — 플레이어 카메라 정면 `Raycast`(레이어 `Interactables`)로 대상을 찾아 `InteractText()` 프롬프트를 띄우고, E 입력 시 `Interact()` 실행. 대상마다 로직이 다르지만 플레이어는 인터페이스만 안다.
  - **미션 진행 드라이버** — 상호작용이 `MissionText.Instance.TextUpdate(...)` 로 목표 문구를 갱신하고 웨이브/보스/문 등을 제어. 예: `Cannon`(포탄 3회 발사로 단계 진행 + 웨이브 유발), `CaveCrystal`(문 파괴), `BossSpawn`(차지→폭발→보스 활성화 + 보스 BGM), `GetAmmo`/`GetPotion`(자원 획득).
  - **탈출 시퀀스** — 보스 사망을 `ExitPortal` 이 감지해 탈출 문구·최종 웨이브·`Escape` BGM·포탈 개방.

- **핵심 코드**
```csharp
// PlayerMovement.ShowInteractText — 정면 레이캐스트로 상호작용 대상 탐지
if (Physics.Raycast(ray, out RaycastHit hit, interactDistance, LayerMask.GetMask("Interactables")))
{
    var interactable = hit.collider.GetComponent<IInteractable>();  // 어디가: 인터페이스로만 취급
    if (interactable != null) { currentInteractable = interactable; interactText.text = interactable.InteractText(); }
}
```
```csharp
// Cannon.Interact — 발사 횟수에 따라 미션 단계 전이(switch)
case < 2: MissionText.Instance.TextUpdate($"...{fireCount} / 3"); WaveSystem.Instance.WaveStart(10); break;
case > 2: MissionText.Instance.TextUpdate("Destroy the staff"); Destroy(rock); enabled = false; break;
```

- **필요한 그래프**
  - 종류 A: **클래스 계층 (classDiagram)**: `IInteractable` ◁── `NPC`·`InteractionMissionBook`·`Cannon`·`CannonBall`·`CaveCrystal`·`GetAmmo`·`GetPotion`·`BossSpawn`.
  - 종류 B: **흐름 (flowchart)** — 미션 진행: `크리스탈 파괴 → 통로 탐색 → 포탄 3회 발사 → 스태프 파괴/보스 소환 → 골렘 처치 → 시작지점으로 탈출`.

- **표/카드 사실**
  - 상호작용물 카드: 각 `InteractText` 문구가 그대로 UI 프롬프트(예: `[E] Pick up`, `[E] Fire`, `[E] destroy the crystal`, `[E] Destroy the Staff`).

---

### 기능 9: 사운드 · BGM 시스템 (GameState 기반)

- **무엇을 · 어떻게 만들었나**
  - **SFX 수동 풀** — `SFXManager` 가 `AudioSource` 10개를 만들어 비어있는 소스에 재생. `Play` 는 단순 재생, `PlayNoDuplicate` 는 같은 클립이 이미 재생 중이면 스킵(그르렁·연속 타격음 중복 방지) + 피치 랜덤(0.95~1.05).
  - **상태 기반 BGM** — `BGMManager`(DontDestroyOnLoad 싱글턴)가 `Dictionary<GameState, AudioClip>` 로 곡을 들고 `ChangeBGM(GameState)` 로 전환하되 같은 상태면 무시. `GameState`: Title·Idle·Wave·Boss·Escape·Dungeon.
  - **씬/상황 트리거** — `TitleBGM`/`LobbyBGM`/`DungeonBGM` 이 씬 진입 시 상태 세팅, 웨이브·보스·탈출은 각 시스템이 상태 전환.
  - **`SFXData` ScriptableObject** — 클립·볼륨·스킵 오프셋을 에셋으로 분리해 코드 수정 없이 사운드 교체.

- **핵심 코드**
```csharp
// SFXManager.PlayNoDuplicate — 동일 클립 중복 재생 차단 + 피치 변주
foreach (AudioSource source in audioSourcesArray)
    if (source.isPlaying && source.clip == sfxData.clip) return;   // 왜: 겹쳐 울리는 소음 방지
// ...빈 소스에 clip/volume 세팅 후 pitch = Random.Range(0.95f, 1.05f);
```

- **필요한 그래프**
  - 종류: **상태 머신 (stateDiagram)**. 질문: "BGM 은 게임 상황에 따라 어떻게 바뀌나?"
  - 상태·전이: `Title → Idle(로비) → Dungeon → Wave ⇄ Dungeon → Boss → Escape`.

- **표/카드 사실**
  - `SFXData` 필드: soundName · clip · skip(0~0.5) · volume(0~1). SFX 풀 크기 = **10**, BGM 볼륨 = 0.4.

---

### 기능 10: 옵저버 기반 이펙트 디커플링 (혈흔)

- **무엇을 · 어떻게 만들었나**
  - **피격 이벤트 구독으로 혈흔 재생** — `BloodControl` 이 `CombatSystem.Events.OnCombatEvent` 를 구독하고, 피격 대상의 `bloodType`(Player/Monster/Boss)에 따라 풀에서 `Blood`/`BossBlood` 파티클을 꺼내 명중 위치에 재생. 전투 로직은 혈흔의 존재를 모른다(역참조 없음).
  - **자동 반납** — `BloodParticle` 은 파티클 재생이 끝나면 스스로 풀에 반납.

- **핵심 코드**
```csharp
// BloodControl — 전투 이벤트를 구독해 bloodType 별로 혈흔 파티클 재생
private void PlayBlood(CombatEvents combatEvent)
{
    switch (combatEvent.Receiver.bloodType)
    {
        case BloodType.Player: return;                 // 어디가: 플레이어는 혈흔 생략
        case BloodType.Monster: /* "Blood" 풀에서 꺼내 HitPosition 에 재생 */ break;
        case BloodType.Boss:    /* "BossBlood" 풀 */ break;
    }
}
```
  - 「어디가·왜」: `IFighter.bloodType` 로 표현을 분기 — 이펙트가 전투 코드에 침투하지 않도록 **이벤트 구독 + 인터페이스 속성**으로 분리.

- **필요한 그래프**
  - 종류: **흐름 (flowchart)**. 질문: "혈흔은 어떻게 전투와 분리되어 재생되나?"
  - 노드/엣지: `CombatSystem.OnCombatEvent` → `BloodControl.PlayBlood` → `Receiver.bloodType` 분기 → `ObjectPool(Blood/BossBlood)` → `HitPosition 재생` → 종료 시 자동 반납.

---

## 부록 — 확인이 더 필요한 것 (사람에게)

- **period** 확정: 코드 커밋은 2025.12.28 까지지만 README 는 2025.04.15~05.02 를 개발 기간으로 명시 → 포트폴리오에 쓸 기간을 선택 필요.
- **evidence(수치·측정값)**: README 의 "프레임 15 미만 → Occlusion Culling 으로 개선" 같은 **측정 전후 값**은 코드에 없음 → 양식 ②/③ 로 보완.
- **스크린샷·영상·저장소 링크**: 코드로 알 수 없음 → 양식 ③.
- **세이브 기능**: `SavingSystem` 은 현재 스텁 — 실제 기능이 없음을 문서에 반영할지 확인.
