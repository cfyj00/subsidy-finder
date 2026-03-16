/**
 * Bizinfo (기업마당) Open API 클라이언트
 *
 * API 키 발급:
 *   1. https://www.bizinfo.go.kr 회원가입 후 로그인
 *   2. 상단 메뉴 → 활용정보 → Open API 신청 (또는 /apiList.do)
 *   3. IP 주소 또는 서비스 URL 입력 후 신청 → 이메일로 키 수령
 *
 * 환경변수: BIZINFO_API_KEY
 * 인증 파라미터: crtfcKey (serviceKey 아님!)
 * 기본 엔드포인트: https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do
 */

import { stripHtml, extractProgramDetails } from './utils';

// ─── 응답 타입 ──────────────────────────────────────────────────────────────

export interface BizinfoListItem {
  pblancId: string;           // 공고 ID
  pblancNm: string;           // 공고명 (사업명)
  jrsdInsttNm: string;        // 주관기관명
  creatPnttm: string;         // 생성 시점 (YYYYMMDDHHMMSS)
  pbancBgngYmd: string;       // 공고 시작일 (YYYYMMDD) - 실제 API에선 빈 문자열
  pbancEndYmd: string;        // 공고 종료일 (YYYYMMDD) - 실제 API에선 빈 문자열
  pgmSttusNm: string;         // 상태 (실제 API 응답엔 없음 → 빈 문자열)
  reqstDt?: string;           // 접수 기간 '2026-02-24 ~ 2026-03-16' 형태
  reqstBeginEndDe?: string;   // reqstDt와 동일한 날짜 범위 필드
  bsnsChrgDeptNm?: string;    // 담당 부서
  ctpvNm?: string;            // 시도명
  detlUrl?: string;           // 상세 URL
  totPblancAmt?: string;      // 총 지원금액
  sprtAmt?: string;           // 지원금액
  ntcnNm?: string;            // 공지 분류명
  ctgryNm?: string;           // 카테고리명
  bsnsSumryCn?: string;       // 사업 요약
}

export interface BizinfoListResponse {
  resultCode: string;
  resultMsg: string;
  totalCount: number;
  pageIndex: number;
  pageUnit: number;
  items: BizinfoListItem[];
}

// ─── API 설정 ──────────────────────────────────────────────────────────────

const BIZINFO_BASE = 'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do';
const PAGE_SIZE = 100;

function getApiKey(): string {
  // BIZINFO_API_KEY 가 정식 명칭 (crtfcKey 파라미터로 전달)
  return process.env.BIZINFO_API_KEY ?? '';
}

// ─── 개인 이름 감지 (jrsdInsttNm에 기관명 대신 개인명이 들어오는 경우) ──────

const KOREAN_SURNAMES = '김이박최정강조윤장임한오서신권황안송유홍전고문양손배백노하허심도우남엄채원천방공현함변염석선설마길진봉온형민계';
function isPersonName(name: string | undefined | null): boolean {
  if (!name) return false;
  const t = name.trim();
  return /^[가-힣]{2,4}$/.test(t) && KOREAN_SURNAMES.includes(t[0]);
}

// ─── 날짜 파싱 (YYYYMMDD → ISO) ────────────────────────────────────────────

export function parseKorDate(yyyymmdd: string | undefined | null): string | null {
  if (!yyyymmdd || yyyymmdd.length < 8) return null;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const iso = `${y}-${m}-${d}`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : iso;
}

// ─── reqstDt 파싱 '2026-02-24 ~ 2026-03-16' → {start, end} ───────────────

function parseReqstDt(reqstDt: string | undefined): { start: string | null; end: string | null } {
  if (!reqstDt) return { start: null, end: null };
  const m = reqstDt.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return { start: null, end: null };
  return { start: m[1], end: m[2] };
}

// ─── 상태 → DB status 매핑 ────────────────────────────────────────────────

