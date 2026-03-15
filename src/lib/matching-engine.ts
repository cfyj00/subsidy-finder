import type { BusinessProfile, Program } from '@/types/database';

interface MatchResult {
  score: number;
  reasons: string[];
  mismatches: string[];
}

// ── 기업 규모 분류 ────────────────────────────────────────────────────────────
function classifyCompanySize(profile: BusinessProfile): string[] {
  const sizes: string[] = [];
  const emp = profile.employee_count ?? 0;
  const rev = (profile.annual_revenue ?? 0) * 10_000; // 백만원→원 단위 아님, 백만원 그대로

  // 소상공인: 직원 5명 미만(제조업 10명) or 연매출 3억 미만 — 간략 기준
  if (emp < 10 || rev < 300) sizes.push('소상공인');
  // 소기업: 직원 50명 미만 or 연매출 10억 미만
  if (emp < 50 || rev < 1_000) sizes.push('소기업');
  // 중소기업: 직원 300명 미만 or 연매출 300억 미만
  if (emp < 300 || rev < 30_000) sizes.push('중소기업');
  // 중견기업
  if (emp >= 300) sizes.push('중견기업');

  return sizes.length ? sizes : ['중소기업'];
}

// ── 지원유형 + 카테고리 → 목표 매핑 ─────────────────────────────────────────
const SUPPORT_GOAL_MAP: Record<string, string[]> = {
  '융자':        ['설비 투자', '공장 증축/이전', '운전자금 확보'],
  '보조금':      ['설비 투자', '신제품 개발', '스마트공장 구축'],
  '금융':        ['설비 투자', '공장 증축/이전'],
  '기술':        ['신제품 개발', '기술 인증 획득', 'AI/자동화 도입'],
  '연구':        ['신제품 개발', '기술 인증 획득'],
  '인력':        ['인력 채용'],
  '고용':        ['인력 채용'],
  '수출':        ['수출 시작', '해외 진출'],
  '해외':        ['수출 시작', '해외 진출'],
  '마케팅':      ['온라인 판매 확대', '브랜딩/마케팅 강화'],
  '판로':        ['온라인 판매 확대', '브랜딩/마케팅 강화'],
  '내수':        ['온라인 판매 확대', '브랜딩/마케팅 강화'],
  '창업':        ['창업 준비', '사업 초기 안정화'],
  '스마트':      ['스마트공장 구축', 'AI/자동화 도입', '디지털 전환'],
  '디지털':      ['디지털 전환', 'AI/자동화 도입'],
  '경영':        ['경영 개선', '디지털 전환'],
  '환경':        ['친환경 전환', '탄소중립'],
};

