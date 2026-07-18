# 구현 문서 ① — 뱀서라이크 (VamSirLike)

> **양식:** `Portfolio_Pipeline/templates/1-구현-AI.md` (구현 · PART A / PART B 분리판)
> **이 문서 = PART A(프로젝트 AI 산출물).** 대상 repo 게임 코드를 읽고 *무엇을 · 어떻게 만들었나*를 **말로** 뽑은 사실이다.
>   YAML 블록 `type` · mermaid 문법은 넣지 않는다 — 그건 PART B(파이프라인 AI)가 조립할 때 한다.
> **철칙:** 코드 · git 에서 확인한 것만. 지어내지 않는다. 모르면 비우고 사람에게 묻는다. (`« »` = 채울 자리)
> **근거:** 소스 스크립트 22개 · `git log` · `ProjectSettings` · TSV 4종 · 기존 `vampire-like.yaml` · `26_0717_TechDoc`.
> **작성일:** 2026-07-18 · **대상 커밋:** `819a6ca` (main)

---

# PART A — 코드에서 뽑은 사실

## A0. 메타 — git · ProjectSettings 에서

- **slug**: `vampire-like` (`projects.yaml` 의 키)
- **subtitle**: 탑뷰 핵 앤 슬래시
- **period**: 2026.03.03 ~ 03.18
  - *근거:* 기능 개발 커밋 구간(`2026-03-03` 이동·맵 ~ `2026-03-07` 스킬매니저·경험치). `git log` 전체 첫/마지막은 `2026-02-02`(Initial) ~ `2026-07-17`(문서 커밋)이나, 2월 단일 Initial 커밋과 6·7월 데이터·문서 커밋을 제외한 실제 개발 스프린트로 표기.
- **engine**: Unity 6000.0.56f1 · URP
  - *근거:* URP 확정(`GraphicsSettings.asset` 의 `UniversalRenderPipeline`, `com.unity.render-pipelines.universal 17.3.0`). ⚠ 현재 `ProjectSettings/ProjectVersion.txt` 는 `6000.3.10f1`(개발 이후 에디터 상향 추정)이나, 표기는 개발 당시 버전 `6000.0.56f1` 로 통일.

> **team · vcs · ide · 링크 · 스크린샷은 코드로 알 수 없다 → 양식 ③.**
> (확인된 값 참고용: 1인 / GitBash CLI · Github Desktop / Rider 2025.2.1 / 유튜브 `youtu.be/kCM6ASBUIEo` / 깃허브 `github.com/juno11234/VamSirLike` / hero `gameplay.png`)

## A1. 개요 — 사실

- **what**: 이동만 조작하면 보유 스킬이 쿨타임마다 **자동 발동**해 수백 마리의 적을 처치하고, 적이 떨군 경험치 보석을 모아 레벨업하면 게임이 멈추고 스킬 3종 중 하나를 **선택·강화**하는 **2D 탑다운 뱀서라이크**다.
- **scope**: 의존성 주입과 초기화 순서, 데이터 드리븐 파이프라인(TSV→ScriptableObject→런타임 딕셔너리), 이벤트 큐 전투 시스템, 오브젝트 풀링/GC 최적화 기법, 스킬 시스템, 이벤트 기반 UI, 빌드 자동화를 다룬다. **아트 · 사운드 · 레벨 디자인은 이 문서의 범위가 아니다.**

### 기술 스택 — 분류 · 기술 · 사용 목적 (개요 섹션 끝에 렌더)

> PART B 참고: 본문 블록이 아니라 **개요의 `overview.stack`** 으로 렌더된다 — 무엇으로 만들었나를 먼저 보이기 위함.

