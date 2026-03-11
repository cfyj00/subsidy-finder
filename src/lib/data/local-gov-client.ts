/**
 * 광역시도 공공데이터 클라이언트
 *
 * 서울특별시, 경기도, 부산광역시, 충청북도 각자 공공데이터 포털에서
 * 기업지원/소상공인/창업 지원사업 공고를 수집합니다.
 *
 * API 키 발급 (각 포털에서 별도 신청):
 *   - 서울:  https://data.seoul.go.kr → 개발자 API → 인증키 발급
 *   - 경기:  https://openapi.gg.go.kr → 회원가입 → API 키 발급
 *   - 부산:  https://www.data.busan.go.kr → 공공데이터 활용신청
 *   - 충북:  https://www.data.cb.go.kr → 회원가입 → 활용신청
 *
 * 환경변수:
 *   SEOUL_API_KEY    서울 열린데이터광장 인증키
 *   GYEONGGI_API_KEY 경기도 공공데이터 인증키
 *   BUSAN_API_KEY    부산광역시 공공데이터 인증키
 *   CHUNGBUK_API_KEY 충청북도 공공데이터 인증키
 *
 * ※ 키가 없는 시도는 조용히 건너뜁니다 (graceful skip).
 */

import type { ParsedProgram } from './bizinfo-client';

// ── 공통 유틸 ────────────────────────────────────────────────────────────────

function guessCategory(text: string): string {
  if (/R&D|기술개발|연구개발|특허/.test(text))       return '기술';
  if (/창업|스타트업|예비창업/.test(text))            return '창업';
  if (/수출|해외|글로벌/.test(text))                  return '수출';
  if (/인력|채용|고용|인건비/.test(text))             return '인력';
  if (/융자|대출|보증|보조금|자금/.test(text))        return '금융';
  if (/판로|마케팅|내수/.test(text))                  return '내수';
  if (/스마트|디지털|경영혁신|컨설팅/.test(text))     return '경영';
  if (/소상공인|자영업/.test(text))                   return '금융';
  return '기타';
}

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

