import { defineCollection } from 'astro:content';
import type { SchemaContext } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

/** defineCollection의 schema 함수가 넘겨주는 image 헬퍼 */
type ImageFn = SchemaContext['image'];

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
  /**
   * 발급·주관 기관 (예: 한국산업인력공단).
   *
   * 학력에는 없다. '염광고등학교 졸업'처럼 학교명이 곧 항목명이라
   * 기관을 따로 적으면 같은 이름이 두 번 나온다.
   * 교육·자격과 달리 학력만 구조가 다른 것이지, 품질 기준을 낮춘 게 아니다.
   */
  organization: z.string().min(1).optional(),
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
  schema: ({ image }) => z.object({
    name: z.string().min(1),
    /** 프로필 사진. image()를 쓰면 빌드 때 WebP 변환·리사이즈를 astro가 처리한다. */
    photo: image(),
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

/**
 * 프로젝트. 지금은 **사이드바 내비게이션에 필요한 최소 정보만** 담는다.
 *
 * 상세 페이지용 스키마(기술 스택 표·의사결정 비교·수치 개선 등)는 아직 짜지 않았다.
 * 기술 문서를 뱀서라이크 것 하나만 받아서, 그것만 보고 구조를 확정하면
 * 다른 프로젝트를 넣을 때 반드시 깨진다. 문서를 더 받은 뒤에 공통 구조를 뽑는다.
 *
 * YAML의 키가 그대로 주소가 된다. `bond` → `/projects/bond`
 */
const projects = defineCollection({
  loader: file('src/content/projects/projects.yaml'),
  schema: z.object({
    /** 사이드바 표시 순서. 대표 프로젝트는 이 번호가 화면에 01, 02로 찍힌다. */
    order: z.number().int().positive(),
    title: z.string().min(1),
    /** 장르 한 줄 (예: 탑뷰 핵 앤 슬래시) */
    genre: z.string().min(1),
    /** 대표 프로젝트인지. false면 '그외 프로젝트'로 내려간다. */
    featured: z.boolean(),
    /** 팀 프로젝트일 때만 적는다. 1인 프로젝트는 생략한다 — 목록에서 노이즈가 된다. */
    team: z.string().min(1).optional(),
  }),
});

/** 문단 묶음. 빈 문단이나 빈 배열을 막는다. */
const paragraphs = z.array(z.string().min(1)).min(1);

/* ============================================================================
 * 기술 문서 블록
 *
 * 기술 문서 두 개(뱀서라이크·Bond)를 비교해 반복되는 표현을 추린 것이다.
 * 페이지마다 마크업을 손으로 짜면 파이프라인이 아니라 수작업이 된다.
 * 새 프로젝트는 여기 있는 블록을 조합해 콘텐츠 파일로만 쓴다.
 *
 * 블록이 부족하면 그때 새 종류를 추가한다. 다만 추가는 신중해야 한다.
 * 블록이 늘수록 프로젝트마다 다른 모양이 나오고, 그게 '일정한 퀄리티'를 깎는다.
 * ========================================================================== */

/** 서술 문단 */
const proseBlock = z.object({
  type: z.literal('prose'),
  paragraphs,
});

/**
 * 코드 + 설명.
 *
 * 가이드 ③ 핵심 기능: "1000줄 다 보여주면 최악. '아하!'가 오는 핵심 50줄만 선별",
 * "어떤 함수를 호출하고 무엇을 입력하면 무엇이 나오는지".
 * 그래서 사용법(api)과 왜 이렇게 짰는지(notes)를 코드와 함께 묶는다.
 */
const codeBlock = z.object({
  type: z.literal('code'),
  /** 호출부 한 줄. 예: InventoryManager.Instance.UseItem(slot) */
  api: z.string().min(1),
  lang: z.string().default('csharp'),
  code: z.string().min(1),
  /** 이 코드의 어느 지점이 왜 그렇게 되어 있는지. 코드만 붙이는 것을 막는다. */
  notes: z.array(z.object({
    at: z.string().min(1),
    why: z.string().min(1),
  })).min(1),
});

/** 제목 + 설명 카드 여러 개. 두 문서 모두 3~4개씩 늘어놓는다. */
const pointsBlock = z.object({
  type: z.literal('points'),
  items: z.array(z.object({
    title: z.string().min(1),
    body: z.string().min(1),
  })).min(2),
});

/** 기술 스택 표. 두 문서가 분류·기술·사용 목적 3열로 완전히 같다. */
const stackTableBlock = z.object({
  type: z.literal('stack-table'),
  rows: z.array(z.object({
    category: z.string().min(1),
    tech: z.string().min(1),
    /** 왜 썼는지. 기술 이름만 적는 것을 막는다. */
    purpose: z.string().min(1),
  })).min(1),
});

/**
 * 일반 표. 기술 스택 말고 다른 표(예: 뱀서라이크의 무기별 스킬 표)에 쓴다.
 * stack-table과 합치지 않은 이유는 그쪽의 '사용 목적 필수' 검사를 잃지 않기 위해서다.
 */
const tableBlock = z.object({
  type: z.literal('table'),
  headers: z.array(z.string().min(1)).min(2),
  rows: z.array(z.array(z.string()).min(2)).min(1),
});

/** 표의 열 개수가 헤더와 맞는지. decision과 같은 이유로 문서 단위에서 검사한다. */
function checkTable(block: z.infer<typeof tableBlock>, where: string, ctx: z.RefinementCtx): void {
  const bad = block.rows.filter((r) => r.length !== block.headers.length);
  if (bad.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${where}: 열 개수가 헤더(${block.headers.length}개)와 다른 행이 ${bad.length}개 있습니다.`,
    });
  }
}

/**
 * 계층도. 뱀서라이크 '시스템 구조'와 Bond 'DI 스코프 계층'이 같은 모양이다.
 *
 * 가이드 ②: 시스템 구조는 구성요소·관계·흐름 셋을 모두 설명해야 한다.
 * "코드를 한 줄도 안 보여주고도 독자가 전체 동작을 이해하게 만드는 섹션"이므로
 * 그림만 있고 셋 중 하나라도 없으면 독자는 그림을 해석하지 못한다.
 * Bond 문서는 이미 세 항목을 나란히 적고 있다. 그 습관을 규칙으로 만든다.
 */
const layersBlock = z.object({
  type: z.literal('layers'),
  /** 무엇으로 이루어졌나 */
  components: z.string().min(1),
  /** 누가 누구를 알고·제어하나 */
  relations: z.string().min(1),
  /** 입력이 어떤 순서로 결과가 되나 */
  flow: z.string().min(1),
  layers: z.array(z.object({
    name: z.string().min(1),
    note: z.string().optional(),
    /** 계층에서 이 계층으로 내려올 때 붙는 라벨 (예: INJECT · REGISTER) */
    edge: z.string().optional(),
    items: z.array(z.object({
      name: z.string().min(1),
      note: z.string().optional(),
      /** 이 문서에서 설명하려는 핵심 객체 하나를 강조한다 */
      emphasis: z.boolean().default(false),
    })).min(1),
  })).min(2),
});

/**
 * 의사결정. 이 포트폴리오에서 가장 값어치 있는 블록이다.
 *
 * 무엇을 만들었는지는 누구나 적지만, 왜 그 방식을 골랐는지는 대부분 못 적는다.
 * 원본 PDF에서는 이 내용이 72ppi 이미지에 묻혀 검색도 복사도 안 됐다.
 */
/**
 * 의사결정 하나.
 *
 * 본문 블록이 아니라 최상위 `decisions` 배열의 원소다.
 * 블록 유니온에서 빠졌으므로 `type` 판별자가 필요 없다.
 */
const decisionBlock = z.object({
  /** 무엇을 두고 고민했는지. 예: 전투 처리 — 직접 호출 vs 이벤트 큐 */
  title: z.string().min(1),
  options: z.array(z.object({
    /** A · B · C */
    key: z.string().min(1),
    title: z.string().min(1),
    chosen: z.boolean().default(false),
  })).min(2),
  /**
   * 기준별 비교. 선택지를 같은 잣대로 재야 비교가 된다.
   * values의 순서와 개수는 options와 정확히 맞아야 한다.
   */
  criteria: z.array(z.object({
    label: z.string().min(1),
    values: z.array(z.string().min(1)).min(2),
  })).min(1),
  /** 왜 그것을 골랐는지. 선택지만 늘어놓고 끝내면 판단이 아니라 조사다. */
  reason: z.string().min(1),
});

/**
 * 의사결정 블록 검증.
 *
 * 이 검사를 블록 자체에 superRefine으로 달면 ZodEffects가 되어
 * discriminatedUnion에 못 들어간다. 그렇다고 의사결정을 본문 밖으로 빼면
 * 원본이 지키던 맥락(고민 → 바로 다음 장에서 그 구현)이 끊긴다.
 * 문법 제약 때문에 구조를 왜곡하지 않도록, 검사만 문서 단위로 올린다.
 */
function checkDecision(block: z.infer<typeof decisionBlock>, where: string, ctx: z.RefinementCtx): void {
  const chosen = block.options.filter((o) => o.chosen === true);
  if (chosen.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${where}: 선택지 중 정확히 하나만 chosen: true 여야 합니다 (현재 ${chosen.length}개).`,
    });
  }
  // 기준마다 모든 선택지를 재지 않으면 표에 빈칸이 생기고, 빈칸은 비교가 아니다.
  const ragged = block.criteria.filter((c) => c.values.length !== block.options.length);
  if (ragged.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${where}: 기준 [${ragged.map((c) => c.label).join(', ')}]의 값 개수가 선택지 수(${block.options.length}개)와 다릅니다. 모든 선택지를 같은 잣대로 재야 합니다.`,
    });
  }
}

/** 수치 개선. 뱀서라이크의 196 → 4 (97% 감소) 형태. */
const metricsBlock = z.object({
  type: z.literal('metrics'),
  items: z.array(z.object({
    label: z.string().min(1),
    before: z.string().min(1),
    after: z.string().min(1),
    /** 예: 97% 감소 */
    delta: z.string().min(1),
  })).min(1),
});

/** 전후 비교. Bond 회고의 '과거 팀 프로젝트 / 현재 팀 프로젝트'. */
const beforeAfterBlock = z.object({
  type: z.literal('before-after'),
  before: z.object({ label: z.string().min(1), items: z.array(z.string().min(1)).min(1) }),
  after: z.object({ label: z.string().min(1), items: z.array(z.string().min(1)).min(1) }),
  /** 그래서 무엇을 알게 됐는지 */
  lesson: z.string().min(1),
});

/**
 * 자기소개서.
 *
 * 프로젝트와 달리 **하나뿐인 글**이라 반복 구조를 만들지 않았다.
 * 원본 자기소개서의 네 꼭지를 그대로 필드로 두는 것이 정직하다.
 * 꼭지가 늘어날 일이 생기면 그때 구조를 바꾼다.
 */
const about = defineCollection({
  loader: glob({ pattern: 'about.yaml', base: './src/content/about' }),
  schema: z.object({
    growth: z.object({
      title: z.string().min(1),
      paragraphs,
    }),
    personality: z.object({
      title: z.string().min(1),
      strength: z.object({ label: z.string().min(1), paragraphs }),
      weakness: z.object({ label: z.string().min(1), paragraphs }),
    }),
    teamwork: z.object({
      title: z.string().min(1),
      episodes: z.array(z.object({
        heading: z.string().min(1),
        paragraphs,
        /**
         * 이 필수 지정이 이 스키마의 핵심이다.
         *
         * 원본 자기소개서는 경험을 적을 때마다 '이후 팀프로젝트에서 무엇을 바꿨는지'를
         * 반드시 뒤에 붙인다. 실수만 적고 끝내면 반성문이지 자기소개서가 아니다.
         * 이미 지키고 계신 규칙이므로 코드로 못박는다.
         */
        improvement: z.object({
          title: z.string().min(1),
          paragraphs,
        }),
      })).min(1),
    }),
    goals: z.object({
      title: z.string().min(1),
      short: z.object({ heading: z.string().min(1), paragraphs }),
      long: z.object({ heading: z.string().min(1), paragraphs }),
    }),
  }),
});

/**
 * 기술 문서 안에 놓을 수 있는 모든 블록.
 *
 * image()는 스키마 함수가 넘겨주는 헬퍼라서 밖에서 못 만든다.
 * 그래서 유니온 전체를 팩토리로 감쌌다.
 */
function makeDocBlock(image: ImageFn) {
  /**
   * 스크린샷. 캡션을 필수로 둔 것이 요점이다.
   * 무엇을 보라는 건지 말해주지 않는 이미지는 증거가 아니라 장식이다.
   */
  const imageBlock = z.object({
    type: z.literal('image'),
    src: image(),
    caption: z.string().min(1),
    /** 이미지 위에 붙는 라벨 (예: SCREENSHOT · PROFILER) */
    label: z.string().min(1).default('SCREENSHOT'),
  });

  return z.discriminatedUnion('type', [
    proseBlock,
    codeBlock,
    pointsBlock,
    stackTableBlock,
    tableBlock,
    layersBlock,
    metricsBlock,
    beforeAfterBlock,
    imageBlock,
    mermaidBlock,
  ]);
}

/**
 * Mermaid 다이어그램. 빌드 시점에 SVG로 구워진다.
 *
 * 관계가 많아 손으로 그리면 품이 드는 것(클래스·시퀀스·상태·플로우)에만 쓴다.
 * 계층도처럼 '무엇을 강조할지 사람이 정한' 편집된 그림은 layers 블록을 쓴다.
 * 자동 배치는 강조를 못 하기 때문이다.
 */
const mermaidBlock = z.object({
  type: z.literal('mermaid'),
  /**
   * 이 그림이 무슨 질문에 답하는지.
   *
   * 가이드 Part 4: "같은 시스템도 5가지 각도로 볼 수 있습니다. 다 그리지 말고,
   * 내가 설명하려는 질문에 맞는 1~2개를 고르세요."
   * 질문을 못 적겠다면 그 그림은 넣을 이유가 없는 그림이다.
   */
  question: z.string().min(1),
  /** ```mermaid 블록 안에 넣던 그 텍스트 */
  source: z.string().min(1),
});


