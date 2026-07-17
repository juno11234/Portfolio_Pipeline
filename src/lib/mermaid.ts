import { createMermaidRenderer } from 'mermaid-isomorphic';

/**
 * Mermaid 다이어그램을 **빌드 시점에** SVG로 굽는다.
 *
 * 브라우저에서 렌더하는 방법도 있지만 그러면 mermaid 라이브러리 1MB 남짓이
 * 방문자에게 전송된다. 포트폴리오는 채용 담당자가 잠깐 열어보는 페이지라
 * 런타임 JS를 늘릴 이유가 없다. 여기서 구우면 결과물은 그냥 SVG다.
 *
 * 대신 mermaid는 DOM이 있어야 동작하므로 playwright(헤드리스 브라우저)가 필요하다.
 * 개발 의존성이라 배포물에는 들어가지 않는다.
 */

/**
 * 렌더러는 모듈 수준에서 하나만 만든다.
 * 호출할 때마다 만들면 다이어그램 개수만큼 브라우저가 뜬다.
 */
const renderer = createMermaidRenderer();

/**
 * 같은 소스를 두 번 굽지 않는다.
 * dev 서버는 요청마다 컴포넌트를 다시 실행하므로 캐시가 없으면 매번 브라우저가 돈다.
 */
const cache = new Map<string, string>();

/**
 * 디자인의 3색·2폰트에 맞춘 테마.
 *
 * mermaid 기본 테마(보라·연노랑)를 그대로 두면 페이지 안에서 이 다이어그램만 딴 세상이 된다.
 * 가이드: "장마다 스타일이 바뀌면 그 자체로 '정리 안 됨'으로 읽힙니다."
 */
const mermaidConfig = {
  theme: 'base' as const,
  themeVariables: {
    fontFamily: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
    fontSize: '13px',

    // 노드
    primaryColor: '#eef3ff',
    primaryTextColor: '#17181a',
    primaryBorderColor: '#2563eb',
    secondaryColor: '#f4f5f7',
    secondaryBorderColor: '#c2c3c8',
    tertiaryColor: '#ffffff',
    tertiaryBorderColor: '#c2c3c8',
    mainBkg: '#eef3ff',
    nodeBorder: '#2563eb',
    nodeTextColor: '#17181a',

    // 선·글자
    lineColor: '#8a8b90',
    textColor: '#17181a',
    background: '#ffffff',

    // subgraph
    clusterBkg: '#f7f7f5',
    clusterBorder: '#cddcfb',

    // 클래스 다이어그램
    classText: '#17181a',

    // 시퀀스 다이어그램
    actorBkg: '#eef3ff',
    actorBorder: '#2563eb',
    actorTextColor: '#17181a',
    signalColor: '#55565a',
    signalTextColor: '#55565a',
    labelBoxBkgColor: '#eef3ff',
    labelBoxBorderColor: '#2563eb',
    noteBkgColor: '#f4f5f7',
    noteBorderColor: '#c2c3c8',
    noteTextColor: '#44454a',
  },
};

/**
 * Mermaid 소스 하나를 SVG 문자열로 만든다.
 *
 * 실패하면 예외를 던진다. 다이어그램이 깨진 채로 배포되느니 빌드가 멈추는 게 낫다.
 * 스키마가 품질 게이트인 것과 같은 이유다.
 *
 * @param source ```mermaid 블록 안에 넣던 그 텍스트
 */
export async function renderMermaid(source: string): Promise<string> {
  const hit = cache.get(source);
  if (hit !== undefined) return hit;

  const results = await renderer([source], { mermaidConfig });
  const result = results[0];

  if (result === undefined || result.status === 'rejected') {
    const why = result === undefined ? '결과 없음' : String(result.reason);
    throw new Error(
      `Mermaid 다이어그램을 그리지 못했습니다.\n${why}\n\n--- 문제의 소스 ---\n${source}`,
    );
  }

  const { svg } = result.value;
  cache.set(source, svg);
  return svg;
}
