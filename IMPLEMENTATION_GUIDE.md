# 정부지원사업 도우미 - 최종 개발 계획서 (Sonnet 구현용)

> **이 문서는 AI(Sonnet)가 처음부터 끝까지 따라 구현할 수 있도록 작성된 상세 구현 가이드입니다.**
> **기존 `C:/AI_Worker/coffee-roasting-tracker` 프로젝트의 패턴을 그대로 따릅니다.**

---

## 0. 프로젝트 배경 & 회의록 핵심 요약

정부지원사업 컨설턴트(김방주)와의 실제 상담 회의를 기반으로 설계.

### 회의에서 확인된 핵심 Pain Point:
- **복잡한 프로세스**: 기초사업/소기업형/고도화 등 단계별 사업, 각각 다른 예산·자격·서류
- **다수 부처 동시 진행**: 충북TP, 소상공인진흥공단, 중소벤처기업부, 도청/군청, 농어촌공사 등 — 부처가 다르면 중복 지원 가능
- **항상 12개+ 프로그램이 진행 중**: 4월 9일까지만 해도 12개 사업 동시 진행
- **서류 작성이 최대 허들**: 사업계획서, 견적서, 기술문서, 인프라 계획서 등
- **자부담 필요**: 기초사업 5000만원 중 자부담 2200만원, 전체 7200만원 규모
- **선정 후 관리**: 기초 6개월 구축 + 사후관리 3년
- **컨설턴트 없이 혼자 하기 거의 불가능**

### 이 앱이 해결할 것:
컨설턴트 역할을 AI 앱으로 대체. 소상공인이 혼자서도 지원사업을 찾고, 서류를 준비하고, 신청까지 할 수 있게 함.

---

## 1. 프로젝트 초기화 명령어

```bash
# 1. 프로젝트 생성
cd C:/AI_Worker
npx create-next-app@latest subsidy-finder --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"

# 2. 의존성 설치
cd subsidy-finder
npm install @supabase/supabase-js @supabase/ssr lucide-react date-fns

# 3. AI 관련 (Phase 2용이지만 미리 설치)
npm install ai @ai-sdk/anthropic

# 4. 확인
npm run dev
```

---

## 2. 환경 설정 파일들

### `.env.local` (Supabase 별도 프로젝트 필요)
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY
ANTHROPIC_API_KEY=YOUR_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `postcss.config.mjs`
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### `next.config.ts`
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

---

## 3. 파일 구조 (전체 트리)

```
subsidy-finder/
├── .env.local
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
├── public/
│   ├── icons/              # PWA 아이콘 (icon-192.png, icon-512.png)
│   ├── sw.js
│   └── manifest.json
├── supabase/
│   └── migrations/
│       ├── 001_core_schema.sql
│       └── 002_programs_and_matching.sql
└── src/
    ├── proxy.ts
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx                         # 랜딩 페이지 (비로그인)
    │   ├── (auth)/
    │   │   ├── layout.tsx                   # 인증 카드 레이아웃
    │   │   ├── login/page.tsx
    │   │   └── signup/page.tsx
    │   ├── auth/
    │   │   └── callback/route.ts
    │   └── (app)/
    │       ├── layout.tsx                   # Sidebar + auth guard
    │       ├── dashboard/page.tsx
    │       ├── profile/page.tsx             # 4단계 사업 프로필 위저드
    │       ├── programs/
    │       │   ├── page.tsx                 # 지원사업 검색/목록
    │       │   └── [id]/page.tsx            # 지원사업 상세
    │       ├── consultant/page.tsx          # AI 컨설턴트 채팅 (Phase 2)
    │       ├── documents/page.tsx           # 서류 체크리스트 (Phase 2)
    │       ├── applications/page.tsx        # 내 지원 관리 (Phase 2)
    │       └── notifications/page.tsx       # 알림 센터 (Phase 3)
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── ProfileProviderWrapper.tsx
    │   ├── NotificationBell.tsx
    │   └── ServiceWorkerRegistration.tsx
    ├── lib/
    │   ├── supabase.ts
    │   ├── supabase-browser.ts
    │   ├── supabase-server.ts
    │   ├── theme.tsx
    │   ├── profile-context.tsx
    │   ├── business-profile-context.tsx
    │   ├── constants.ts                    # 업종, 지역, 카테고리 상수
    │   └── matching-engine.ts              # 규칙 기반 매칭
    └── types/
        └── database.ts
```

---

## 4. Supabase 마이그레이션 (SQL Editor에서 순서대로 실행)

### `supabase/migrations/001_core_schema.sql`