- **엔진 · 렌더** — Unity 6000.0.56f1 · URP — 2D `SpriteRenderer` 기반 탑다운 렌더
- **DI 프레임워크** — VContainer — 전역 의존성 주입 · 생명주기 관리(`LifetimeScope` · `IAsyncStartable` · `ITickable`)
- **비동기 처리** — UniTask — GC 없는 `async/await` · 프레임 분산 로딩 · 취소 토큰 연동
- **에셋 관리** — Addressables 2.9.0 — 데이터 · 프리팹 · 스프라이트의 비동기 로드 및 명시적 `Release`
- **오브젝트 풀링** — `UnityEngine.Pool.ObjectPool<T>` — 적 · 투사체 · 경험치 재사용으로 GC 스파이크 제거
- **입력** — Unity Input System 1.18.0 — 자동 생성 클래스 `PlayerActions` 로 이동 입력 처리
- **데이터** — ScriptableObject · TSV — 기획 밸런싱 데이터를 코드와 분리한 데이터 드리븐 설계
- **텍스트 UI** — TextMeshPro — `SetText` 오버로드로 힙 할당 없는 텍스트 갱신
- **셰이더** — ShaderGraph — 피격 플래시 셰이더(`HitFlash.shadergraph`) 제작 — 스프라이트를 흰색으로 덮는 `_Amount` 프로퍼티
- **material 최적화** — `MaterialPropertyBlock` — 피격 플래시 시 프로퍼티만 덮어써 공유 material 유지
- **빌드 자동화** — GitHub Actions — `main` 병합 시 클라우드에서 Android 빌드(`.github/workflows`)
- **프로파일링** — Unity Profiler — 프레임당 GC 할당·스파이크 측정으로 최적화 지점 식별
- **성능 분석** — Unity Profile Analyzer 1.3.4 — Compare 모드로 최적화 전/후 마커별 프레임 분포 비교 *(측정 수치 자체는 → 양식 ②)*

> **why · evidence(동기 · 프로파일러 측정값)는 양식 ②.** 개요 가운데(WHAT/WHY 2단 또는 목표 카드)의 WHY 쪽은 사람이 ②에 쓴다.

## A2. 시스템 구조 — 말로 서술 (그림은 PART B 가 그린다)

- **intro**: 시스템은 **조립 루트 → 매니저 → 런타임 객체**의 3계층이다. VContainer가 최상위에서 의존성을 조립하고, 데이터·전투·스폰·경험치·UI 매니저가 그 아래 런타임 객체를 생성·등록·구독한다.

### 계층 구성 (위→아래)

- **조립 루트** — `GameLifetimeScope` (DI Root · EntryPoint)
- **매니저** — `DataManager`(데이터 허브) · **`CombatSystem`(전투 이벤트 큐 · 허브 — 이 문서의 핵심)** · `SpawnManager`(웨이브 · 풀링) · `ExpManager`(경험치 · 풀링) · `UIManager`(HUD · 이벤트)
- **런타임 객체** — `PlayerController`(IFighter) · `EnemyController`(IFighter) · `SkillManager`(SkillBase 계층) · `ExpItem`(자석 이동) · `LevelUpUI`(스킬 선택)

세 줄 요약:

- **구성요소**: 조립 루트 1개, 매니저 5종, 그 아래 런타임 객체 5종.
- **관계**: `GameLifetimeScope` 가 매니저를 주입·등록하고, 매니저가 런타임 객체를 생성·등록·구독한다. 플레이어와 적은 구체 타입이 아닌 **`IFighter`** 인터페이스로만 전투 시스템과 이어진다.
- **흐름**: 초기화를 `await` 로 직렬화한다. `DataManager` 로드 대기 → `PlayerController` 조립·스탯 주입 → `SpawnManager` 풀 준비 대기 → `ExpManager` 기동. 데이터 로드 전 플레이어가 생성되는 경쟁 조건을 순서로 차단한다.

> PART B 참고: 이 계층 구성은 사람이 강조(`CombatSystem`)를 정했으므로 자동 배치 mermaid 가 아니라 `layers` 블록으로 그린다.

### 핵심 클래스 관계 (계약만 — 그림은 PART B 가 클래스 계층으로)

- **`IFighter`** (interface) — `MainCollider` · `TakeDamage(InGameEvent)` · `Heal(InGameEvent)`. **`PlayerController` 와 `EnemyController` 가 구현**해 전투 로직이 양쪽을 동일하게 취급한다.
- **`InGameEvent`** (struct) — `Type` · `Sender` · `Receiver` · `Amount`. 힙 할당을 막으려 구조체로 설계.
- **`CombatSystem`** — `_monstersDict`(Collider2D→IFighter) · `_eventQueue`(InGameEvent). `InGameEvent` 를 큐에 저장하고 `IFighter` 로 디스패치. `ITickable` 로 등록돼 매 프레임 `Tick()`.
- **`SkillBase`** (abstract) — `CombatSystem` · `Sender` · `SkillData` · `CurrentLevel` · `Damage` · `Cooldown` + `Init` · `LevelUp` · `GetCurrentData`. **`CircleAttack` · `ProjectileTargetScanner` · `BoomerangManager` · `SpiralManager` 가 상속**하고 `CombatSystem` 에 이벤트를 발행.
- **`SkillManager`** — `_activeWeapons`(int→SkillBase) 로 보유 스킬 관리.