/** YYYYMMDD → YYYY-MM-DD */
function toIsoDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const clean = raw.replace(/\./g, '-').replace(/\//g, '-');
  // YYYYMMDD → YYYY-MM-DD
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`;
  }
  // 이미 YYYY-MM-DD 형태
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 서울특별시  (열린데이터광장)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 서울시 기업지원 사업공고
 * 서비스명: TBiz_SupportProject (기업지원사업)
 * URL 예시: http://openapi.seoul.go.kr:8088/{KEY}/json/TBiz_SupportProject/1/100/
 */

interface SeoulBizItem {
  BIZ_CD?:        string;  // 사업코드
  BIZ_NM:         string;  // 사업명
  AGENCY_NM?:     string;  // 주관기관
  RCRIT_BGNG_DE?: string;  // 모집시작일
  RCRIT_END_DE?:  string;  // 모집종료일
  BIZ_CN?:        string;  // 사업내용
  APPLY_URL?:     string;  // 신청 URL
  BIZ_SE_NM?:     string;  // 사업구분명
}

async function fetchSeoulPrograms(): Promise<ParsedProgram[]> {
  const key = process.env.SEOUL_API_KEY;
  if (!key) return [];

  const results: ParsedProgram[] = [];

  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/TBiz_SupportProject/1/100/`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const json = await res.json();
    const items: SeoulBizItem[] = json?.TBiz_SupportProject?.row ?? [];

    for (const item of items) {
      if (!item.BIZ_NM) continue;
      const start = toIsoDate(item.RCRIT_BGNG_DE);
      const end   = toIsoDate(item.RCRIT_END_DE);
      const status = calcStatus(start, end);
      if (status === 'closed') continue;

      const text = `${item.BIZ_NM} ${item.BIZ_CN ?? ''}`;
      results.push({
        external_id:       `seoul_${item.BIZ_CD ?? item.BIZ_NM.slice(0,20).replace(/\s/g,'_')}`,
        source:            'seoul',
        title:             item.BIZ_NM,
        managing_org:      item.AGENCY_NM || '서울특별시',
        category:          guessCategory(text),
        support_type:      null,
        target_regions:    ['서울특별시'],
        application_start: start,
        application_end:   end,
        status,
        description:       item.BIZ_CN || null,
        detail_url:        item.APPLY_URL || 'https://biz.seoul.go.kr',
        raw_data:          item as unknown as Record<string, unknown>,
        last_synced_at:    new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('[local-gov] 서울 API 오류:', e);
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// 경기도  (경기데이터드림)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 경기도 중소기업 지원사업
 * URL: https://openapi.gg.go.kr/SmBizSuptBsns
 */

interface GyeonggiItem {
  SIGUN_NM?:       string;  // 시군명
  BIZPLN_NM?:      string;  // 사업계획명
  OPNNG_INSTT_NM?: string;  // 개설기관명
  RCRIT_BGNG_YMD?: string;  // 모집 시작일
  RCRIT_CLSR_YMD?: string;  // 모집 마감일
  SFRND_DETAIL_CN?: string; // 지원 세부내용
  LINK_URL?:       string;  // 링크 URL
}

async function fetchGyeonggiPrograms(): Promise<ParsedProgram[]> {
  const key = process.env.GYEONGGI_API_KEY;
  if (!key) return [];

  const results: ParsedProgram[] = [];

  try {
    const params = new URLSearchParams({
      KEY:      key,
      TYPE:     'json',
      pIndex:   '1',
      pSize:    '100',
    });
    const url = `https://openapi.gg.go.kr/SmBizSuptBsns?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const json = await res.json();
    const items: GyeonggiItem[] = json?.SmBizSuptBsns?.[1]?.row ?? [];

    for (const item of items) {
      const title = item.BIZPLN_NM;
      if (!title) continue;
      const start = toIsoDate(item.RCRIT_BGNG_YMD);
      const end   = toIsoDate(item.RCRIT_CLSR_YMD);
      const status = calcStatus(start, end);
      if (status === 'closed') continue;

      const text = `${title} ${item.SFRND_DETAIL_CN ?? ''}`;
      const region = item.SIGUN_NM ? `경기도 ${item.SIGUN_NM}` : '경기도';
      const safeKey = `${item.OPNNG_INSTT_NM ?? ''}_${title}`.slice(0, 30).replace(/\s/g, '_');

      results.push({
        external_id:       `gyeonggi_${safeKey}`,
        source:            'gyeonggi',
        title,
        managing_org:      item.OPNNG_INSTT_NM || '경기도',
        category:          guessCategory(text),
        support_type:      null,
        target_regions:    [region],
        application_start: start,
        application_end:   end,
        status,
        description:       item.SFRND_DETAIL_CN || null,
        detail_url:        item.LINK_URL || 'https://www.gg.go.kr',
        raw_data:          item as unknown as Record<string, unknown>,
        last_synced_at:    new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('[local-gov] 경기 API 오류:', e);
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// 부산광역시  (부산광역시 공공데이터 포털)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 부산시 소상공인/중소기업 지원사업
 * URL: https://www.data.busan.go.kr/openApi/call/json/{serviceName}
 *
 * 실제 서비스명은 포털에서 확인 필요.
 * 여기서는 "busan_bizsupt" (중소기업지원사업) 를 사용.
 */

interface BusanBizItem {
  BIZ_NM?:        string;  // 사업명
  JRSD_INSTT_NM?: string;  // 주관기관명
  RCRIT_BGNG_DE?: string;  // 접수 시작일
  RCRIT_END_DE?:  string;  // 접수 마감일
  BIZ_SUMRY_CN?:  string;  // 사업 요약
  DETAIL_URL?:    string;  // 상세 URL
  BIZ_ID?:        string;  // 사업 ID
}

async function fetchBusanPrograms(): Promise<ParsedProgram[]> {
  const key = process.env.BUSAN_API_KEY;
  if (!key) return [];

  const results: ParsedProgram[] = [];

  try {
    const params = new URLSearchParams({
      apiKey:   key,
      pageIndex: '1',
      pageSize:  '100',
      resultType: 'json',
    });
    const url = `https://www.data.busan.go.kr/openApi/call/json/15121066?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const json = await res.json();
    // 부산 API 응답 구조는 서비스마다 다름 — 여러 형태 시도
    const items: BusanBizItem[] =
      json?.items ?? json?.list ?? json?.data ?? json?.response?.body?.items?.item ?? [];

    const itemArray = Array.isArray(items) ? items : [items];

    for (const item of itemArray) {
      const title = item.BIZ_NM;
      if (!title) continue;
      const start = toIsoDate(item.RCRIT_BGNG_DE);
      const end   = toIsoDate(item.RCRIT_END_DE);
      const status = calcStatus(start, end);
      if (status === 'closed') continue;

      const text = `${title} ${item.BIZ_SUMRY_CN ?? ''}`;

      results.push({
        external_id:       `busan_${item.BIZ_ID ?? title.slice(0,20).replace(/\s/g,'_')}`,
        source:            'busan',
        title,
        managing_org:      item.JRSD_INSTT_NM || '부산광역시',
        category:          guessCategory(text),
        support_type:      null,
        target_regions:    ['부산광역시'],
        application_start: start,
        application_end:   end,
        status,
        description:       item.BIZ_SUMRY_CN || null,
        detail_url:        item.DETAIL_URL || 'https://www.busan.go.kr',
        raw_data:          item as unknown as Record<string, unknown>,
        last_synced_at:    new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('[local-gov] 부산 API 오류:', e);
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// 충청북도  (충청북도 공공데이터포털)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 충청북도 기업지원 사업공고
 *
 * 충청북도 공공데이터포털: https://www.data.cb.go.kr
 * → 회원가입 후 "중소기업지원사업" 또는 "기업지원공고" 데이터 활용신청
 * → 발급된 API 키를 CHUNGBUK_API_KEY 환경변수에 입력
 *
 * 충북은 data.go.kr 공동 포털도 활용:
 *   https://apis.data.go.kr/6430000/ChungbukBizSuptService/getBizSuptList
 * (기관코드 6430000 = 충청북도)
 */

interface ChungbukBizItem {
  BIZ_ID?:        string;   // 사업 ID
  BIZ_NM:         string;   // 사업명
  JRSD_INSTT_NM?: string;   // 주관기관명
  SIGUN_NM?:      string;   // 시군명
  RCRIT_BGNG_DE?: string;   // 접수 시작일
  RCRIT_END_DE?:  string;   // 접수 마감일
  BIZ_CN?:        string;   // 사업내용
  DETAIL_URL?:    string;   // 상세 URL
  SUPT_AMT?:      string;   // 지원금액
}

function parseXmlBlock(tag: string, block: string): string {
  const m = block.match(
    new RegExp(
      `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`,
    ),
  );
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

async function fetchChungbukPrograms(): Promise<ParsedProgram[]> {
  const key = process.env.CHUNGBUK_API_KEY;
  if (!key) return [];

  const results: ParsedProgram[] = [];

  try {
    // data.go.kr 경유 충청북도 기업지원 API
    const params = new URLSearchParams({
      serviceKey: key,
      pageNo:     '1',
      numOfRows:  '100',
    });
    const url = `https://apis.data.go.kr/6430000/ChungbukBizSuptService/getBizSuptList?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/xml, text/xml' },
      next:    { revalidate: 0 },
    });
    if (!res.ok) return [];

    const text = await res.text();

    // 오류 코드 확인
    const errCode = text.match(/<resultCode[^>]*>([^<]+)<\/resultCode>/)?.[1]?.trim();
    if (errCode && errCode !== '00' && errCode !== '0000') return [];

    // <item> 블록 파싱
    for (const match of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = match[1];
      const title = parseXmlBlock('BIZ_NM', block);
      if (!title) continue;

      const start  = toIsoDate(parseXmlBlock('RCRIT_BGNG_DE', block));
      const end    = toIsoDate(parseXmlBlock('RCRIT_END_DE',  block));
      const status = calcStatus(start, end);
      if (status === 'closed') continue;

      const bizId   = parseXmlBlock('BIZ_ID',       block);
      const sigunNm = parseXmlBlock('SIGUN_NM',     block);
      const content = parseXmlBlock('BIZ_CN',       block);
      const org     = parseXmlBlock('JRSD_INSTT_NM', block);
      const url2    = parseXmlBlock('DETAIL_URL',    block);
      const text2   = `${title} ${content}`;
      const region  = sigunNm ? `충청북도 ${sigunNm}` : '충청북도';

      results.push({
        external_id:       `chungbuk_${bizId || title.slice(0, 20).replace(/\s/g, '_')}`,
        source:            'chungbuk',
        title,
        managing_org:      org || '충청북도',
        category:          guessCategory(text2),
        support_type:      null,
        target_regions:    [region],
        application_start: start,
        application_end:   end,
        status,
        description:       content || null,
        detail_url:        url2 || 'https://www.cb.go.kr',
        raw_data:          { BIZ_ID: bizId, BIZ_NM: title, JRSD_INSTT_NM: org } as Record<string, unknown>,
        last_synced_at:    new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('[local-gov] 충북 API 오류:', e);
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// 통합 진입점
// ══════════════════════════════════════════════════════════════════════════════

export interface LocalGovResult {
  programs: ParsedProgram[];
  errors:   string[];
  counts:   Record<string, number>;
}

/**
 * 서울 + 경기 + 부산 + 충북 병렬 수집
 * 키가 없는 시도는 조용히 빈 배열 반환 (graceful skip)
 */
export async function fetchAllLocalGovPrograms(): Promise<LocalGovResult> {
  const [seoulResult, gyeonggiResult, busanResult, chungbukResult] = await Promise.allSettled([
    fetchSeoulPrograms(),
    fetchGyeonggiPrograms(),
    fetchBusanPrograms(),
    fetchChungbukPrograms(),
  ]);

  const programs: ParsedProgram[] = [];
  const errors:   string[]        = [];
  const counts:   Record<string, number> = {};

  if (seoulResult.status === 'fulfilled') {
    programs.push(...seoulResult.value);
    counts.seoul = seoulResult.value.length;
  } else {
    errors.push(`서울: ${seoulResult.reason}`);
    counts.seoul = 0;
  }

  if (gyeonggiResult.status === 'fulfilled') {
    programs.push(...gyeonggiResult.value);
    counts.gyeonggi = gyeonggiResult.value.length;
  } else {
    errors.push(`경기: ${gyeonggiResult.reason}`);
    counts.gyeonggi = 0;
  }

  if (busanResult.status === 'fulfilled') {
    programs.push(...busanResult.value);
    counts.busan = busanResult.value.length;
  } else {
    errors.push(`부산: ${busanResult.reason}`);
    counts.busan = 0;
  }

  if (chungbukResult.status === 'fulfilled') {
    programs.push(...chungbukResult.value);
    counts.chungbuk = chungbukResult.value.length;
  } else {
    errors.push(`충북: ${chungbukResult.reason}`);
    counts.chungbuk = 0;
  }

  // external_id 기준 중복 제거
  const seen = new Set<string>();
  const deduped = programs.filter(p => {
    if (seen.has(p.external_id)) return false;
    seen.add(p.external_id);
    return true;
  });

  return { programs: deduped, errors, counts };
}