```sql
-- =====================================================
-- 001_core_schema.sql
-- 정부지원사업 도우미 - 핵심 스키마
-- =====================================================

-- ─── 1. PROFILES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  phone              TEXT,
  is_premium         BOOLEAN NOT NULL DEFAULT false,
  onboarding_done    BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);


-- ─── 2. BUSINESS PROFILES ────────────────────────────
CREATE TABLE IF NOT EXISTS business_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 기본 정보
  business_name         TEXT NOT NULL,
  business_reg_number   TEXT,               -- 사업자등록번호
  representative_name   TEXT,               -- 대표자명
  -- 사업 분류
  business_type         TEXT NOT NULL,       -- 업태 (제조업, 서비스업 등)
  business_category     TEXT,               -- 업종 (세부)
  industry_code         TEXT,               -- 한국표준산업분류코드
  -- 지역
  region_sido           TEXT NOT NULL,       -- 시/도
  region_sigungu        TEXT,               -- 시/군/구
  -- 규모
  employee_count        INTEGER,
  annual_revenue        BIGINT,             -- 연매출 (원)
  establishment_date    DATE,               -- 설립일
  company_age_years     INTEGER,            -- 업력 (년)
  -- 인증
  is_venture            BOOLEAN DEFAULT false,  -- 벤처기업 인증
  is_innobiz            BOOLEAN DEFAULT false,  -- 이노비즈
  is_mainbiz            BOOLEAN DEFAULT false,  -- 메인비즈
  has_smart_factory     BOOLEAN DEFAULT false,  -- 스마트공장 보유
  smart_factory_level   TEXT,               -- 기초/고도화
  -- 목표와 현황
  current_challenges    TEXT[] DEFAULT '{}',     -- 현재 어려움
  goals                 TEXT[] DEFAULT '{}',     -- 목표
  previous_subsidies    JSONB DEFAULT '[]',     -- 기존 수혜 이력 [{name, year, amount}]
  notes                 TEXT,
  -- 타임스탬프
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_business_profiles_user ON business_profiles(user_id);

DROP POLICY IF EXISTS "bp_select" ON business_profiles;
DROP POLICY IF EXISTS "bp_insert" ON business_profiles;
DROP POLICY IF EXISTS "bp_update" ON business_profiles;
DROP POLICY IF EXISTS "bp_delete" ON business_profiles;
CREATE POLICY "bp_select" ON business_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bp_insert" ON business_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bp_update" ON business_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bp_delete" ON business_profiles FOR DELETE USING (auth.uid() = user_id);
```

### `supabase/migrations/002_programs_and_matching.sql`

```sql
-- =====================================================
-- 002_programs_and_matching.sql
-- 지원사업 프로그램 + 매칭 결과
-- =====================================================

-- ─── 1. PROGRAMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id          TEXT UNIQUE,            -- 외부 API ID (중복방지)
  source               TEXT NOT NULL DEFAULT 'manual',  -- manual/bizinfo/data_go_kr
  -- 기본 정보
  title                TEXT NOT NULL,
  managing_org         TEXT,                   -- 소관기관 (중소벤처기업부 등)
  implementing_org     TEXT,                   -- 수행기관
  -- 분류
  category             TEXT NOT NULL,          -- 금융/기술/인력/수출/내수/창업/경영/기타
  subcategory          TEXT,
  support_type         TEXT,                   -- 보조금/융자/매칭/현물/세제
  -- 대상
  target_industries    TEXT[] DEFAULT '{}',    -- 대상 업종
  target_regions       TEXT[] DEFAULT '{}',    -- 대상 지역
  target_company_size  TEXT[] DEFAULT '{}',    -- 소기업/중기업/소상공인
  min_employee_count   INTEGER,
  max_employee_count   INTEGER,
  min_revenue          BIGINT,
  max_revenue          BIGINT,
  min_company_age      INTEGER,               -- 최소 업력 (년)
  max_company_age      INTEGER,
  -- 금액
  funding_amount_min   BIGINT,                -- 지원금 최소
  funding_amount_max   BIGINT,                -- 지원금 최대
  self_funding_ratio   INTEGER,               -- 자부담 비율 (%)
  -- 일정
  application_start    DATE,
  application_end      DATE,
  status               TEXT DEFAULT 'open',    -- open/closed/upcoming
  -- 상세
  description          TEXT,
  eligibility_summary  TEXT,                   -- 자격 요건 요약
  required_documents   TEXT[] DEFAULT '{}',    -- 필요 서류 목록
  detail_url           TEXT,                   -- 원문 링크
  raw_data             JSONB,                  -- 원본 API 데이터 보관
  is_featured          BOOLEAN DEFAULT false,
  -- 타임스탬프
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 읽기 가능
CREATE POLICY "programs_select" ON programs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_programs_category ON programs(category);
CREATE INDEX idx_programs_end ON programs(application_end);
CREATE INDEX idx_programs_regions ON programs USING GIN(target_regions);
CREATE INDEX idx_programs_industries ON programs USING GIN(target_industries);


-- ─── 2. USER PROGRAM MATCHES ─────────────────────────
CREATE TABLE IF NOT EXISTS user_program_matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  match_score      INTEGER NOT NULL,         -- 0-100
  match_reasons    TEXT[] DEFAULT '{}',      -- 매칭 이유
  mismatch_reasons TEXT[] DEFAULT '{}',      -- 불일치 이유
  is_bookmarked    BOOLEAN DEFAULT false,
  is_dismissed     BOOLEAN DEFAULT false,
  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE user_program_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select" ON user_program_matches;
DROP POLICY IF EXISTS "matches_insert" ON user_program_matches;
DROP POLICY IF EXISTS "matches_update" ON user_program_matches;
DROP POLICY IF EXISTS "matches_delete" ON user_program_matches;
CREATE POLICY "matches_select" ON user_program_matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "matches_insert" ON user_program_matches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "matches_update" ON user_program_matches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "matches_delete" ON user_program_matches FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_matches_user ON user_program_matches(user_id);
CREATE INDEX idx_matches_score ON user_program_matches(match_score DESC);
```

