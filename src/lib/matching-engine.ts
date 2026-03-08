import type { BusinessProfile, Program } from '@/types/database';

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
  } else if (program.target_regions.some(r => r.includes(profile.region_sido) || profile.region_sido.includes(r))) {
    score += 20;
    reasons.push(`${profile.region_sido} 지역 대상`);
  } else {
    mismatches.push(`대상 지역: ${program.target_regions.join(', ')}`);
  }

  // 2. 업종 매칭 (20점)
  if (program.target_industries.length === 0) {
    score += 20;
    reasons.push('업종 제한 없음');
  } else if (program.target_industries.some(i => i.includes(profile.business_type) || profile.business_type.includes(i))) {
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
      mismatches.push(`직원수 조건: ${program.min_employee_count ?? 0}~${program.max_employee_count ?? '무제한'}명`);
    }
  } else {
    score += 7;
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
  const matchedGoals = (categoryGoalMap[program.category] ?? []).filter(g => profile.goals.includes(g));
  if (matchedGoals.length > 0) {
    score += 10;
    reasons.push(`목표 일치: ${matchedGoals.join(', ')}`);
  }

  return { score: Math.min(score, 100), reasons, mismatches };
}

export function getMatchLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '매우 적합', color: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 60) return { label: '적합', color: 'text-blue-600 dark:text-blue-400' };
  if (score >= 40) return { label: '보통', color: 'text-amber-600 dark:text-amber-400' };
  return { label: '낮음', color: 'text-stone-400' };
}
