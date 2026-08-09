/**
 * 빌드 결과물(`dist/`)을 PDF 로 뽑는다.  실행: `npm run pdf`
 *
 * **왜 있나:** 채용 지원은 대부분 첨부파일 심사다. 사이트 링크만 내면 열리지 않는 경우가 많다.
 * 이 파이프라인이 없애려는 것은 "손으로 PDF 를 만드는 과정"이지 PDF 자체가 아니다 —
 * 같은 `docs/*.yaml` 에서 화면과 종이가 함께 나오면 손으로 만드는 과정은 여전히 0이다.
 *
 * **어떻게 도나:**
 *   1. `dist/` 를 임시 HTTP 서버로 띄운다. 배포와 같은 base 경로로 마운트해야 에셋 절대경로가 풀린다
 *      (`file://` 로 열면 `/Portfolio_Pipeline/_astro/...` 가 파일시스템 루트를 가리켜 전부 깨진다).
 *   2. mermaid 를 굽는 데 이미 쓰는 playwright 크로미움으로 각 페이지를 인쇄한다. 새 의존성이 없다.
 *   3. 합본은 각 페이지의 `<main>` 만 떼어 한 문서로 잇고 문서 사이에 페이지를 끊는다.
 *
 * 인쇄 레이아웃 자체는 `src/styles/print.css` 에 있다. 여기 있는 건 용지·여백·쪽번호뿐이다.
 *
 * **프로젝트 순서는 빌드 결과에서 읽는다.** 사이드바에 이미 `projects.yaml` 순서로 박혀 있어
 * 이 스크립트에 목록을 적지 않는다 — 프로젝트가 늘어도 이 파일은 그대로다.
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(root, 'dist');
const OUT = path.join(root, 'pdf');

/** 합본을 서버에 얹을 가짜 경로. 실제 파일로 만들지 않아 dist 를 더럽히지 않는다. */
const COMBINED_PATH = '/__combined.html';

/**
 * 용지 설정.
 *
 * `scale` 이 핵심이다. 문서 단은 디자인 원본 그대로 860px 인데 A4 인쇄 폭은 약 733px 이라
 * 그냥 뽑으면 오른쪽이 잘린다. 0.8 로 줄이면 배치가 그대로인 채 860px 이 여유 있게 들어간다
 * (본문 14px → 종이에서 11px 남짓, 일반적인 기술 문서 본문 크기다).
 * 단을 좁히는 방법도 있지만 그러면 카드·표가 다시 흘러 화면과 다른 문서가 된다.
 */
const PAPER = {
  format: 'A4',
  printBackground: true,
  scale: 0.8,
  margin: { top: '12mm', right: '8mm', bottom: '14mm', left: '8mm' },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** 빌드 결과에서 base 경로를 읽는다. astro.config 를 따로 파싱하지 않기 위해서다. */
function readBase(homeHtml) {
  const hit = homeHtml.match(/href="(\/[^"]*)\/_astro\//);
  if (hit === null) return '';
  return hit[1];
}

/** 사이드바 링크에서 프로젝트 슬러그를 순서대로 뽑는다(중복 제거 — 접힘/펼침 두 벌이 있다). */
function readSlugs(homeHtml, base) {
  const pattern = new RegExp(`href="${base}/projects/([a-z0-9-]+)"`, 'g');
  const seen = [];
  for (const hit of homeHtml.matchAll(pattern)) {
    if (seen.includes(hit[1]) === false) seen.push(hit[1]);
  }
  return seen;
}

function readTitle(html) {
  const hit = html.match(/<title>([^<]*)<\/title>/);
  if (hit === null) return '';
  return hit[1];
}

/** 페이지에서 본문(`<main>`)만 떼어낸다. 사이드바·확대 오버레이는 여기 안 들어 있다. */
function readMain(html) {
  const hit = html.match(/<main[\s\S]*?<\/main>/);
  if (hit === null) throw new Error('<main> 을 찾지 못했다 — 레이아웃이 바뀌었는지 확인한다.');
  return hit[0];
}