## A3. 핵심 기능

### 기능 ①: 의존성 주입과 초기화

**무엇을 · 어떻게** — 의존 순서를 `await` 로 직렬화해, 데이터 로드 전 플레이어 생성 같은 경쟁 조건을 원천 차단했다. 순수 C# 클래스는 `Register`, 씬의 MonoBehaviour는 `RegisterComponent` 로 구분 등록한다.

**핵심 코드 — DI 등록** (`GameLifetimeScope.Configure`)

```csharp
builder.Register<DataManager>(Lifetime.Singleton);          // 순수 C# 클래스
builder.Register<CombatSystem>(Lifetime.Scoped)             // 이 씬만(Scope)
    .AsImplementedInterfaces()                              // ITickable 명찰 등록
    .AsSelf();                                              // 본명 등록
builder.RegisterComponent(spawnManager);                    // 씬에 이미 있는 MonoBehaviour
builder.RegisterComponent(playerController);
builder.RegisterComponent(expManager);
builder.RegisterComponent(uiManager);
builder.RegisterComponent(levelUpUI);
builder.RegisterEntryPoint<GameInitializer>();
```

- **어디:** `AsImplementedInterfaces()` — **왜:** `CombatSystem` 을 `ITickable` 로 잡히게 해 VContainer가 매 프레임 `Tick()` 을 호출한다. 이 등록이 없으면 전투 이벤트 큐가 영영 비워지지 않는다.
- **어디:** `Register` vs `RegisterComponent` — **왜:** 코드 주석대로 "Register 대신 RegisterComponent" — 씬에 이미 존재하는 인스턴스를 그대로 컨테이너에 넣기 위해.

**핵심 코드 — 진입점** (`GameInitializer.StartAsync`, `IAsyncStartable`)

```csharp
await _dataManager.InitializeAsync(cancellationToken);
// VContainer가 이 예외를 감지하고 안전하게 초기화 프로세스를 중단.
cancellationToken.ThrowIfCancellationRequested();
PlayerStat warriorStat = _dataManager.GetPlayerStat(PlayerWarriorId); // 3001
_playerController.Initialize(warriorStat, _combatSystem, _dataManager);
await _spawnManager.InitAsync(_playerController, _combatSystem, _expManager, _dataManager, cancellationToken);
_expManager.Init();
```

- **어디:** `await` 직렬화 — **왜:** 데이터 로드가 끝나야 플레이어 스탯을 세팅할 수 있어 순서를 강제한다.
- **어디:** `PlayerWarriorId = 3001` — **왜:** 플레이어 직업 ID가 상수로 하드코딩. 현재 전사만 쓰고 `JobType.Mage` 는 진입 경로가 없다. *(사실 — 개선 판단은 ②)*

**그래프** — *질문:* 초기화는 어떤 순서로 흐르나? · *종류:* 단계 흐름(분기 없음). *노드(순서):* `await DataManager.InitializeAsync` → `ThrowIfCancellationRequested` → `GetPlayerStat(3001)` → `PlayerController.Initialize` → `await SpawnManager.InitAsync` → `ExpManager.Init()`.

**곁가지(주의)** — 이 프로젝트의 모든 `UniTask.Delay` 는 `ignoreTimeScale` 기본값(false). `Time.timeScale = 0`(레벨업/게임오버) 시 스폰 간격·연사 딜레이·피격 무적 대기도 함께 멈춘다. (의도된 동작)

### 기능 ②: 데이터 파이프라인 (TSV 임포트 · DataManager)

**무엇을 · 어떻게** — 스프레드시트에서 작업한 밸런싱 데이터(TSV)를 커스텀 에디터 툴로 `ScriptableObject` 에 담고, 런타임에는 조회가 빠른 딕셔너리로 재가공한다.

- **DataImporter(에디터)**: `VamSir Tools ▸ Data Importer` 메뉴의 `EditorWindow`. 탭 분리 파싱, **2줄 헤더(타입 행·한글명 행)라 루프가 `i = 2` 부터** 시작. `EditorApplication.delayCall` 로 GUI 충돌 회피, `Undo.RecordObject` + `SetDirty`. 플레이어(6칸)·스킬(12칸)은 칸 수 검증, 적·레벨업은 검증 없음.
- **DataManager(런타임)**: `Addressables.LoadAssetAsync<GameDataContainer>("GameData")` 로드 후 `List` → 3종 `Dictionary`. `IDisposable` 로 스코프 종료 시 `Release`.

