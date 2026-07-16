import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 이력 날짜. `YYYY` · `YYYY.MM` · `YYYY.MM.DD` 세 가지를 허용한다.
 *
 * 원본 이력서가 항목마다 정밀도가 다르다. 학력은 연 단위(2016년~2019년),
 * 자격증은 일 단위(2018년 12월 28일)로 적혀 있다. 하나로 통일하려면
 * 없는 정보를 추측해서 채워야 하므로 세 가지를 모두 받는다.
 */
const historyDate = z
  .string()
  .regex(/^\d{4}(\.\d{2}(\.\d{2})?)?$/, '날짜는 YYYY · YYYY.MM · YYYY.MM.DD 중 하나여야 합니다');

/** 학력·교육·자격증이 공유하는 이력 한 줄 */
const historyEntry = z.object({
  /** 항목 이름 (예: 컴퓨터그래픽스운용기능사) */
  name: z.string().min(1),
  /** 기관 이름 (예: 한국산업인력공단) */
  organization: z.string().min(1),
  startDate: historyDate,
  /** 자격증처럼 취득일 하나뿐인 항목은 생략한다 */
  endDate: historyDate.optional(),
});

/**
 * 메인 페이지의 프로필·이력.
 *
 * 사이트에 하나만 존재하므로 `src/content/profile/profile.yaml` 한 파일로 관리한다.
 * 집 주소·생년월일은 의도적으로 스키마에 넣지 않았다. 공개 사이트에 올릴 정보가 아니다.
 */
const profile = defineCollection({
  loader: glob({ pattern: 'profile.yaml', base: './src/content/profile' }),
  schema: z.object({
    name: z.string().min(1),
    /** 지원 분야 (예: 게임 클라이언트 개발자) */
    role: z.string().min(1),
    /**
     * 메인 상단 한 줄 소개.
     * 80자 상한은 품질 기준이다. 길어지면 '한 줄'이 아니게 되고 첫인상이 흐려진다.
     */
    tagline: z.string().min(10).max(80),
    email: z.string().email(),
    phone: z.string().regex(/^010-\d{4}-\d{4}$/, '전화번호는 010-0000-0000 형식이어야 합니다'),
    /** 근무 희망 지역. 상세 주소가 아니다. */
    location: z.string().min(1),
    career: z.string().min(1),
    education: z.array(historyEntry).min(1),
    training: z.array(historyEntry),
    certificates: z.array(historyEntry),
  }),
});

/**
 * 메인 페이지의 기술 스택 카테고리.
 *
 * `highlights`를 필수로 둔 것이 이 스키마의 핵심이다.
 * 기술 이름만 나열한 기술 스택은 누구나 쓸 수 있어서 변별력이 없다.
 * 그 기술로 무엇을 했는지 한 줄이라도 없으면 빌드를 실패시킨다.
 */
const skills = defineCollection({
  loader: file('src/content/skills/skills.yaml'),
  schema: z.object({
    /** 메인에 표시할 순서 (01, 02, ...) */
    order: z.number().int().positive(),
    title: z.string().min(1),
    /** 기술 이름 태그 */
    items: z.array(z.string().min(1)).min(1),
    /** 그 기술로 실제 한 일. 최소 한 줄은 반드시 있어야 한다. */
    highlights: z.array(z.string().min(1)).min(1),
  }),
});

export const collections = { profile, skills };