---

## 5. TypeScript 타입 정의

### `src/types/database.ts`

```ts
// ─── Profile ────────────────────────────────────
export interface Profile {
  id: string;
  display_name: string | null;
  phone: string | null;
  is_premium: boolean;
  onboarding_done: boolean;
  created_at: string;
}

// ─── Business Profile ───────────────────────────
export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_reg_number: string | null;
  representative_name: string | null;
  business_type: string;
  business_category: string | null;
  industry_code: string | null;
  region_sido: string;
  region_sigungu: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  establishment_date: string | null;
  company_age_years: number | null;
  is_venture: boolean;
  is_innobiz: boolean;
  is_mainbiz: boolean;
  has_smart_factory: boolean;
  smart_factory_level: string | null;
  current_challenges: string[];
  goals: string[];
  previous_subsidies: PreviousSubsidy[];
  notes: string | null;
  updated_at: string;
  created_at: string;
}

export interface PreviousSubsidy {
  name: string;
  year: number;
  amount: number;
}

// ─── Program ────────────────────────────────────
export interface Program {
  id: string;
  external_id: string | null;
  source: string;
  title: string;
  managing_org: string | null;
  implementing_org: string | null;
  category: string;
  subcategory: string | null;
  support_type: string | null;
  target_industries: string[];
  target_regions: string[];
  target_company_size: string[];
  min_employee_count: number | null;
  max_employee_count: number | null;
  min_revenue: number | null;
  max_revenue: number | null;
  min_company_age: number | null;
  max_company_age: number | null;
  funding_amount_min: number | null;
  funding_amount_max: number | null;
  self_funding_ratio: number | null;
  application_start: string | null;
  application_end: string | null;
  status: string;
  description: string | null;
  eligibility_summary: string | null;
  required_documents: string[];
  detail_url: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Match ──────────────────────────────────────
export interface UserProgramMatch {
  id: string;
  user_id: string;
  program_id: string;
  match_score: number;
  match_reasons: string[];
  mismatch_reasons: string[];
  is_bookmarked: boolean;
  is_dismissed: boolean;
  calculated_at: string;
  // join용
  program?: Program;
}
```

---

## 6. 상수 정의

### `src/lib/constants.ts`

```ts
// ─── 시/도 ──────────────────────────────────────
export const REGIONS_SIDO = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시',
  '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
] as const;

// ─── 업태 (Business Type) ───────────────────────
export const BUSINESS_TYPES = [
  '제조업', '서비스업', '도소매업', '음식점업', '건설업',
  '운수업', '정보통신업', '농업·임업·어업', '숙박업',
  '교육서비스업', '보건·사회복지업', '예술·스포츠·여가',
  '전문·과학·기술서비스업', '기타',
] as const;

// ─── 지원사업 카테고리 ──────────────────────────
export const PROGRAM_CATEGORIES = [
  { value: '금융', label: '금융 지원', icon: 'Banknote', desc: '융자·보조금·투자' },
  { value: '기술', label: '기술 개발', icon: 'Cpu', desc: 'R&D·특허·기술이전' },
  { value: '인력', label: '인력 지원', icon: 'Users', desc: '채용·교육·인건비' },
  { value: '수출', label: '수출·해외', icon: 'Globe', desc: '수출바우처·해외진출' },
  { value: '내수', label: '내수·판로', icon: 'ShoppingBag', desc: '판로개척·마케팅' },
  { value: '창업', label: '창업 지원', icon: 'Rocket', desc: '창업자금·멘토링' },
  { value: '경영', label: '경영 혁신', icon: 'TrendingUp', desc: '컨설팅·스마트공장' },
  { value: '기타', label: '기타', icon: 'MoreHorizontal', desc: '그 외 지원' },
] as const;

// ─── 지원 유형 ──────────────────────────────────
export const SUPPORT_TYPES = [
  '보조금', '융자', '매칭', '현물지원', '세제감면', '바우처', '컨설팅',
] as const;

// ─── 기업 규모 ──────────────────────────────────
export const COMPANY_SIZES = [
  '소상공인', '소기업', '중기업', '중견기업', '예비창업자',
] as const;

// ─── 현재 어려움 (challenges) ───────────────────
export const CHALLENGE_OPTIONS = [
  '자금 부족', '인력 부족', '기술 개발', '판로 개척',
  '설비 투자', '수출 진출', '디지털 전환', '공장 이전/확장',
  '인증 획득', '마케팅', '경영 관리', '원자재 비용',
] as const;

// ─── 목표 (goals) ───────────────────────────────
export const GOAL_OPTIONS = [
  '설비 투자', '신제품 개발', '스마트공장 구축', '수출 시작',
  '온라인 판매 확대', '공장 증축/이전', '인력 채용',
  '기술 인증 획득', '프랜차이즈 확장', '디지털 전환',
  'AI/자동화 도입', '브랜딩/마케팅 강화',
] as const;
```

