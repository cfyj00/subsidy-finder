/**
 * Bizinfo (기업마당) Open API 클라이언트
 *
 * API 키 발급: https://www.bizinfo.go.kr → 마이페이지 → Open API 신청
 * 환경변수: BIZINFO_API_KEY (또는 DATA_GO_KR_API_KEY)
 */

// ─── 응답 타입 ──────────────────────────────────────────────────────────────

export interface BizinfoListItem {
  pblancId: string;           // 공고 ID
  pblancNm: string;           // 공고명 (사업명)
  jrsdInsttNm: string;        // 주관기관명
  creatPnttm: string;         // 생성 시점 (YYYYMMDDHHMMSS)
  pbancBgngYmd: string;       // 공고 시작일 (YYYYMMDD)
  pbancEndYmd: string;        // 공고 종료일 (YYYYMMDD)
  pgmSttusNm: string;         // 상태: '접수중' | '접수예정' | '접수마감'
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
  const key = process.env.BIZINFO_API_KEY ?? process.env.DATA_GO_KR_API_KEY ?? '';
  return key;
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

// ─── 상태 → DB status 매핑 ────────────────────────────────────────────────

function mapStatus(pgmSttusNm: string): 'open' | 'upcoming' | 'closed' {
  if (pgmSttusNm.includes('접수중'))   return 'open';
  if (pgmSttusNm.includes('접수예정')) return 'upcoming';
  return 'closed';
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
    throw new Error('BIZINFO_API_KEY 또는 DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const params = new URLSearchParams({
    serviceKey: key,
    pageUnit:   String(PAGE_SIZE),
    pageIndex:  String(pageIndex),
    type:       'json',
  });

  if (options?.status)  params.set('pbancSttus', options.status);
  if (options?.keyword) params.set('pbanc_nm',   options.keyword);

  const url = `${BIZINFO_BASE}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next:    { revalidate: 0 },         // no cache
  });

  if (!res.ok) {
    throw new Error(`Bizinfo API HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  // 응답 구조 정규화 (bizinfo는 중첩 구조로 반환할 수 있음)
  const data = json?.response ?? json;
  const body = data?.body ?? data;

  const items: BizinfoListItem[] = Array.isArray(body?.items?.item)
    ? body.items.item
    : Array.isArray(body?.items)
    ? body.items
    : body?.item != null
    ? [body.item]
    : [];

  return {
    resultCode: data?.header?.resultCode ?? '00',
    resultMsg:  data?.header?.resultMsg  ?? 'OK',
    totalCount: Number(body?.totalCount ?? items.length),
    pageIndex,
    pageUnit:   PAGE_SIZE,
    items,
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

// ─── 단건 상세 조회 ────────────────────────────────────────────────────────

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
  external_id:         string;
  source:              string;
  title:               string;
  managing_org:        string | null;
  category:            string;
  support_type:        string | null;
  target_regions:      string[];
  application_start:   string | null;
  application_end:     string | null;
  status:              'open' | 'upcoming' | 'closed';
  description:         string | null;
  detail_url:          string | null;
  raw_data:            Record<string, unknown>;
  last_synced_at:      string;
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

  return {
    external_id:       `bizinfo_${item.pblancId}`,
    source:            'bizinfo',
    title:             item.pblancNm,
    managing_org:      item.jrsdInsttNm || null,
    category:          guessCategory(item),
    support_type:      null,           // 세부 정보 부족 — 상세 조회로 보완 가능
    target_regions:    regions,
    application_start: parseKorDate(item.pbancBgngYmd),
    application_end:   parseKorDate(item.pbancEndYmd),
    status:            mapStatus(item.pgmSttusNm),
    description:       item.bsnsSumryCn ?? null,
    detail_url:        item.detlUrl ?? `https://www.bizinfo.go.kr/web/pgm/pgm030/view.do?pblancId=${item.pblancId}`,
    raw_data:          item as unknown as Record<string, unknown>,
    last_synced_at:    new Date().toISOString(),
  };
}
