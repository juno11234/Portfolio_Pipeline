# 기술문서 ① — 구현 · PART A (MouseAndCheese — URP 커스텀 셰이더)
> 프로젝트 AI 가 대상 repo(`MouseAndCheeseGame`)의 코드 · git 에서 뽑은 사실. `« »` = 사람이 채우거나 확인할 자리.
> **주요 내용 = HLSL · ShaderLab 셰이더**(`Assets/03_Shaders/**`)와 그것을 구동하는 URP 설정 · C#. 게임플레이 시스템은 맨 뒤 부록에 요약만 둔다.
> 근거 파일: `Assets/03_Shaders/*.shader · *.hlsl · *.mat`, `Assets/Settings/PC_Renderer.asset · PC_RPAsset.asset`, `Assets/02_Scripts/SpeedEffect/**`,
> 작업 문서 `Assets/Ignore/Task/Plan/26_0912_툰쉐이더_plan.md`, `Assets/Ignore/26_0912_URP_그림자_아티팩트_디버깅_정리.md`, git log.

---

## A0. 메타
- **slug**: «projects.yaml 의 키 — 확인 필요. 제안: `mouse-and-cheese`»
- **subtitle**: MouseAndCheese
- **title(문서 제목)**: «제안: URP 커스텀 툰 셰이더 · 화면공간 포스트프로세스»
- **period**: 2026.08.14 ~ 2026.09.24 (프로젝트 전체, 커밋 29개). 셰이더 작업은 2026.09.12(툰 셰이더 · 외곽선 · 그림자 수정) ~ 09.22(라디얼 블러 · 머티리얼 수치 조절 · 학습용 주석).
- **engine**: Unity 6000.3.19f1 · URP 17.3.0 (PC_Renderer: Forward+)

---

## A1. 개요
- **lead**: 쥐가 부엌을 달리며 고양이에게서 도망치는 3D 러너 *MouseAndCheese* 의 룩을, Shader Graph 없이 **HLSL 로 직접 작성한 URP 셰이더 3종**으로 만들었다.
  오브젝트 단위의 셀 셰이딩 + 림라이트(`Custom/ToonLit`), 씬 전체에 한 번 적용되는 화면공간 외곽선(`Custom/ToonOutlineFullScreen`),
  이동 속도에 반응하는 화면 외곽 라디얼 블러(`Custom/SpeedRadialBlur`). 뒤의 둘은 C# 렌더 패스를 쓰지 않고 URP 내장 `FullScreenPassRendererFeature` 에 머티리얼만 꽂아 돌린다.
- **what**: 이 문서는 다음을 다룬다 —
  ① `ToonLit` 의 파일 구조(얇은 `.shader` + Pass 별 `.hlsl`)와 4개 Pass
  ② ForwardLit Pass 의 셀 셰이딩(2단 밴딩) · 그림자 감쇠 · 림라이트
  ③ 보조 Pass 3종(ShadowCaster · DepthOnly · DepthNormals)과 SRP Batcher 호환
  ④ Depth + Normal 기반 Roberts Cross 화면공간 외곽선
  ⑤ 속도 연출 라디얼 블러 셰이더와 이를 구동하는 C#(FOV 연동)
  ⑥ 툰 셰이더 적용 후 드러난 그림자 아티팩트와 URP 그림자 설정
- **scope**: 셰이더 코드 · 이를 연결하는 URP 렌더러 설정 · 셰이더 파라미터를 움직이는 C# 까지 다룬다.
  Shader Graph 는 쓰지 않았다. **메인 라이트(Directional) 1개만** 지원하며 Additional Light(포인트 · 스팟) · 스펙큘러는 범위 밖이다. **PC_Renderer 만 대상**이고 Mobile_Renderer 는 다루지 않는다.
  3D 모델링 · 애니메이션(Blender) · 사운드는 범위가 아니다. 게임플레이 시스템(고양이 AI · 스폰 등)은 부록 요약으로만 둔다.
- **기술 스택**

