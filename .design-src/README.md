# .design-src — claude.ai/design 원본 스냅샷

여기 있는 `.dc.html` 은 **손대지 않는다.** 대조용 기준이다.

`src/components/dc/` 의 컴포넌트를 뜨거나 고친 뒤, 생성 결과(`dist/`)를 이 파일들과 대조해
원본과 같은지 확인한다. 이 대조로 실제 버그를 세 번 잡았다.
(배지·제목이 딱 붙음 / 인라인 `<code>` 가 원본보다 요란함 / 속성 순서 다름)

## 다시 받는 법

DesignSync 도구로 언제든 최신본을 받을 수 있다. 내보내기(독립형 HTML·아카이브)는 필요 없다.

```
DesignSync  method: get_file
            projectId: fc9cc71a-4f26-4060-a664-496f5532382e
            path: "VamSirLike Document.dc.html"   또는  "Bond Document.dc.html"
```

사용자가 디자인을 고치면 여기 스냅샷도 갱신해야 대조가 의미를 갖는다.

## 대조하는 법

```
node <scratchpad>/diff.mjs <슬러그> <섹션id>     예: node diff.mjs vampire-like sec-2
```

베이스라인(정적 페이지의 dist 결과)과 조립본(`dist/cmp-<슬러그>`)의 같은 섹션을 정규화해
문자열 비교한다. **베이스라인이 여기 원본과 같은지 먼저 확인하고 시작한다** — 기준이 흔들리면
그 위의 판단이 전부 무너진다. (뱀서 5섹션 · Bond 7섹션 전부 일치 확인함)

## 의도적으로 다른 것

정규화가 접어주는 것은 여기 적힌 것뿐이다. **정규화를 늘려서 격차를 없애지 않는다.**
그건 대조를 무력화하는 것이고, 그러면 "원본과 같다"는 말을 아무도 믿을 수 없게 된다.

- **볼드** — 원본은 `<b style="color:#17181a">` 를 91군데 반복한다.
  우리는 `<b>` + `global.css` 의 `b { color: var(--ink) }`. `--ink` 가 같은 값이라 화면은 같다.
  인라인을 91번 반복하느니 한 곳에서 관리하는 게 낫다.
- **인라인 코드** — 위와 같은 이유. 원본은 `<code style="font-family:'JetBrains Mono',monospace;color:#1d4ed8">`
  를 55군데 반복하고, 우리는 `global.css` 의 `code {}` 가 같은 값을 준다.
- **구문 강조** — 원본은 코드에 `<span style="color:#2563eb">` 를 사람이 박아뒀다.
  우리는 `dc/Code.astro` 가 규칙으로 칠한다. 색이 셋뿐(키워드·리터럴·주석)이라 규칙이 단순하다.
  `public void` 가 한 span 에서 두 span 으로 쪼개지지만 색과 범위가 같아 화면은 같다.
  (대조할 때 붙어 있는 같은 색 span 을 합쳐 원본 모양으로 되돌린 뒤 비교한다.)
- **`data-code`** — 원본이 코드블록에 붙여둔 dc 런타임 마커다. 원본 `<script>` 의
  `data-props="{showCode:...}"` 가 이걸로 코드블록을 숨겼다 보였다 한다. 우리 사이트엔 그 토글이
  없어 **아무도 읽지 않는다.** `port-design.mjs` 가 `style-hover` · `ref="{{}}"` 를 걷어내는 것과
  같은 부류인데 이것만 빠져 있어서 정적 페이지에는 남아 있다. 조립본은 안 뱉는다.
  (뱀서는 값 없이 `data-code`, Bond 는 `data-code=""` 로 온다. 둘 다 지운다.)
- **`data-section` · `data-screen-label`** — Bond 섹션 태그에만 붙는 dc 뷰어 속성.
  `data-section` 은 우리도 쓰지만(사이드바 스크롤 추적) 값 없이 존재만 본다.
  `data-screen-label`("01 개요")은 dc 뷰어의 화면 라벨이라 우리 사이트엔 쓸모없어 지운다.
- **`&` 이스케이프 — 우리 쪽이 옳다.** 원본 `힙 할당 & GC 방지` 에 `&` 가 안 막혀 있다.
  같은 문서의 `Raycast &amp; OverlapCircle` 은 막아뒀으니 빠뜨린 것이다. `rich()` 는 늘 막는다.
  둘 다 `&` 로 펴서 비교한다.

**구문 강조 보충:** 원본은 `return false`·`return true`·`out string` 을 한 키워드 span 으로 칠한다.
`dc/Code.astro` 는 낱말 단위라 이들을 쪼개지만, 색이 같아 위의 "붙은 같은 색 span 합치기" 규칙이
원본 모양으로 되돌린다(`return false` 만은 리터럴 색이 섞여 컴포넌트가 직접 합친다).

## 원본이 어긋나 있는 곳 (대조로 찾은 것)

여기서 임의로 고치지 않는다. 디자인은 claude.ai/design 이 원본이고, 고칠 거면 거기서 고쳐
다시 떠 온다. 지금은 원본을 그대로 재현한다.

이 흔들림들 때문에 컴포넌트가 값을 `margin`·`width` 같은 prop 으로 받는다. 원본을 그대로
재현하려면 어쩔 수 없다. 흔들림이 아니라 진짜 다른 모양이면 컴포넌트 자체를 나눴다.

- **h3 여백** — 같은 자리인데 섹션마다 다르다(뱀서 `36/44px` · `34/40px`, Bond `8/36/44px`).
  2~4px 차이라 화면에서 구분되지 않는다. → `PartTitle` 의 `margin` prop.
- **StackTable 열 폭** — 뱀서 `[118,180]` · Bond `[124,172]`. 합은 거의 같다(298·296). → `widths` prop.
- **Layers 헤더 letter-spacing** — 뱀서 `.08em` · Bond `.06em`. → `headTracking` prop.
- **Lede line-height** — 뱀서 lede `1.66` · Bond lede `1.64`. → `lineHeight` prop.
- **FigureAside 값 묶음** — 뱀서(sm) vs Bond(md) 가 gap·모서리·캡션·배지 여백에서 조금씩 다르다.
  → `size` prop 으로 두 벌을 묶었다.
- **NoteCards** — 열 수·카드 padding·본문 글자·line-height 가 세 사례가 다 다르다. → 넷 다 prop.
- **격자 문법** — 2열은 `1fr 1fr`, 3열은 `repeat(3,1fr)`. 같은 뜻을 두 문법으로 쓴다.
- **표 여백** — 표 여러 종의 칸 padding 이 다 다르다
  (`11px 12px` · `10px` · `8px 10px` · `12px` · `9px 11px` · `10px 11px`). 그래서 표 컴포넌트가 6개다.

**파란 볼드는 이제 드리프트가 아니다.** 처음엔 뱀서 4곳만 보고 "그 문단만 어긋난 것"으로 봤는데,
Bond 15곳이 규칙(=내가 고른 해법·기제)을 드러냈다. `rich()` 에 `==해법==` 문법으로 넣어 해결했다.
잉크 볼드(문제)와 파란 볼드(해법)가 색으로 갈린다. `src/lib/rich.ts` 주석 참조.