function mapStatus(
  pgmSttusNm: string,
  startDate: string | null,
  endDate: string | null,
): 'open' | 'upcoming' | 'closed' {
  if (pgmSttusNm.includes('접수중'))   return 'open';
  if (pgmSttusNm.includes('접수예정')) return 'upcoming';
  if (pgmSttusNm.includes('접수마감')) return 'closed';

  // pgmSttusNm이 비어있는 경우 → 날짜 기반 fallback
  const now = Date.now();
  const s   = startDate ? new Date(startDate).getTime() : null;
  const e   = endDate   ? new Date(endDate).getTime()   : null;

  if (e && now > e) return 'closed';
  if (s && now < s) return 'upcoming';
  // 날짜가 있거나 상태를 알 수 없는 경우 → open으로 처리
  // (fetchAllOpenPrograms가 pblancSttus=Y/O 필터로 이미 open/upcoming만 가져옴)
  return 'open';
}

// ─── 카테고리 추측 ────────────────────────────────────────────────────────

function guessCategory(item: BizinfoListItem): string {
  const text = `${item.pblancNm} ${item.ctgryNm ?? ''} ${item.ntcnNm ?? ''}`;
  if (/R&D|기술개발|연구개발|특허/.test(text)) return '기술';
  if (/창업|스타트업|예비창업/.test(text))       return '창업';
  if (/수출|해외|글로벌/.test(text))             return '수출';
  if (/인력|채용|고용|인건비/.test(text))        return '인력';
  if (/융자|대출|보증|보조금|자금/.test(text))   return '금융';
  if (/판로|마케팅|내수/.test(text))             return '내수';
  if (/스마트|디지털|경영혁신|컨설팅/.test(text))return '경영';
  return '기타';
}

// ─── API 단일 페이지 요청 ─────────────────────────────────────────────────