| 분류 | 기술 | 사용 목적 |
|---|---|---|
| 엔진 · 렌더링 | Unity 6000.3.19f1 · URP 17.3.0 (Forward+) | 커스텀 HLSL 셰이더를 URP 라이팅 · 그림자 · 렌더러 피처 체계에 맞춰 작성 |
| 셰이더 언어 | HLSL + ShaderLab | Shader Graph 없이 라이팅 계산을 직접 제어(밴딩 임계값 · 림 · 그림자 감쇠 결합) |
| URP 셰이더 라이브러리 | `Core.hlsl` · `Lighting.hlsl` · `Blit.hlsl` · `DeclareDepthTexture.hlsl` · `DeclareNormalsTexture.hlsl` | 좌표 변환 · `GetMainLight` · 그림자 좌표 · 풀스크린 Blit 정점 · 깊이/노멀 샘플링을 표준 함수로 재사용 (URP Lit 원본 include · `UsePass` 는 쓰지 않음) |
| 풀스크린 패스 | URP 내장 `FullScreenPassRendererFeature` ×2 | 외곽선 · 라디얼 블러를 **C# ScriptableRenderPass 작성 없이** 머티리얼만으로 화면 전체에 적용 |
| 렌더러 피처 | Screen Space Ambient Occlusion | 기존 SSAO 유지 — 이 때문에 커스텀 셰이더에도 DepthNormals Pass 가 필요 |
| 셰이더 구동 C# | `SpeedEffectController` + `SpeedEffectData`(ScriptableObject) | 이동 속도에 따라 블러 강도(`_BlurIntensity`) · 카메라 FOV 를 SmoothDamp 로 조절 |
| 그림자 설정 | URP Asset(Shadow Distance 150 · Cascade 4 · Split 0.4/0.6/0.8 · 2048) + Mixed Light · Shadowmask | 러너 카메라 이동 중 그림자 깜빡임 · 계단 아티팩트 제거 |
| 검증 도구 | Unity CLI(`unity command eval`) | 그림자 원인 추적 시 렌더러 그룹별 `shadowCastingMode` on/off + 스크린샷 비교를 스크립트로 반복 |
| (게임 전반) | Input System · AI Navigation(NavMesh) · CharacterController · `ObjectPool<T>` · uGUI/TMP · GitHub Actions(game-ci) | 게임플레이 · 빌드 — 부록 참고 |

---

## A2. 시스템 구조

- **intro**: 셰이더는 **두 층**으로 나뉜다. (1) 오브젝트마다 머티리얼로 붙는 `ToonLit` 이 색 · 그림자 · 깊이 · 노멀 버퍼를 채우고,
  (2) 불투명 렌더링이 끝난 뒤 `FullScreenPassRendererFeature` 두 개가 그 버퍼를 읽어 화면 전체에 외곽선과 블러를 한 번씩 입힌다.
  (1)의 DepthNormals Pass 가 (2) 외곽선과 SSAO 의 **공통 데이터 소스**라는 점이 두 층을 잇는다.

- **계층 구성 (위→아래)**
  1. **C# 구동 계층** — `SpeedEffectController`(블러 강도 · FOV), `SpeedEffectData`(수치). 배고픔 → 속도 계산은 `HungerController` · `PlayerStatData`.
  2. **렌더러 설정 계층** — `PC_Renderer.asset`: FullScreenPass(블러, Requirements 없음) · FullScreenPass(외곽선, Requirements = Depth + Normal) · SSAO. `PC_RPAsset.asset`: 그림자 설정.
  3. **화면공간 셰이더 계층** — `Custom/ToonOutlineFullScreen`(`ToonOutline_Mat`), `Custom/SpeedRadialBlur`(`SpeedRadialBlur_Mat`)
  4. **오브젝트 셰이더 계층** — `Custom/ToonLit` = `ToonLit.shader`(진입점 · Properties · Pass 선언)
  5. **HLSL 로직 계층** — `ToonLitInput.hlsl`(공용 CBUFFER · 구조체) ← `ToonLitForwardPass.hlsl` · `ToonShadowCasterPass.hlsl` · `ToonDepthOnlyPass.hlsl` · `ToonDepthNormalsPass.hlsl`
  6. **머티리얼 계층** — 캐릭터 2(`Rat_Mat` · `Cat_Mat`) + 부엌 환경 5(`Oven` · `Sink` · `Table&Chair` · `Wall` · `refrigerator`) = 7개가 `Custom/ToonLit` 하나를 공유

- **구성요소**: `.shader` 3개, `.hlsl` 5개, 머티리얼(툰 7 + 풀스크린 2), URP 렌더러/파이프라인 에셋, C# 2개.
- **관계**:
  - `ToonLit.shader` 의 각 Pass 는 `ToonLitInput.hlsl` + 자기 Pass 의 `.hlsl` **하나만** include 한다(HLSLINCLUDE 로 몰아넣지 않음).
  - ForwardLit 는 ShadowCaster 가 만든 그림자맵을 `GetMainLight(shadowCoord).shadowAttenuation` 으로 읽는다.
  - DepthOnly/DepthNormals 가 `_CameraDepthTexture` · `_CameraNormalsTexture` 를 만들고 → SSAO 와 `ToonOutlineFullScreen` 이 읽는다.
  - `FullScreenPassRendererFeature` 가 `_BlitTexture`(현재 화면 색)를 두 풀스크린 셰이더에 공급한다.
  - `SpeedEffectController` 가 `SpeedRadialBlur_Mat` 의 `_BlurIntensity` 를 매 프레임 쓴다.
- **흐름**: 메인 라이트 · 카메라 → 오브젝트별 `ToonLit`(ShadowCaster → 그림자맵, DepthOnly/DepthNormals → 깊이 · 노멀 버퍼, ForwardLit → 셀 셰이딩된 색)
  → SSAO → AfterRenderingPostProcessing 시점에 FullScreenPass(라디얼 블러) → FullScreenPass(외곽선) → 화면.

