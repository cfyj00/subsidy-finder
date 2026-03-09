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

  console.log(`[cron/sync-programs] bizinfo=${bizinfoItems.length} datagokr=${datagokrItems.length} upserted=${upserted} closed=${closed}`);

  return NextResponse.json({
    ok:        true,
    bizinfo:   bizinfoItems.length,
    datagokr:  datagokrItems.length,
    fetched:   parsed.length,
    upserted,
    closed,
    errors,
    syncedAt:  new Date().toISOString(),
  });
}