async function fetchPage(
  pageIndex: number,
  options?: { status?: 'Y' | 'N' | 'O'; keyword?: string },
): Promise<BizinfoListResponse> {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'BIZINFO_API_KEY 환경변수가 설정되지 않았습니다.\n' +
      '발급: https://www.bizinfo.go.kr → 활용정보 → Open API 신청',
    );
  }

  const params = new URLSearchParams({
    crtfcKey:  key,               // ← bizinfo 인증키 파라미터명
    pageUnit:  String(PAGE_SIZE),
    pageIndex: String(pageIndex),
    type:      'json',
  });

  // pblancSttus: Y=접수중, O=접수예정, N=마감
  if (options?.status)  params.set('pblancSttus', options.status);
  if (options?.keyword) params.set('keyword',      options.keyword);

  const url = `${BIZINFO_BASE}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next:    { revalidate: 0 },         // no cache
  });

  if (!res.ok) {
    throw new Error(`Bizinfo API HTTP ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  let items: BizinfoListItem[] = [];
  let totalCount = 0;

  if (contentType.includes('xml') || contentType.includes('html')) {
    // XML/RSS 응답 파싱 (bizinfo는 type=json 요청해도 XML로 응답하는 경우 있음)
    const text = await res.text();
    // 에러 메시지 확인
    const errMatch = text.match(/<reqErr[^>]*>([\s\S]*?)<\/reqErr>/);
    if (errMatch) throw new Error(`Bizinfo API 오류: ${errMatch[1].trim()}`);

    const countMatch = text.match(/<totalCount[^>]*>([\d]+)<\/totalCount>/);
    totalCount = countMatch ? Number(countMatch[1]) : 0;

    // <item>...</item> 블록 추출
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const block = match[1];
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`));
        return m ? (m[1] ?? m[2] ?? '').trim() : '';
      };
      items.push({
        pblancId:       get('pblancId'),
        pblancNm:       get('pblancNm') || get('title'),
        jrsdInsttNm:    get('jrsdInsttNm'),
        creatPnttm:     get('creatPnttm'),
        pbancBgngYmd:   get('pbancBgngYmd'),
        pbancEndYmd:    get('pbancEndYmd'),
        pgmSttusNm:     get('pgmSttusNm'),
        reqstDt:        get('reqstDt') || get('reqstBeginEndDe') || undefined,
        reqstBeginEndDe: get('reqstBeginEndDe') || undefined,
        bsnsChrgDeptNm: get('bsnsChrgDeptNm') || undefined,
        ctpvNm:         get('ctpvNm') || undefined,
        detlUrl:        get('detlUrl') || get('pblancUrl') || get('link') || undefined,
        ntcnNm:         get('ntcnNm') || undefined,
        ctgryNm:        get('ctgryNm') || get('lcategory') || get('pldirSportRealmLclasCodeNm') || undefined,
        bsnsSumryCn:    get('bsnsSumryCn') || get('description') || undefined,
      });
    }
  } else {
    // JSON 응답 파싱
    const json = await res.json();
    const data = json?.response ?? json;
    const body = data?.body ?? data;
    totalCount = Number(body?.totalCount ?? 0);

    items = Array.isArray(body?.items?.item)
      ? body.items.item
      : Array.isArray(body?.items)
      ? body.items
      : body?.item != null
      ? [body.item]
      : [];
  }

  // 빈 pblancId 제거
  const validItems = items.filter((it) => !!it.pblancId);

  return {
    resultCode: '00',
    resultMsg:  'OK',
    totalCount: totalCount || validItems.length,
    pageIndex,
    pageUnit:   PAGE_SIZE,
    items:      validItems,
  };
}

// ─── 전체 목록 수집 (페이지 순회) ─────────────────────────────────────────

export async function fetchAllOpenPrograms(options?: {
  maxPages?: number;
  includeUpcoming?: boolean;
}): Promise<BizinfoListItem[]> {
  const maxPages       = options?.maxPages ?? 10;       // 최대 10페이지 = 1,000건
  const includeUpcoming = options?.includeUpcoming ?? true;

  const allItems: BizinfoListItem[] = [];

  // 접수중 프로그램
  let page = 1;
  while (page <= maxPages) {
    const resp = await fetchPage(page, { status: 'Y' });
    allItems.push(...resp.items);
    if (resp.items.length < PAGE_SIZE || allItems.length >= resp.totalCount) break;
    page++;
  }

  // 접수예정 프로그램 (선택적)
  if (includeUpcoming) {
    let upPage = 1;
    while (upPage <= Math.min(3, maxPages)) {
      const resp = await fetchPage(upPage, { status: 'O' });
      allItems.push(...resp.items);
      if (resp.items.length < PAGE_SIZE) break;
      upPage++;
    }
  }

  // 중복 제거 (pblancId 기준)
  const seen = new Set<string>();
  return allItems.filter((item) => {
    if (seen.has(item.pblancId)) return false;
    seen.add(item.pblancId);
    return true;
  });
}

// ─── 상세 API 타입 ────────────────────────────────────────────────────────

export interface BizinfoDetailItem {
  pblancId:        string;
  pblancNm:        string;
  applyTarget?:    string;   // 신청대상
  sprtCn?:         string;   // 지원내용
  applyMthd?:      string;   // 신청방법
  bsnsSumryCn?:    string;   // 사업요약
  totPblancAmt?:   string;   // 총지원금액
  sprtAmt?:        string;   // 지원금액
  reqstDt?:        string;   // 신청기간
  jrsdInsttNm?:    string;
  bsnsChrgDeptNm?: string;
  detlUrl?:        string;
  [key: string]: unknown;
}

/**
 * Bizinfo 상세 API 호출
 * GET /uss/rss/bizinfoApi.do?crtfcKey={key}&pblancId={id}&dataType=json
 * 실패 시 null 반환 (graceful degradation)
 */
export async function fetchBizinfoDetail(pblancId: string): Promise<BizinfoDetailItem | null> {
  const key = getApiKey();
  if (!key) return null;

  try {
    const url = new URL(BIZINFO_BASE);
    url.searchParams.set('crtfcKey', key);
    url.searchParams.set('pblancId', pblancId);
    url.searchParams.set('dataType', 'json');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;

    const json = await res.json() as Record<string, unknown>;

    // 응답 구조: { result: {...} } 또는 { resultData: {...} } 또는 배열
    const detail = (
      (json.result as BizinfoDetailItem | undefined) ??
      (json.resultData as BizinfoDetailItem | undefined) ??
      ((Array.isArray(json.items) ? json.items[0] : null) as BizinfoDetailItem | null)
    );

    return detail ?? null;
  } catch {
    return null;
  }
}

/**
 * 상세 API 데이터로 ParsedProgram 보강
 * 기존 parsed 값을 덮어쓰지 않고 null/빈 값만 채움
 */
export function enrichWithDetail(
  base: ParsedProgram,
  detail: BizinfoDetailItem,
): ParsedProgram {
  // applyTarget + sprtCn을 합쳐서 더 풍부한 텍스트 생성
  const extraText = [
    detail.applyTarget && `신청대상: ${detail.applyTarget}`,
    detail.sprtCn      && `지원내용: ${detail.sprtCn}`,
    detail.applyMthd   && `신청방법: ${detail.applyMthd}`,
  ].filter(Boolean).join('\n');

  if (!extraText) return base;

  const cleanExtra = stripHtml(extraText) ?? '';
  const extracted  = extractProgramDetails((base.description ?? '') + ' ' + cleanExtra);

  return {
    ...base,
    description:         base.description ?? stripHtml(detail.bsnsSumryCn) ?? null,
    eligibility_summary: base.eligibility_summary ?? extracted.eligibility_summary,
    target_company_size: base.target_company_size.length > 0
      ? base.target_company_size
      : extracted.target_company_size,
    target_industries:   base.target_industries.length > 0
      ? base.target_industries
      : extracted.target_industries,
    funding_amount_max:  base.funding_amount_max ?? extracted.funding_amount_max,
    funding_amount_min:  base.funding_amount_min ?? extracted.funding_amount_min,
    min_employee_count:  base.min_employee_count ?? extracted.min_employee_count,
    max_employee_count:  base.max_employee_count ?? extracted.max_employee_count,
    min_company_age:     base.min_company_age    ?? extracted.min_company_age,
    max_company_age:     base.max_company_age    ?? extracted.max_company_age,
    self_funding_ratio:  base.self_funding_ratio ?? extracted.self_funding_ratio,
  };
}

// ─── 단건 상세 조회 (레거시 - 목록 검색 방식) ─────────────────────────────

export async function fetchProgramDetail(pblancId: string): Promise<BizinfoListItem | null> {
  try {
    const resp = await fetchPage(1, { keyword: pblancId });
    return resp.items[0] ?? null;
  } catch {
    return null;
  }
}

// ─── BizinfoListItem → programs 테이블 행 변환 ───────────────────────────

export interface ParsedProgram {
  external_id:          string;
  source:               string;
  title:                string;
  managing_org:         string | null;
  category:             string;
  support_type:         string | null;
  target_regions:       string[];
  target_industries:    string[];
  target_company_size:  string[];
  min_employee_count:   number | null;
  max_employee_count:   number | null;
  min_revenue:          number | null;
  max_revenue:          number | null;
  min_company_age:      number | null;
  max_company_age:      number | null;
  funding_amount_min:   number | null;
  funding_amount_max:   number | null;
  self_funding_ratio:   number | null;
  application_start:    string | null;
  application_end:      string | null;
  status:               'open' | 'upcoming' | 'closed';
  description:          string | null;
  eligibility_summary:  string | null;
  detail_url:           string | null;
  raw_data:             Record<string, unknown>;
  last_synced_at:       string;
}

// 제목의 [경남], [대구ㆍ경북], [서울] 등 지역 태그를 전체 시도명으로 변환
const REGION_TAG_MAP: Record<string, string> = {
  '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시',
  '인천': '인천광역시', '광주': '광주광역시', '대전': '대전광역시',
  '울산': '울산광역시', '세종': '세종특별자치시', '경기': '경기도',
  '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도',
  '전북': '전북특별자치도', '전남': '전라남도',
  '경북': '경상북도', '경남': '경상남도', '제주': '제주특별자치도',
};
function extractRegionsFromTitle(title: string): string[] {
  // "[경남]", "[대구ㆍ경북]", "[서울·경기]" 등 처리
  const match = title.match(/^\[([^\]]+)\]/);
  if (!match) return [];
  const tag = match[1];
  const result: string[] = [];
  // ·, ㆍ, ,, / 등 구분자로 split
  tag.split(/[·ㆍ,\/]/).forEach(part => {
    const key = part.trim().slice(0, 2); // 앞 2글자로 매핑 (경남→경남)
    const full = REGION_TAG_MAP[key] ?? REGION_TAG_MAP[part.trim()];
    if (full && !result.includes(full)) result.push(full);
  });
  return result;
}

export function parseBizinfoItem(item: BizinfoListItem): ParsedProgram {
  const regions: string[] = [];
  if (item.ctpvNm) {
    // "서울특별시,경기도" 형태 처리
    item.ctpvNm.split(/[,，]/).forEach((r) => {
      const trimmed = r.trim();
      if (trimmed) regions.push(trimmed);
    });
  }
  // ctpvNm 없으면 제목의 [지역] 태그에서 추출
  if (regions.length === 0) {
    extractRegionsFromTitle(item.pblancNm ?? '').forEach(r => regions.push(r));
  }

  // reqstDt 우선, 없으면 pbancBgngYmd/pbancEndYmd fallback
  const reqst = parseReqstDt(item.reqstDt ?? item.reqstBeginEndDe);
  const start = reqst.start ?? parseKorDate(item.pbancBgngYmd);
  const end   = reqst.end   ?? parseKorDate(item.pbancEndYmd);

  // jrsdInsttNm이 개인 이름이면 bsnsChrgDeptNm(담당부서)을 기관명으로 사용
  const managingOrg = isPersonName(item.jrsdInsttNm)
    ? (item.bsnsChrgDeptNm || item.jrsdInsttNm || null)
    : (item.jrsdInsttNm || null);

  const cleanDesc = stripHtml(item.bsnsSumryCn);
  const extracted = extractProgramDetails(cleanDesc);

  return {
    external_id:          `bizinfo_${item.pblancId}`,
    source:               'bizinfo',
    title:                item.pblancNm,
    managing_org:         managingOrg,
    category:             guessCategory(item),
    support_type:         null,
    target_regions:       regions,
    target_industries:    extracted.target_industries,
    target_company_size:  extracted.target_company_size,
    min_employee_count:   extracted.min_employee_count,
    max_employee_count:   extracted.max_employee_count,
    min_revenue:          null,
    max_revenue:          null,
    min_company_age:      extracted.min_company_age,
    max_company_age:      extracted.max_company_age,
    funding_amount_min:   extracted.funding_amount_min,
    funding_amount_max:   extracted.funding_amount_max,
    self_funding_ratio:   extracted.self_funding_ratio,
    application_start:    start,
    application_end:      end,
    status:               mapStatus(item.pgmSttusNm, start, end),
    description:          cleanDesc,
    eligibility_summary:  extracted.eligibility_summary,
    detail_url:           item.detlUrl ?? `https://www.bizinfo.go.kr/web/pgm/pgm030/view.do?pblancId=${item.pblancId}`,
    raw_data:             item as unknown as Record<string, unknown>,
    last_synced_at:       new Date().toISOString(),
  };
}