- **핵심 클래스 · 타입 관계**
  - `ToonLitInput.hlsl` 이 정의: `CBUFFER UnityPerMaterial`(8개 프로퍼티), `TEXTURE2D(_BaseMap)`, `struct Attributes {positionOS, normalOS, uv}`, `struct Varyings {positionHCS, uv, normalWS, positionWS, shadowCoord}`.
  - 4개 Pass 가 모두 같은 `Attributes` 를 입력으로 받고, 출력 구조체는 Pass 마다 **필요한 것만** 따로 둔다: `Varyings`(ForwardLit), `ShadowVaryings`/`DepthOnlyVaryings`(`positionHCS` 하나), `DepthNormalsVaryings`(`positionHCS` + `normalWS`).
  - 풀스크린 셰이더 2개는 `ToonLitInput.hlsl` 을 공유하지 않고, URP 코어 `Blit.hlsl` 의 `Vert()` · `Varyings{positionCS, texcoord}` · `_BlitTexture` 를 재사용한다.
  - C#: `SpeedEffectController` —reads→ `HungerController.CurrentMoveSpeed`, `PlayerStatData.EvaluateMoveSpeed`, `SpeedEffectData`; —writes→ `Material(_BlurIntensity)`, `Camera.fieldOfView`.

---

## A3. 핵심 기능

### 기능 ①: `ToonLit` 파일 구조 — 얇은 `.shader` + Pass 별 `.hlsl`
- **무엇을 · 어떻게**
  - *구조*: URP `Lit.shader` 가 따르는 표준 패턴대로 `.shader` 는 Properties · Tags · Pass 선언 · `#pragma` · `#include` 만 들고, 계산은 전부 `.hlsl` 에 있다. → 7개 머티리얼이 셰이더 하나를 공유하면서, 이후 특정 Pass 로직 파일만 교체 · 재사용하기 쉽게(계획 문서 9-1).
  - *Pass 4개*: `ForwardLit`(LightMode `UniversalForward`) · `ShadowCaster` · `DepthOnly`(ColorMask 0) · `DepthNormals`. 각 Pass 가 필요한 `.hlsl` 만 include → 불필요한 컴파일 의존성 감소(계획 5절).
  - *URP Lit 원본 include · `UsePass` 미사용*: URP 버전마다 내부 구조체/매크로 이름이 바뀌고 SRP Batcher 호환 이슈가 있어, 최소 HLSL 을 직접 쓰고 `Core.hlsl` · `Lighting.hlsl` 의 공개 함수만 재사용(계획 5절).
  - *그림자 키워드 변형*: `multi_compile _ _MAIN_LIGHT_SHADOWS` / `_CASCADE` / `_SCREEN`, `multi_compile_fragment _ _SHADOWS_SOFT`. → URP 그림자 설정에 맞는 변형만 쓰이고, 소프트 섀도는 프래그먼트 단계에서만 분기.
  - *이름 재사용*: 텍스처 프로퍼티를 URP Lit 과 같은 `_BaseMap` 으로 → 기존 머티리얼의 셰이더를 교체해도 텍스처 연결이 유지되도록. `_BaseMap` 기본값 `"white"` → 텍스처 없는 `Wall_Mat` 은 `_BaseColor` 만으로 색 결정.
  - *외곽선 프로퍼티 없음*: 외곽선은 머티리얼이 아니라 화면공간 포스트프로세스로 분리(기능 ④).
- **핵심 코드**
```hlsl
// ToonLit.shader — ForwardLit Pass
Pass
{
    Name "ForwardLit"
    Tags { "LightMode" = "UniversalForward" }
    Cull Back

    HLSLPROGRAM
    #pragma vertex ToonVertex
    #pragma fragment ToonFragment

    #pragma multi_compile _ _MAIN_LIGHT_SHADOWS // 메인 라이트가 그림자를 드리우는지
    #pragma multi_compile _ _MAIN_LIGHT_SHADOWS_CASCADE // 카메라 거리에 따라 그림자 해상도 사용여부
    #pragma multi_compile _ _MAIN_LIGHT_SHADOWS_SCREEN // 그림자를 화면공간에서 한번 더 처리
    #pragma multi_compile_fragment _ _SHADOWS_SOFT // 그림자 경계를 부드럽게할지, fragment를 붙여 픽셀 단계에서만

    #include "ToonLitInput.hlsl"
    #include "ToonLitForwardPass.hlsl"
    ENDHLSL
}
```
  - 어디가 · 왜: 주석 "쓰지 않는 그림자 연산비용 아낌, URP 에서 그림자 관련설정에 맞춰 사용". include 두 줄이 "공용 입력 + 이 Pass 로직"이라는 구조 그 자체.
