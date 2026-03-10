/**
 * POST /api/cron/sync-programs
 *
 * Vercel Cron Job이 호출하는 엔드포인트.
 * CRON_SECRET 헤더 검증 후 /api/programs/sync 와 동일한 로직으로 동기화합니다.
 *
 * vercel.json 설정 예시:
 * {
 *   "crons": [{ "path": "/api/cron/sync-programs", "schedule": "0 2 * * *" }]
 * }
 * → 매일 새벽 2시 실행
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
  fetchAllOpenPrograms,
  parseBizinfoItem,
} from '@/lib/data/bizinfo-client';
import {
  fetchAllMssBizPrograms,
  parseDataGoKrItem,
} from '@/lib/data/data-go-kr-client';

export async function POST(req: Request) {
  // ── 1. 크론 시크릿 검증 ────────────────────────────────────────────────
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── 2. API 키 확인 ──────────────────────────────────────────────────────
  const apiKey = process.env.BIZINFO_API_KEY ?? process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API 키 미설정' }, { status: 503 });
  }

  // ── 3. 데이터 수집 (Bizinfo + data.go.kr 병렬) ──────────────────────────
  const [bizinfoResult, datagokrResult] = await Promise.allSettled([
    fetchAllOpenPrograms({ maxPages: 20, includeUpcoming: true }),
    process.env.DATA_GO_KR_API_KEY
      ? fetchAllMssBizPrograms({ maxPages: 10, daysBack: 180 })
      : Promise.resolve([]),
  ]);

  const bizinfoItems  = bizinfoResult.status  === 'fulfilled' ? bizinfoResult.value  : [];
  const datagokrItems = datagokrResult.status === 'fulfilled' ? datagokrResult.value : [];
  const errors: string[] = [];

  if (bizinfoResult.status  === 'rejected') errors.push(`Bizinfo: ${bizinfoResult.reason}`);
  if (datagokrResult.status === 'rejected') errors.push(`data.go.kr: ${datagokrResult.reason}`);

  if (bizinfoItems.length === 0 && datagokrItems.length === 0) {
    return NextResponse.json({ error: '수집된 데이터 없음', errors }, { status: 502 });
  }

  // ── 4. Upsert ────────────────────────────────────────────────────────────
  const admin = createSupabaseAdmin();
  const parsed = [
    ...bizinfoItems.map(parseBizinfoItem),
    ...datagokrItems.map(parseDataGoKrItem),
  ];
  let upserted = 0;
  let closed = 0;
  const BATCH = 50;

  for (let i = 0; i < parsed.length; i += BATCH) {
    const batch = parsed.slice(i, i + BATCH);
    const { error } = await admin.from('programs').upsert(
      batch.map((p) => ({
        external_id:        p.external_id,
        source:             p.source,
        title:              p.title,
        managing_org:       p.managing_org,
        category:           p.category,
        support_type:       p.support_type,
        target_regions:     p.target_regions,
        application_start:  p.application_start,
        application_end:    p.application_end,
        status:             p.status,
        description:        p.description,
        detail_url:         p.detail_url,
        raw_data:           p.raw_data,
        last_synced_at:     p.last_synced_at,
      })),
      { onConflict: 'external_id', ignoreDuplicates: false },
    );
    if (error) {
      errors.push(error.message);
    } else {
      upserted += batch.length;
    }
  }

  // ── 5. 마감 처리 (소스별) ────────────────────────────────────────────────
  const bizinfoIds  = bizinfoItems.map(parseBizinfoItem).map((p) => p.external_id);
  const datagokrIds = datagokrItems.map(parseDataGoKrItem).map((p) => p.external_id);

  for (const [source, ids] of [['bizinfo', bizinfoIds], ['datagokr', datagokrIds]] as const) {
    if (ids.length === 0) continue;
    const { data: toClose } = await admin
      .from('programs')
      .select('id')
      .eq('source', source)
      .in('status', ['open', 'upcoming'])
      .not('external_id', 'in', `(${ids.map((id) => `'${id}'`).join(',')})`);

    if (toClose && toClose.length > 0) {
      await admin
        .from('programs')
        .update({ status: 'closed', last_synced_at: new Date().toISOString() })
        .in('id', toClose.map((r) => r.id));
      closed += toClose.length;
    }
  }

  // ── 6. 반복 사업 자동화 ──────────────────────────────────────────────────
  // 6a. 새로 open된 사업과 기존 expected/closed 사업 제목 매칭
  //     → 같은 사업의 올해 버전이 나왔으면: 과거 것은 closed, 새 것은 is_recurring=true
  let recurringLinked = 0;
  const currentYear = new Date().getFullYear();

  for (const p of parsed.filter(p => p.status === 'open' || p.status === 'upcoming')) {
    const titleKey = p.title.replace(/\s+/g, '').substring(0, 12); // 공백 제거 후 앞 12자
    if (titleKey.length < 5) continue;

    // 작년 이전에 마감됐거나 expected 상태인 유사 사업 검색
    const { data: prevVersions } = await admin
      .from('programs')
      .select('id, typical_open_month, last_active_year')
      .in('status', ['closed', 'expected'])
      .not('external_id', 'eq', p.external_id ?? '')
      .ilike('title', `%${p.title.substring(0, 10)}%`)
      .limit(3);

    if (prevVersions && prevVersions.length > 0) {
      const prev = prevVersions[0];
      // 과거 버전: is_recurring 표시, closed 확정
      await admin.from('programs').update({
        is_recurring: true,
        status: 'closed',
        last_active_year: currentYear - 1,
      }).eq('id', prev.id);

      // 새 버전: is_recurring + typical_open_month 이어받기
      const openMonth = p.application_start
        ? new Date(p.application_start).getMonth() + 1
        : (prev.typical_open_month ?? null);
      await admin.from('programs').update({
        is_recurring: true,
        typical_open_month: openMonth,
        last_active_year: currentYear,
      }).eq('external_id', p.external_id ?? '');

      recurringLinked++;
    }
  }

  // 6b. is_recurring=true인데 작년에 마감 → 올해 아직 안 뜬 사업: expected로 전환
  let expectedPromoted = 0;
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
    // 올해 open/upcoming 버전이 이미 있는지 확인
    const { data: thisYearVersion } = await admin
      .from('programs')
      .select('id')
      .in('status', ['open', 'upcoming'])
      .ilike('title', `%${titleKey}%`)
      .limit(1)
      .maybeSingle();

    if (!thisYearVersion) {
      await admin.from('programs').update({
        status: 'expected',
        last_active_year: currentYear - 1,
        last_synced_at: new Date().toISOString(),
      }).eq('id', prog.id);
      expectedPromoted++;
    }
  }

  console.log(`[cron/sync-programs] bizinfo=${bizinfoItems.length} datagokr=${datagokrItems.length} upserted=${upserted} closed=${closed} recurringLinked=${recurringLinked} expectedPromoted=${expectedPromoted}`);

  return NextResponse.json({
    ok:               true,
    bizinfo:          bizinfoItems.length,
    datagokr:         datagokrItems.length,
    fetched:          parsed.length,
    upserted,
    closed,
    recurringLinked,
    expectedPromoted,
    errors,
    syncedAt:         new Date().toISOString(),
  });
}