**핵심 코드 — 조회 실패 패턴 + 리스트 재사용** (`DataManager`)

```csharp
public List<SkillData> GetSkillList()
{
    _skillList.Clear();                                 // 새 리스트 대신 필드 재사용(GC 절감)
    foreach (var skills in _container.SkillData)
        if (skills.job is JobType.Warrior) _skillList.Add(skills);
    return _skillList;
}
```

- **어디:** `_skillList.Clear()` 후 재사용 — **왜:** 매 호출 새 리스트 할당을 피한다. 호출자가 반환 리스트를 수정(셔플)해도 다음 호출에서 `Clear` 후 다시 채워져 동작엔 문제없다.

**그래프** — *질문:* TSV 한 장이 런타임 딕셔너리가 되기까지? · *종류:* 흐름. *노드:* TSV(TextAsset) → DataImporter(EditorWindow) → GameDataContainer(SO) → Addressables("GameData") → DataManager → Dictionary 3종. *엣지:* 탭분리·2행부터 파싱 / SetDirty / LoadAssetAsync / Initialize().

**표로 낼 사실 — 데이터 ID 규약**

| ID 대역 | 클래스 | 주요 필드 |
| --- | --- | --- |
| 1001~ | `EnemyStat` | id · name · hp · atk · speed · attackType |
| 3001~ | `PlayerStat` | id · name · baseHp · baseAtk · baseSpeed · baseCooldown |
| 4001~ | `SkillData` | id · name · job · enhanceType · baseAtk · cooldown · maxLevel · atkPerLevel · enhancePerLevel · description · prefabKey |
| 5001~ | `StatLevelUp` | id · name · increaseStatPer · minLevel · maxLevel · statType |

열거형: `AttackType`(Melee·Ranged·Boss) · `JobType`(Warrior·Mage) · `EnhanceType`(Range·Projectile) · `StatType`(HP·ATK·Speed·Cooldown).

**곁가지(사실)** — 스킬 TSV 6번 인덱스(최소 레벨)는 코드 주석과 함께 읽지 않고 건너뛴다. `AssetDatabase.SaveAssets()` 는 주석 처리돼 `SetDirty` 후 수동/자동 저장이 있어야 디스크 반영.

### 기능 ③: 이벤트 큐 전투 시스템

**무엇을 · 어떻게** — 개별 객체가 대상을 직접 때리지 않고, 모든 데미지를 `InGameEvent` 구조체로 큐에 넣어 프레임당 한 곳에서 순차 처리한다.

**핵심 코드 — 큐 소비** (`CombatSystem.Tick`)

```csharp
public void Tick()
{
    while (_eventQueue.Count > 0)     // 큐가 빌 때까지 한 프레임에 모두 소비
    {
        InGameEvent e = _eventQueue.Dequeue();
        switch (e.Type)
        {
            case EventType.Combat: e.Receiver.TakeDamage(e); break;
            case EventType.Heal:   e.Receiver.Heal(e);       break;
        }
    }
}
```

- **어디:** `while` 루프 — **왜:** 한 프레임에 쌓인 전투 이벤트를 전부 소비한다. 지연은 최대 1프레임이 아니라 사실상 0이다.
- **어디:** `Dequeue` 단일 지점 — **왜:** 처리 지점이 프레임당 한 곳이라 피격 이펙트·사운드를 여기서 일괄 후킹할 수 있다(`EventCallback`).

**그래프** — *질문:* 발행된 데미지는 어디로 모여 처리되나? · *종류:* 흐름. *노드:* 생산자 5종(`CircleAttack` · `ProjectileAttack` · `BoomerangProjectile` · `SpiralProjectile` · `EnemyController`) → `_eventQueue` → `Tick()` → 분기(Combat→`TakeDamage` / Heal→`Heal`) → 수신자(Player · Enemy). *엣지:* `AddInGameEvent` 로 적재 / `evt.Type` 로 분기.

