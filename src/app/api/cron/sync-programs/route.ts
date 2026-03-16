/**
 * POST /api/cron/sync-programs
 *
 * Vercel Cron Job이 호출하는 엔드포인트.
 * 4개 데이터 소스를 병렬 수집 후 Supabase에 upsert합니다:
 *   1. Bizinfo (기업마당) - 중앙정부 지원사업
 *   2. data.go.kr (중소벤처기업부) - 중기부 사업공고
 *   3. K-Startup (창업진흥원) - 창업·벤처 지원사업
 *   4. 광역시도 (서울/경기/부산) - 지자체 사업 (키 있는 경우만)
 *
 * 참고: 보조금24(Gov24)는 data.go.kr에 서비스 없음 → 제외
 *
 * vercel.json 설정:
 * { "crons": [{ "path": "/api/cron/sync-programs", "schedule": "0 2 * * *" }] }
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
  fetchAllOpenPrograms,
  parseBizinfoItem,
  fetchBizinfoDetail,
  enrichWithDetail,
} from '@/lib/data/bizinfo-client';
import {
  fetchAllMssBizPrograms,
  parseDataGoKrItem,
} from '@/lib/data/data-go-kr-client';
import {
  fetchAllKStartupPrograms,
  parseKStartupItem,
} from '@/lib/data/kstartup-client';
import {
  fetchAllLocalGovPrograms,
} from '@/lib/data/local-gov-client';
import type { ParsedProgram } from '@/lib/data/bizinfo-client';

export async function POST(req: Request) {
  // ── 1. 크론 시크릿 검증 ────────────────────────────────────────────────
  const secret   = req.headers.get('x-cron-secret') ?? req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET ?? '';

  if (!expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let authorized = false;
  try {
    const a = Buffer.from(secret);
    const b = Buffer.from(expected);
    authorized = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    authorized = false;
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 2. 최소 API 키 확인 ─────────────────────────────────────────────────
  const hasAnyKey =
    !!process.env.BIZINFO_API_KEY ||
    !!process.env.DATA_GO_KR_API_KEY;

  if (!hasAnyKey) {
    return NextResponse.json({ error: 'API 키 미설정' }, { status: 503 });
  }

  // ── 3. 5개 소스 병렬 수집 ───────────────────────────────────────────────
  const [
    bizinfoResult,
    datagokrResult,
    kstartupResult,
    localGovResult,
  ] = await Promise.allSettled([
    fetchAllOpenPrograms({ maxPages: 20, includeUpcoming: true }),
    process.env.DATA_GO_KR_API_KEY
      ? fetchAllMssBizPrograms({ maxPages: 10, daysBack: 180 })
      : Promise.resolve([]),
    process.env.KSTARTUP_API_KEY || process.env.DATA_GO_KR_API_KEY
      ? fetchAllKStartupPrograms({ maxPages: 5 })
      : Promise.resolve([]),
    fetchAllLocalGovPrograms(),       // 키 없으면 내부에서 graceful skip
  ]);

  // 결과 추출
  const bizinfoItems  = bizinfoResult.status  === 'fulfilled' ? bizinfoResult.value  : [];
  const datagokrItems = datagokrResult.status === 'fulfilled' ? datagokrResult.value : [];
  const kstartupItems = kstartupResult.status === 'fulfilled' ? kstartupResult.value : [];
  const localGovData  = localGovResult.status === 'fulfilled' ? localGovResult.value : { programs: [], errors: [], counts: {} };

  const errors: string[] = [];
  if (bizinfoResult.status  === 'rejected') errors.push(`Bizinfo: ${bizinfoResult.reason}`);
  if (datagokrResult.status === 'rejected') errors.push(`data.go.kr: ${datagokrResult.reason}`);
  if (kstartupResult.status === 'rejected') errors.push(`K-Startup: ${kstartupResult.reason}`);
  if (localGovResult.status === 'rejected') errors.push(`광역시도: ${localGovResult.reason}`);
  errors.push(...localGovData.errors);

  const totalFetched =
    bizinfoItems.length + datagokrItems.length +
    kstartupItems.length + localGovData.programs.length;

  if (totalFetched === 0) {
    return NextResponse.json({ error: '수집된 데이터 없음', errors }, { status: 502 });
  }

  // ── 4. 전체 파싱 & Upsert ────────────────────────────────────────────────
  const admin = createSupabaseAdmin();

  const parsed: ParsedProgram[] = [
    ...bizinfoItems.map(parseBizinfoItem),
    ...datagokrItems.map(parseDataGoKrItem),
    ...kstartupItems.map(parseKStartupItem),
    ...localGovData.programs,         // 이미 ParsedProgram[]
  ];

  let upserted = 0;
  const BATCH = 50;

  for (let i = 0; i < parsed.length; i += BATCH) {
    const batch = parsed.slice(i, i + BATCH);
    const { error } = await admin.from('programs').upsert(
      batch.map((p) => ({
        external_id:          p.external_id,
        source:               p.source,
        title:                p.title,
        managing_org:         p.managing_org,
        category:             p.category,
        support_type:         p.support_type,
        target_regions:       p.target_regions,
        target_industries:    p.target_industries,
        target_company_size:  p.target_company_size,
        min_employee_count:   p.min_employee_count,
        max_employee_count:   p.max_employee_count,
        min_company_age:      p.min_company_age,
        max_company_age:      p.max_company_age,
        funding_amount_min:   p.funding_amount_min,
        funding_amount_max:   p.funding_amount_max,
        self_funding_ratio:   p.self_funding_ratio,
        application_start:    p.application_start,
        application_end:      p.application_end,
        status:               p.status,
        description:          p.description,
        eligibility_summary:  p.eligibility_summary,
        detail_url:           p.detail_url,
        raw_data:             p.raw_data,
        last_synced_at:       p.last_synced_at,
      })),
      { onConflict: 'external_id', ignoreDuplicates: false },
    );
    if (error) {
      errors.push(error.message);
    } else {
      upserted += batch.length;
    }
  }

  // ── 5. Bizinfo 상세 API 보강 ─────────────────────────────────────────────
  // eligibility_summary 또는 target_company_size가 비어있는 신규 bizinfo 프로그램만 대상
  // (rate limit 방지: 최대 30건, 순차 처리)
  let enriched = 0;
  if (process.env.BIZINFO_API_KEY) {
    const needsEnrich = bizinfoItems
      .map(parseBizinfoItem)
      .filter(p => !p.eligibility_summary || p.target_company_size.length === 0)
      .slice(0, 30);

    for (const base of needsEnrich) {
      const pblancId = base.external_id.replace('bizinfo_', '');
      const detail = await fetchBizinfoDetail(pblancId);
      if (!detail) continue;

      const enriched_p = enrichWithDetail(base, detail);

      // 보강된 필드만 업데이트 (description, eligibility_summary, target_*, funding_* 등)
      await admin.from('programs').update({
        description:          enriched_p.description,
        eligibility_summary:  enriched_p.eligibility_summary,
        target_company_size:  enriched_p.target_company_size,
        target_industries:    enriched_p.target_industries,
        funding_amount_min:   enriched_p.funding_amount_min,
        funding_amount_max:   enriched_p.funding_amount_max,
        min_employee_count:   enriched_p.min_employee_count,
        max_employee_count:   enriched_p.max_employee_count,
        min_company_age:      enriched_p.min_company_age,
        max_company_age:      enriched_p.max_company_age,
        self_funding_ratio:   enriched_p.self_funding_ratio,
        last_synced_at:       new Date().toISOString(),
      }).eq('external_id', base.external_id);

      enriched++;
      // 과도한 API 호출 방지 (100ms 간격)
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // ── 6. 마감 처리 (소스별) ────────────────────────────────────────────────
  let closed = 0;

  const sourceIdMap: Record<string, string[]> = {
    bizinfo:  bizinfoItems.map(parseBizinfoItem).map(p => p.external_id),
    datagokr: datagokrItems.map(parseDataGoKrItem).map(p => p.external_id),
    kstartup: kstartupItems.map(parseKStartupItem).map(p => p.external_id),
    seoul:    localGovData.programs.filter(p => p.source === 'seoul').map(p => p.external_id),
    gyeonggi: localGovData.programs.filter(p => p.source === 'gyeonggi').map(p => p.external_id),
    busan:    localGovData.programs.filter(p => p.source === 'busan').map(p => p.external_id),
  };

  for (const [source, ids] of Object.entries(sourceIdMap)) {
    if (ids.length === 0) continue;
    const { data: toClose } = await admin
      .from('programs')
      .select('id')
      .eq('source', source)
      .in('status', ['open', 'upcoming'])
      .not('external_id', 'in', `(${ids.map(id => `'${id.replace(/'/g, '')}'`).join(',')})`);

    if (toClose && toClose.length > 0) {
      await admin
        .from('programs')
        .update({ status: 'closed', last_synced_at: new Date().toISOString() })
        .in('id', toClose.map((r) => r.id));
      closed += toClose.length;
    }
  }

  // ── 6. 반복 사업 자동화 ──────────────────────────────────────────────────
  let recurringLinked  = 0;
  let expectedPromoted = 0;
  const currentYear    = new Date().getFullYear();

  // 6a. 새 open 사업과 기존 closed/expected 사업 제목 매칭
  for (const p of parsed.filter(p => p.status === 'open' || p.status === 'upcoming')) {
    const titleKey = p.title.replace(/\s+/g, '').substring(0, 12);
    if (titleKey.length < 5) continue;

    const { data: prevVersions } = await admin
      .from('programs')
      .select('id, typical_open_month, last_active_year')
      .in('status', ['closed', 'expected'])
      .not('external_id', 'eq', p.external_id ?? '')
      .ilike('title', `%${p.title.substring(0, 10)}%`)
      .limit(3);

    if (prevVersions && prevVersions.length > 0) {
      const prev = prevVersions[0];
      await admin.from('programs').update({
        is_recurring:     true,
        status:           'closed',
        last_active_year: currentYear - 1,
      }).eq('id', prev.id);

      const openMonth = p.application_start
        ? new Date(p.application_start).getMonth() + 1
        : (prev.typical_open_month ?? null);

      await admin.from('programs').update({
        is_recurring:      true,
        typical_open_month: openMonth,
        last_active_year:  currentYear,
      }).eq('external_id', p.external_id ?? '');

      recurringLinked++;
    }
  }

  // 6b. 반복 사업 중 올해 버전 없는 것 → expected로 전환
  const thisYearStart = `${currentYear}-01-01`;
  const prevYearStart = `${currentYear - 1}-01-01`;

  const { data: recurringClosed } = await admin
    .from('programs')
    .select('id, title, typical_open_month')
    .eq('is_recurring', true)
    .eq('status', 'closed')
    .gte('application_end', prevYearStart)
    .lt('application_end', thisYearStart);

  for (const prog of (recurringClosed ?? [])) {
    const titleKey = prog.title.substring(0, 10);
    const { data: thisYearVersion } = await admin
      .from('programs')
      .select('id')
      .in('status', ['open', 'upcoming'])
      .ilike('title', `%${titleKey}%`)
      .limit(1)
      .maybeSingle();

    if (!thisYearVersion) {
      await admin.from('programs').update({
        status:           'expected',
        last_active_year: currentYear - 1,
        last_synced_at:   new Date().toISOString(),
      }).eq('id', prog.id);
      expectedPromoted++;
    }
  }

  // ── 7. 로그 & 응답 ───────────────────────────────────────────────────────
  console.log(
    `[cron/sync-programs] ` +
    `bizinfo=${bizinfoItems.length} datagokr=${datagokrItems.length} ` +
    `kstartup=${kstartupItems.length} ` +
    `seoul=${localGovData.counts.seoul ?? 0} gyeonggi=${localGovData.counts.gyeonggi ?? 0} busan=${localGovData.counts.busan ?? 0} ` +
    `upserted=${upserted} enriched=${enriched} closed=${closed} recurringLinked=${recurringLinked} expectedPromoted=${expectedPromoted}`,
  );

  return NextResponse.json({
    ok:               true,
    sources: {
      bizinfo:        bizinfoItems.length,
      datagokr:       datagokrItems.length,
      kstartup:       kstartupItems.length,
      seoul:          localGovData.counts.seoul    ?? 0,
      gyeonggi:       localGovData.counts.gyeonggi ?? 0,
      busan:          localGovData.counts.busan    ?? 0,
    },
    fetched:          totalFetched,
    upserted,
    enriched,
    closed,
    recurringLinked,
    expectedPromoted,
    errors,
    syncedAt:         new Date().toISOString(),
  });
}
