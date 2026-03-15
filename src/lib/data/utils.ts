// ─── 프로그램 상세 추출 결과 타입 ─────────────────────────────────────────────

export interface ExtractedDetails {
  funding_amount_min:   number | null;   // 만원 단위
  funding_amount_max:   number | null;   // 만원 단위
  target_company_size:  string[];
  target_industries:    string[];
  min_employee_count:   number | null;
  max_employee_count:   number | null;
  min_company_age:      number | null;
  max_company_age:      number | null;
  self_funding_ratio:   number | null;   // % 단위
  eligibility_summary:  string | null;
}

// ─── 한국어 금액 문자열 → 만원 단위 숫자 ────────────────────────────────────
function parseKorAmount(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, '');
  let total = 0;
  const eok = s.match(/(\d+(?:\.\d+)?)억/);
  if (eok) total += Math.round(parseFloat(eok[1]) * 10_000);
  const cheon = s.match(/(\d+)천\s*만/);
  if (cheon) total += parseInt(cheon[1]) * 1_000;
  // 독립적인 "만" (억·천만이 없을 때, 또는 나머지 만 단위)
  const man = s.match(/(?:억|천만).*?(\d+)\s*만|^(\d+)\s*만/);
  if (man) total += parseInt(man[1] ?? man[2]);
  return total > 0 ? total : null;
}

/**
 * 프로그램 설명 텍스트에서 구조화된 정보를 정규식으로 추출합니다.
 * 외부 API 호출 없이 기존 description 필드만 활용합니다.
 */
export function extractProgramDetails(text: string | null | undefined): ExtractedDetails {
  const t = (text ?? '').replace(/\s+/g, ' ');

  // ── 지원금액 ────────────────────────────────────────────────────────────────
  let funding_amount_min: number | null = null;
  let funding_amount_max: number | null = null;

  // 범위: "X억원 ~ Y억원" / "X만원 ~ Y만원"
  const rangeMatch = t.match(
    /([\d,.]+\s*(?:억|천만|만)\s*원?)\s*[~∼]\s*([\d,.]+\s*(?:억|천만|만)\s*원?)/
  );
  if (rangeMatch) {
    funding_amount_min = parseKorAmount(rangeMatch[1]);
    funding_amount_max = parseKorAmount(rangeMatch[2]);
  } else {
    // 단일 상한: "최대/이내/한도/까지 N억원"
    const maxMatch = t.match(
      /(?:최대|이내|한도|까지|총|up\s*to)\s*([\d,.]+\s*(?:억|천만|만)\s*원)/i
    );
    if (maxMatch) funding_amount_max = parseKorAmount(maxMatch[1]);

    // 단일 하한: "N억원 이상 지원"
    const minMatch = t.match(/([\d,.]+\s*(?:억|천만|만)\s*원)\s*이상\s*지원/);
    if (minMatch) funding_amount_min = parseKorAmount(minMatch[1]);
  }

  // ── 기업규모 ────────────────────────────────────────────────────────────────
  const sizeMap: [RegExp, string][] = [
    [/소상공인/,                       '소상공인'],
    [/소기업/,                         '소기업'],
    [/중소기업/,                       '중소기업'],
    [/중견기업/,                       '중견기업'],
    [/예비\s*창업|창업\s*(?:기업|자)/, '창업기업'],
    [/스타트업/,                       '스타트업'],
    [/벤처\s*기업/,                    '벤처기업'],
  ];
  const target_company_size = sizeMap
    .filter(([re]) => re.test(t))
    .map(([, label]) => label);

  // ── 대상 업종 ───────────────────────────────────────────────────────────────
  const industryKeywords = [
    '제조업', '제조', '정보통신', 'IT', '소프트웨어', '바이오', '의료기기',
    '의료', '헬스케어', '농업', '농식품', '수산업', '건설업', '건설',
    '유통', '물류', '외식', '음식', '서비스업', '도소매', '관광', '문화',
    '콘텐츠', '교육', '환경', '에너지', '자동차', '반도체', '패션', '뷰티',
    '화학', '철강', '조선', '항공',
  ];
  const target_industries = industryKeywords.filter(kw => t.includes(kw));

  // ── 직원 수 조건 ────────────────────────────────────────────────────────────
  const empMinM = t.match(/(?:상시\s*)?(?:근로자|직원|종업원|인력)\s*(\d+)\s*(?:인|명)\s*이상/);
  const empMaxM = t.match(/(?:상시\s*)?(?:근로자|직원|종업원|인력)\s*(\d+)\s*(?:인|명)\s*(?:이하|미만)/);
  const min_employee_count = empMinM ? parseInt(empMinM[1]) : null;
  const max_employee_count = empMaxM ? parseInt(empMaxM[1]) : null;

  // ── 업력 조건 ────────────────────────────────────────────────────────────────
  const ageMinM = t.match(/(?:창업|사업|업력)\s*(?:후\s*)?(\d+)\s*년\s*이상/);
  const ageMaxM = t.match(/(?:창업|사업|업력)\s*(?:후\s*)?(\d+)\s*년\s*(?:이하|미만|이내)/);
  const min_company_age = ageMinM ? parseInt(ageMinM[1]) : null;
  const max_company_age = ageMaxM ? parseInt(ageMaxM[1]) : null;

  // ── 자부담 비율 ──────────────────────────────────────────────────────────────
  const selfM = t.match(/자부담\s*(?:비율\s*)?:?\s*(\d+)\s*%/);
  const self_funding_ratio = selfM ? parseInt(selfM[1]) : null;

  // ── 자격요건 요약 ────────────────────────────────────────────────────────────
  // "신청 자격", "지원 대상", "대상 기업" 이후 첫 문장 우선 추출
  let eligibility_summary: string | null = null;
  const eligM = t.match(
    /(?:신청\s*자격|지원\s*대상|대상\s*기업|신청\s*대상|자격\s*요건)[^\n。]{5,100}/
  );
  if (eligM) {
    eligibility_summary = eligM[0].trim().slice(0, 200);
  } else {
    // fallback: 앞 2문장
    const sents = t.split(/[。\n]/).map(s => s.trim()).filter(s => s.length > 15);
    if (sents.length > 0) eligibility_summary = sents.slice(0, 2).join(' ').slice(0, 200);
  }

  return {
    funding_amount_min,
    funding_amount_max,
    target_company_size,
    target_industries,
    min_employee_count,
    max_employee_count,
    min_company_age,
    max_company_age,
    self_funding_ratio,
    eligibility_summary,
  };
}

/** HTML 태그 및 엔티티 제거 */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<[^>]+>/g, ' ')           // 태그 제거
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/&middot;/g, '·')
    .replace(/&bull;/g, '·')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&times;/g, '×')
    .replace(/&[a-zA-Z]+;/g, ' ')       // 나머지 named entity 제거
    .replace(/&#[0-9]+;/g, '')          // 숫자 entity 제거
    .replace(/\s{2,}/g, ' ')            // 연속 공백 정리
    .trim() || null;
}
