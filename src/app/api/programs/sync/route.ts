/**
 * POST /api/programs/sync
 *
 * Bizinfo + data.go.kr(중소벤처기업부) API에서 지원사업을 수집해 programs 테이블에 upsert합니다.
 *
 * 호출 방법:
 *   - 수동: POST /api/programs/sync (로그인한 사용자)
 *   - 크론: POST /api/cron/sync-programs (CRON_SECRET 헤더 필요)
 *
 * 필요한 환경변수:
 *   BIZINFO_API_KEY     — bizinfo.go.kr Open API 키 (필수)
 *   DATA_GO_KR_API_KEY  — data.go.kr 중소벤처기업부_사업공고 키 (선택)
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase 서비스 롤 키 (RLS 우회)
 */

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
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
  // ── 1. 인증 (수동 호출 시) ─────────────────────────────────────────────
  // cron 호출은 /api/cron/sync-programs 에서 처리 — 여기서는 로그인 확인만
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. API 키 확인 ──────────────────────────────────────────────────────
  const apiKey = process.env.BIZINFO_API_KEY ?? process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'API 키 미설정',
        message:
          'BIZINFO_API_KEY 환경변수를 설정해주세요. ' +
          '발급: https://www.bizinfo.go.kr → 마이페이지 → Open API 신청',
      },
      { status: 503 },
    );
  }

  // ── 3. 데이터 수집 (Bizinfo + data.go.kr 병렬) ──────────────────────────
  const results = { bizinfo: 0, datagokr: 0, upserted: 0, closed: 0, errors: [] as string[] };

  const [bizinfoResult, datagokrResult] = await Promise.allSettled([
    fetchAllOpenPrograms({ maxPages: 10, includeUpcoming: true }),
    process.env.DATA_GO_KR_API_KEY
      ? fetchAllMssBizPrograms({ maxPages: 5, daysBack: 180 })
      : Promise.resolve([]),
  ]);

  const bizinfoItems  = bizinfoResult.status  === 'fulfilled' ? bizinfoResult.value  : [];
  const datagokrItems = datagokrResult.status === 'fulfilled' ? datagokrResult.value : [];

  if (bizinfoResult.status  === 'rejected') results.errors.push(`Bizinfo: ${bizinfoResult.reason}`);
  if (datagokrResult.status === 'rejected') results.errors.push(`data.go.kr: ${datagokrResult.reason}`);

  results.bizinfo  = bizinfoItems.length;
  results.datagokr = datagokrItems.length;

  if (bizinfoItems.length === 0 && datagokrItems.length === 0) {
    return NextResponse.json({ error: '수집된 데이터 없음', errors: results.errors }, { status: 502 });
  }

  // ── 4. Supabase admin 클라이언트 (RLS 우회) ─────────────────────────────
  const admin = createSupabaseAdmin();

  // ── 5. Upsert (Bizinfo + data.go.kr 통합) ───────────────────────────────
  const BATCH  = 50;
  const parsed = [
    ...bizinfoItems.map(parseBizinfoItem),
    ...datagokrItems.map(parseDataGoKrItem),
  ];

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
      results.errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    } else {
      results.upserted += batch.length;
    }
  }

  // ── 6. 마감된 프로그램 상태 업데이트 (소스별) ────────────────────────────
  const bizinfoIds  = bizinfoItems.map(parseBizinfoItem).map(p => p.external_id);
  const datagokrIds = datagokrItems.map(parseDataGoKrItem).map(p => p.external_id);

  for (const [source, ids] of [['bizinfo', bizinfoIds], ['datagokr', datagokrIds]] as const) {
    if (ids.length === 0) continue;
    const { data: toClose } = await admin
      .from('programs')
      .select('id')
      .eq('source', source)
      .in('status', ['open', 'upcoming'])
      .not('external_id', 'in', `(${ids.map(id => `'${id}'`).join(',')})`);

    if (toClose && toClose.length > 0) {
      await admin
        .from('programs')
        .update({ status: 'closed', last_synced_at: new Date().toISOString() })
        .in('id', toClose.map(r => r.id));
      results.closed += toClose.length;
    }
  }

  return NextResponse.json({
    ok: true,
    bizinfo:   results.bizinfo,
    datagokr:  results.datagokr,
    fetched:   parsed.length,
    upserted:  results.upserted,
    closed:    results.closed,
    errors:    results.errors,
    syncedAt:  new Date().toISOString(),
  });
}