- **그래프**: 클래스/타입 계층(classDiagram) — *질문: 셰이더 파일들은 무엇을 공유하고 무엇을 따로 갖나?*
  - 노드: `ToonLit.shader` · `ToonLitInput.hlsl`(CBUFFER · Attributes · Varyings) · `ToonLitForwardPass.hlsl` · `ToonShadowCasterPass.hlsl` · `ToonDepthOnlyPass.hlsl` · `ToonDepthNormalsPass.hlsl`
  - 엣지: `ToonLit.shader` —Pass 별 include→ 각 `*Pass.hlsl`; 모든 `*Pass.hlsl` —uses→ `ToonLitInput.hlsl` 의 `Attributes`; ForwardPass —outputs→ `Varyings`, 나머지 —outputs→ 각자 최소 구조체
- **표로 낼 사실**: Pass 4개 표 — Pass 이름 · LightMode · 담당 `.hlsl` · 출력 · 누가 소비하나
  | ForwardLit | UniversalForward | ToonLitForwardPass | 셀 셰이딩 색 | 카메라 컬러 |
  | ShadowCaster | ShadowCaster | ToonShadowCasterPass | 그림자맵 깊이 | 다른 오브젝트의 shadowAttenuation |
  | DepthOnly | DepthOnly | ToonDepthOnlyPass | 깊이 | `_CameraDepthTexture` |
  | DepthNormals | DepthNormals | ToonDepthNormalsPass | 월드 노멀 | SSAO · 외곽선 |

### 기능 ②: ForwardLit — 2단 셀 셰이딩 + 그림자 감쇠 + 림라이트
- **무엇을 · 어떻게**
  - *그림자를 밴딩 안으로*: 램버트 `NdotL` 에 `shadowAttenuation` 을 **곱한 뒤** 양자화 → 그림자맵 그림자도 같은 2단 경계를 따른다(따로 합성하지 않음).
  - *2단 밴딩*: `smoothstep(threshold ± smoothness)` 로 0/1 두 단계. 계단 함수가 아니라 폭 `_ShadowSmoothness` 만큼 부드러운 경계 → 경계 계단현상 완화. 3단 이상은 저해상도 캐릭터 텍스처와 충돌해 제외, 확장 시 `smoothstep` 하나 추가(계획 6절 · 9-5).
  - *그림자 색 보간*: 어둡게 곱하는 대신 `_ShadowColor`(기본 푸른 회색 0.6/0.6/0.7) ↔ 라이트 색을 `lerp` → 그림자가 "검정"이 아니라 색을 가진 카툰 톤.
  - *림라이트*: `1 - saturate(dot(view, normal))` 을 같은 방식으로 양자화하고 **`lightBand` 를 곱해 그림자 쪽엔 림이 안 뜨게**. → 러너 특성상 캐릭터가 부엌 가구와 겹칠 때 실루엣 가독성(계획 6절).
  - *그림자 좌표는 정점에서*: `TransformWorldToShadowCoord` 를 버텍스 셰이더에서 계산(주석: "정점 단계에서 계산하는게 비용이 저렴").
  - *정규화 두 번*: 보간된 `normalWS` 를 프래그먼트에서 다시 `normalize`.
  - 미채택: 스펙큘러(평면적인 셀 컬러가 스타일에 부합), Additional Lights(씬에 Directional 하나).
- **핵심 코드**
```hlsl
// ToonLitForwardPass.hlsl — ToonFragment
Light mainLight = GetMainLight(input.shadowCoord);

half NdotL = dot(normalWS, mainLight.direction); // 램버트 반사 기본 항
half litMask = NdotL * mainLight.shadowAttenuation; // 그림자에 가려지지 않은 정도를 곱해 해당 픽셀이 얼마나 밝은지

// 툰 셰이더는 smoothstep으로 임계값(ShadowThreshold) 기준 0, 1 두단계로 나눔
half lightBand = smoothstep(_ShadowThreshold - _ShadowSmoothness, _ShadowThreshold + _ShadowSmoothness, litMask);

half3 shading = lerp(_ShadowColor.rgb, mainLight.color, lightBand);
half3 albedo = baseColor.rgb * shading; // 셀 셰이딩 적용

float3 viewDirWS = normalize(GetCameraPositionWS() - input.positionWS);
half rim = 1.0 - saturate(dot(viewDirWS, normalWS));
// lightBand를 곱해 이미 그림자져있는 부분 반영
half rimBand = smoothstep(_RimThreshold - _RimSmoothness, _RimThreshold + _RimSmoothness, rim) * lightBand;

half3 finalColor = albedo + _RimColor.rgb * rimBand;
```
  - 어디가 · 왜: `litMask` 한 줄이 "그림자맵 그림자도 셀 경계를 따른다"를 만든다. `* lightBand` 가 "그림자 영역에는 림을 가산하지 않는다".
- **그래프**: 흐름(flowchart) — *질문: 한 픽셀의 최종 색은 어떤 단계를 거쳐 나오나?*
  - `_BaseMap × _BaseColor` → baseColor
  - `normalWS · lightDir` → NdotL → × shadowAttenuation → litMask → smoothstep(Shadow) → lightBand → lerp(ShadowColor, lightColor) → × baseColor → albedo
  - `viewDir · normalWS` → 1 − x → rim → smoothstep(Rim) → × lightBand → rimBand → × RimColor
  - albedo + rim → finalColor (alpha = baseColor.a)
