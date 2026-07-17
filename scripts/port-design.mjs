import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

/**
 * claude.ai/design 의 .dc.html 을 Astro 페이지로 옮긴다.
 *
 * 마크업·스타일은 손대지 않는다. dc 런타임 전용 문법과, 우리 사이트와 겹치는
 * 부분(문서 사이드바·바깥 여백)만 걷어낸다.
 *
 * 사용: node port2.mjs <design.html> <slug> <title> <description>
 */
const [srcFile, slug, title, description] = process.argv.slice(2);
const REPO = 'C:/Users/cozam/OneDrive/Desktop/Unity Practice/Portfolio_Pipeline';
const src = readFileSync(srcFile, 'utf8');

/* 1) <x-dc> 안의 본문만. helmet(폰트·리셋)은 Base 레이아웃이 이미 갖고 있다. */
const open = /<x-dc(?:\s[^>]*)?>/.exec(src);
const close = src.lastIndexOf('</x-dc>');
let body = src.slice(open.index + open[0].length, close);
body = body.replace(/<helmet[\s\S]*?<\/helmet>/, '').trim();
body = body.replace(/<script[\s\S]*?<\/script>/g, '').trim();

/* 2) style-hover 는 dc 런타임 문법이다. 진짜 CSS 로 바꾼다. */
let hoverRules = '';
let hoverN = 0;
body = body.replace(/\s*style-hover="([^"]*)"/g, (_, css) => {
  const cls = `${slug}-h${++hoverN}`;
  hoverRules += `  .${cls}:hover { ${css.endsWith(';') ? css : css + ';'} }\n`;
  return ` class="${cls}"`;
});

/* 3) dc 전용 잔재 */
body = body.replace(/\s*ref="\{\{[^}]*\}\}"/g, '');

/*
 * 4) 원본 문서 사이드바를 걷어낸다.
 *    우리 사이드바가 이미 '사이트 내비 + 현재 문서 목차'를 한다. 둘이 겹친다.
 *    인라인 style 이라 CSS 로는 못 이기므로 마크업에서 뺀다.
 *    원본 목차 항목은 뽑아서 Base 에 넘긴다.
 */
const toc = [...body.matchAll(/data-nav="(sec-\d+)"[\s\S]*?data-nl[^>]*>([^<]+)</g)].map(
  ([, id, label]) => ({ id, label: label.trim() }),
);
const a = body.indexOf('<aside id="doc-sidebar"');
const b = body.indexOf('</aside>', a);
if (a < 0 || b < 0) throw new Error('#doc-sidebar 못 찾음');
body = body.slice(0, a) + body.slice(b + '</aside>'.length);

/* 사이드바를 뺐으니 본문 밀어내기도 없앤다 */
body = body.replace(/margin-left:\s*250px/g, 'margin-left:0');
/* Base 가 이미 <main> 이다. 중첩 방지 */
body = body.replace(/<main(\s|>)/, '<div$1').replace(/<\/main>/, '</div>');
/* 바깥 여백은 Base 의 .main 이 준다. 그대로 두면 두 번 들어간다. */
body = body.replace(/padding:\s*60px 54px 96px/g, 'padding:0');

/* 5) 이미지 — src/assets/<slug>/ 에 있는 것만 잇는다 */
mkdirSync(`${REPO}/public/design`, { recursive: true });
const missing = new Set();
/* 디자인이 캐시 무력화용으로 ?v=2 같은 쿼리를 붙여둔 곳이 있다. 파일명만 떼어 쓴다. */
body = body.replace(/src="assets\/([^"?]+)(\?[^"]*)?"/g, (m, name) => {
  const from = `${REPO}/src/assets/${slug}/${name}`;
  if (!existsSync(from)) {
    missing.add(name);
    return m;
  }
  copyFileSync(from, `${REPO}/public/design/${name}`);
  return `src="/design/${name}"`;
});

/* 6) Astro 페이지 */
writeFileSync(
  `${REPO}/src/pages/projects/${slug}.astro`,
  `---
/**
 * claude.ai/design 의 "${srcFile.replace(/.*\//, '')}" 를 **그대로** 옮긴 것.
 * 마크업·스타일에 손대지 않았다. dc 런타임 문법과 우리 사이트와 겹치는 부분만 걷어냈다.
 *
 * 이 파일은 아직 파이프라인이 아니다. 프로젝트마다 이렇게 손으로 옮기면 수작업이다.
 * 두 문서(뱀서라이크·Bond)를 나란히 놓고 실제로 반복되는 것만 골라내는 것이 다음 단계다.
 */
import Base from '../../layouts/Base.astro';

/* 원본 마크업 */
const body = ${JSON.stringify(body)};

/* 원본 사이드바에 있던 목차. 우리 사이드바가 대신 보여준다. */
const toc = ${JSON.stringify(toc)};
---

<Base
  title=${JSON.stringify(title)}
  description=${JSON.stringify(description)}
  activeProject=${JSON.stringify(slug)}
  toc={toc}
>
  <div class="dc" set:html={body} />
</Base>

<style is:global>
${hoverRules}</style>
`,
);

console.log(`${slug} 옮김:`);
console.log('  본문      ', (body.length / 1024).toFixed(1) + 'KB');
console.log('  목차      ', toc.map((t) => t.label).join(' · '));
console.log('  hover 규칙', hoverN + '개');
console.log('  이미지 없음:', missing.size ? [...missing].join(', ') : '없음');
