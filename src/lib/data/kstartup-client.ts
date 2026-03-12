/**
 * K-Startup (창업진흥원) Open API 클라이언트
 *
 * 창업진흥원이 운영하는 창업·벤처 지원 공고 API.
 * 예비창업자, 초기창업자, 도약기 기업 등 창업 단계별 지원사업 포함.
 * 지역별 창업지원도 포함 (서울, 경기, 부산 등 지자체 위탁 사업).
 *
 * API 키 발급:
 *   1. https://www.data.go.kr 로그인
 *   2. "창업진흥원 창업공고" 또는 "K-Startup" 검색 → 활용신청
 *   3. 기존 DATA_GO_KR_API_KEY 사용 (동일한 data.go.kr 계정)
 *
 * 환경변수: KSTARTUP_API_KEY (없으면 DATA_GO_KR_API_KEY 대체)
 * 엔드포인트: https://apis.data.go.kr/B490001/kisedKstartupService/getAnnouncementInformation
 */

import type { ParsedProgram } from './bizinfo-client';
import { stripHtml } from './utils';

// ── 타입 ────────────────────────────────────────────────────────────────────

export interface KStartupItem {
  pbanc_sn:          string;   // 공고 일련번호
  biz_pbanc_nm:      string;   // 사업 공고명
  pbanc_rcpt_bgng_dt: string;  // 접수 시작일 (YYYY-MM-DD)
  pbanc_rcpt_end_dt:  string;  // 접수 종료일 (YYYY-MM-DD)
  rcrt_prgs_yn:       string;  // 모집 진행 여부 ('Y'|'N')
  supt_regin?:        string;  // 지원 지역
  aply_trgt_ctnt?:    string;  // 신청 대상 내용
  supt_biz_clsfc?:    string;  // 지원 사업 분류
  biz_entr_clsfc_nm?: string;  // 기업 분류명
  tot_supt_amt?:      string;  // 총 지원금액
  pbanc_url?:         string;  // 공고 URL
  jrsd_instt_nm?:     string;  // 주관기관명
  biz_prch_dprt_nm?:  string;  // 사업 담당 부서명
}

// ── 설정 ────────────────────────────────────────────────────────────────────

const BASE_URL  = 'https://apis.data.go.kr/B490001/kisedKstartupService/getAnnouncementInformation';
const PAGE_SIZE = 100;

function getApiKey(): string {
  return (
    process.env.KSTARTUP_API_KEY ??
    process.env.DATA_GO_KR_API_KEY ??
    ''
  );
}

// ── 카테고리 추측 ────────────────────────────────────────────────────────────

function guessCategory(item: KStartupItem): string {
  const text = `${item.biz_pbanc_nm} ${item.supt_biz_clsfc ?? ''} ${item.aply_trgt_ctnt ?? ''}`;
  if (/R&D|기술개발|연구개발|특허/.test(text))       return '기술';
  if (/예비창업|초기창업|창업|스타트업/.test(text))   return '창업';
  if (/수출|해외|글로벌/.test(text))                  return '수출';
  if (/인력|채용|고용/.test(text))                    return '인력';
  if (/융자|보증|투자|자금/.test(text))               return '금융';
  if (/판로|마케팅|내수/.test(text))                  return '내수';
  if (/디지털|스마트|경영혁신/.test(text))             return '경영';
  return '창업'; // K-Startup은 기본적으로 창업 지원
}

// ── 상태 계산 ────────────────────────────────────────────────────────────────

function calcStatus(
  rcrtPrgsYn: string,
  startDate:  string | null,
  endDate:    string | null,
): 'open' | 'upcoming' | 'closed' {
  if (rcrtPrgsYn === 'N') return 'closed';

  const now = Date.now();
  const s   = startDate ? new Date(startDate).getTime() : null;
  const e   = endDate   ? new Date(endDate).getTime()   : null;

  if (e && now > e)   return 'closed';
  if (s && now < s)   return 'upcoming';
  return 'open';
}

// ── XML 파서 (data.go.kr API는 XML 또는 JSON 응답) ──────────────────────────

