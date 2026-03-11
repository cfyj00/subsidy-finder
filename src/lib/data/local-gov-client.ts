/**
 * 광역시도 공공데이터 클라이언트
 *
 * 서울특별시, 경기도, 부산광역시 각자 공공데이터 포털에서
 * 기업지원/소상공인/창업 지원사업 공고를 수집합니다.
 *
 * ※ 충청북도는 bizinfo API의 ctpvNm 필드로 자동 수집됩니다.
 *   별도 API 없이 기존 동기화에서 충청북도 사업을 포함합니다.
 *
 * API 키 발급 (각 포털에서 별도 신청):
 *   - 서울:  https://data.seoul.go.kr → 개발자 API → 인증키 발급
 *   - 경기:  https://openapi.gg.go.kr → 회원가입 → API 키 발급
 *   - 부산:  https://www.data.busan.go.kr → 공공데이터 활용신청
 *
 * 환경변수:
 *   SEOUL_API_KEY    서울 열린데이터광장 인증키
 *   GYEONGGI_API_KEY 경기도 공공데이터 인증키
 *   BUSAN_API_KEY    부산광역시 공공데이터 인증키
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
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 서울특별시  (열린데이터광장)
// ══════════════════════════════════════════════════════════════════════════════

interface SeoulBizItem {
  BIZ_CD?:        string;
  BIZ_NM:         string;
  AGENCY_NM?:     string;
  RCRIT_BGNG_DE?: string;
  RCRIT_END_DE?:  string;
  BIZ_CN?:        string;
  APPLY_URL?:     string;
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
      const start  = toIsoDate(item.RCRIT_BGNG_DE);
      const end    = toIsoDate(item.RCRIT_END_DE);
      const status = calcStatus(start, end);
      if (status === 'closed') continue;

      results.push({
        external_id:       `seoul_${item.BIZ_CD ?? item.BIZ_NM.slice(0,20).replace(/\s/g,'_')}`,
        source:            'seoul',
        title:             item.BIZ_NM,
        managing_org:      item.AGENCY_NM || '서울특별시',
        category:          guessCategory(`${item.BIZ_NM} ${item.BIZ_CN ?? ''}`),
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

interface GyeonggiItem {
  SIGUN_NM?:        string;
  BIZPLN_NM?:       string;
  OPNNG_INSTT_NM?:  string;
  RCRIT_BGNG_YMD?:  string;
  RCRIT_CLSR_YMD?:  string;
  SFRND_DETAIL_CN?: string;
  LINK_URL?:        string;
}

async function fetchGyeonggiPrograms(): Promise<ParsedProgram[]> {
  const key = process.env.GYEONGGI_API_KEY;
  if (!key) return [];

  const results: ParsedProgram[] = [];
  try {
    const params = new URLSearchParams({ KEY: key, TYPE: 'json', pIndex: '1', pSize: '100' });
    const url = `https://openapi.gg.go.kr/SmBizSuptBsns?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const json = await res.json();
    const items: GyeonggiItem[] = json?.SmBizSuptBsns?.[1]?.row ?? [];

    for (const item of items) {
      const title = item.BIZPLN_NM;
      if (!title) continue;
      const start  = toIsoDate(item.RCRIT_BGNG_YMD);
      const end    = toIsoDate(item.RCRIT_CLSR_YMD);
      const status = calcStatus(start, end);
      if (status === 'closed') continue;

      const region  = item.SIGUN_NM ? `경기도 ${item.SIGUN_NM}` : '경기도';
      const safeKey = `${item.OPNNG_INSTT_NM ?? ''}_${title}`.slice(0, 30).replace(/\s/g, '_');

      results.push({
        external_id:       `gyeonggi_${safeKey}`,
        source:            'gyeonggi',
        title,
        managing_org:      item.OPNNG_INSTT_NM || '경기도',
        category:          guessCategory(`${title} ${item.SFRND_DETAIL_CN ?? ''}`),
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

interface BusanBizItem {
  BIZ_NM?:        string;
  JRSD_INSTT_NM?: string;
  RCRIT_BGNG_DE?: string;
  RCRIT_END_DE?:  string;
  BIZ_SUMRY_CN?:  string;
  DETAIL_URL?:    string;
  BIZ_ID?:        string;
}

async function fetchBusanPrograms(): Promise<ParsedProgram[]> {
  const key = process.env.BUSAN_API_KEY;
  if (!key) return [];

  const results: ParsedProgram[] = [];
  try {
    const params = new URLSearchParams({ apiKey: key, pageIndex: '1', pageSize: '100', resultType: 'json' });
    const url = `https://www.data.busan.go.kr/openApi/call/json/15121066?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const json  = await res.json();
    const raw   = json?.items ?? json?.list ?? json?.data ?? json?.response?.body?.items?.item ?? [];
    const items: BusanBizItem[] = Array.isArray(raw) ? raw : [raw];

    for (const item of items) {
      const title = item.BIZ_NM;
      if (!title) continue;
      const start  = toIsoDate(item.RCRIT_BGNG_DE);
      const end    = toIsoDate(item.RCRIT_END_DE);
      const status = calcStatus(start, end);
      if (status === 'closed') continue;

      results.push({
        external_id:       `busan_${item.BIZ_ID ?? title.slice(0,20).replace(/\s/g,'_')}`,
        source:            'busan',
        title,
        managing_org:      item.JRSD_INSTT_NM || '부산광역시',
        category:          guessCategory(`${title} ${item.BIZ_SUMRY_CN ?? ''}`),
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
// 통합 진입점
// ══════════════════════════════════════════════════════════════════════════════

export interface LocalGovResult {
  programs: ParsedProgram[];
  errors:   string[];
  counts:   Record<string, number>;
}

/**
 * 서울 + 경기 + 부산 병렬 수집
 * 키가 없는 시도는 조용히 빈 배열 반환 (graceful skip)
 *
 * ※ 충청북도: bizinfo API가 ctpvNm 필드로 자동 수집 → 별도 API 불필요
 */
export async function fetchAllLocalGovPrograms(): Promise<LocalGovResult> {
  const [seoulResult, gyeonggiResult, busanResult] = await Promise.allSettled([
    fetchSeoulPrograms(),
    fetchGyeonggiPrograms(),
    fetchBusanPrograms(),
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

  // external_id 기준 중복 제거
  const seen = new Set<string>();
  const deduped = programs.filter(p => {
    if (seen.has(p.external_id)) return false;
    seen.add(p.external_id);
    return true;
  });

  return { programs: deduped, errors, counts };
}
