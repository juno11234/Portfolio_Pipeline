import { createHighlighter, type Highlighter } from 'shiki';

/**
 * C# 코드를 **빌드 시점에** 구문 강조한다 — Shiki 의 `dark-plus`(Visual Studio / VS Code 다크) 테마.
 *
 * 예전엔 사이트 3색(파랑·회색)에 맞춘 규칙 기반 커스텀 하이라이터였으나, 사용자가 **실제 VS 색상**을
 * 원해 Shiki 로 교체했다. 정확한 C# 문법(키워드·타입·문자열·주석·숫자·메서드)을 grammar 로 칠한다.
 *
 * mermaid.ts 와 같은 이유로 **하이라이터는 모듈 수준에 하나만** 만들고 결과를 캐시한다 —
 * 안 그러면 코드 블록마다 grammar·theme·WASM 을 다시 로드한다. 브라우저로 나가는 JS 는 0(결과는 <span>뿐).
 */

/** VS Code/Visual Studio 다크 테마 색상. 코드 배경 #1e1e1e 도 이 테마가 함께 준다. */
const THEME = 'dark-plus';

let highlighterPromise: Promise<Highlighter> | null = null;

/** 하이라이터 싱글턴. 처음 호출에서 csharp grammar 와 dark-plus 테마를 한 번 로드한다. */
function getHighlighter(): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = createHighlighter({ themes: [THEME], langs: ['csharp'] });
  }
  return highlighterPromise;
}

/** 같은 코드를 두 번 굽지 않는다. dev 서버는 요청마다 컴포넌트를 다시 실행한다. */
const cache = new Map<string, string>();

/**
 * C# 코드 한 덩이를 하이라이트된 HTML(`<pre class="shiki">…`)로 만든다.
 * 이 사이트의 코드 블록은 전부 C# 이라 lang 은 csharp 고정이다.
 *
 * @param code 코드 원문
 */
export async function highlightCsharp(code: string): Promise<string> {
  const hit = cache.get(code);
  if (hit !== undefined) return hit;

  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(code, { lang: 'csharp', theme: THEME });
  cache.set(code, html);
  return html;
}
