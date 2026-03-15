import type { BusinessProfile, Program } from '@/types/database';

export interface SingleProgramMatchInfo {
  score: number;
  reasons: string[];
  mismatches: string[];
}

interface MatchInfo {
  program: Program;
  score: number;
  reasons: string[];
  mismatches?: string[];
}

// ─── 금액 포맷 (만원 단위 입력) ───────────────────────────────────────────────
function fmt만원(n: number): string {
  if (n >= 10_000) {
    const eok = n / 10_000;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억원`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}천만원`;
  return `${n.toLocaleString()}만원`;
}

function formatAmount(min: number | null, max: number | null): string {
  if (!min && !max) return '미정';
  if (min && max) return `${fmt만원(min)} ~ ${fmt만원(max)}`;
  if (max) return `최대 ${fmt만원(max)}`;
  return `${fmt만원(min!)} 이상`;
}

function formatRevenueMillion(mil: number): string {
  if (mil >= 100) {
    const eok = mil / 100;
    return `약 ${Number.isInteger(eok) ? eok : eok.toFixed(1)}억원`;
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

// ─── 공통 프로필 블록 생성 ─────────────────────────────────────────────────────
function buildProfileBlock(profile: BusinessProfile): string {
  const certs = [
    profile.is_venture    && '벤처기업',
    profile.is_innobiz    && '이노비즈',
    profile.is_mainbiz    && '메인비즈',
    profile.has_smart_factory && `스마트공장${profile.smart_factory_level ? `(${profile.smart_factory_level})` : ''}`,
  ].filter(Boolean);

  return [
    `- 사업체명: ${profile.business_name}`,
    profile.business_entity_type && `- 사업자 유형: ${profile.business_entity_type}`,
    `- 업종: ${profile.business_type}${profile.business_category ? ` / ${profile.business_category}` : ''}`,
    profile.main_products && `- 주요 제품/서비스: ${profile.main_products}`,
    `- 지역: ${profile.region_sido}${profile.region_sigungu ? ` ${profile.region_sigungu}` : ''}`,
    profile.employee_count    != null && `- 직원수: ${profile.employee_count}명`,
    profile.annual_revenue    != null && `- 연매출: ${formatRevenueMillion(profile.annual_revenue)}`,
    profile.company_age_years != null && `- 업력: ${profile.company_age_years}년`,
    profile.has_export && profile.annual_export_amount != null
      && `- 수출실적: 연 ${profile.annual_export_amount.toLocaleString()}달러`,
    certs.length > 0 && `- 보유 인증: ${certs.join(', ')}`,
    profile.goals.length > 0 && `- 현재 목표: ${profile.goals.join(', ')}`,
    profile.current_challenges.length > 0 && `- 현재 어려움: ${profile.current_challenges.join(', ')}`,
    profile.previous_subsidies.length > 0 &&
      `- 기수령 지원사업: ${profile.previous_subsidies
        .slice(0, 3)
        .map(s => `${s.name}(${s.year}년, ${s.amount.toLocaleString()}만원)`)
        .join(', ')}`,
    profile.notes && `- 기타 메모: ${profile.notes}`,
  ].filter(Boolean).join('\n');
}

// ─── 공통 프로그램 블록 생성 ─────────────────────────────────────────────────
function buildProgramBlock(program: Program, includeDescription = true): string {
  return [
    `- 사업명: ${program.title}`,
    `- 주관기관: ${program.managing_org ?? '미정'}`,
    program.implementing_org && `- 운영기관: ${program.implementing_org}`,
    `- 분류: ${program.category}${program.subcategory ? ` > ${program.subcategory}` : ''}`,
    program.support_type && `- 지원유형: ${program.support_type}`,
    `- 지원금액: ${formatAmount(program.funding_amount_min, program.funding_amount_max)}`,
    program.self_funding_ratio != null && `- 자부담 비율: ${program.self_funding_ratio}%`,
    `- 신청마감: ${formatDeadline(program.application_end)}`,
    program.target_company_size.length > 0 && `- 대상 기업규모: ${program.target_company_size.join(', ')}`,
    program.target_industries.length > 0  && `- 대상 업종: ${program.target_industries.join(', ')}`,
    program.target_regions.length > 0     && `- 대상 지역: ${program.target_regions.join(', ')}`,
    program.min_employee_count != null && `- 직원수 조건: ${program.min_employee_count}명 이상${program.max_employee_count != null ? ` ${program.max_employee_count}명 이하` : ''}`,
    program.min_company_age    != null && `- 업력 조건: ${program.min_company_age}년 이상${program.max_company_age != null ? ` ${program.max_company_age}년 이하` : ''}`,
    includeDescription && program.eligibility_summary && `\n**신청 자격:**\n${program.eligibility_summary}`,
    includeDescription && program.description &&
      `\n**사업 개요:**\n${program.description.slice(0, 600)}${program.description.length > 600 ? '...' : ''}`,
    program.required_documents.length > 0 &&
      `\n**필요 서류:**\n${program.required_documents.map(d => `- ${d}`).join('\n')}`,
  ].filter(Boolean).join('\n');
}

// ─── 1. 맞춤 지원사업 Top N 종합 상담 ────────────────────────────────────────
export function generateConsultingPrompt(
  profile: BusinessProfile,
  matches: MatchInfo[],
): string {
  const top = matches.slice(0, 5);

  const programList = top.map((m, i) => {
    const p = m.program;
    const lines = [
      `### ${i + 1}. ${p.title} (적합도 ${m.score}점)`,
      `- 주관기관: ${p.managing_org ?? '미정'} | 지원유형: ${p.support_type ?? p.category}`,
      `- 지원금액: ${formatAmount(p.funding_amount_min, p.funding_amount_max)} | 마감: ${formatDeadline(p.application_end)}`,
      p.target_company_size.length > 0 && `- 대상기업: ${p.target_company_size.join(', ')}`,
      p.eligibility_summary && `- 자격요건: ${p.eligibility_summary.slice(0, 150)}`,
      m.reasons.length > 0 && `- 매칭근거: ${m.reasons.slice(0, 3).join(', ')}`,
      (m.mismatches?.length ?? 0) > 0 && `- 확인필요: ${m.mismatches!.slice(0, 2).join(', ')}`,
    ].filter(Boolean).join('\n');
    return lines;
  }).join('\n\n');

  return `안녕하세요! 정부 지원사업 신청을 준비 중인 사업주입니다.
AI 매칭 시스템이 분석한 저의 사업 프로필과 추천 지원사업을 공유드립니다.

## 제 사업 프로필

${buildProfileBlock(profile)}

## AI 추천 지원사업 Top ${top.length}

${programList}

## 종합 상담 요청

위 정보를 바탕으로 다음을 도와주세요:

1. **우선순위**: 제 상황에 가장 적합한 프로그램 순서와 이유를 설명해 주세요.
2. **신청 전략**: 각 프로그램의 핵심 합격 포인트와 경쟁력 있는 신청 방법을 알려주세요.
3. **중복 신청 가능 여부**: 동시에 신청할 수 있는 조합과 주의사항을 알려주세요.
4. **준비 서류**: 공통적으로 필요한 기본 서류와 각 프로그램별 추가 서류를 정리해 주세요.
5. **단기/장기 로드맵**: 올해 안에 신청할 수 있는 최적의 순서와 일정을 제안해 주세요.

구체적이고 실용적인 조언을 부탁드립니다!`;
}

// ─── 2. 특정 지원사업 심층 분석 ──────────────────────────────────────────────
export function generateSingleProgramPrompt(
  profile: BusinessProfile,
  program: Program,
  matchInfo?: SingleProgramMatchInfo,
): string {
  const matchBlock = matchInfo
    ? [
        `- AI 적합도: ${matchInfo.score}점 / 100점`,
        matchInfo.reasons.length > 0    && `- 적합 근거: ${matchInfo.reasons.join(', ')}`,
        matchInfo.mismatches.length > 0 && `- 불일치/확인필요: ${matchInfo.mismatches.join(', ')}`,
      ].filter(Boolean).join('\n')
    : null;

  return `안녕하세요! 아래 지원사업 신청에 대해 심층 분석을 요청드립니다.

## 제 사업 프로필

${buildProfileBlock(profile)}

## 분석 대상 지원사업

${buildProgramBlock(program, true)}
${matchBlock ? `\n## AI 매칭 분석\n\n${matchBlock}` : ''}

## 심층 분석 요청

1. **신청 자격 판단**: 제 회사가 이 사업의 자격 요건을 충족하는지 항목별로 분석해 주세요. (가능 / 불가 / 확인필요)
2. **합격 전략**: 선정 가능성을 높이기 위한 핵심 포인트와 차별화 전략을 알려주세요.
3. **서류 체크리스트**: 필요한 서류 목록, 발급처, 준비 기간을 정리해 주세요.
4. **사업계획서 방향**: 이 사업의 평가 기준에 맞는 사업계획서 핵심 포인트를 알려주세요.
5. **주의사항**: 자주 하는 실수, 탈락 원인, 놓치기 쉬운 사항을 알려주세요.
6. **준비 일정**: 마감일 기준 역산한 최적 준비 일정을 제안해 주세요.

최대한 구체적이고 실용적인 조언 부탁드립니다!`;
}

// ─── 3. 사업계획서 작성 ──────────────────────────────────────────────────────
export function generateBusinessPlanPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `아래 지원사업의 사업계획서 작성을 도와주세요.

## 지원사업 정보

${buildProgramBlock(program, true)}

## 우리 회사 정보

${buildProfileBlock(profile)}

## 사업계획서 작성 요청

다음 구조로 심사위원을 설득할 수 있는 사업계획서 초안을 작성해 주세요:

1. **현황 및 문제점** — 현재 우리 회사의 상황과 해결이 필요한 문제를 구체적 수치와 함께
2. **지원 필요성** — 이 지원사업이 왜 우리 회사에 반드시 필요한지 논리적 근거
3. **추진 계획** — 단계별 실행 방법, 일정, 담당자 (최대한 구체적으로)
4. **기대 효과** — 지원 후 예상 성과를 정량적 수치로 (매출 N% 증가, 고용 N명 창출 등)
5. **예산 계획** — 지원금 사용처, 자부담 계획, 비용 대비 효과

평가위원이 선정하고 싶은 사업계획서가 되도록, 이 사업의 핵심 키워드를 자연스럽게 포함해 주세요.`;
}

// ─── 4. 자격요건 확인 ────────────────────────────────────────────────────────
export function generateEligibilityCheckPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `아래 지원사업의 신청 자격을 항목별로 분석해 주세요.

## 지원사업 정보

${buildProgramBlock(program, true)}

## 우리 회사 정보

${buildProfileBlock(profile)}

## 자격 분석 요청

각 자격 항목에 대해 ✅ 충족 / ❌ 미충족 / ❓ 확인필요 형식으로 판단해 주세요:

1. **기업 유형/규모** — 소상공인/중소기업 해당 여부, 사업자 유형
2. **업종** — 대상 업종 해당 여부 (제외 업종 포함)
3. **지역** — 사업 소재지 조건 충족 여부
4. **직원수/매출** — 수치 조건 충족 여부
5. **업력** — 창업 후 경과 기간 조건
6. **인증/자격** — 필요한 인증이나 특수 자격 보유 여부
7. **중복 수혜 제한** — 기수령 지원사업과 중복 여부

마지막으로 **종합 판단**과 **미충족 항목 보완 방법**을 알려주세요.`;
}

// ─── 5. 서류 체크리스트 ──────────────────────────────────────────────────────
export function generateDocumentChecklistPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `아래 지원사업 신청에 필요한 서류를 정리해 주세요.

## 지원사업 정보

${buildProgramBlock(program, false)}

## 우리 회사 정보 (서류 범위 판단용)

${buildProfileBlock(profile)}

## 서류 안내 요청

1. **필수 서류 체크리스트** — 번호 목록으로 정리 (서류명 / 발급처 / 비용 / 유효기간)
2. **선택/가산점 서류** — 제출 시 유리한 서류와 이유
3. **준비 기간** — 서류별 예상 소요 기간 (당일 / 2~3일 / 1주일 이상)
4. **온라인 발급** — 정부24, 홈택스 등 온라인 발급 가능 서류와 URL
5. **주의사항** — 유효기간 임박 서류, 자주 하는 실수, 함정 포인트
6. **제출 전 최종 확인 체크리스트** — 제출 직전 확인할 사항 요약`;
}

// ─── 6. 담당기관 문의 질문 생성 ──────────────────────────────────────────────
export function generateInquiryPrompt(
  profile: BusinessProfile,
  program: Program,
): string {
  return `아래 지원사업 담당 기관 문의 시 사용할 질문 목록을 만들어 주세요.

## 지원사업 정보

${buildProgramBlock(program, false)}

## 우리 회사 정보

${buildProfileBlock(profile)}

## 요청 사항

전화/이메일로 바로 사용 가능한 형태로, 아래 주제별 질문 2~3개씩 작성해 주세요:

1. **자격요건 확인** — 우리 회사의 신청 가능 여부 확인
2. **서류 관련** — 특수 상황에서의 서류 대체/면제 가능 여부
3. **심사 기준** — 평가 항목 비중과 선정 기준
4. **중복 신청** — 현재 수혜 중인 사업과의 중복 여부
5. **실무 절차** — 접수 방법, 온/오프라인 여부, 담당자 연락처`;
}