---

## 7. Supabase 클라이언트 (기존 패턴 그대로)

### `src/lib/supabase.ts`
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### `src/lib/supabase-browser.ts`
```ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let browserClient: ReturnType<typeof createSupabaseBrowser> | null = null;

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createSupabaseBrowser();
  }
  return browserClient;
}
```

### `src/lib/supabase-server.ts`
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component
          }
        },
      },
    }
  );
}
```

---

## 8. Proxy (Next.js 16 인증 미들웨어)

### `src/proxy.ts`
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/profile',
  '/programs',
  '/consultant',
  '/documents',
  '/applications',
  '/notifications',
  '/settings',
];

const AUTH_ONLY = ['/login', '/signup'];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_ONLY.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPage && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|sw\\.js|manifest\\.json).*)',
  ],
};
```

---

## 9. 글로벌 스타일 (Indigo/Blue 테마)

### `src/app/globals.css`
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --font-sans: var(--font-inter);

  /* Amber 포인트 컬러 유지 */
  --color-amber-50: #fffbeb;
  --color-amber-100: #fef3c7;
  --color-amber-200: #fde68a;
  --color-amber-300: #fcd34d;
  --color-amber-400: #fbbf24;
  --color-amber-500: #f59e0b;
  --color-amber-600: #d97706;

  /* Stone → Indigo/Slate 계열로 재정의 */
  --color-stone-50:  #f0f4ff;   /* 라이트 페이지 배경 */
  --color-stone-100: #e8eef8;   /* 서브 섹션 배경 */
  --color-stone-200: #d8e0ee;   /* 라이트 보더 */
  --color-stone-300: #d1d5db;   /* 중립 */
  --color-stone-400: #9ca3af;   /* muted text */
  --color-stone-500: #6b7280;   /* secondary text */
  --color-stone-600: #4b5563;   /* body text */
  --color-stone-700: #374151;   /* dark border */
  --color-stone-800: #1a2332;   /* 다크 hover */
  --color-stone-900: #0f172a;   /* 다크 카드 배경 (slate-900) */
  --color-stone-950: #070d1a;   /* 다크 바디 배경 */
}

