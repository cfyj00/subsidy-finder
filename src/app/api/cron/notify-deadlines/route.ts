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
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@jisiljang.com';

/** 마감 알림 이메일 HTML */
function buildEmailHtml(opts: {
  userName: string;
  programTitle: string;
  days: number;
  emoji: string;
  link: string;
}): string {
  const { userName, programTitle, days, emoji, link } = opts;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jisiljang.com';
  const urgencyColor = days === 1 ? '#dc2626' : days <= 5 ? '#d97706' : '#4f46e5';
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <!-- 헤더 -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;">
          <p style="margin:0;color:#c7d2fe;font-size:13px;">🤝 지실장</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">마감 ${emoji} D-${days}</h1>
        </td></tr>
        <!-- 본문 -->
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;color:#374151;font-size:15px;">${userName}님, 안녕하세요!</p>
          <div style="background:#f1f5f9;border-left:4px solid ${urgencyColor};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
            <p style="margin:0 0 4px;color:#64748b;font-size:12px;">신청 마감 ${days}일 전</p>
            <p style="margin:0;color:#1e293b;font-size:16px;font-weight:600;">${programTitle}</p>
          </div>
          <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
            ${days === 1
              ? '오늘이 마지막 기회예요! 지금 바로 서류를 최종 확인하고 접수하세요.'
              : days <= 5
              ? `마감까지 ${days}일밖에 남지 않았어요. 서류 준비 현황을 다시 한번 확인해 보세요.`
              : `마감까지 ${days}일 남았어요. 미리미리 준비하면 합격률이 높아져요!`}
          </p>
          <a href="${appUrl}${link}" style="display:inline-block;background:${urgencyColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">지원 현황 확인하기 →</a>
        </td></tr>
        <!-- 푸터 -->
        <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">알림 수신을 원하지 않으시면 <a href="${appUrl}/profile" style="color:#94a3b8;">프로필 설정</a>에서 변경하세요.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** 프리미엄 유저의 이메일 조회 */
async function getUserEmail(admin: ReturnType<typeof createSupabaseAdmin>, userId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data?.user?.email) return null;
  const isPremium = (data.user.user_metadata?.is_premium as boolean | undefined) ?? false;
  // business_profiles에서 is_premium 확인
  const { data: profile } = await admin
    .from('business_profiles')
    .select('is_premium, business_name')
    .eq('user_id', userId)
    .eq('is_premium', true)
    .maybeSingle();
  if (!profile?.is_premium) return null;
  return {
    email: data.user.email,
    name: profile.business_name ?? data.user.email.split('@')[0],
  };
}

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
      // 이메일 발송 (프리미엄 유저만)
      if (resend) {
        const user = await getUserEmail(admin, app.user_id);
        if (user) {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: user.email,
            subject: `[지실장] 마감 D-${days} ${emoji} "${title}"`,
            html: buildEmailHtml({ userName: user.name, programTitle: title, days, emoji, link: '/applications' }),
          }).catch(e => errors.push(`이메일 발송 실패: ${e.message}`));
        }
      }
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
      // 이메일 발송 (프리미엄 유저만)
      if (resend) {
        const user = await getUserEmail(admin, bm.user_id);
        if (user) {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: user.email,
            subject: `[지실장] 마감 D-${days} ${emoji} "${title}"`,
            html: buildEmailHtml({ userName: user.name, programTitle: title, days, emoji, link: '/programs' }),
          }).catch(e => errors.push(`이메일 발송 실패: ${e.message}`));
        }
      }
    }
  }

  console.log(
    `[cron/notify-deadlines] created=${created} skipped=${skipped} errors=${errors.length}`
  );

  return NextResponse.json({ ok: true, created, skipped, errors });
}