/**
 * 페이지가 쓰는 스타일을 전부 걷는다 — 링크된 번들과 **인라인 `<style>` 둘 다**.
 *
 * Astro 는 작은 스타일을 파일로 빼지 않고 문서에 인라인으로 심는다. 링크만 모았더니
 * 합본에서 홈 화면 레이아웃이 통째로 풀렸다(사진만 남고 이력·기술스택이 맨 텍스트로 쏟아졌다).
 * 위치도 페이지마다 다르다 — 홈은 `<head>`, 문서 페이지는 본문 안이다. 그래서 문서 전체를 훑는다.
 */
function readStylesheets(html) {
  const pattern = /<link rel="stylesheet"[^>]*>|<style>[\s\S]*?<\/style>/g;
  return [...html.matchAll(pattern)].map((hit) => hit[0]);
}

/**
 * 여러 페이지를 한 문서로 잇는다.
 * 페이지마다 스코프된 CSS 번들이 달라 링크를 전부 모은다(Astro 가 `data-astro-cid-*` 로
 * 스코프를 걸어 두어 섞여도 서로 간섭하지 않는다).
 */
function combine(pages) {
  const links = [];
  for (const page of pages) {
    for (const link of readStylesheets(page.html)) {
      if (links.includes(link) === false) links.push(link);
    }
  }
  const bodies = pages.map((page) => `<div class="pdf-doc">${readMain(page.html)}</div>`);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${pages[0].title}</title>
${links.join('\n')}
<style>@media print { .pdf-doc + .pdf-doc { break-before: page; } }</style>
</head>
<body>
${bodies.join('\n')}
</body>
</html>`;
}

/** dist 를 배포와 같은 base 경로에 얹는 정적 서버. 합본만 메모리에서 준다. */
function serve(base, combinedHtml) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === `${base}${COMBINED_PATH}`) {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(combinedHtml.value);
      return;
    }

    if (base !== '' && pathname.startsWith(base)) pathname = pathname.slice(base.length);
    if (pathname === '') pathname = '/';

    let file = path.join(DIST, pathname);
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    else if (path.extname(file) === '') file = path.join(file, 'index.html');

    // 경로 탈출 방지 — 로컬 스크립트지만 dist 밖은 내보내지 않는다.
    if (path.relative(DIST, file).startsWith('..')) {
      res.writeHead(403).end();
      return;
    }

    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * 쪽번호 · 문서 이름 푸터.
 * 크로미움은 이 조각을 본문과 별개인 작은 문서로 그린다 — 폰트 크기를 명시하지 않으면 0px 이 된다.
 */
function footer(label) {
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="width:100%;padding:0 9mm;font-family:'Malgun Gothic','Pretendard',sans-serif;font-size:7.5px;color:#a0a1a6;display:flex;justify-content:space-between;">
    <span>${escaped}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

/**
 * 스크린샷을 JPEG 로 바꿔 파일 크기를 줄인다.
 *
 * 크로미움은 PNG 를 PDF 에 넣을 때 원본 스트림을 그대로 쓰지 않고 다시 압축한다 — 7MB 짜리
 * 스크린샷 묶음이 16MB 합본이 됐다. 채용 포털 첨부 한도가 보통 10MB 라 그대로는 못 낸다.
 * JPEG 는 PDF 가 그대로 품어(DCTDecode) 재압축이 없다.
 *
 * **투명한 이미지는 건너뛴다.** JPEG 에는 알파가 없어 몬스터 렌더처럼 배경이 뚫린 그림이
 * 검게 칠해진다. 알파를 실제로 훑어보고 판단한다 — 확장자로는 알 수 없다.
 * 해상도는 줄이지 않는다(원본이 최대 1815px 로 이미 인쇄에 맞다). 바뀌는 건 압축 방식뿐이다.
 */
async function toJpeg(page) {
  return page.evaluate(async (quality) => {
    let converted = 0;
    for (const img of document.querySelectorAll('img')) {
      if (img.naturalWidth === 0) continue;

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = false;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 255) {
          transparent = true;
          break;
        }
      }
      if (transparent === true) continue;

      img.src = canvas.toDataURL('image/jpeg', quality);
      await img.decode().catch(() => {});
      converted += 1;
    }
    return converted;
  }, 0.92);
}

/**
 * 인쇄할 때만 **정적** Pretendard 로 갈아끼운다.
 *
 * 크로미움은 가변 폰트(Pretendard Variable)를 PDF 에 그대로 넣지 못해 글자를 300dpi
 * 비트맵으로 구워 Type 3 폰트에 담는다 — 문서 하나가 3.8MB 가 됐다.
 * 같은 서체의 정적 파일을 쓰면 진짜 폰트로 임베드되어 용량이 크게 준다.
 * 서체가 같으므로 모양은 바뀌지 않는다. **사이트에는 손대지 않는다** — 인쇄 경로에서만 덮는다.
 */
async function useStaticFont(page) {
  await page.addStyleTag({
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css',
  });
  await page.addStyleTag({
    content: ":root { --font: Pretendard, system-ui, -apple-system, sans-serif; }",
  });
}

/** 한 URL 을 PDF 로. 폰트가 CDN 에서 오므로 로드를 기다린 뒤 인쇄한다. */
async function printPage(page, url, outFile, label) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await useStaticFont(page);
  await page.evaluate(() => document.fonts.ready);
  await toJpeg(page);
  await page.pdf({
    path: outFile,
    ...PAPER,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: footer(label),
  });
}

async function main() {
  const homeHtml = await readFile(path.join(DIST, 'index.html'), 'utf8').catch(() => {
    throw new Error('dist/index.html 이 없다. 먼저 `npm run build` 를 돌린다.');
  });

  const base = readBase(homeHtml);
  const slugs = readSlugs(homeHtml, base);
  if (slugs.length === 0) throw new Error('사이드바에서 프로젝트 링크를 찾지 못했다.');

  const aboutHtml = await readFile(path.join(DIST, 'about', 'index.html'), 'utf8');
  const docs = [];
  for (const slug of slugs) {
    const html = await readFile(path.join(DIST, 'projects', slug, 'index.html'), 'utf8');
    docs.push({ slug, html, title: readTitle(html) });
  }

  const home = { slug: 'index', html: homeHtml, title: readTitle(homeHtml) };
  const about = { slug: 'about', html: aboutHtml, title: readTitle(aboutHtml) };

  // 합본 = 홈(프로필 · 이력 · 기술스택) + 기술 문서 전부. 자기소개서는 따로 낸다(제출 서류가 다르다).
  const combinedHtml = { value: combine([home, ...docs]) };

  const server = await serve(base, combinedHtml);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await mkdir(path.join(OUT, '개별'), { recursive: true });

    const jobs = [
      {
        url: `${origin}${base}${COMBINED_PATH}`,
        file: path.join(OUT, '이주노_포트폴리오.pdf'),
        label: '이주노 · 게임 클라이언트 개발자 포트폴리오',
      },
      {
        url: `${origin}${base}/about`,
        file: path.join(OUT, '이주노_자기소개서.pdf'),
        label: '이주노 · 자기소개서',
      },
      ...docs.map((doc) => ({
        url: `${origin}${base}/projects/${doc.slug}`,
        file: path.join(OUT, '개별', `${doc.slug}.pdf`),
        label: doc.title,
      })),
    ];

    for (const job of jobs) {
      await printPage(page, job.url, job.file, job.label);
      console.log(`  ✓ ${path.relative(root, job.file)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n완료 — ${path.relative(root, OUT)}/ 에 담겼다.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