/**
 * 꼭지 하나 — 원본 디자인의 소제목 한 덩어리.
 * ②·③ 어디서나 같은 모양이라 함수로 뽑았다. image()가 필요해 팩토리다.
 */
function partSchema(image: ImageFn) {
  return z.object({
    title: z.string().min(1),
    /** 제목 아래 한 줄 설명. 두 디자인 모두 거의 모든 꼭지에 달고 있다. */
    lede: z.string().optional(),
    blocks: z.array(makeDocBlock(image)).min(1),
  });
}

/**
 * 프로젝트 기술 문서.
 *
 * 파일 이름이 곧 주소이자 projects.yaml의 키와 이어진다.
 * `vampire-like.yaml` → `/projects/vampire-like`
 *
 * 원본 PDF의 구조를 그대로 옮겼다. 섹션(01 프로젝트 개요) 안에 여러 꼭지가 있고,
 * 꼭지마다 제목 · 한 줄 설명 · 본문 블록이 온다.
 */
const projectDocs = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/docs' }),
  schema: ({ image }) => z.object({
    /** 표지의 부제 (예: 탑뷰 핵 앤 슬래시) */
    subtitle: z.string().min(1),

    /**
     * ① 개요 — 가이드 Part 2의 첫 단계.
     *
     * "문서를 읽는 사람은 배경지식이 없습니다. 개요는 그 정보 비대칭을 해소하고
     * 독자를 '같은 출발선'에 세웁니다. 결론부터 제시해 10초 안에 핵심이 잡혀야 합니다."
     *
     * 네 항목을 따로 받는 이유는, 한 문단으로 뭉치면 what만 쓰고 why를 빠뜨리기 때문이다.
     * 가이드의 아쉬운 예가 정확히 그것이다 — "인벤토리 시스템을 만들었습니다"(왜 만들었나?).
     */
    overview: z.object({
      /** 지도 — 이 문서가 다루는 것 */
      what: z.string().min(1),
      /** 나침반 — 왜 이 문제를 풀었나 */
      why: z.string().min(1),
      /**
       * 증거 — 측정된 문제.
       * 가이드: "'느리다' 대신 '로딩 15초'처럼 측정 가능한 문제로."
       * 숫자 없는 문제 제기는 주관적 감상이라 근거가 되지 못한다.
       */
      evidence: z.string().min(1),
      /** 범위 — 이 문서가 다루지 않는 것까지 그어준다 */
      scope: z.string().min(1),
    }),

    /**
     * 개요 상단에 걸리는 대표 화면.
     *
     * 포트폴리오는 '실물로 증명'하는 문서다(가이드 Part 1). 무엇을 만들었는지
     * 글로만 설명하고 화면을 안 보여주면 읽는 사람이 상상해야 한다.
     * 캡션까지 필수로 둔 이유는 imageBlock과 같다 — 무엇을 보라는 건지 없으면 장식이다.
     */
    screenshot: z.object({
      src: image(),
      caption: z.string().min(1),
    }),

    /**
     * 개발 메타. 전부 필수다.
     * 포트폴리오 PDF는 6개 프로젝트에 예외 없이 이 다섯 항목을 적고 있다.
     * 인원과 기간을 안 밝힌 프로젝트는 규모를 가늠할 수 없어 신뢰를 못 준다.
     */
    meta: z.object({
      team: z.string().min(1),
      period: z.string().min(1),
      vcs: z.string().min(1),
      engine: z.string().min(1),
      ide: z.string().min(1),
    }),

    /** 유튜브·깃허브 등. 확인된 주소가 없으면 넣지 않는다. */
    links: z.array(z.object({
      label: z.string().min(1),
      url: z.string().url(),
    })).default([]),

    /**
     * ② 시스템 구조 — 가이드 Part 2의 두 번째 단계. 문서마다 정확히 하나다.
     *
     * "코드를 한 줄도 안 보여주고도 독자가 전체 동작을 이해하게 만드는 섹션."
     * 두 디자인(뱀서라이크 '전체 시스템 구조' · Bond '시스템 구조') 모두 두 번째에 딱 하나 있다.
     */
    architecture: z.object({
      title: z.string().default('시스템 구조'),
      parts: z.array(partSchema(image)).min(1),
    }),

    /**
     * ③ 핵심 기능 — 가이드 Part 2의 세 번째 단계.
     *
     * **배열인 것이 요점이다.** 뱀서라이크는 '핵심 기능' 한 덩어리로 끝나지만,
     * Bond는 기간이 길고 규모가 커서 하나에 담기지 않아 넷으로 나눴다
     * (AI 활용 개발 · 절차적 맵 생성 · 전투 · 연출·이펙트).
     * 즉 가운데가 자유로운 게 아니라, 같은 ③ 단계를 프로젝트 크기에 따라 쪼갠 것이다.
     *
     * 문서 두 개를 나란히 놓고서야 보인 구조다. 하나만 봤을 때는 '가운데는 자유'로 잘못 잡았다.
     */
    features: z.array(z.object({
      title: z.string().min(1),
      parts: z.array(partSchema(image)).min(1),
      /**
       * ④ 고민과 선택 — 이 기능을 만들며 내린 판단.
       *
       * Bond는 결정을 해당 기능 섹션 안에 둔다
       * ('절차적 맵 생성'의 씬 경계 데이터 전달 방식, '연출·이펙트'의 이팩트 재생 방식).
       */
      decisions: z.array(decisionBlock).default([]),
    })).min(1),

    /**
     * ④ 고민과 선택 — 독립 섹션으로 모아 보여줄 때.
     *
     * 뱀서라이크는 핵심 기능이 한 덩어리라 결정 두 개를 '04 고민과 선택'으로 뽑아놨다.
     * 기능별로 흩을지 한데 모을지는 프로젝트 크기가 정한다. 둘 다 허용한다.
     *
     * 다만 **문서 전체에 결정이 하나도 없으면 빌드가 깨진다** (아래 superRefine).
     * 가이드: "'그냥'은 금지어. 신입에게 기대하는 건 기술력이 아니라 사고 과정 —
     * 면접관이 가장 보고 싶어 하는 부분." Coder와 Developer를 가르는 지점이다.
     */
    decisions: z.array(decisionBlock).default([]),

    /**
     * ⑤ 결과·회고 — 가이드 Part 2의 마지막 단계.
     *
     * "'다 만들었다'는 선언이 아닙니다. 개요에서 세운 목표(Why)가 달성됐는지
     * 데이터로 보이고, 배운 점을 다음 사람이 쓸 수 있게 남깁니다."
     *
     * debt와 plan을 필수로 둔 것이 이 스키마에서 가장 중요한 판단이다.
     * 가이드: "'아쉬운 점 없습니다'는 0점. 기술 부채를 인지하고 개선을 제시하는 사람이
     * 성장 가능성을 인정받습니다."
     */
    retrospective: z.object({
      /** 목표 달성 여부를 데이터로. 가이드: "'빨라졌다'가 아니라 '15초가 3초가 됐다'" */
      results: z.array(z.string().min(1)).min(1),
      /** 무엇이 문제였고 원인이 무엇이었나 */
      troubleshooting: z.array(z.object({
        problem: z.string().min(1),
        cause: z.string().min(1),
        fix: z.string().min(1),
        lesson: z.string().min(1),
      })).default([]),
      /** 남은 기술 부채. 비워둘 수 없다. */
      debt: z.array(z.string().min(1)).min(1),
      /** 그래서 다음엔 어떻게 할 것인가. 부채만 적고 계획이 없으면 반쪽이다. */
      plan: z.array(z.string().min(1)).min(1),
    }),
  }).superRefine((doc, ctx) => {
    /*
     * 결정은 기능 안에 있어도 되고(Bond) 따로 모아도 된다(뱀서라이크).
     * 어디에 있든 **문서 전체에 하나도 없으면 안 된다.**
     * 가이드: "'그냥'은 금지어. 모든 선택엔 이유가 있어야 합니다."
     */
    const inFeatures = doc.features.flatMap((f) => f.decisions.map((d) => [f.title, d] as const));
    const standalone = doc.decisions.map((d) => ['고민과 선택', d] as const);
    const all = [...inFeatures, ...standalone];

    if (all.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '이 문서에 의사결정이 하나도 없습니다. features[].decisions 나 최상위 decisions 중 ' +
          '어디든 최소 하나는 있어야 합니다. 무엇을 만들었는지만 있고 왜 그렇게 했는지가 없는 ' +
          '문서는 판단을 보여주지 못합니다.',
      });
    }
    all.forEach(([where, d], i) => checkDecision(d, `${where} #${i + 1}`, ctx));

    /* 표의 열 개수 검사 — ②·③ 모든 꼭지를 훑는다 */
    const groups = [doc.architecture, ...doc.features];
    for (const g of groups) {
      for (const part of g.parts) {
        for (const block of part.blocks) {
          if (block.type === 'table') checkTable(block, `${g.title} › ${part.title}`, ctx);
        }
      }
    }
  }),
});

export const collections = { profile, skills, projects, about, projectDocs };
