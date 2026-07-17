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

임시 페이지에 컴포넌트를 렌더 → `npx astro build` → `dist` 결과물과 여기 원본 조각을
정규화(`replace(/>\s+</g,'><').replace(/\s+/g,' ')`)해서 문자열 비교.

## 의도적으로 다른 것

- **볼드** — 원본은 `<b style="color:#17181a">` 를 91군데 반복한다.
  우리는 `<b>` + `global.css` 의 `b { color: var(--ink) }`. `--ink` 가 같은 값이라 화면은 같다.
  인라인을 91번 반복하느니 한 곳에서 관리하는 게 낫다.
- **구문 강조** — 원본은 코드에 `<span style="color:#2563eb">` 를 사람이 박아뒀다.
  우리는 `dc/Code.astro` 가 규칙으로 칠한다. 색이 셋뿐(키워드·리터럴·주석)이라 규칙이 단순하다.
  `public void` 가 한 span 에서 두 span 으로 쪼개지지만 색과 범위가 같아 화면은 같다.
