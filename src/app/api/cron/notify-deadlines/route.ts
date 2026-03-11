/**
 * POST /api/cron/notify-deadlines
 *
 * 마감 D-30·D-20·D-10·D-5·D-1 인앱 알림을 생성합니다.
 * 매일 오전 9시 실행 (vercel.json 설정).
 *
 * 동작:
 * 1. user_applications 중 상태가 preparing/submitted/reviewing 인 항목 조회
 * 2. application_deadline 이 D-30·D-20·D-10·D-5·D-1인 경우 notifications 삽입 (중복 방지)
 * 3. user_program_matches 중 is_bookmarked=true 인 프로그램도 동일하게 처리
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const DEADLINE_DAYS = [30, 20, 10, 5, 1] as const;

function daysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(isoDate);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - now.getTime()) / 86_400_000);
}

/** 남은 일수에 따른 이모지 */
function deadlineEmoji(days: number): string {
  if (days === 1)  return '🚨';
  if (days <= 5)   return '⏰';
  if (days <= 10)  return '📌';
  return '📅';
}

export async function POST(req: Request) {
  // ── 크론 시크릿 검증 ───────────────────────────────────────────────────
  const secret   = req.headers.get('x-cron-secret') ?? req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  const today = new Date().toISOString().slice(0, 10);

  // ── 1. 진행 중인 지원 항목의 마감 알림 ──────────────────────────────────
  const { data: apps, error: appsErr } = await admin
    .from('user_applications')
    .select('id, user_id, program_id, status, application_deadline, programs(title)')
    .in('status', ['preparing', 'submitted', 'reviewing'])
    .not('application_deadline', 'is', null);

  if (appsErr) errors.push(`user_applications 조회 실패: ${appsErr.message}`);

  for (const app of apps ?? []) {
    if (!app.application_deadline) continue;
    const days = daysUntil(app.application_deadline);
    if (!(DEADLINE_DAYS as readonly number[]).includes(days)) continue;

    // 중복 체크: 오늘 이미 같은 프로그램에 deadline 알림 있으면 skip
    const { data: exists } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', app.user_id)
      .eq('program_id', app.program_id)
      .eq('type', 'deadline')
      .gte('created_at', `${today}T00:00:00Z`)
      .maybeSingle();

    if (exists) { skipped++; continue; }

    const title = (app.programs as { title?: string } | null)?.title ?? '지원사업';
    const emoji = deadlineEmoji(days);

    const { error: insertErr } = await admin.from('notifications').insert({
      user_id:    app.user_id,
      type:       'deadline',
      title:      `마감 D-${days} ${emoji}`,
      body:       `"${title}" 신청 마감이 ${days}일 남았습니다.`,
      link:       `/applications`,
      program_id: app.program_id,
    });

    if (insertErr) {
      errors.push(`알림 생성 실패(${app.id}): ${insertErr.message}`);
    } else {
      created++;
    }
  }

  // ── 2. 북마크된 프로그램의 마감 알림 ─────────────────────────────────────
  const { data: bookmarks, error: bmErr } = await admin
    .from('user_program_matches')
    .select('user_id, program_id, programs(id, title, application_end)')
    .eq('is_bookmarked', true)
    .not('programs', 'is', null);

  if (bmErr) errors.push(`북마크 조회 실패: ${bmErr.message}`);

  for (const bm of bookmarks ?? []) {
    const prog = bm.programs as { id?: string; title?: string; application_end?: string } | null;
    if (!prog?.application_end) continue;

    const days = daysUntil(prog.application_end);
    if (!(DEADLINE_DAYS as readonly number[]).includes(days)) continue;

    // 중복 체크
    const { data: exists } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', bm.user_id)
      .eq('program_id', bm.program_id)
      .eq('type', 'deadline')
      .gte('created_at', `${today}T00:00:00Z`)
      .maybeSingle();

    if (exists) { skipped++; continue; }

    const title = prog.title ?? '지원사업';
    const emoji = deadlineEmoji(days);

    const { error: insertErr } = await admin.from('notifications').insert({
      user_id:    bm.user_id,
      type:       'deadline',
      title:      `마감 D-${days} ${emoji}`,
      body:       `북마크한 "${title}" 신청 마감이 ${days}일 남았습니다.`,
      link:       `/programs`,
      program_id: bm.program_id,
    });

    if (insertErr) {
      errors.push(`북마크 알림 생성 실패: ${insertErr.message}`);
    } else {
      created++;
    }
  }

  console.log(
    `[cron/notify-deadlines] created=${created} skipped=${skipped} errors=${errors.length}`
  );

  return NextResponse.json({ ok: true, created, skipped, errors });
}