body {
  font-family: var(--font-inter), 'Noto Sans KR', Arial, Helvetica, sans-serif;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #6b7280; }
.dark ::-webkit-scrollbar-thumb { background: #1a2332; }
.dark ::-webkit-scrollbar-thumb:hover { background: #2d3a4d; }
```

---

## 10. 레이아웃 구조

### `src/app/layout.tsx`
```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "지원사업 도우미 - 정부지원사업 AI 컨설턴트",
  description: "소상공인·중소기업을 위한 정부지원사업 찾기, 서류 준비, 신청까지 AI가 도와드립니다.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "지원사업도우미" },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#1e3a5f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} antialiased bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-50`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### `src/app/(auth)/layout.tsx`
Indigo 그라데이션 배경의 인증 카드 레이아웃.
- 배경: `from-indigo-950 via-indigo-900 to-slate-900`
- 카드: `bg-indigo-950/80 backdrop-blur-md border border-indigo-800/60`
- 아이콘: `Building2` (lucide) + "지원사업 도우미" 타이틀
- 포인트: `text-amber-400`, `bg-amber-500/20`

### `src/app/(app)/layout.tsx`
기존과 동일 패턴: SSR auth guard + Sidebar + ProfileProviderWrapper

---

## 11. 핵심 컴포넌트 설계

### Sidebar 네비게이션 항목
```ts
const navItems = [
  { href: '/dashboard',     label: '대시보드',       icon: Home },
  { href: '/programs',      label: '지원사업 찾기',  icon: Search },
  { href: '/profile',       label: '내 사업 프로필', icon: Building2 },
  { href: '/consultant',    label: 'AI 컨설턴트',    icon: MessageSquare },  // Phase 2
  { href: '/documents',     label: '서류 가이드',    icon: FileCheck },      // Phase 2
  { href: '/applications',  label: '지원 관리',      icon: ClipboardList },  // Phase 2
];
```
- Sidebar 색상: `bg-indigo-950`, `text-indigo-100`, active: `bg-indigo-700/40 text-indigo-200`
- 아이콘 active: `text-amber-400`

---

## 12. 매칭 엔진

### `src/lib/matching-engine.ts`

```ts
import type { BusinessProfile, Program, UserProgramMatch } from '@/types/database';

interface MatchResult {
  score: number;
  reasons: string[];
  mismatches: string[];
}

export function calculateMatch(profile: BusinessProfile, program: Program): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  const mismatches: string[] = [];

  // 1. 지역 매칭 (20점)
  if (program.target_regions.length === 0 || program.target_regions.includes('전국')) {
    score += 20;
    reasons.push('전국 대상 사업');
  } else if (program.target_regions.includes(profile.region_sido)) {
    score += 20;
    reasons.push(`${profile.region_sido} 지역 대상`);
  } else {
    mismatches.push(`대상 지역: ${program.target_regions.join(', ')}`);
  }

  // 2. 업종 매칭 (20점)
  if (program.target_industries.length === 0) {
    score += 20;
    reasons.push('업종 제한 없음');
  } else if (program.target_industries.includes(profile.business_type)) {
    score += 20;
    reasons.push(`${profile.business_type} 대상`);
  } else {
    mismatches.push(`대상 업종: ${program.target_industries.join(', ')}`);
  }

  // 3. 직원수 매칭 (15점)
  const emp = profile.employee_count;
  if (emp != null) {
    const minOk = program.min_employee_count == null || emp >= program.min_employee_count;
    const maxOk = program.max_employee_count == null || emp <= program.max_employee_count;
    if (minOk && maxOk) {
      score += 15;
      reasons.push(`직원수 ${emp}명 조건 충족`);
    } else {
      mismatches.push(`직원수 조건: ${program.min_employee_count ?? '무제한'}~${program.max_employee_count ?? '무제한'}명`);
    }
  } else {
    score += 7; // 미입력 시 절반
  }

  // 4. 매출 매칭 (15점)
  const rev = profile.annual_revenue;
  if (rev != null) {
    const minOk = program.min_revenue == null || rev >= program.min_revenue;
    const maxOk = program.max_revenue == null || rev <= program.max_revenue;
    if (minOk && maxOk) {
      score += 15;
      reasons.push('매출 조건 충족');
    } else {
      mismatches.push('매출 조건 미충족');
    }
  } else {
    score += 7;
  }

  // 5. 업력 매칭 (10점)
  const age = profile.company_age_years;
  if (age != null) {
    const minOk = program.min_company_age == null || age >= program.min_company_age;
    const maxOk = program.max_company_age == null || age <= program.max_company_age;
    if (minOk && maxOk) {
      score += 10;
      reasons.push(`업력 ${age}년 조건 충족`);
    } else {
      mismatches.push(`업력 조건: ${program.min_company_age ?? 0}~${program.max_company_age ?? '무제한'}년`);
    }
  } else {
    score += 5;
  }

  // 6. 인증 보너스 (10점)
  let certScore = 0;
  if (profile.is_venture) { certScore += 4; reasons.push('벤처기업 인증 보유'); }
  if (profile.is_innobiz) { certScore += 3; reasons.push('이노비즈 인증 보유'); }
  if (profile.is_mainbiz) { certScore += 3; reasons.push('메인비즈 인증 보유'); }
  score += Math.min(certScore, 10);

  // 7. 목표 일치 (10점)
  const categoryGoalMap: Record<string, string[]> = {
    '금융': ['설비 투자', '공장 증축/이전'],
    '기술': ['신제품 개발', '기술 인증 획득', 'AI/자동화 도입'],
    '인력': ['인력 채용'],
    '수출': ['수출 시작'],
    '내수': ['온라인 판매 확대', '브랜딩/마케팅 강화'],
    '창업': [],
    '경영': ['스마트공장 구축', '디지털 전환'],
  };
  const matchedGoals = categoryGoalMap[program.category]?.filter(g => profile.goals.includes(g)) ?? [];
  if (matchedGoals.length > 0) {
    score += 10;
    reasons.push(`목표 일치: ${matchedGoals.join(', ')}`);
  }

  return { score: Math.min(score, 100), reasons, mismatches };
}
```

---

## 13. 지원사업 시드 데이터 (20개)

### `src/lib/seed-programs.ts`

프로그램 배열로 실제 존재하는 정부지원사업 데이터를 큐레이션하여 제공.
각 항목에는 다음이 포함되어야 함:

```ts
export const SEED_PROGRAMS: Omit<Program, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    external_id: 'sf-basic-2026',
    source: 'manual',
    title: '스마트공장 기초 구축 지원사업',
    managing_org: '중소벤처기업부',
    implementing_org: '스마트제조혁신추진단',
    category: '경영',
    subcategory: '스마트공장',
    support_type: '보조금',
    target_industries: ['제조업'],
    target_regions: ['전국'],
    target_company_size: ['소기업', '소상공인'],
    min_employee_count: null,
    max_employee_count: 50,
    min_revenue: null,
    max_revenue: 10000000000, // 100억
    min_company_age: 1,
    max_company_age: null,
    funding_amount_min: 30000000,  // 3천만
    funding_amount_max: 50000000,  // 5천만
    self_funding_ratio: 30,
    application_start: '2026-03-01',
    application_end: '2026-04-09',
    status: 'open',
    description: '제조 중소기업의 스마트공장 기초 단계 구축을 지원합니다. MES, IoT 센서, 생산관리 시스템 등 도입 비용을 지원하며, 자부담 30%가 필요합니다.',
    eligibility_summary: '제조업 영위 중소기업, 직원 50인 이하, 매출 100억 이하, 업력 1년 이상',
    required_documents: ['사업계획서', '사업자등록증', '재무제표(최근 2년)', '견적서', '공장등록증', '4대보험 가입증명'],
    detail_url: 'https://www.smart-factory.kr',
    raw_data: null,
    is_featured: true,
    last_synced_at: null,
    status: 'open',
  },
  // ... 19개 더 (소상공인 긴급자금, 수출바우처, 기술개발, 청년고용장려금, 디지털전환 등)
];
```

**포함할 20개 프로그램 목록**:
1. 스마트공장 기초 구축 지원사업
2. 스마트공장 고도화 지원사업
3. 소상공인 정책자금 (직접대출)
4. 중소기업 긴급경영안정자금
5. 수출바우처 지원사업
6. 기술개발 R&D 지원사업 (중기부)
7. 청년고용장려금
8. 내일채움공제
9. 소공인 특화 지원사업
10. 지역특화산업 육성사업
11. 디지털 전환(스마트 서비스) 지원
12. 창업성장기술개발(TIPS)
13. 농식품 가공 시설 현대화
14. 전통시장 디지털 전환
15. 1인 창조기업 지원
16. 여성기업 육성자금
17. 사회적기업 육성 지원
18. 제조혁신 바우처
19. 탄소중립 설비전환 지원
20. 지역 산업단지 입주기업 지원

---

## 14. 주요 페이지별 구현 가이드

### 14-A. 대시보드 (`/dashboard`)

**레이아웃:**
```
┌──────────────────────────────────────────┐
│ 환영 메시지 + 프로필 완성도 프로그레스바     │
├──────────────────────────────────────────┤
│ [📊 매칭 사업 N개] [⏰ 마감임박 N개] [📋 진행중 N개] │ ← 3개 StatCard
├────────────────────┬─────────────────────┤
│ 🏆 추천 지원사업 Top5 │ 📅 마감 임박          │
│  - ProgramCard ×5  │  - 마감일 리스트       │
│                    │                     │
├────────────────────┴─────────────────────┤
│ 💡 오늘의 팁: "부처가 다르면 동시 지원 가능!" │
└──────────────────────────────────────────┘
```

**구현 포인트:**
- `supabase`에서 `business_profiles` 조회 → 없으면 "프로필을 먼저 작성하세요" 안내
- `user_program_matches` + `programs` JOIN 조회 (score DESC, LIMIT 5)
- 마감 임박: `application_end` 7일 이내
- StatCard는 `lucide-react` 아이콘 + 숫자 + 라벨

### 14-B. 사업 프로필 위저드 (`/profile`)

**4단계 위저드** (predictor 패턴 따라):

```
Step 0: 기본 정보
  - 사업체명 (text, 필수)
  - 사업자등록번호 (text)
  - 대표자명 (text)

Step 1: 사업 상세
  - 업태 (select, BUSINESS_TYPES)
  - 업종 (text)
  - 지역 - 시/도 (select, REGIONS_SIDO)
  - 지역 - 시/군/구 (text)

Step 2: 규모 & 재무
  - 직원수 (number)
  - 연매출 (number, 단위: 만원)
  - 설립일 (date)
  - 업력 (auto-calculate from 설립일)

Step 3: 인증 & 목표
  - 벤처기업 인증 (checkbox)
  - 이노비즈 인증 (checkbox)
  - 메인비즈 인증 (checkbox)
  - 스마트공장 보유 (checkbox) + 수준 (select)
  - 현재 어려움 (multi-select chips, CHALLENGE_OPTIONS)
  - 목표 (multi-select chips, GOAL_OPTIONS)
  - → 완료 시 onboarding_done = true 업데이트
```

**위저드 상단 스텝 인디케이터:**
```tsx
// 스텝별 원형 번호 + 연결선
{steps.map((label, i) => (
  <div key={i} className="flex items-center">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
      ${i <= currentStep ? 'bg-indigo-600 text-white' : 'bg-stone-200 text-stone-500'}`}>
      {i + 1}
    </div>
    {i < steps.length - 1 && <div className={`w-12 h-0.5 ${i < currentStep ? 'bg-indigo-600' : 'bg-stone-200'}`} />}
  </div>
))}
```

### 14-C. 지원사업 검색 (`/programs`)

**필터 바:**
- 카테고리 (PROGRAM_CATEGORIES chips)
- 지역 (select)
- 지원유형 (SUPPORT_TYPES chips)
- 상태 (전체/모집중/마감/예정)
- 텍스트 검색 (title ILIKE)

**프로그램 카드 (ProgramCard):**
```
┌─────────────────────────────────────────┐
│ [경영] 스마트공장 기초 구축 지원사업      │ ← category badge + title
│ 중소벤처기업부 · 모집중                   │ ← org + status badge
│                                         │
│ 💰 3,000~5,000만원  📅 ~2026.04.09      │ ← funding + deadline
│ 🏢 제조업  📍 전국  👥 50인 이하          │ ← tags
│                                         │
│ [매칭 85점 ████████░░]  [상세보기 →]      │ ← match score + link
└─────────────────────────────────────────┘
```

### 14-D. 지원사업 상세 (`/programs/[id]`)

**섹션:**
1. 헤더 (제목, 기관, 상태배지, 마감일 카운트다운)
2. 매칭 분석 (점수, 매칭 이유, 불일치 이유 — 빨강/초록 리스트)
3. 지원 개요 (금액, 자부담, 대상, 기간)
4. 상세 설명 (description)
5. 자격 요건 (eligibility_summary)
6. 필요 서류 체크리스트 (required_documents → 체크박스)
7. 액션 버튼: "지원 준비 시작" / "북마크" / "원문 보기(외부링크)"

---

## 15. Phase 2 구현 가이드 (AI 컨설턴트)

### AI 채팅 (`/consultant`)

**Vercel AI SDK 사용:**

`src/app/api/chat/route.ts`:
```ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createSupabaseServer } from '@/lib/supabase-server';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { messages } = await req.json();

  // 사업 프로필 로드
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // 매칭 프로그램 로드
  const { data: matches } = await supabase
    .from('user_program_matches')
    .select('*, program:programs(*)')
    .eq('user_id', user.id)
    .order('match_score', { ascending: false })
    .limit(10);

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: buildSystemPrompt(profile, matches?.map(m => m.program) ?? []),
    messages,
  });

  return result.toDataStreamResponse();
}
```

**클라이언트 (`/consultant/page.tsx`):**
```tsx
'use client';
import { useChat } from 'ai/react';