function parseXml(text: string): { items: KStartupItem[]; totalCount: number } {
  const get = (tag: string, block: string): string => {
    const m = block.match(
      new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`),
    );
    return m ? (m[1] ?? m[2] ?? '').trim() : '';
  };

  const countMatch = text.match(/<totalCount[^>]*>(\d+)<\/totalCount>/);
  const totalCount = countMatch ? Number(countMatch[1]) : 0;

  const items: KStartupItem[] = [];
  for (const match of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const sn = get('pbanc_sn', block) || get('pbancSn', block);
    if (!sn) continue;

    items.push({
      pbanc_sn:           sn,
      biz_pbanc_nm:       get('biz_pbanc_nm',      block) || get('bizPbancNm',     block),
      pbanc_rcpt_bgng_dt: get('pbanc_rcpt_bgng_dt', block) || get('pbancRcptBgngDt', block),
      pbanc_rcpt_end_dt:  get('pbanc_rcpt_end_dt',  block) || get('pbancRcptEndDt',  block),
      rcrt_prgs_yn:       get('rcrt_prgs_yn',        block) || get('rcrtPrgsYn',      block) || 'Y',
      supt_regin:         get('supt_regin',          block) || get('suptRegin',       block) || undefined,
      aply_trgt_ctnt:     get('aply_trgt_ctnt',      block) || get('aplyTrgtCtnt',    block) || undefined,
      supt_biz_clsfc:     get('supt_biz_clsfc',      block) || get('suptBizClsfc',    block) || undefined,
      biz_entr_clsfc_nm:  get('biz_entr_clsfc_nm',   block) || get('bizEntrClsfcNm',  block) || undefined,
      tot_supt_amt:       get('tot_supt_amt',         block) || get('totSuptAmt',      block) || undefined,
      pbanc_url:          get('pbanc_url',            block) || get('pbancUrl',        block) || undefined,
      jrsd_instt_nm:      get('jrsd_instt_nm',        block) || get('jrsdInsttNm',     block) || undefined,
      biz_prch_dprt_nm:   get('biz_prch_dprt_nm',     block) || get('bizPrchDprtNm',   block) || undefined,
    });
  }

  return { items, totalCount };
}

// ── 단일 페이지 요청 ─────────────────────────────────────────────────────────

async function fetchPage(
  pageNo: number,
): Promise<{ items: KStartupItem[]; totalCount: number }> {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'KSTARTUP_API_KEY(또는 DATA_GO_KR_API_KEY) 환경변수가 설정되지 않았습니다.\n' +
      '발급: https://www.data.go.kr → "창업진흥원" 또는 "K-Startup" 검색 → 활용신청',
    );
  }

  const params = new URLSearchParams({
    serviceKey: key,
    pageNo:     String(pageNo),
    numOfRows:  String(PAGE_SIZE),
  });

  const url = `${BASE_URL}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/xml, text/xml' },
    next:    { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`K-Startup API HTTP ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();

  // JSON 응답 처리
  if (contentType.includes('json')) {
    try {
      const json = JSON.parse(text);
      const body = json?.response?.body ?? json?.body ?? json;
      const rawItems = Array.isArray(body?.items?.item) ? body.items.item
                     : Array.isArray(body?.items)       ? body.items
                     : [];
      return {
        items:      rawItems as KStartupItem[],
        totalCount: Number(body?.totalCount ?? rawItems.length),
      };
    } catch {
      // fall through to XML
    }
  }

  // 오류 코드 확인
  const errCode = text.match(/<resultCode[^>]*>([^<]+)<\/resultCode>/)?.[1]?.trim();
  if (errCode && errCode !== '00' && errCode !== '0000') {
    const errMsg = text.match(/<resultMsg[^>]*>([^<]+)<\/resultMsg>/)?.[1]?.trim();
    throw new Error(`K-Startup API 오류 ${errCode}: ${errMsg}`);
  }

  return parseXml(text);
}

// ── 전체 목록 수집 ───────────────────────────────────────────────────────────

export async function fetchAllKStartupPrograms(options?: {
  maxPages?: number;
}): Promise<KStartupItem[]> {
  const maxPages = options?.maxPages ?? 5;

  const allItems: KStartupItem[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const { items, totalCount } = await fetchPage(page);
    allItems.push(...items);
    if (items.length < PAGE_SIZE || allItems.length >= totalCount) break;
  }

  // 중복 제거
  const seen = new Set<string>();
  return allItems.filter(item => {
    const key = item.pbanc_sn;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── 지역 파싱 ────────────────────────────────────────────────────────────────

function parseRegions(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,，/]/)
    .map(r => r.trim())
    .filter(r => r.length > 0 && r !== '전국');
}

// ── KStartupItem → ParsedProgram 변환 ───────────────────────────────────────

export function parseKStartupItem(item: KStartupItem): ParsedProgram {
  const start = item.pbanc_rcpt_bgng_dt || null;
  const end   = item.pbanc_rcpt_end_dt  || null;

  return {
    external_id:       `kstartup_${item.pbanc_sn}`,
    source:            'kstartup',
    title:             item.biz_pbanc_nm,
    managing_org:      item.jrsd_instt_nm || '창업진흥원',
    category:          guessCategory(item),
    support_type:      null,
    target_regions:    parseRegions(item.supt_regin),
    application_start: start,
    application_end:   end,
    status:            calcStatus(item.rcrt_prgs_yn, start, end),
    description:       stripHtml(item.aply_trgt_ctnt),
    detail_url:        item.pbanc_url || `https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do`,
    raw_data:          item as unknown as Record<string, unknown>,
    last_synced_at:    new Date().toISOString(),
  };
}
