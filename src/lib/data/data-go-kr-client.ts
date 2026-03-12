/**
 * 중소벤처기업부 사업공고 Open API 클라이언트 (data.go.kr)
 *
 * API 키 발급:
 *   1. https://www.data.go.kr 회원가입 후 로그인
 *   2. "중소벤처기업부_사업공고" 검색 → 활용신청
 *   3. 마이페이지 → 인증키 확인
 *
 * 환경변수: DATA_GO_KR_API_KEY
 * 엔드포인트: https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2
 */

import type { ParsedProgram } from './bizinfo-client';
import { stripHtml } from './utils';

// ── 타입 ───────────────────────────────────────────────────────────────────

interface DataGoKrItem {
  itemId:               string;
  title:                string;
  dataContents:         string;
  applicationStartDate: string;   // YYYY-MM-DD
  applicationEndDate:   string;   // YYYY-MM-DD
  viewUrl:              string;
  writerName:           string;
  writerPhone?:         string;
  writerEmail?:         string;
  fileName?:            string;
}

// ── 설정 ───────────────────────────────────────────────────────────────────

const BASE_URL  = 'https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2';
const PAGE_SIZE = 100;

function getApiKey(): string {
  return process.env.DATA_GO_KR_API_KEY ?? '';
}

// ── 날짜 → 상태 매핑 ──────────────────────────────────────────────────────

function calcStatus(
  start: string | null,
  end:   string | null,
): 'open' | 'upcoming' | 'closed' {
  const now = Date.now();
  const s   = start ? new Date(start).getTime() : null;
  const e   = end   ? new Date(end).getTime()   : null;

  if (e && now > e)              return 'closed';
  if (s && now < s)              return 'upcoming';
  if ((!s || now >= s) && (!e || now <= e)) return 'open';
  return 'closed';
}

// ── 카테고리 추측 ─────────────────────────────────────────────────────────

function guessCategory(title: string, contents: string): string {
  const text = `${title} ${contents}`;
  if (/R&D|기술개발|연구개발|특허/.test(text))       return '기술';
  if (/창업|스타트업|예비창업/.test(text))            return '창업';
  if (/수출|해외|글로벌/.test(text))                  return '수출';
  if (/인력|채용|고용|인건비/.test(text))             return '인력';
  if (/융자|대출|보증|보조금|자금/.test(text))        return '금융';
  if (/판로|마케팅|내수/.test(text))                  return '내수';
  if (/스마트|디지털|경영혁신|컨설팅/.test(text))     return '경영';
  return '기타';
}

// ── XML 파서 ──────────────────────────────────────────────────────────────

function parseXml(text: string): { items: DataGoKrItem[]; totalCount: number } {
  const get = (tag: string, block: string): string => {
    const m = block.match(
      new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`),
    );
    return m ? (m[1] ?? m[2] ?? '').trim() : '';
  };

  const countMatch = text.match(/<totalCount[^>]*>(\d+)<\/totalCount>/);
  const totalCount = countMatch ? Number(countMatch[1]) : 0;

  const items: DataGoKrItem[] = [];
  for (const match of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const itemId = get('itemId', block);
    if (!itemId) continue;
    items.push({
      itemId,
      title:                get('title',                block),
      dataContents:         get('dataContents',         block),
      applicationStartDate: get('applicationStartDate', block),
      applicationEndDate:   get('applicationEndDate',   block),
      viewUrl:              get('viewUrl',               block),
      writerName:           get('writerName',            block),
      writerPhone:          get('writerPhone',           block) || undefined,
      writerEmail:          get('writerEmail',           block) || undefined,
    });
  }

  return { items, totalCount };
}

// ── 단일 페이지 요청 ──────────────────────────────────────────────────────

async function fetchPage(
  pageNo: number,
  options?: { startDate?: string; endDate?: string },
): Promise<{ items: DataGoKrItem[]; totalCount: number }> {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.\n' +
      '발급: https://www.data.go.kr → "중소벤처기업부_사업공고" 검색 → 활용신청',
    );
  }

  const params = new URLSearchParams({
    serviceKey: key,
    pageNo:     String(pageNo),
    numOfRows:  String(PAGE_SIZE),
  });

  if (options?.startDate) params.set('startDate', options.startDate);
  if (options?.endDate)   params.set('endDate',   options.endDate);

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Accept: 'application/xml, text/xml' },
    next:    { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`data.go.kr API HTTP ${res.status}: ${res.statusText}`);
  }

  const text = await res.text();

  // 오류 응답 확인
  const errCode = text.match(/<resultCode[^>]*>([^<]+)<\/resultCode>/)?.[1]?.trim();
  if (errCode && errCode !== '00' && errCode !== '0000') {
    const errMsg = text.match(/<resultMsg[^>]*>([^<]+)<\/resultMsg>/)?.[1]?.trim();
    throw new Error(`data.go.kr API 오류 ${errCode}: ${errMsg}`);
  }

  return parseXml(text);
}

// ── 전체 목록 수집 ────────────────────────────────────────────────────────

export async function fetchAllMssBizPrograms(options?: {
  maxPages?: number;
  daysBack?: number;
}): Promise<DataGoKrItem[]> {
  const maxPages = options?.maxPages ?? 5;
  const daysBack = options?.daysBack ?? 90;

  // 최근 N일 공고 기준
  const endDate   = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

  const allItems: DataGoKrItem[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const { items, totalCount } = await fetchPage(page, { startDate, endDate });
    allItems.push(...items);
    if (items.length < PAGE_SIZE || allItems.length >= totalCount) break;
  }

  // 중복 제거
  const seen = new Set<string>();
  return allItems.filter(item => {
    if (seen.has(item.itemId)) return false;
    seen.add(item.itemId);
    return true;
  });
}

// ── DataGoKrItem → ParsedProgram 변환 ─────────────────────────────────────

export function parseDataGoKrItem(item: DataGoKrItem): ParsedProgram {
  const start = item.applicationStartDate || null;
  const end   = item.applicationEndDate   || null;

  return {
    external_id:       `datagokr_${item.itemId}`,
    source:            'datagokr',
    title:             item.title,
    managing_org:      '중소벤처기업부',   // writerName은 개인 이름 → 소스 기관명으로 고정
    category:          guessCategory(item.title, item.dataContents),
    support_type:      null,
    target_regions:    [],
    application_start: start,
    application_end:   end,
    status:            calcStatus(start, end),
    description:       stripHtml(item.dataContents),
    detail_url:        item.viewUrl || null,
    raw_data:          item as unknown as Record<string, unknown>,
    last_synced_at:    new Date().toISOString(),
  };
}