- **표로 낼 사실**: 머티리얼 프로퍼티 표(이름 · 범위 · 기본값) — `_ShadowColor` (0.6,0.6,0.7) · `_ShadowThreshold` 0~1, 0.5 · `_ShadowSmoothness` 0.001~0.3, 0.05 · `_RimColor` 흰색 · `_RimThreshold` 0~1, 0.7 · `_RimSmoothness` 0.001~0.3, 0.1. (7개 머티리얼의 실제 값은 «에셋에서 확인 필요» — 커밋 "Mat 수치 조절" 09.22)

### 기능 ③: 보조 Pass 3종 + SRP Batcher 호환
- **무엇을 · 어떻게**
  - *ShadowCaster*: `ApplyShadowBias(positionWS, normalWS, 메인라이트 방향)` 로 정점을 밀어낸 뒤 클립 변환 → 그림자 여드름 · 피터패닝 완화에 URP 표준 바이어스 사용. 출력은 `positionHCS` 하나, 프래그먼트는 `return 0`.
  - *DepthOnly*: 클립 위치만 쓰는 최소 구조체, ColorMask 0.
  - *DepthNormals*: 월드 노멀을 **정점에서 한 번, 픽셀에서 한 번 더** 정규화해 그대로 기록. `PC_Renderer` 가 Accurate G-Buffer Normals(Octahedral 인코딩)를 쓰지 않으므로(`m_AccurateGbufferNormals: 0`) 인코딩 없이 기록. 원래 SSAO 호환용이었으나 외곽선(기능 ④)의 입력이 되면서 "셀 셰이딩 + 외곽선의 공통 데이터 소스"로 역할이 커졌다(계획 9-4).
  - *SRP Batcher*: 모든 머티리얼 프로퍼티를 `CBUFFER_START(UnityPerMaterial)` 안에, Properties 순서대로 선언. → 7개 머티리얼이 같은 셰이더를 공유하므로 배칭이 깨지지 않게(계획 9-6). 텍스처 · 샘플러는 CBUFFER 밖.
  - *include 가드*: 모든 `.hlsl` 에 `#ifndef ..._INCLUDED`.
- **핵심 코드**
```hlsl
// ToonShadowCasterPass.hlsl
// 그림자맵 접선 방향 왜곡(피터패닝)을 줄이기 위해 URP 표준 바이어스 함수를 사용한다
float3 biasedPositionWS = ApplyShadowBias(positionInputs.positionWS, normalInputs.normalWS,
                                          GetMainLight().direction);
output.positionHCS = TransformWorldToHClip(biasedPositionWS);

// ToonDepthNormalsPass.hlsl
// PC_Renderer.asset은 Accurate G-Buffer Normals(Octahedral 인코딩)를 사용하지 않으므로
// (m_AccurateGbufferNormals: 0) 월드공간 노멀을 그대로 기록한다
float3 normalWS = NormalizeNormalPerPixel(input.normalWS); // 보간 왜곡 때문에 한번더 정규화
return half4(normalWS, 0.0);

// ToonLitInput.hlsl
// SRP Batcher 호환을 위해 머티리얼별 프로퍼티는 반드시 이 CBUFFER 안에 선언한다
CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST;
    half4 _BaseColor;
    half4 _ShadowColor;
    half _ShadowThreshold;
    half _ShadowSmoothness;
    half4 _RimColor;
    half _RimThreshold;
    half _RimSmoothness;
CBUFFER_END
```
- **callout 후보**: 「DepthNormals Pass 가 없으면 이 셰이더를 쓴 오브젝트는 SSAO 에서 빠지고 **외곽선도 그려지지 않는다**」 — 새 오브젝트가 자동으로 외곽선 대상이 되는 조건 = `Custom/ToonLit` 계열 셰이더 사용.

### 기능 ④: 화면공간 외곽선 — Depth + Normal Roberts Cross
- **무엇을 · 어떻게**
  - *방식*: 오브젝트별 Inverted Hull(머티리얼마다 Outline Pass) 대신 **화면 전체에 한 번** 도는 포스트프로세스. `PC_Renderer` 의 `FullScreenPassRendererFeature`(Requirements = Depth + Normal, Injection = AfterRenderingPostProcessing, Fetch Color Buffer)에 `ToonOutline_Mat` 을 연결. C# 렌더 패스 코드는 없다. → **이후 추가되는 오브젝트도 별도 설정 없이 외곽선 대상**(작업 당시 "오브젝트 계속 추가 예정" 요구로 Inverted Hull 에서 방향 변경, 계획 6절 · 9-2).
  - *Roberts Cross*: 대각선 2쌍(TL–BR, TR–BL)만 1텍셀 간격으로 샘플 → 깊이 차 합(`abs`) · 노멀 차 합(`length`).
  - *두 기준 OR*: `saturate(step(깊이) + step(노멀))`. 주석 근거 — 깊이만으로는 같은 평면 위 경계를 못 잡고, 노멀만으로는 평행한 면이 겹친 경우를 못 잡음.
  - *합성*: `lerp(sceneColor, _OutlineColor, edge)`.
  - *include 순서*: `Core.hlsl` 를 **먼저**, `Blit.hlsl` 을 나중에. 계획 문서의 초안 코드는 `Blit.hlsl` → `Core.hlsl` 순서였고, 실제 코드는 뒤집혀 있으며 주석 "Core.hlsl을 먼저 include해 XR 관련 텍스처 매크로(TEXTURE2D_X 등)를 정의한 뒤 Blit.hlsl을 include해야 한다". «이 순서 때문에 컴파일 오류를 겪었는지 확인 필요»
  - *알려진 한계*: raw(비선형) 깊이를 그대로 빼므로 거리에 따라 `_DepthThreshold` 민감도가 달라진다(계획 7-4 주의). 그림자 디버깅 중 `LinearEyeDepth` 로 바꾸는 시도 2가지(절대/비례)를 했으나 화면 곳곳이 검게 나오는 회귀로 **롤백**, 원본 유지(디버깅 문서 2절).