**곁가지(사실)** — 몬스터 등록/해제는 풀의 `createFunc`(`RegisterMonster`)/`actionOnDestroy`(`RemoveMonster`)에 걸린다. 적이 죽어 풀 반납될 때는 딕셔너리에서 빠지지 않으나(재사용 시 재등록 불필요), 비활성 콜라이더는 물리 쿼리에 안 잡혀 조회되지 않는다. `Max_Event_Count`(1000) 상수·주입된 `_dataManager`·`EventCallback` 은 현재 사용처/구독자 없음. *(사실 — ②)*

### 기능 ④: 플레이어 & 적 (IFighter)

**무엇을 · 어떻게** — 플레이어와 적이 같은 `IFighter` 를 상속해 전투 로직이 양쪽을 동일 취급한다.

- **PlayerController**: `transform.position` 직접 대입 이동(물리 미사용) + `Mathf.Clamp` 경계 제한, `OverlapCircle`(반경 4) 경험치 자석, 피격 시 `UniTask.Delay` 무적 + `MaterialPropertyBlock` 플래시. `Initialize` 에서 `MaxHp ← baseHp`, `_moveSpeed ← baseSpeed`.
- **EnemyController**: `Setup()` 으로 스폰 매니저가 타겟·스탯·반납 콜백·전투 시스템 주입. 경로 탐색 없이 직선 추적, 사거리 안이면 멈추고 쿨타임마다 공격. 직접 `Destroy` 하지 않고 `_onDeathCallback` 으로 풀 반납 + 경험치 드롭.
- **이벤트 기반 UI**: `OnHpChanged` · `OnDeath` 로 폴링 없이 갱신.

**표로 낼 사실 — 적 스탯(적스탯 TSV)**

| ID | 이름 | 체력 | 공격력 | 이동속도 | 공격타입 |
| --- | --- | --- | --- | --- | --- |
| 1001 | Rat | 10 | 10 | 5 | Melee |
| 1002 | Spider | 30 | 15 | 6 | Melee |
| 1003 | Ghost | 75 | 20 | 7 | Melee |
| 1004 | Warlock | 50 | 20 | 5 | Ranged |
| 1005 | Cyclops | 300 | 30 | 5 | Boss |

**곁가지(사실)** — `EnemyStat.attackType`(Ranged/Boss)이 데이터엔 있으나 `EnemyController` 가 분기에 안 써 현재 모든 적이 근접 행동. `PlayerController` 는 `baseAtk`·`baseCooldown` 을, `EnemyController.Heal()` 은 빈 구현이다(스킬 데미지는 `SkillData.baseAtk` 에서 직접). *(사실 — ②)*

### 기능 ⑤: 스킬 시스템 (SkillBase 계층 · 4종)

**무엇을 · 어떻게** — `SkillBase` 추상 클래스로 공통 상태를 정의하고 `override` 로 확장. 레벨업 후 최초 획득 시 Addressables로 프리팹을 동적 장착한다.

**핵심 코드 — 레벨업 계산식** (`SkillBase.LevelUp`)

```csharp
public virtual void LevelUp(SkillData skillData)
{
    if (CurrentLevel >= SkillData.maxLevel) return;   // 최대 레벨 가드
    Damage  += SkillData.atkPerLevel;                 // 데미지 상승
    Cooldown = Mathf.Max(0.1f, Cooldown - 0.5f);      // 쿨타임 감소 (하한 0.1s)
    CurrentLevel++;
}
```

- **어디:** `virtual` — **왜:** 기본은 데미지·쿨타임만 올리고, 반경 증가(`CircleAttack`)·투사체 수 증가(`ProjectileTargetScanner`·`SpiralManager`)는 파생 클래스가 `override`.
- **어디:** `Mathf.Max(0.1f, …)` — **왜:** 쿨타임이 0 이하로 내려가 매 프레임 발사되는 것을 막는 하한.
- **어디:** `0.5f` — **왜:** 데이터가 아닌 코드 상수. `SkillSelectButton` 표시 로직에도 같은 값이 복제돼 있다. *(중복 상수 사실 — 부채 판단은 ②)*

**그래프** — *질문:* 스킬 획득/강화는 어떻게 분기하나? · *종류:* 흐름. *노드/엣지:* `GetSkillData(id)` → (null이면 반환) → `_activeWeapons` 보유? → 있으면 `LevelUp` / 없으면 `InstantiateAsync(prefabKey)` → `Init` → `_activeWeapons.Add`. `OnDestroy` 시 `ReleaseInstance`.

**표로 낼 사실 — 전사 스킬 4종(플레이어 스킬 TSV · 4001~)**

