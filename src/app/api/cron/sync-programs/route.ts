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

  // ── 3. Bizinfo 수집 ─────────────────────────────────────────────────────
  let rawItems;
  try {
    rawItems = await fetchAllOpenPrograms({ maxPages: 20, includeUpcoming: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/sync-programs] fetch error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // ── 4. Upsert ────────────────────────────────────────────────────────────
  const admin = createSupabaseAdmin();
  const parsed = rawItems.map(parseBizinfoItem);
  let upserted = 0;
  let closed = 0;
  const errors: string[] = [];
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

  // ── 5. 마감 처리 ──────────────────────────────────────────────────────────
  const fetchedIds = parsed.map((p) => p.external_id);
  if (fetchedIds.length > 0) {
    const { data: toClose } = await admin
      .from('programs')
      .select('id')
      .eq('source', 'bizinfo')
      .in('status', ['open', 'upcoming'])
      .not('external_id', 'in', `(${fetchedIds.map((id) => `'${id}'`).join(',')})`);

    if (toClose && toClose.length > 0) {
      await admin
        .from('programs')
        .update({ status: 'closed', last_synced_at: new Date().toISOString() })
        .in('id', toClose.map((r) => r.id));
      closed = toClose.length;
    }
  }

  console.log(`[cron/sync-programs] fetched=${rawItems.length} upserted=${upserted} closed=${closed}`);

  return NextResponse.json({
    ok:       true,
    fetched:  rawItems.length,
    upserted,
    closed,
    errors,
    syncedAt: new Date().toISOString(),
  });
}