- **핵심 코드**
```hlsl
// ToonOutlineFullScreen.shader
float2 texel = _BlitTexture_TexelSize.xy;

// Roberts Cross: 대각선 방향 2쌍의 샘플을 비교해 깊이/노멀이 급격히 변하는 지점(=윤곽선)을 찾는다
float depthTL = SampleSceneDepth(uv + texel * float2(-1, -1));
float depthBR = SampleSceneDepth(uv + texel * float2( 1,  1));
float depthTR = SampleSceneDepth(uv + texel * float2( 1, -1));
float depthBL = SampleSceneDepth(uv + texel * float2(-1,  1));
float depthEdge = abs(depthTL - depthBR) + abs(depthTR - depthBL);

float3 normalTL = SampleSceneNormals(uv + texel * float2(-1, -1));
float3 normalBR = SampleSceneNormals(uv + texel * float2( 1,  1));
float3 normalTR = SampleSceneNormals(uv + texel * float2( 1, -1));
float3 normalBL = SampleSceneNormals(uv + texel * float2(-1,  1));
float normalEdge = length(normalTL - normalBR) + length(normalTR - normalBL);

// 깊이만으로는 같은 평면 위의 그림 경계를 못 잡고,
// 노멀만으로는 평행한 면이 겹쳐진 경우를 못 잡기 때문에 두 기준을 함께 사용한다
half edge = saturate(step(_DepthThreshold, depthEdge) + step(_NormalThreshold, normalEdge));

return lerp(sceneColor, _OutlineColor, edge);
```
- **그래프**: 흐름(flowchart) — *질문: 외곽선 한 픽셀은 어떤 입력으로 판정되나?*
  - `ToonLit` DepthOnly → `_CameraDepthTexture` → 대각 4샘플 → depthEdge → step(DepthThreshold)
  - `ToonLit` DepthNormals → `_CameraNormalsTexture` → 대각 4샘플 → normalEdge → step(NormalThreshold)
  - 두 step → OR(saturate 합) → edge → lerp(`_BlitTexture` 색, OutlineColor) → 화면
- **표로 낼 사실**: 프로퍼티 — `_OutlineColor` 검정 · `_DepthThreshold` 0.0001~0.1, 기본 0.01 · `_NormalThreshold` 0~1, 기본 0.4 (실제 `ToonOutline_Mat` 값 «확인 필요»).
  비교 카드(points): Inverted Hull vs 화면공간 — 적용 단위(머티리얼별 / 씬 1회), 새 오브젝트(Pass 추가 필요 / 자동), 약점(메시 노멀 의존 / 깊이 스케일 민감).

### 기능 ⑤: 속도 연출 — 화면 외곽 라디얼 블러 셰이더 + C# 구동
- **무엇을 · 어떻게**
  - *셰이더*: 화면 중심에서의 거리로 `smoothstep(_InnerRadius 0.35, _OuterRadius 0.75)` 마스크를 만들어 **중심부는 선명, 외곽만 블러**. 샘플 지점을 중심 쪽으로 `direction * t` 만큼 당기며 8번 샘플해 평균 → 방사형 블러.
  - *샘플 수는 컴파일 타임 상수*: `#define SAMPLE_COUNT 8` → 런타임 프로퍼티로 노출하지 않아 셰이더를 단순하게, 고정 루프라 언롤 가능(주석).
  - *파이프라인*: 외곽선과 같은 `FullScreenPassRendererFeature`(Requirements 없음 — 색 버퍼만 필요). 렌더러 피처 목록에서 **블러가 외곽선보다 앞**, 둘 다 AfterRenderingPostProcessing → 블러된 화면 위에 외곽선이 그려진다. «의도한 순서인지 확인 필요»
  - *C# 구동*: `SpeedEffectController.LateUpdate` 가 현재 이동 속도 ≥ 임계 속도이면 목표 블러 0.3 · FOV 75, 아니면 0 · 60 으로 `SmoothDamp`(0.5초) 후 `material.SetFloat(Shader.PropertyToID("_BlurIntensity"))`. 임계값은 기획상 "배고픔 비율 0.75"인데 `EvaluateMoveSpeed` 로 **속도 단위로 환산해 비교**. 같은 커밋에서 배고픔→속도 곡선을 0.75 지점에서 꺾이도록 조정(완만 → 이후 급격).
  - *수치 관리*: `SpeedEffectData` 는 구글 시트 데이터 테이블 임포트 대상에서 **의도적으로 제외** — 블러 · FOV 수치는 실제 화면을 보면서 적용해야 하므로 에디터 인스펙터에서 직접 조정한다.