function goalMatchScore(profile: BusinessProfile, program: Program): { pts: number; matched: string[] } {
  const searchText = [program.category, program.subcategory, program.support_type, program.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matched: string[] = [];
  for (const [keyword, goals] of Object.entries(SUPPORT_GOAL_MAP)) {
    if (searchText.includes(keyword)) {
      const hit = goals.filter(g => profile.goals.includes(g));
      matched.push(...hit);
    }
  }
  const unique = [...new Set(matched)];
  return { pts: Math.min(unique.length * 5, 12), matched: unique };
}

// ── 키워드 매칭 ──────────────────────────────────────────────────────────────
function keywordScore(profile: BusinessProfile, program: Program): { pts: number; hits: string[] } {
  const programText = [program.title, program.description, program.eligibility_summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const profileKeywords = [
    profile.business_type,
    profile.business_category,
    profile.main_products,
    ...profile.goals,
    ...profile.current_challenges,
  ]
    .filter(Boolean)
    .map(s => s!.toLowerCase());

  const hits: string[] = [];
  for (const kw of profileKeywords) {
    if (kw.length >= 2 && programText.includes(kw)) {
      hits.push(kw);
    }
  }
  const unique = [...new Set(hits)];
  return { pts: Math.min(unique.length * 2, 8), hits: unique.slice(0, 3) };
}

// ── 기업규모 매칭 ─────────────────────────────────────────────────────────────
function companySizeScore(profile: BusinessProfile, program: Program): { pts: number; matched: boolean } {
  if (!program.target_company_size || program.target_company_size.length === 0) {
    return { pts: 5, matched: true }; // 제한 없음 = 전부 해당
  }
  const mySize = classifyCompanySize(profile);
  const hit = program.target_company_size.some(s =>
    mySize.some(m => s.includes(m) || m.includes(s))
  );
  return { pts: hit ? 5 : 0, matched: hit };
}

// ── 수출 보너스 ──────────────────────────────────────────────────────────────
function exportBonus(profile: BusinessProfile, program: Program): number {
  if (!profile.has_export) return 0;
  const text = [program.category, program.support_type, program.title].filter(Boolean).join(' ');
  return /수출|해외|글로벌/.test(text) ? 3 : 0;
}

// ── 마감 임박 가산점 ──────────────────────────────────────────────────────────
function deadlineBonus(program: Program): number {
  if (!program.application_end || program.status === 'closed') return 0;
  const end = new Date(program.application_end);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)  return 0;
  if (daysLeft <= 7)  return 5;
  if (daysLeft <= 30) return 3;
  if (daysLeft <= 60) return 1;
  return 0;
}

// ── 메인 계산 함수 ────────────────────────────────────────────────────────────
export function calculateMatch(profile: BusinessProfile, program: Program): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  const mismatches: string[] = [];

  // 1. 지역 (20점) — 계층형 매칭: 시군구 > 시도 > 전국
  {
    const regions  = program.target_regions;
    const sido     = profile.region_sido;      // 예: '충청북도'
    const sigungu  = profile.region_sigungu;   // 예: '증평군' (nullable)

    if (regions.length === 0 || regions.some(r => r.includes('전국') || r === '전 지역')) {
      // 전국 대상
      score += 20;
      reasons.push('전국 대상 사업');

    } else if (sigungu && regions.some(r => r.includes(sigungu))) {
      // 정확한 시군구 매칭 (예: '충청북도 증평군' 또는 '증평군')
      score += 20;
      reasons.push(`${sido} ${sigungu} 지역 대상`);

    } else if (regions.some(r => {
      // 시도 단위 매칭 — 단, 다른 시군구가 명시된 경우는 제외
      // 예: '충청북도' → 충북 사용자 20점
      //     '충청북도 청주시' → 증평군 사용자는 점수 없음
      if (!r.includes(sido)) return false;           // 다른 시도
      // 시군구가 명시된 경우: '충청북도 청주시' → 내 시군구와 다르면 skip
      if (sigungu && r !== sido && !r.includes(sigungu)) return false;
      return true;
    })) {
      score += 20;
      reasons.push(`${sido} 지역 대상`);

    } else if (sigungu && regions.some(r => r.includes(sido))) {
      // 같은 시도지만 다른 시군구 대상 (예: 충북 청주시 사업 vs 증평군 사용자)
      // → 5점 (완전 제외보다는 참고용으로 표시)
      score += 5;
      // reasons에는 추가하지 않음 (mismatch로 표시)
      mismatches.push(`대상 지역: ${regions.join(', ')} (다른 시군구)`);

    } else {
      mismatches.push(`대상 지역: ${regions.join(', ')}`);
    }
  }

  // 2. 업종 (20점) — 3단계: 완전매칭 20 / 부분매칭 12 / 불일치 0
  if (program.target_industries.length === 0) {
    score += 20;
    reasons.push('업종 제한 없음');
  } else {
    const myType = profile.business_type.toLowerCase();
    const inds = program.target_industries.map(i => i.toLowerCase());
    if (inds.some(i => i.includes(myType) || myType.includes(i))) {
      score += 20;
      reasons.push(`${profile.business_type} 업종 해당`);
    } else {
      // 3글자 이상 부분 문자열 매칭 (예: "소프트웨어" vs "소프트웨어개발")
      const hasPartial = inds.some(ind => {
        for (let len = 3; len <= myType.length; len++) {
          for (let s = 0; s <= myType.length - len; s++) {
            if (ind.includes(myType.slice(s, s + len))) return true;
          }
        }
        return false;
      });
      if (hasPartial) {
        score += 12;
        reasons.push(`${profile.business_type} 관련 업종`);
      } else {
        mismatches.push(`대상 업종: ${program.target_industries.join(', ')}`);
      }
    }
  }

  // 3. 직원수 (10점)
  const emp = profile.employee_count;
  if (emp != null) {
    const minOk = program.min_employee_count == null || emp >= program.min_employee_count;
    const maxOk = program.max_employee_count == null || emp <= program.max_employee_count;
    if (minOk && maxOk) {
      score += 10;
      reasons.push(`직원수 ${emp}명 조건 충족`);
    } else {
      mismatches.push(`직원수 조건: ${program.min_employee_count ?? 0}~${program.max_employee_count ?? '무제한'}명`);
    }
  } else {
    score += 5;
  }

  // 4. 매출 (10점)
  const rev = profile.annual_revenue;
  if (rev != null) {
    const minOk = program.min_revenue == null || rev >= program.min_revenue;
    const maxOk = program.max_revenue == null || rev <= program.max_revenue;
    if (minOk && maxOk) {
      score += 10;
      reasons.push('매출 조건 충족');
    } else {
      mismatches.push('매출 조건 미충족');
    }
  } else {
    score += 5;
  }

  // 5. 업력 (8점)
  const age = profile.company_age_years;
  if (age != null) {
    const minOk = program.min_company_age == null || age >= program.min_company_age;
    const maxOk = program.max_company_age == null || age <= program.max_company_age;
    if (minOk && maxOk) {
      score += 8;
      reasons.push(`업력 ${age}년 조건 충족`);
    } else {
      mismatches.push(`업력 조건: ${program.min_company_age ?? 0}~${program.max_company_age ?? '무제한'}년`);
    }
  } else {
    score += 4;
  }

  // 6. 인증 보너스 (7점)
  let certScore = 0;
  if (profile.is_venture) { certScore += 3; reasons.push('벤처기업 인증 보유'); }
  if (profile.is_innobiz) { certScore += 2; reasons.push('이노비즈 인증 보유'); }
  if (profile.is_mainbiz) { certScore += 2; reasons.push('메인비즈 인증 보유'); }
  score += Math.min(certScore, 7);

  // 7. 목표 + 지원유형 매칭 (12점) ← 강화
  const { pts: goalPts, matched: goalMatched } = goalMatchScore(profile, program);
  if (goalPts > 0) {
    score += goalPts;
    reasons.push(`목표 일치: ${goalMatched.slice(0, 2).join(', ')}`);
  }

  // 8. 기업 규모 (5점) ← 신규
  const { pts: sizePts, matched: sizeMatched } = companySizeScore(profile, program);
  score += sizePts;
  if (!sizeMatched) mismatches.push(`대상 기업 규모 미해당`);

  // 9. 키워드 매칭 (8점) ← 신규
  const { pts: kwPts, hits } = keywordScore(profile, program);
  if (kwPts > 0) {
    score += kwPts;
    reasons.push(`키워드 매칭: ${hits.join(', ')}`);
  }

  // 10. 수출 보너스 (최대 3점)
  score += exportBonus(profile, program);

  // 11. 마감 임박 가산점 (최대 5점) — 타이브레이커 역할
  score += deadlineBonus(program);

  return { score: Math.min(score, 100), reasons, mismatches };
}

export function getMatchLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '매우 적합', color: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 60) return { label: '적합',     color: 'text-blue-600 dark:text-blue-400' };
  if (score >= 40) return { label: '보통',     color: 'text-amber-600 dark:text-amber-400' };
  return                     { label: '낮음',  color: 'text-stone-400' };
}
