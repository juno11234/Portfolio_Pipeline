// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages(프로젝트 페이지) 배포. 공개 URL: https://juno11234.github.io/Portfolio_Pipeline/
// base 하위경로 때문에 내부 링크는 절대경로 대신 import.meta.env.BASE_URL 로 만든다(Sidebar·Base 참조).
export default defineConfig({
  site: 'https://juno11234.github.io',
  base: '/Portfolio_Pipeline',
});