- **핵심 코드**
```hlsl
// SpeedRadialBlur.shader
float distanceFromCenter = length(uv - center);
// InnerRadius 안쪽은 완전히 선명, OuterRadius 바깥에서만 블러가 최대 강도(외곽부만 블러 처리)
float radiusMask = smoothstep(_InnerRadius, _OuterRadius, distanceFromCenter);

// 강도와 마스크만큼 샘플 지점을 중심 쪽으로 당겨 방사형 블러. 마스크가 0인 중심부는 원본 uv와 같아져 블러가 사라진다
float2 direction = (uv - center) * _BlurIntensity * radiusMask;

for (int i = 0; i < SAMPLE_COUNT; i++)
{
    float t = (float)i / (SAMPLE_COUNT - 1);
    accumulatedColor += SAMPLE_TEXTURE2D_X_LOD(_BlitTexture, sampler_LinearClamp, uv - direction * t, 0);
}
return accumulatedColor / SAMPLE_COUNT;
```
```csharp
// SpeedEffectController.cs
private bool IsSpeedBoosted()
{
    float thresholdSpeed = _playerStatData.EvaluateMoveSpeed(_speedEffectData.HungerRatioThreshold);
    return _hungerController.CurrentMoveSpeed >= thresholdSpeed;
}
// LateUpdate: SmoothDamp 후
_radialBlurMaterial.SetFloat(BlurIntensityId, _currentBlurIntensity);
```
  - 어디가 · 왜: `radiusMask` 를 `direction` 에 곱하는 것 하나로 "중심 선명 / 외곽 블러"가 된다(별도 분기 없음). C# 쪽 `LateUpdate` 는 주석상 카메라 추종(CameraController.LateUpdate)과 같은 타이밍에 그 프레임 최종 상태 반영.
- **그래프**: 흐름(flowchart) — *질문: 배고픔 수치가 어떻게 화면 블러가 되나?*
  - 배고픔 비율 → `EvaluateMoveSpeed`(곡선) → CurrentMoveSpeed → [≥ 임계 속도?] → 목표 블러/FOV → SmoothDamp → `_BlurIntensity` · `fieldOfView` → SpeedRadialBlur 셰이더(마스크 × 강도 → 8샘플)
- **표로 낼 사실**: 셰이더 프로퍼티(`_BlurIntensity` 0~1 · `_InnerRadius` 0.35 · `_OuterRadius` 0.75 · SAMPLE_COUNT 8), `SpeedEffectData`(임계 0.75 · FOV 60/75 · FOV smooth 0.5 · 블러 최대 0.3 · 블러 smooth 0.5).

### 기능 ⑥: 툰 셰이더 적용 후 그림자 아티팩트 — URP 그림자 설정
> 셰이더 코드가 아니라 **설정 · 진단**이다. 사실만 적는다 — 판단 · 교훈 서술은 양식 ②(고민과 선택 · 회고)의 재료.
- **무엇을 · 어떻게** (근거: `26_0912_URP_그림자_아티팩트_디버깅_정리.md`, 커밋 a1edc44)
  - *1차 증상* (카메라 이동 시 그림자 깜빡임): 외곽선 피처를 끄면 사라져 용의자로 지목 → 외곽선 깊이 비교를 `LinearEyeDepth` 로 바꾸는 시도 2회 → 더 큰 회귀로 롤백. **실제 원인은 Shadow Distance** — 러너 카메라가 전진하며 그림자 거리 경계 밖 오브젝트가 들어와 깜빡임. Shadow Max Distance 상향으로 해결.
  - *2차 증상* (카메라 거리에 따라 벽에 계단 모양 그림자): 라이트맵 베이크(Kitchen 전체 Static, Mixed · Shadowmask, 라이트맵 7장, 약 84초) → 부분 개선만. Unity CLI 로 머티리얼 그룹별 `shadowCastingMode` 를 끄며 스크린샷 비교 → 개별 · 조합 모두 무효, 전체를 끄거나 라이트 그림자를 끄면 사라짐 → **실시간 그림자 Cascade 경계**로 특정. 기본 Split (0.12, 0.29, 0.54) 에서 첫 경계 ≈ 18유닛인데 주방이 카메라에서 20~50유닛에 걸쳐 있었음.
  - *해결*: Cascade4 Split → **(0.4, 0.6, 0.8)** — 첫 Cascade 가 0~60유닛을 덮어 주방 전체가 한 Cascade 안에.
