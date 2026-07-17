/**
 * 콘텐츠 문장에 허용하는 아주 작은 마크업.
 *
 * `**굵게**` 와 `` `코드` `` 둘뿐이다.
 *
 * 왜 필요한가 — claude.ai/design 의 두 문서에서 볼드가 91군데 쓰였고(뱀서라이크 26, Bond 65)
 * 전부 수치(196회 → 4회)나 핵심 용어(IFighter, GC 최적화)를 짚는 용도였다.
 * 볼드 없이 평평한 회색 문단으로 두면 읽는 사람이 무엇이 중요한지 스스로 찾아야 한다.
 * 가이드 Part 3: "제목 > 소제목 > 본문 > 캡션 — 크기·굵기·색으로" 위계를 준다.
 *
 * 왜 이것만인가 — 마크다운 전체를 열면 콘텐츠 파일이 반쯤 마크다운이 되어
 * 스키마가 검사할 수 없는 구조(표·목록·제목)가 문장 안으로 들어온다.
 * 구조는 블록이 갖고, 문장은 강조만 한다.
 */

/** &, <, > 를 먼저 막는다. 순서가 반대면 콘텐츠로 태그를 주입할 수 있게 된다. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 문장을 HTML 조각으로 바꾼다. `set:html` 로 넣어야 한다.
 *
 * @param text 콘텐츠 파일의 원문
 */
export function rich(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
