import type { BusinessProfile, Program } from '@/types/database';

interface MatchInfo {
  program: Program;
  score: number;
  reasons: string[];
}

function formatAmount(min: number | null, max: number | null): string {
  if (!min && !max) return '미정';
  const fmt = (n: number) =>
    n >= 100_000_000
      ? `${(n / 100_000_000).toFixed(0)}억원`
      : `${(n / 10_000).toFixed(0)}만원`;
  if (min && max) return `${fmt(min)} ~ ${fmt(max)}`;
  if (max) return `최대 ${fmt(max)}`;
  return `${fmt(min!)} 이상`;
}

// annual_revenue is stored in 백만원 (million KRW) units in the DB
function formatRevenueMillion(mil: number): string {
  if (mil >= 100) {
    const eok = mil / 100;
    const eokStr = Number.isInteger(eok) ? eok.toString() : eok.toFixed(1);
    return `약 ${eokStr}억원`;
  }
  return `약 ${mil}백만원`;
}

function formatDeadline(end: string | null): string {
  if (!end) return '상시 접수';
  const d = new Date(end);
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return '마감됨';
  if (daysLeft === 0) return '오늘 마감';
  return `D-${daysLeft} (${d.toLocaleDateString('ko-KR')})`;
}

export function generateConsultingPrompt(
  profile: BusinessProfile,
  matches: MatchInfo[],
): string {
  const top = matches.slice(0, 5);

  const certs = [
    profile.is_venture && '벤처기업',
    profile.is_innobiz && '이노비즈',
    profile.is_mainbiz && '메인비즈',
  ].filter(Boolean);

  const bizLines = [
    `- 사업체명: ${profile.business_name}`,
    `- 업종: ${profile.business_type}${profile.business_category ? ` / ${profile.business_category}` : ''}`,
    `- 지역: ${profile.region_sido}${profile.region_sigungu ? ` ${profile.region_sigungu}` : ''}`,
    profile.employee_count != null && `- 직원수: ${profile.employee_count}명`,
    profile.annual_revenue != null &&
      `- 연매출: ${formatRevenueMillion(profile.annual_revenue)}`,
    profile.company_age_years != null && `- 업력: ${profile.company_age_years}년`,
    certs.length > 0 && `- 보유인증: ${certs.join(', ')}`,
    profile.goals.length > 0 && `- 주요 목표: ${profile.goals.join(', ')}`,
    profile.current_challenges.length > 0 &&
      `- 현재 어려움: ${profile.current_challenges.join(', ')}`,
    profile.notes && `- 기타: ${profile.notes}`,
  ]
    .filter(Boolean)
    .join('\n');

  const programList = top
    .map((m, i) => {
      const p = m.program;
      return [
        `### ${i + 1}. ${p.title} (적합도: ${m.score}점)`,
        `- 주관기관: ${p.managing_org ?? '미정'}`,
        `- 지원유형: ${p.support_type ?? p.category}`,
        `- 지원금액: ${formatAmount(p.funding_amount_min, p.funding_amount_max)}`,
        `- 신청마감: ${formatDeadline(p.application_end)}`,
        p.eligibility_summary && `- 자격요건: ${p.eligibility_summary}`,
        m.reasons.length > 0 && `- 매칭사유: ${m.reasons.slice(0, 3).join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `안녕하세요! 저는 정부 지원사업 신청을 도움받고 싶은 사업주입니다.
AI 매칭 시스템으로 분석한 제 사업 정보와 추천 지원사업을 공유드리니, 전문적인 상담 부탁드립니다.

## 제 사업 정보

${bizLines}

## AI 매칭 추천 지원사업 Top ${top.length}

${programList}

## 상담 요청 사항

위 정보를 바탕으로 다음 사항을 도와주세요:

1. **우선순위 추천**: 위 프로그램 중 제 상황에 가장 적합한 순서로 추천해 주세요.
2. **신청 전략**: 각 프로그램의 핵심 포인트와 주의사항을 알려주세요.
3. **준비 서류**: 신청에 필요한 서류와 준비 방법을 안내해 주세요.
4. **중복 신청**: 동시에 신청 가능한 조합이 있다면 알려주세요.
5. **추가 조언**: 제 상황에서 놓치면 안 될 중요한 사항이 있다면 말씀해 주세요.

구체적이고 실용적인 조언 부탁드립니다!`;
}

// ─── 사업계획서 작성 프롬프트 ────────────────────────────────────────────────
export function generateBusinessPlanPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `안녕하세요! 아래 지원사업의 사업계획서 작성을 도와주세요.

## 지원사업 정보
- 사업명: ${program.title}
- 주관기관: ${program.managing_org ?? '미정'}
- 지원유형: ${program.support_type ?? program.category}
- 지원금액: 최대 ${program.funding_amount_max ? `${(program.funding_amount_max / 10000).toFixed(0)}만원` : '미정'}
- 신청마감: ${program.application_end ? new Date(program.application_end).toLocaleDateString('ko-KR') : '상시'}
${program.eligibility_summary ? `- 신청자격: ${program.eligibility_summary}` : ''}

## 우리 회사 정보
- 사업체명: ${profile.business_name}
- 업종: ${profile.business_type}${profile.business_category ? ` (${profile.business_category})` : ''}
- 지역: ${profile.region_sido}${profile.region_sigungu ? ` ${profile.region_sigungu}` : ''}
${profile.employee_count != null ? `- 직원수: ${profile.employee_count}명` : ''}
${profile.annual_revenue != null ? `- 연매출: 약 ${profile.annual_revenue}백만원` : ''}
${profile.company_age_years != null ? `- 업력: ${profile.company_age_years}년` : ''}
${profile.main_products ? `- 주요 제품/서비스: ${profile.main_products}` : ''}
- 주요 목표: ${profile.goals.join(', ')}
- 현재 어려움: ${profile.current_challenges.join(', ')}

## 요청 사항

위 지원사업에 제출할 사업계획서를 작성해 주세요. 아래 항목을 포함해 주세요:

1. **사업 개요** (현황 및 문제점, 해결 방안)
2. **지원 필요성** (왜 이 지원사업이 우리 회사에 필요한가)
3. **추진 계획** (단계별 추진 일정 및 방법)
4. **기대 효과** (지원 후 예상되는 성과 및 파급효과)
5. **예산 계획** (지원금 사용처 및 자부담 계획)

평가위원이 호감을 갖도록 설득력 있게, 구체적인 수치와 근거를 포함해 작성해 주세요.`;
}

// ─── 자격요건 확인 프롬프트 ──────────────────────────────────────────────────
export function generateEligibilityCheckPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `아래 정부지원사업의 신청 자격 요건을 분석해서 우리 회사가 신청 가능한지 판단해 주세요.

## 지원사업 정보
- 사업명: ${program.title}
- 주관기관: ${program.managing_org ?? '미정'}
${program.description ? `- 사업 개요: ${program.description.slice(0, 500)}` : ''}
${program.eligibility_summary ? `- 신청 자격(요약): ${program.eligibility_summary}` : ''}
${program.target_company_size.length > 0 ? `- 대상 기업규모: ${program.target_company_size.join(', ')}` : ''}
${program.target_industries.length > 0 ? `- 대상 업종: ${program.target_industries.join(', ')}` : ''}
${program.min_company_age != null ? `- 최소 업력: ${program.min_company_age}년 이상` : ''}
${program.min_employee_count != null ? `- 직원수 조건: ${program.min_employee_count}명 이상` : ''}

## 우리 회사 정보
- 사업체명: ${profile.business_name}
- 업종: ${profile.business_type}${profile.business_category ? ` (${profile.business_category})` : ''}
- 지역: ${profile.region_sido}
- 사업자 유형: ${profile.business_entity_type ?? '미확인'}
${profile.employee_count != null ? `- 직원수: ${profile.employee_count}명` : ''}
${profile.annual_revenue != null ? `- 연매출: 약 ${profile.annual_revenue}백만원` : ''}
${profile.company_age_years != null ? `- 업력: ${profile.company_age_years}년` : ''}
- 보유인증: ${[profile.is_venture && '벤처기업', profile.is_innobiz && '이노비즈', profile.is_mainbiz && '메인비즈'].filter(Boolean).join(', ') || '없음'}

## 분석 요청

1. **신청 가능 여부**: 가능 / 불가능 / 확인 필요로 명확히 답해 주세요
2. **충족 요건**: 우리 회사가 충족하는 자격 요건을 나열해 주세요
3. **미충족/불확실 요건**: 충족하지 못하거나 확인이 필요한 항목을 알려주세요
4. **보완 방법**: 미충족 요건이 있다면 보완 가능한 방법을 제안해 주세요
5. **주의사항**: 신청 전 반드시 확인해야 할 사항을 알려주세요`;
}

// ─── 서류 체크리스트 프롬프트 ────────────────────────────────────────────────
export function generateDocumentChecklistPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `아래 지원사업 신청에 필요한 서류 목록과 준비 방법을 상세히 알려주세요.

## 지원사업 정보
- 사업명: ${program.title}
- 주관기관: ${program.managing_org ?? '미정'}
- 지원유형: ${program.support_type ?? program.category}
${program.required_documents.length > 0 ? `- 기재된 필요 서류: ${program.required_documents.join(', ')}` : ''}
${program.application_end ? `- 신청 마감: ${new Date(program.application_end).toLocaleDateString('ko-KR')}` : ''}

## 우리 회사 정보
- 사업체명: ${profile.business_name}
- 사업자 유형: ${profile.business_entity_type ?? '미확인'}
- 업종: ${profile.business_type}
${profile.employee_count != null ? `- 직원수: ${profile.employee_count}명` : ''}
- 보유인증: ${[profile.is_venture && '벤처기업', profile.is_innobiz && '이노비즈', profile.is_mainbiz && '메인비즈'].filter(Boolean).join(', ') || '없음'}

## 요청 사항

1. **필수 서류 체크리스트**: 반드시 제출해야 하는 서류를 번호 목록으로 정리해 주세요
2. **선택/추가 서류**: 가산점이나 유리한 평가를 위해 제출하면 좋은 서류를 알려주세요
3. **발급처 및 준비 방법**: 각 서류를 어디서, 어떻게 발급받는지 알려주세요
4. **준비 기간**: 서류별 예상 준비 기간을 알려주세요 (당일발급 / 수일소요 등)
5. **유효기간 주의**: 유효기간이 있는 서류와 기간을 명시해 주세요
6. **실수 방지 팁**: 서류 준비 시 자주 하는 실수나 놓치기 쉬운 사항을 알려주세요`;
}

// ─── 담당기관 문의 프롬프트 ──────────────────────────────────────────────────
export function generateInquiryPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `아래 정부지원사업 담당 기관에 문의할 때 사용할 효과적인 질문 목록을 만들어 주세요.

## 지원사업 정보
- 사업명: ${program.title}
- 주관기관: ${program.managing_org ?? '미정'}
- 지원유형: ${program.support_type ?? program.category}
${program.application_end ? `- 신청 마감: ${new Date(program.application_end).toLocaleDateString('ko-KR')}` : ''}

## 우리 회사 정보
- 업종: ${profile.business_type}
- 지역: ${profile.region_sido}
${profile.employee_count != null ? `- 직원수: ${profile.employee_count}명` : ''}
${profile.company_age_years != null ? `- 업력: ${profile.company_age_years}년` : ''}
- 목표: ${profile.goals.slice(0, 3).join(', ')}

## 요청 사항

1. **자격요건 확인 질문**: 우리 회사의 신청 자격을 확인하기 위한 질문
2. **서류 관련 질문**: 제출 서류와 양식에 대한 질문
3. **심사 기준 질문**: 평가 방법과 선정 기준에 대한 질문
4. **일정 관련 질문**: 신청 절차와 결과 발표 일정에 대한 질문
5. **추가 혜택 질문**: 연계 가능한 다른 지원사업이나 추가 혜택에 대한 질문

각 질문은 담당자가 명확하게 답변할 수 있도록 구체적으로 작성해 주세요.
전화/이메일 문의 시 바로 사용할 수 있는 형태로 만들어 주세요.`;
}

// ─── 특정 지원사업 전용 프롬프트 ─────────────────────────────────────
export interface SingleProgramMatchInfo {
  score: number;
  reasons: string[];
  mismatches: string[];
}

export function generateSingleProgramPrompt(
  profile: BusinessProfile,
  program: Program,
  matchInfo?: SingleProgramMatchInfo,
): string {
  const certs = [
    profile.is_venture && '벤처기업',
    profile.is_innobiz && '이노비즈',
    profile.is_mainbiz && '메인비즈',
  ].filter(Boolean);

  const bizLines = [
    `- 사업체명: ${profile.business_name}`,
    `- 업종: ${profile.business_type}${profile.business_category ? ` / ${profile.business_category}` : ''}`,
    `- 지역: ${profile.region_sido}${profile.region_sigungu ? ` ${profile.region_sigungu}` : ''}`,
    profile.employee_count != null && `- 직원수: ${profile.employee_count}명`,
    profile.annual_revenue != null &&
      `- 연매출: ${formatRevenueMillion(profile.annual_revenue)}`,
    profile.company_age_years != null && `- 업력: ${profile.company_age_years}년`,
    certs.length > 0 && `- 보유인증: ${certs.join(', ')}`,
    profile.goals.length > 0 && `- 주요 목표: ${profile.goals.join(', ')}`,
    profile.current_challenges.length > 0 &&
      `- 현재 어려움: ${profile.current_challenges.join(', ')}`,
    profile.notes && `- 기타: ${profile.notes}`,
  ]
    .filter(Boolean)
    .join('\n');

  const programLines = [
    `- 사업명: ${program.title}`,
    `- 주관기관: ${program.managing_org ?? '미정'}`,
    program.implementing_org && `- 운영기관: ${program.implementing_org}`,
    `- 분류: ${program.category}${program.subcategory ? ` > ${program.subcategory}` : ''}`,
    program.support_type && `- 지원유형: ${program.support_type}`,
    `- 지원금액: ${formatAmount(program.funding_amount_min, program.funding_amount_max)}`,
    program.self_funding_ratio != null &&
      `- 자부담 비율: ${program.self_funding_ratio}%`,
    `- 신청마감: ${formatDeadline(program.application_end)}`,
    program.target_company_size.length > 0 &&
      `- 대상 기업규모: ${program.target_company_size.join(', ')}`,
    program.target_regions.length > 0 &&
      `- 대상 지역: ${program.target_regions.join(', ')}`,
    program.target_industries.length > 0 &&
      `- 대상 업종: ${program.target_industries.join(', ')}`,
    program.min_employee_count != null &&
      `- 최소 직원수: ${program.min_employee_count}명 이상`,
    program.max_employee_count != null &&
      `- 최대 직원수: ${program.max_employee_count}명 이하`,
    program.min_company_age != null &&
      `- 최소 업력: ${program.min_company_age}년 이상`,
    program.description && `\n**사업 개요:**\n${program.description}`,
    program.eligibility_summary && `\n**신청 자격:**\n${program.eligibility_summary}`,
    program.required_documents.length > 0 &&
      `\n**필요 서류:**\n${program.required_documents.map((d) => `- ${d}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const matchLines = matchInfo
    ? [
        `- AI 적합도 점수: ${matchInfo.score}점 / 100점`,
        matchInfo.reasons.length > 0 &&
          `- 적합 사유: ${matchInfo.reasons.join(', ')}`,
        matchInfo.mismatches.length > 0 &&
          `- 확인 필요 사항: ${matchInfo.mismatches.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n')
    : null;

  return `안녕하세요! 아래 특정 지원사업 신청과 관련해 심층 상담을 요청드립니다.

## 제 사업 정보

${bizLines}

## 상담 대상 지원사업

${programLines}
${matchLines ? `\n## AI 매칭 분석\n\n${matchLines}` : ''}

## 심층 상담 요청 사항

이 지원사업에 대해 다음을 상세히 알려주세요:

1. **신청 가능 여부**: 제 사업이 이 지원사업의 신청 자격에 해당하는지 구체적으로 분석해 주세요.
2. **신청 전략**: 합격 가능성을 높이기 위한 핵심 포인트와 차별화 전략을 알려주세요.
3. **준비 서류 체크리스트**: 필요한 서류 목록과 각 서류의 준비 방법을 안내해 주세요.
4. **사업계획서 작성 팁**: 이 사업의 평가 기준에 맞는 사업계획서 작성 방향을 알려주세요.
5. **주의사항 및 실수 방지**: 신청 시 자주 하는 실수나 놓치기 쉬운 사항을 알려주세요.
6. **신청 일정 관리**: 마감일을 고려한 최적의 신청 준비 일정을 제안해 주세요.

최대한 구체적이고 실용적인 조언 부탁드립니다!`;
}