export default function ConsultantPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });
  // 채팅 UI 렌더링
}
```

### 시스템 프롬프트 (`src/lib/ai/system-prompt.ts`)

```ts
export function buildSystemPrompt(profile: any, programs: any[]): string {
  return `
당신은 "정부지원사업 도우미" AI 컨설턴트입니다.
한국 중소기업/소상공인의 정부지원사업 신청을 전문적으로 돕습니다.

## 핵심 역할
1. 정부 지원사업을 쉽고 친절하게 설명
2. 복잡한 행정 용어를 일반인이 이해할 수 있게 풀어줌
3. 사업주 상황에 맞는 맞춤 조언 제공
4. 서류 작성 가이드 제공
5. 여러 사업에 동시 지원하는 전략 안내

## 중요 규칙
- 존댓말 사용
- 확실하지 않은 정보는 "확인이 필요합니다"로 표현
- 전문 용어 사용 시 괄호 안에 쉬운 설명 추가
- 구체적 액션 아이템 제시
- 부처가 다르면 중복 지원 가능하다는 점 안내

## 사용자 사업 정보
${profile ? `
- 사업체명: ${profile.business_name}
- 업태/업종: ${profile.business_type} / ${profile.business_category || '미입력'}
- 지역: ${profile.region_sido} ${profile.region_sigungu || ''}
- 직원수: ${profile.employee_count || '미입력'}명
- 연매출: ${profile.annual_revenue ? (profile.annual_revenue / 10000).toLocaleString() + '만원' : '미입력'}
- 업력: ${profile.company_age_years || '미입력'}년
- 인증: ${[profile.is_venture && '벤처', profile.is_innobiz && '이노비즈', profile.is_mainbiz && '메인비즈'].filter(Boolean).join(', ') || '없음'}
- 현재 어려움: ${profile.current_challenges?.join(', ') || '미입력'}
- 목표: ${profile.goals?.join(', ') || '미입력'}
` : '(프로필 미작성)'}

## 매칭된 지원사업
${programs.length > 0 ? programs.map((p: any, i: number) =>
  `${i + 1}. ${p.title} (${p.managing_org}, ${p.support_type}, ${p.application_end ? '마감: ' + p.application_end : '상시'})`
).join('\n') : '(매칭된 사업 없음)'}
`.trim();
}
```

---

## 16. 개발 순서 체크리스트

### Phase 1 (즉시 구현)
- [ ] `npx create-next-app` → 프로젝트 생성
- [ ] `.env.local` 설정 (새 Supabase 프로젝트 필요)
- [ ] `globals.css` Indigo 테마 적용
- [ ] `src/lib/supabase.ts`, `supabase-browser.ts`, `supabase-server.ts`
- [ ] `src/lib/theme.tsx` (ThemeProvider)
- [ ] `src/proxy.ts`
- [ ] `src/types/database.ts`
- [ ] `src/lib/constants.ts`
- [ ] Supabase에 001_core_schema.sql 실행
- [ ] Supabase에 002_programs_and_matching.sql 실행
- [ ] `src/app/layout.tsx` (Root)
- [ ] `src/app/(auth)/layout.tsx` (인증)
- [ ] `src/app/(auth)/login/page.tsx`
- [ ] `src/app/(auth)/signup/page.tsx`
- [ ] `src/app/auth/callback/route.ts`
- [ ] `src/lib/profile-context.tsx`
- [ ] `src/components/ProfileProviderWrapper.tsx`
- [ ] `src/components/Sidebar.tsx`
- [ ] `src/app/(app)/layout.tsx`
- [ ] `src/app/(app)/profile/page.tsx` — 4단계 위저드
- [ ] `src/lib/seed-programs.ts` — 20개 프로그램 데이터
- [ ] 시드 데이터 Supabase에 INSERT (API route 또는 직접)
- [ ] `src/lib/matching-engine.ts`
- [ ] `src/app/(app)/programs/page.tsx` — 검색/목록
- [ ] `src/app/(app)/programs/[id]/page.tsx` — 상세
- [ ] `src/app/(app)/dashboard/page.tsx` — 대시보드
- [ ] `src/app/page.tsx` — 랜딩 페이지

### Phase 2 (AI 컨설턴트)
- [ ] `npm install ai @ai-sdk/anthropic`
- [ ] `src/lib/ai/system-prompt.ts`
- [ ] `src/app/api/chat/route.ts`
- [ ] `src/app/(app)/consultant/page.tsx`
- [ ] `src/app/(app)/documents/page.tsx`
- [ ] `src/app/(app)/applications/page.tsx`

### Phase 3 (데이터 자동화)
- [ ] `src/lib/data/bizinfo-client.ts`
- [ ] `src/lib/data/data-go-kr-client.ts`
- [ ] `src/lib/data/program-sync.ts`
- [ ] `src/app/api/cron/sync-programs/route.ts`
- [ ] 알림 시스템

---

## 17. 핵심 패턴 요약 (Sonnet 참고용)

| 패턴 | 방법 | 참고 파일 |
|------|------|-----------|
| Supabase 싱글톤 | `supabase.ts` export | coffee-tracker 그대로 |
| 브라우저 클라이언트 | `getSupabaseBrowser()` 싱글톤 | coffee-tracker 그대로 |
| SSR 클라이언트 | `createSupabaseServer()` async | coffee-tracker 그대로 |
| Auth 미들웨어 | `proxy.ts` (NOT middleware.ts) | Next.js 16 규칙 |
| Auth Guard | `(app)/layout.tsx`에서 SSR redirect | coffee-tracker 그대로 |
| 인증 레이아웃 | `(auth)/layout.tsx` 센터 카드 | 색상만 indigo로 변경 |
| 위저드 UI | `useState(step)` + step별 렌더링 | predictor 패턴 |
| 프로필 Context | `ProfileProvider` + `useProfile()` | coffee-tracker 그대로 |
| useSearchParams | 반드시 `<Suspense>` 감싸기 | coffee-tracker LoginForm |
| user_id 패턴 | `const { data: { user } } = await supabase.auth.getUser()` | 모든 INSERT에 적용 |
| 다크모드 | ThemeProvider + `dark:` 클래스 | coffee-tracker 그대로 |
| 페이지 선언 | 모든 페이지 `'use client'` | coffee-tracker 패턴 |

---

## 18. 금지사항 / 주의사항

1. **middleware.ts 사용 금지** → Next.js 16에서는 `proxy.ts` 사용
2. **supabase.auth.getSession() 호출 금지** → 보안상 `getUser()` 사용
3. **useSearchParams() 사용 시 반드시 Suspense 경계** 필요
4. **Tailwind v4**: `@import "tailwindcss"` 사용, `@tailwind` 디렉티브 아님
5. **폰트**: `next/font/google`에서 Inter 사용 (Nunito 아님)
6. **색상 테마**: green → indigo/slate로 전부 변경
7. **한국어 UI**: 모든 라벨, 메시지, 에러 텍스트 한국어
8. **RLS 필수**: 모든 테이블에 Row Level Security 활성화

---

## 19. Supabase 프로젝트 설정 체크리스트

Supabase 대시보드에서:
1. 새 프로젝트 생성
2. Authentication → Providers → Email 활성화 (Confirm email = ON)
3. Authentication → Providers → Google 활성화 (OAuth 설정)
4. Authentication → URL Configuration → Site URL = `http://localhost:3000`
5. Authentication → URL Configuration → Redirect URLs에 `http://localhost:3000/auth/callback` 추가
6. SQL Editor에서 001, 002 마이그레이션 순서대로 실행
7. API Settings에서 URL, anon key, service role key 복사 → `.env.local`

---

이 문서를 따라 Phase 1부터 순서대로 구현하면 완성됩니다.