| 무기(ID) | 구현 클래스 | 공격 방식 | 대상 선택 | 레벨업 효과 |
| --- | --- | --- | --- | --- |
| GreatSword(4001) | `CircleAttack` | OverlapCircle 주기 광역 | 반경 내 전체 | 데미지↑ · 쿨타임↓ · 반경↑ |
| Dagger(4002) | `ProjectileTargetScanner` | Raycast 직선 투사체 | 최근접 1체 자동 조준 | 데미지↑ · 쿨타임↓ · 발사 수 +1 |
| BattleAxe(4003) | `SpiralManager` | OverlapCircle 나선 궤도 | 무지향(나선 확산) | 데미지↑ · 쿨타임↓ · 발사 수 +1 |
| Hammer(4004) | `BoomerangManager` | OverlapCircle 왕복 | 최근접 1체(없으면 랜덤) | 데미지↑ · 쿨타임↓ (override 없음) |

> Mage 스킬 4종(4005~4008: ReleaseMagic · FireBall · LightningChain · IceMagic)은 TSV엔 있으나 `JobType.Mage` 진입 경로가 없어 미사용.

### 기능 ⑥: 스폰 & 오브젝트 풀

**무엇을 · 어떻게** — 게임 시작 시 풀을 미리 채우고(프리웜), 웨이브마다 독립 비동기 루프로 적을 스폰한다.

- **독립 풀 · 프리웜**: 적 프리팹별 `ObjectPool`(capacity 50/max 500), 초기화 때 50개 미리 생성·반납해 `Instantiate` 부하를 초기 구간으로 이전.
- **콜백 캐싱**: 반납 콜백에 경험치 드롭을 결합하고 `_releaseActions` 딕셔너리에 캐싱해 적 사망마다 람다 재할당 방지.
- **동시 웨이브**: 웨이브마다 `SpawnLoopAsync` 를 `Forget()` 으로 실행해 동시 진행. `_playTime` 은 `Time.deltaTime` 누적이라 `timeScale=0` 이면 함께 정지.
- **스폰 위치**: 플레이어 중심 반경 15 원주 위 무작위 지점(카메라 밖). **안전 정리**: `OnDestroy` 에서 `_cts.Cancel()` + 프리팹 `Release`.

**그래프** — *질문:* 적 한 마리는 풀 안에서 어떤 상태를 오가나? · *종류:* 상태 머신(FSM). *상태·전이:* 풀_생성(createFunc/RegisterMonster) → 대기(Release·비활성) → 활성(Get+Setup) → 추적(거리>사거리) ↔ 공격(거리≤사거리) → 피격(TakeDamage) → [HP 남음→추적 / HP≤0→사망] → 대기(onDeathCallback: 경험치 스폰+Release) → 소멸(actionOnDestroy: RemoveMonster+Destroy).

**표로 낼 사실 — 오브젝트 풀 설정**

| 풀 | 소유자 | capacity | maxSize | 프리웜 | 컨테이너 |
| --- | --- | --- | --- | --- | --- |
| 적 | SpawnManager(프리팹별) | 50 | 500 | 50 | SpawnManager 자신 |
| 자동 투사체 | ProjectileTargetScanner | 20 | 100 | 20 | ProjectileContainer |
| 부메랑 | BoomerangManager | 10 | 10 | 10 | BoomerangContainer |
| 나선 투사체 | SpiralManager | 10 | 20 | 20 | SpiralContainer |
| 경험치 보석 | ExpManager | 50 | 300 | 50 | ExpContainer |

### 기능 ⑦: 경험치 & 레벨업

**무엇을 · 어떻게** — 적이 떨군 보석이 플레이어에게 빨려와 경험치가 되고, 누적치가 임계에 닿으면 레벨업한다.

**핵심 코드 — 레벨업 계산** (`ExpManager.AddExp`)

```csharp
CurrentExp += amount;
Score      += amount;                 // 게임오버 점수로 사용
while (CurrentExp >= RequiredExp)      // 한 번에 큰 경험치면 연속 레벨업
{
    CurrentExp -= RequiredExp;
    CurrentLevel++;
    RequiredExp = baseRequiredExp * CurrentLevel * 1.5f;
    OnLevelUp?.Invoke(CurrentLevel);
}
```

- **어디:** `while` 루프 — **왜:** 한 번에 큰 경험치를 얻으면 연속 레벨업이 가능하며 그만큼 `OnLevelUp` 이 여러 번 발행된다.
- **어디:** `baseRequiredExp * level * 1.5f` — **왜:** 필요 경험치 증가 공식. 초기값은 `baseRequiredExp`(기본 100).

