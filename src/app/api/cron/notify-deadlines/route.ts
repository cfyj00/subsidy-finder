/**
 * POST /api/cron/notify-deadlines
 *
 * 마감 D-7·D-3·D-1 알림을 생성하고 이메일을 발송합니다.
 * 매일 오전 9시 실행 (vercel.json 설정).
 *
 * 동작:
 * 1. user_applications 중 상태가 preparing/submitted/reviewing 인 항목 조회
 * 2. application_deadline 이 D-7·D-3·D-1인 경우 notifications 삽입 (중복 방지)
 * 3. user_program_matches 중 is_bookmarked=true 인 프로그램도 동일하게 처리
 * 4. 위 알림마다 Resend로 이메일 발송 (RESEND_API_KEY 설정 시)
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
  buildDeadlineEmailHtml,
  buildDeadlineEmailText,
} from '@/lib/email/templates';

const DEADLINE_DAYS = [7, 3, 1] as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ji-jang.vercel.app';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@ji-jang.co.kr';

function daysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(isoDate);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - now.getTime()) / 86_400_000);
}

/** Resend API를 통해 이메일 발송 */
async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false; // API 키 없으면 skip

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `지실장 <${FROM_EMAIL}>`,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Supabase admin으로 user 이메일 조회 */
async function getUserEmail(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // ── 크론 시크릿 검증 ───────────────────────────────────────────────────
  const secret   = req.headers.get('x-cron-secret') ?? req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  let created   = 0;
  let skipped   = 0;
  let emailed   = 0;
  const errors: string[] = [];

  // 이메일 캐시: 같은 유저에게 중복 API 호출 방지
  const emailCache = new Map<string, string | null>();
  async function getEmail(uid: string) {
    if (emailCache.has(uid)) return emailCache.get(uid)!;
    const email = await getUserEmail(admin, uid);
    emailCache.set(uid, email);
    return email;
  }

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

    // 중복 체크
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

    // in-app 알림 생성
    const { error: insertErr } = await admin.from('notifications').insert({
      user_id:    app.user_id,
      type:       'deadline',
      title:      `마감 D-${days} ⏰`,
      body:       `"${title}" 신청 마감이 ${days}일 남았습니다.`,
      link:       `/applications`,
      program_id: app.program_id,
    });

    if (insertErr) {
      errors.push(`알림 생성 실패(${app.id}): ${insertErr.message}`);
      continue;
    }
    created++;

    // 이메일 발송
    const email = await getEmail(app.user_id);
    if (email && days <= 3) { // D-3, D-1 만 이메일 발송
      const programId = app.program_id ?? '';
      const sent = await sendEmail({
        to:      email,
        subject: `[지실장] 마감 D-${days} ⏰ "${title}"`,
        html:    buildDeadlineEmailHtml({
          programTitle:   title,
          daysLeft:       days,
          applicationEnd: app.application_deadline,
          programUrl:     `${APP_URL}/programs/${programId}`,
          appUrl:         APP_URL,
          isBookmark:     false,
        }),
        text: buildDeadlineEmailText({
          programTitle:   title,
          daysLeft:       days,
          applicationEnd: app.application_deadline,
          programUrl:     `${APP_URL}/programs/${programId}`,
          appUrl:         APP_URL,
          isBookmark:     false,
        }),
      });
      if (sent) emailed++;
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

    // in-app 알림 생성
    const { error: insertErr } = await admin.from('notifications').insert({
      user_id:    bm.user_id,
      type:       'deadline',
      title:      `마감 D-${days} ⏰`,
      body:       `북마크한 "${title}" 신청 마감이 ${days}일 남았습니다.`,
      link:       `/programs`,
      program_id: bm.program_id,
    });

    if (insertErr) {
      errors.push(`북마크 알림 생성 실패: ${insertErr.message}`);
      continue;
    }
    created++;

    // 이메일 발송 (D-3, D-1)
    const email = await getEmail(bm.user_id);
    if (email && days <= 3) {
      const programId = prog.id ?? bm.program_id ?? '';
      const sent = await sendEmail({
        to:      email,
        subject: `[지실장] 마감 D-${days} ⏰ "${title}"`,
        html:    buildDeadlineEmailHtml({
          programTitle:   title,
          daysLeft:       days,
          applicationEnd: prog.application_end,
          programUrl:     `${APP_URL}/programs/${programId}`,
          appUrl:         APP_URL,
          isBookmark:     true,
        }),
        text: buildDeadlineEmailText({
          programTitle:   title,
          daysLeft:       days,
          applicationEnd: prog.application_end,
          programUrl:     `${APP_URL}/programs/${programId}`,
          appUrl:         APP_URL,
          isBookmark:     true,
        }),
      });
      if (sent) emailed++;
    }
  }

  console.log(
    `[cron/notify-deadlines] created=${created} skipped=${skipped} emailed=${emailed} errors=${errors.length}`
  );

  return NextResponse.json({ ok: true, created, skipped, emailed, errors });
}
