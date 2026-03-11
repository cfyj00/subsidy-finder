/**
 * 보조금24 (행정안전부) Open API 클라이언트
 *
 * 중앙부처 + 지자체(광역/기초) 보조금을 한 번에 조회할 수 있는 API.
 * 시청·군청·도청 사업까지 포함되어 있어 가장 포괄적.
 *
 * API 키 발급:
 *   1. https://www.data.go.kr 로그인
 *   2. "행정안전부_보조금24_보조사업현황" 또는 "gov24" 검색 → 활용신청
 *   3. 기존 DATA_GO_KR_API_KEY 를 그대로 사용하거나, 별도 키 발급
 *
 * 환경변수: GOV24_API_KEY (없으면 DATA_GO_KR_API_KEY 대체 사용)
 * 엔드포인트: https://api.odcloud.kr/api/gov24/v3/serviceList
 *            (행정안전부_보조금24_지원서비스목록)
 */

import type { ParsedProgram } from './bizinfo-client';

// ── 타입 ────────────────────────────────────────────────────────────────────

export interface Gov24ServiceItem {
  서비스ID:       string;
  서비스명:       string;
  서비스목적:     string;
  소관기관명:     string;
  부서명?:        string;
  서비스분야:     string;   // 복지, 창업, 기업지원 등
  지원유형:       string;   // 현금, 현물, 서비스, 융자 등
  신청기한:       string;   // '상시', 'YYYY-MM-DD' 등
  지원내용:       string;
  선정기준?:      string;
  신청방법?:      string;
  구비서류?:      string;
  온라인신청여부: string;   // 'Y' | 'N'
  서비스URL?:     string;
}

// ── 설정 ────────────────────────────────────────────────────────────────────

// 행정안전부 보조금24 서비스 목록 (오픈 API 플랫폼)
const BASE_URL  = 'https://api.odcloud.kr/api/gov24/v3/serviceList';
const PAGE_SIZE = 100;

function getApiKey(): string {
  return (
    process.env.GOV24_API_KEY ??
    process.env.DATA_GO_KR_API_KEY ??
    ''
  );
}

// ── 카테고리 추측 ────────────────────────────────────────────────────────────

function guessCategory(item: Gov24ServiceItem): string {
  const text = `${item.서비스명} ${item.서비스목적} ${item.서비스분야}`;
  if (/R&D|기술개발|연구개발|특허/.test(text))       return '기술';
  if (/창업|스타트업|예비창업/.test(text))            return '창업';
  if (/수출|해외|글로벌/.test(text))                  return '수출';
  if (/인력|채용|고용|인건비/.test(text))             return '인력';
  if (/융자|대출|보증|보조금|자금/.test(text))        return '금융';
  if (/판로|마케팅|내수/.test(text))                  return '내수';
  if (/스마트|디지털|경영혁신|컨설팅/.test(text))     return '경영';
  if (/복지|의료|주거/.test(text))                    return '복지';
  return '기타';
}

// ── 지원유형 정규화 ──────────────────────────────────────────────────────────

function normalizeSupportType(raw: string): string | null {
  if (!raw) return null;
  if (/현금|보조/.test(raw))  return '현금지원';
  if (/융자|대출/.test(raw))  return '융자';
  if (/현물|물품/.test(raw))  return '현물지원';
  if (/서비스|컨설팅/.test(raw)) return '서비스';
  return raw.trim() || null;
}

// ── 상태 추측 (보조금24는 개별 마감일 없음 → 상시 or open 처리) ─────────────

function calcStatus(deadline: string): 'open' | 'upcoming' | 'closed' {
  const d = (deadline ?? '').trim();
  if (!d || d === '상시' || d === '해당없음' || d === '-') return 'open';

  // YYYY-MM-DD, YYYY.MM.DD, YYYYMMDD 등 날짜 파싱
  const normalized = d.replace(/\./g, '-').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return 'open'; // 파싱 실패 → 상시로 처리

  const now = Date.now();
  if (now > date.getTime()) return 'closed';
  return 'open';
}

// ── 단일 페이지 요청 ─────────────────────────────────────────────────────────

async function fetchPage(page: number): Promise<{ items: Gov24ServiceItem[]; totalCount: number }> {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'GOV24_API_KEY(또는 DATA_GO_KR_API_KEY) 환경변수가 설정되지 않았습니다.\n' +
      '발급: https://www.data.go.kr → "보조금24" 검색 → 활용신청',
    );
  }

  const params = new URLSearchParams({
    serviceKey: key,
    page:       String(page),
    perPage:    String(PAGE_SIZE),
  });

  const url = `${BASE_URL}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next:    { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Gov24 API HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  // 응답 구조: { currentCount, data: [...], matchCount, page, perPage, totalCount }
  if (json?.currentCount === undefined && !Array.isArray(json?.data)) {
    throw new Error(`Gov24 API 응답 구조 오류: ${JSON.stringify(json).slice(0, 200)}`);
  }

  const items = (json.data ?? []) as Gov24ServiceItem[];
  const totalCount = Number(json.totalCount ?? json.matchCount ?? items.length);

  return { items, totalCount };
}

// ── 전체 목록 수집 ───────────────────────────────────────────────────────────

export async function fetchAllGov24Programs(options?: {
  maxPages?: number;
}): Promise<Gov24ServiceItem[]> {
  const maxPages = options?.maxPages ?? 10;

  const allItems: Gov24ServiceItem[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const { items, totalCount } = await fetchPage(page);
    allItems.push(...items);
    if (items.length < PAGE_SIZE || allItems.length >= totalCount) break;
  }

  // 서비스ID 기준 중복 제거
  const seen = new Set<string>();
  return allItems.filter(item => {
    const key = item.서비스ID;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Gov24ServiceItem → ParsedProgram 변환 ───────────────────────────────────

export function parseGov24Item(item: Gov24ServiceItem): ParsedProgram {
  return {
    external_id:       `gov24_${item.서비스ID}`,
    source:            'gov24',
    title:             item.서비스명,
    managing_org:      item.소관기관명 || null,
    category:          guessCategory(item),
    support_type:      normalizeSupportType(item.지원유형),
    target_regions:    [],          // gov24는 지역 필드 없음 (전국 사업)
    application_start: null,        // 보조금24는 상시 신청 위주
    application_end:   item.신청기한 !== '상시' ? item.신청기한 : null,
    status:            calcStatus(item.신청기한),
    description:       item.지원내용 || item.서비스목적 || null,
    detail_url:        item.서비스URL || null,
    raw_data:          item as unknown as Record<string, unknown>,
    last_synced_at:    new Date().toISOString(),
  };
}