**표로 낼 사실 — 필요 경험치**

| 레벨 | 필요 경험치 |
| --- | --- |
| 1 → 2 | 100 (초기값) |
| 2 → 3 | 100 × 2 × 1.5 = 300 |
| 3 → 4 | 100 × 3 × 1.5 = 450 |
| 4 → 5 | 100 × 4 × 1.5 = 600 |

**곁가지(사실)** — `ExpItem` 은 `SetTarget` 전까지 제자리, 지정되면 `MoveTowards`(속도 15)로 비행하다 거리²<0.25면 수집 콜백. 보석 풀 50/300, 50개 프리웜, 모두 런타임 생성 `ExpContainer` 자식.

### 기능 ⑧: UI 시스템

**무엇을 · 어떻게** — 상태가 변할 때만 UI를 갱신하고, Addressables 핸들을 추적해 네이티브 메모리 누수를 막았다.

- **UIManager**: `[Inject]` 메서드 주입으로 `PlayerController`·`ExpManager` 이벤트 구독, 폴링 없이 HP·경험치·레벨 갱신. 시간 텍스트는 초가 바뀔 때만 `TMP.SetText` 로 갱신(문자열 할당 제거). HP 바는 `LateUpdate` 에서 `WorldToScreenPoint` 로 추종.
- **LevelUpUI**: 레벨업 시 `timeScale=0`, `GetSkillList()` 를 Fisher-Yates 셔플해 3종 제시, 선택 시 `timeScale=1` + `AddOrLevelUpWeaponAsync`.
- **SkillSelectButton**: 스킬 ID→아이콘 매핑이 `switch` 에 하드코딩(4001→106·4002→103·4003→119·4004→117), 아이콘을 Addressable로 로드하며 핸들 보관, 파괴·재초기화 시 `IsValid()` 후 `Release`.
- **LobbyUIButton**: 씬 전환 전 `timeScale==0` 이면 1로 복구 후 `LoadScene` — 게임오버 정지가 다음 씬으로 이어지지 않게.

**그래프** — *질문:* 레벨업 창은 어떤 순서로 뜨고 닫히나? · *종류:* 흐름. *노드/엣지:* `OnLevelUp` → `timeScale=0` → `panel 활성` → `GetSkillList()` + 셔플 → 버튼 수만큼(스킬 있음→Init·활성 / 부족→비활성) → 클릭 `OnSkillSelected` → `panel 닫기`·`timeScale=1` → `AddOrLevelUpWeaponAsync().Forget()`.

**곁가지(사실)** — `UIManager.OnDestroy` 는 `ExpManager` 이벤트는 해제하나 `PlayerController` 의 `OnHpChanged`·`OnDeath` 구독은 해제하지 않는다. 최대 레벨 스킬도 후보에서 제외되지 않으나 선택 시 `maxLevel` 가드로 변화 없이 반환. *(사실 — ②)*

### 기능 ⑨: GC 스파이크 제거 기법

**무엇을 · 어떻게** — 수백 개 오브젝트가 동시에 존재하는 환경에서 프레임당 힙 할당을 없애려 코드 전반에 적용한 기법들이다. (항목 카드로 낼 사실)

- **오브젝트 풀 + 프리웜** — 런타임 중 `Instantiate`/`Destroy` 제거
- **풀 반납 콜백 캐싱** — 사망 시 콜백을 딕셔너리에 캐싱해 클로저 힙 할당 방지
- **버퍼 재사용 물리 쿼리** — `ContactFilter2D` + 사전 할당 배열 재활용, 거리 비교는 `sqrMagnitude`
- **TMP 배열 재활용** — `SetText` 로 char 단위 배열 재활용
- **UniTask로 코루틴 대체** — 열거자 객체 힙 할당 제거
- **구조체 이벤트** — `InGameEvent` 를 `struct` 로 설계
- **MaterialPropertyBlock** — 피격 플래시 시 공유 material 인스턴싱 방지

> **최적화 측정 결과(GC Alloc·코루틴·Destroy·Materials Before/After 수치) → 양식 ②.** 소스가 아닌 Profiler 측정이므로 여기 넣지 않는다.

### 기능 ⑩: 빌드 자동화 (GitHub Actions CI)

