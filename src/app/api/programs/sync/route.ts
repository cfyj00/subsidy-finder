/**
 * POST /api/programs/sync
 *
 * Bizinfo API에서 지원사업 목록을 수집하여 Supabase programs 테이블에 upsert합니다.
 *
 * 호출 방법:
 *   - 수동: POST /api/programs/sync (로그인한 사용자)
 *   - 크론: POST /api/cron/sync-programs (CRON_SECRET 헤더 필요)
 *
 * 필요한 환경변수:
 *   BIZINFO_API_KEY  — bizinfo.go.kr Open API 키
 *     발급: https://www.bizinfo.go.kr → 마이페이지 → Open API 신청
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase 서비스 롤 키 (RLS 우회)
 */

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
  fetchAllOpenPrograms,
  parseBizinfoItem,
} from '@/lib/data/bizinfo-client';

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

  // ── 3. Bizinfo API 수집 ─────────────────────────────────────────────────
  const results = { upserted: 0, closed: 0, errors: [] as string[] };

  let rawItems;
  try {
    rawItems = await fetchAllOpenPrograms({ maxPages: 10, includeUpcoming: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Bizinfo API 오류', message: msg },
      { status: 502 },
    );
  }

  // ── 4. Supabase admin 클라이언트 (RLS 우회) ─────────────────────────────
  const admin = createSupabaseAdmin();

  // ── 5. Upsert ────────────────────────────────────────────────────────────
  const BATCH = 50;
  const parsed = rawItems.map(parseBizinfoItem);

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
      results.errors.push(`Batch ${i / BATCH + 1}: ${error.message}`);
    } else {
      results.upserted += batch.length;
    }
  }

  // ── 6. 마감된 프로그램 상태 업데이트 ─────────────────────────────────────
  // DB에서 open/upcoming이지만 Bizinfo에 없는 bizinfo 소스 프로그램 → closed 처리
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
      results.closed = toClose.length;
    }
  }

  return NextResponse.json({
    ok: true,
    fetched:   rawItems.length,
    upserted:  results.upserted,
    closed:    results.closed,
    errors:    results.errors,
    syncedAt:  new Date().toISOString(),
  });
}