- **표로 낼 사실**: 최종 그림자 설정 표 — Shadow Distance 150 · Cascade 4 · Split (0.4, 0.6, 0.8) · Depth/Normal Bias 기본(0.1/0.5) · 메인 라이트 그림자 해상도 2048 · Directional Mixed · Shadowmask · Kitchen 하위 Static(Contribute GI). (현재 `PC_RPAsset.asset` 값과 일치 확인함)
  가설 표 — 가설 · 검증 방법 · 결과 (Shadow Distance/Cascade 설정 · Soft Shadow 디더링 · 외곽선 포스트프로세스 · 라이트맵 베이크 · Cascade 경계).
- **그래프**: 흐름(flowchart) — *질문: 원인을 어떻게 좁혀 갔나?* — 증상 → 외곽선 on/off(사라짐) → 외곽선 셰이더 수정(회귀, 롤백) → Shadow Distance 상향(1차 해결) → 계단 그림자 잔존 → 베이크(부분) → 그룹별 그림자 off(무효) → 라이트 그림자 off(사라짐) → Cascade 경계 특정 → Split 조정(해결)

---

## 부록 — 게임플레이 시스템 요약 (주 내용 아님)
> 필요하면 별도 문서로 분리. 모두 `Assets/02_Scripts/**` 코드 근거.
- **배고픔 = 속도**: 시간 감소 · 음식 · 쥐덫 모두 `HungerController.ChangeHunger` 한 경로. `AnimationCurve` + Lerp(2~15)로 속도 매핑. 치즈 "즉시 풀 회복"은 `Amount` > MaxHunger + `Clamp` 로 해결.
- **고양이 AI**: 플레이어 위치 큐를 NavMeshAgent 로 재생하는 Path Replay. 상태 5개(Chasing · DirectChasing · Frozen · GapCorrecting · Caught), 거리 15 초과 시 러버밴딩, 플레이어 비행 중 정지 후 비행 전 거리로 보정, 포획은 트리거 충돌.
- **풀잎 비행**: Player `Run`/`Fly` 상태. Fly 중 전진 속도는 **8 로 고정**(배고픔 속도 미사용, 의도된 설계), 상승 `AscendSpeed`, 제한시간 후 자동 Run. 쿨타임은 풀잎마다 개별 관리.
- **랜덤 스폰**: `NavMesh.CalculateTriangulation` 삼각형을 면적 × 높이 배율로 가중 샘플(누적합 + BinarySearch), 치즈는 주변 링에 쥐덫 동반. 종류별 `ObjectPool<Food>`.
- **카메라**: A/D 로 피벗 회전, SphereCast 충돌 시 즉시 스냅 · 복귀는 SmoothDamp.
- **데이터 테이블**: 구글 시트 TSV → `SerializedObject.FindProperty("_" + camelCase)` 로 SO 5종에 기록(`SpeedEffectData` 제외 — 화면 보며 조정).
- **게임 흐름**: 타이틀 → 3·2·1 카운트다운(`WaitForSecondsRealtime`) → 생존 점수 + 사과 30 · 치즈 60 → 포획 시 `timeScale 0` · PlayerPrefs 최고기록.

---

## 양식 ② 재료 (코드 · 작업 문서에서 찾은 "고민과 선택" 후보 — 사람이 판단 · 서술)
1. **외곽선 방식**: Inverted Hull(머티리얼별 Pass) vs 화면공간 Depth/Normal(렌더러 피처) → 화면공간 채택. 기준 후보: 새 오브젝트 대응 · 관리 지점 수 · C# 코드 필요 여부 · 거리 민감도.
2. **밴딩 단계 수**: 2단 vs 3단 이상 → 2단 채택(저해상도 텍스처와 충돌).
3. **URP Lit 재사용 vs 직접 작성**: `UsePass`/원본 include vs 최소 HLSL 직접 작성 → 직접 작성(버전 의존 · SRP Batcher).
4. **라디얼 블러 샘플 수**: 프로퍼티 노출 vs 컴파일 타임 상수 → 상수.
5. **그림자 아티팩트 해결 경로**: 셰이더 수정 vs 설정/A-B 진단 → 회고(learnings) 재료가 디버깅 문서 5절에 있음.

## 사람에게 넘길 확인 목록
1. **slug** · 문서 **title** 확정 (subtitle = MouseAndCheese 반영함).
2. 외곽선 셰이더 include 순서(Core → Blit)가 실제 컴파일 오류를 겪고 고친 것인지.
3. 렌더러 피처 순서(블러 → 외곽선, 외곽선이 블러되지 않음)가 의도인지.
4. 7개 툰 머티리얼 · `ToonOutline_Mat` 의 **실제 튜닝 값**(표의 수치는 셰이더 기본값).
5. 스크린샷 후보(양식 ③): 셀 셰이딩 전/후, 외곽선 on/off, 블러 on/off, Cascade Split 변경 전/후.