**무엇을 · 어떻게** — `main` 병합 시 GitHub 서버가 자동으로 Android 빌드를 수행하도록 환경을 통일·자동화. (항목 카드)

- **자동 트리거** — `main` 병합 시 클라우드에서 Android 빌드(`.github/workflows`)
- **환경 통일** — 로컬 PC 점유·환경 편차로 인한 빌드 차이 제거
- **Secrets 암호화** — 라이선스·계정을 하드코딩 대신 GitHub Secrets 로

## A4. 부록 — 그 밖의 사실

**Addressables 키**

| 키 | 타입 | 사용처 |
| --- | --- | --- |
| `GameData` | GameDataContainer | DataManager.InitializeAsync |
| `WaveData.prefabAddress` | GameObject | SpawnManager.InitAsync (인스펙터 지정) |
| `SkillData.prefabKey` | GameObject | SkillManager.AddOrLevelUpWeaponAsync (TSV 지정) |
| `Tilemap[tilemap_106/103/119/117]` | Sprite | 스킬 4001/4002/4003/4004 아이콘 |

**데이터엔 정의됐으나 런타임 미참조** *(사실만 — 정리·활용 판단은 ②)*

| 항목 | 정의 위치 | 상태 |
| --- | --- | --- |
| `StatLevelUp` 전체(5001~) | Data_Enum&Class.cs · TSV | 임포트되나 딕셔너리·조회 API 없음 |
| `JobType.Mage` · Mage 스킬(4005~) | Data_Enum&Class.cs · TSV | GetSkillList()가 Warrior만 필터, 진입 경로 없음 |
| `EnemyStat.attackType` | Data_Enum&Class.cs | EnemyController가 분기에 미사용 |
| `PlayerStat.baseAtk` · `baseCooldown` | Data_Enum&Class.cs | PlayerController.Initialize가 미참조 |
| `CombatSystem.Max_Event_Count` · `_dataManager` · `EventCallback` | CombatSystem.cs | 선언/주입만, 사용처·구독자 없음 |

---

# 다른 양식으로 넘길 것 (PART A 에는 쓰지 않는다)

- **→ 양식 ②(사람 작성):** 개요 why · evidence(프로파일러 측정치) · **고민과 선택 최소 1건**(예: 직접 호출 vs 이벤트 큐 / `OnTriggerEnter2D` vs `Raycast·OverlapCircle`) · **retrospective 의 learnings(깨달음) · improvements(개선)**(위 "미사용 데이터"·중복 상수 `0.5f`·미해제 구독 등이 개선 후보) · 트러블슈팅(텍스처 압축, 네이티브 메모리 누수).
- **→ 양식 ③(자산):** team · vcs · ide · 링크(유튜브·깃허브) · hero 스크린샷(`gameplay.png`)과 본문 이미지(`profiler-compare.png`) + 각 **caption**.

---

# PART B — 파이프라인 AI 조립 안내 (이 repo 에서 실행)

> 이 문서(PART A) + 양식 ② + ③ 을 **스키마 블록**으로 매핑해 `src/content/docs/vampire-like.yaml` 로 조립한다. **조립 대상은 기존 `vampire-like.yaml`(갱신)** 이다. 스키마: `src/content.config.ts`.

**블록 매핑 (PART A 서술 → YAML `type`)**

- A1 기술 스택 → **개요의 `overview.stack`** {title, rows[분류·기술·목적]}(본문 블록 아님, purpose 필수) · A2 계층 구성+세 줄 → `layers`(강조 `CombatSystem`) · A2 핵심 클래스 관계 → `mermaid`(`classDiagram`, 제네릭 `~T~`)
- A3 핵심 코드 → `code`(api · code · **notes** 필수) · 그래프 서술 → `mermaid`(FSM=`stateDiagram-v2`, 흐름=`flowchart`) 각 `question` 캡션
- 표로 낼 사실 → `table`(행 칸 수=헤더 수) · 단계 흐름 → `chips` · 항목 카드 → `points`(2개+) · 곁가지 → `callout` · 조회 API → `api-list`(returns 필수)
- 스크린샷 → 최상위 `screenshot`(hero) · 본문 `image` — src·caption 은 ③ 에서

**게이트 상기** — 개요 evidence·scope 필수 / decisions 최소 1건·각 1개 채택·기준 값 수=선택지 수 / retrospective learnings·improvements 필수 / code notes·overview.stack purpose·api-list returns·image caption·table 칸 수 일치.
