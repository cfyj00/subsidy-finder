'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { calculateMatch, getMatchLabel } from '@/lib/matching-engine';
import { useBusinessProfile } from '@/lib/business-profile-context';
import type { Program, UserApplication, UserProgramMatch } from '@/types/database';
import {
  ArrowRight, AlertTriangle, CheckCheck, Clock,
  Search, MessageSquare, ClipboardList, Loader2,
  Zap, Trophy, TrendingUp, Calendar, Lightbulb, BookOpen, History,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { DAILY_TIPS } from '@/lib/constants';
import { format, isToday, isTomorrow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { isPersonName } from '@/lib/utils';

// 마감 D-day 포맷
function dday(deadline: string | null): { label: string; urgent: boolean } | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return { label: '마감', urgent: false };
  if (diff === 0) return { label: 'D-Day', urgent: true };
  if (diff <= 7)  return { label: `D-${diff}`, urgent: true };
  return { label: `D-${diff}`, urgent: false };
}

// 애플리케이션 상태별 다음 액션
function nextAction(status: UserApplication['status']): string {
  const map = {
    preparing:  '서류 준비 및 사업계획서 작성',
    submitted:  '심사 결과 대기 · 추가 서류 요청 확인',
    reviewing:  '결과 발표일 확인 · 담당자 연락 대기',
    approved:   '협약 체결 및 사업비 집행 계획 수립',
    rejected:   '탈락 사유 확인 · 다음 지원사업 탐색',
  } as const;
  return map[status] ?? '';
}

const STATUS_LABEL: Record<UserApplication['status'], string> = {
  preparing:  '준비중',
  submitted:  '제출완료',
  reviewing:  '심사중',
  approved:   '합격 🎉',
  rejected:   '불합격',
};

export default function BriefingPage() {
  const { activeProfile: profile } = useBusinessProfile();
  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [matches, setMatches] = useState<UserProgramMatch[]>([]);
  const [expectedPrograms, setExpectedPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(true);

  const loadAll = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: apps }, { data: progs }, { data: matchData }, { data: expectedProgs }] = await Promise.all([
      supabase.from('user_applications').select('id, user_id, program_id, program_title, program_url, status, notes, application_deadline, result_amount, created_at, updated_at').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('programs').select('id, external_id, source, title, managing_org, category, subcategory, support_type, target_regions, target_industries, target_company_size, min_employee_count, max_employee_count, min_company_age, max_company_age, min_revenue, max_revenue, funding_amount_min, funding_amount_max, self_funding_ratio, application_start, application_end, status, description, eligibility_summary, detail_url, is_featured, is_recurring, typical_open_month, created_at').eq('status', 'open').order('is_featured', { ascending: false }).limit(20),
      supabase.from('user_program_matches').select('id, program_id, user_id, match_score, match_reasons, mismatch_reasons, is_bookmarked, is_dismissed, calculated_at, applied_at, notes').eq('user_id', user.id),
      supabase.from('programs').select('id, title, managing_org, category, support_type, target_regions, funding_amount_min, funding_amount_max, typical_open_month, status').eq('status', 'expected').order('typical_open_month', { ascending: true }).limit(10),
    ]);

    setApplications((apps ?? []) as UserApplication[]);
    setPrograms((progs ?? []) as Program[]);
    setMatches((matchData ?? []) as UserProgramMatch[]);
    setExpectedPrograms((expectedProgs ?? []) as Program[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── 파생 데이터 ─────────────────────────────────────────────────────────
  const urgent = applications.filter(a => {
    if (!a.application_deadline) return false;
    const diff = Math.ceil((new Date(a.application_deadline).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 7 && !['approved', 'rejected'].includes(a.status);
  });

  const active = applications.filter(a => !['approved', 'rejected'].includes(a.status));
  const won = applications.filter(a => a.status === 'approved');
  const totalWon = won.reduce((s, a) => s + (a.result_amount ?? 0), 0);

  // 추천 프로그램 (매칭 점수 높은 순, 북마크 우선)
  const recommended = programs
    .filter(p => !applications.some(a => a.program_id === p.id))  // 이미 신청한 건 제외
    .map(p => {
      const existing = matches.find(m => m.program_id === p.id);
      const score = existing?.match_score ?? (profile ? calculateMatch(profile, p).score : 0);
      return { program: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // 오늘 팁 (날짜 기반으로 매일 다른 팁)
  const todayTipIndex = new Date().getDate() % DAILY_TIPS.length;
  const todayTip = DAILY_TIPS[todayTipIndex];

  // 오늘 날짜
  const now = new Date();
  const greeting = now.getHours() < 12 ? '좋은 아침이에요' : now.getHours() < 18 ? '안녕하세요' : '수고하셨어요';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* ── 브리핑 헤더 ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-1">
          <span>🤝 지실장 브리핑</span>
          <span>·</span>
          <span>{format(now, 'yyyy년 M월 d일 (EEE)', { locale: ko })}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {greeting}! <span className="text-indigo-600 dark:text-indigo-400">👋</span>
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          오늘 지실장이 챙겨드릴 내용을 정리했어요.
        </p>
      </div>

      {/* ── 지실장 시작 가이드 (신규 사용자 또는 펼침 상태) ─────────────────── */}
      {(applications.length === 0 || showGuide) && (
        <div className={`mb-5 rounded-2xl border overflow-hidden ${
          applications.length === 0
            ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
        }`}>
          {/* 헤더 */}
          <button
            type="button"
            onClick={() => setShowGuide(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🗺️</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {applications.length === 0 ? '지실장과 함께 시작해요!' : '지원사업 이용 가이드'}
              </span>
            </div>
            {applications.length > 0 && (
              showGuide
                ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                : <ChevronDown size={16} className="text-gray-400 shrink-0" />
            )}
          </button>

          {/* 4단계 여정 */}
          {showGuide && (
            <div className="px-4 pb-4 space-y-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                아래 4단계를 따라가면 지원사업을 끝까지 관리할 수 있어요 ✨
              </p>
              {[
                {
                  step: '1', emoji: '🔍', label: '지원사업 탐색',
                  desc: '내 사업 유형·지역에 맞는 프로그램을 찾아요',
                  href: '/programs', cta: '지원사업 보기',
                  color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400',
                },
                {
                  step: '2', emoji: '➕', label: '트래커에 추가',
                  desc: '상세 페이지에서 \'지원트래커에 추가\'를 클릭해요',
                  href: '/programs', cta: '지원사업으로',
                  color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400',
                },
                {
                  step: '3', emoji: '📂', label: '서류 준비',
                  desc: '서류가이드와 AI 채팅으로 서류를 준비해요',
                  href: '/documents', cta: '서류가이드',
                  color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
                },
                {
                  step: '4', emoji: '💬', label: 'AI 상담 활용',
                  desc: '지실장 AI에게 신청 전략과 사업계획서를 도움받아요',
                  href: '/consultant', cta: 'AI 상담하기',
                  color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
                },
              ].map(({ step, emoji, label, desc, href, cta, color }) => (
                <Link key={step} href={href} className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors group">
                  <span className={`w-7 h-7 rounded-full ${color} text-xs font-bold flex items-center justify-center shrink-0`}>{step}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{emoji} {label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{desc}</p>
                  </div>
                  <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{cta} →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 가이드 토글 버튼 (applications > 0이고 가이드 닫혀있을 때) */}
      {applications.length > 0 && !showGuide && (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 mb-4 hover:underline"
        >
          <span>🗺️</span> 이용 가이드 보기 <ChevronDown size={12} />
        </button>
      )}

      {/* ── 통계 요약 ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="진행 중" value={active.length} color="text-indigo-600 dark:text-indigo-400" icon={<ClipboardList size={14} />} />
        <StatCard label="합격" value={won.length} color="text-emerald-600 dark:text-emerald-400" icon={<Trophy size={14} />} />
        <StatCard
          label="확정 금액"
          value={totalWon > 0 ? formatAmt(totalWon) : '-'}
          color="text-emerald-600 dark:text-emerald-400"
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* ── 긴급 알림 ──────────────────────────────────────────────────────── */}
      {urgent.length > 0 && (
        <Section
          icon={<AlertTriangle size={15} className="text-red-500" />}
          title="마감 임박 — 지금 확인하세요"
          titleColor="text-red-600 dark:text-red-400"
          bg="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
        >
          <div className="space-y-2">
            {urgent.map(app => {
              const dd = dday(app.application_deadline);
              return (
                <Link key={app.id} href="/applications" className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.program_title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{nextAction(app.status)}</p>
                  </div>
                  {dd && (
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${dd.urgent ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-gray-100 text-gray-500'}`}>
                      {dd.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── 진행 중인 지원 ─────────────────────────────────────────────────── */}
      {active.length > 0 ? (
        <Section
          icon={<Zap size={15} className="text-amber-500" />}
          title="지금 진행 중인 지원"
          action={{ label: '전체 트래커 보기', href: '/applications' }}
        >
          <div className="space-y-2">
            {active.slice(0, 4).map(app => {
              const dd = dday(app.application_deadline);
              return (
                <Link key={app.id} href={`/apply/${app.program_id ?? ''}`} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">
                        {STATUS_LABEL[app.status]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.program_title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">👉 {nextAction(app.status)}</p>
                  </div>
                  {dd && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                      dd.urgent
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'
                    }`}>
                      {dd.label}
                    </span>
                  )}
                  <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                </Link>
              );
            })}
          </div>
        </Section>
      ) : (
        <Section
          icon={<ClipboardList size={15} className="text-gray-400" />}
          title="진행 중인 지원"
        >
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">아직 신청한 지원사업이 없어요</p>
            <Link
              href="/programs"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              <Search size={14} /> 지원사업 찾아보기
            </Link>
          </div>
        </Section>
      )}

      {/* ── 완료한 지원 요약 ───────────────────────────────────────────────── */}
      {won.length > 0 && (
        <Section
          icon={<Trophy size={15} className="text-yellow-500" />}
          title="합격한 지원사업"
          bg="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900"
        >
          <div className="space-y-2">
            {won.slice(0, 3).map(app => (
              <div key={app.id} className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.program_title}</p>
                  {app.result_amount && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                      확정 {formatAmt(app.result_amount)}
                    </p>
                  )}
                </div>
                <CheckCheck size={16} className="text-emerald-500 shrink-0" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── AI 추천 지원사업 ───────────────────────────────────────────────── */}
      {recommended.length > 0 && (
        <Section
          icon={<TrendingUp size={15} className="text-indigo-500" />}
          title="지실장이 추천하는 지원사업"
          action={{ label: '전체 보기', href: '/programs' }}
        >
          <div className="space-y-2">
            {recommended.map(({ program: p, score }) => {
              const mi = getMatchLabel(score);
              const dd = dday(p.application_end ?? null);
              return (
                <Link key={p.id} href={`/programs/${p.id}`} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {isPersonName(p.managing_org) ? `작성자: ${p.managing_org}` : p.managing_org}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {score > 0 && (
                      <span className={`text-sm font-bold ${mi.color}`}>{score}</span>
                    )}
                    {dd && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        dd.urgent
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'
                      }`}>
                        {dd.label}
                      </span>
                    )}
                    <ArrowRight size={14} className="text-gray-300 dark:text-gray-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── 올해 출시 예정 사업 ────────────────────────────────────────────── */}
      {expectedPrograms.length > 0 && (
        <Section
          icon={<History size={15} className="text-violet-500" />}
          title="작년 기준 — 올해 출시 예정 사업"
          titleColor="text-violet-700 dark:text-violet-400"
          bg="bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800"
          action={{ label: '전체 보기', href: '/programs?status=expected' }}
        >
          <p className="text-xs text-violet-600 dark:text-violet-400 mb-3">
            아직 공고가 나지 않았지만 작년에 운영된 사업이에요. 미리 준비해 두세요!
          </p>
          <div className="space-y-2">
            {expectedPrograms.slice(0, 4).map(p => {
              const month = p.typical_open_month;
              const currentYear = new Date().getFullYear();
              const estimateLabel = month
                ? `예상 ${currentYear}년 ${month}월 모집`
                : `작년 (${p.last_active_year ?? currentYear - 1}) 운영`;
              return (
                <Link key={p.id} href={`/programs/${p.id}`} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {isPersonName(p.managing_org) ? `작성자: ${p.managing_org}` : p.managing_org}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">
                      {estimateLabel}
                    </span>
                    <ArrowRight size={14} className="text-gray-300 dark:text-gray-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── 오늘의 팁 ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-800/30 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-indigo-700 dark:text-indigo-300">
            <Lightbulb size={15} className="text-amber-500" /> 오늘의 팁
          </div>
          <Link href="/learn" className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
            <BookOpen size={11} /> 지원사업 배우기 <ArrowRight size={11} />
          </Link>
        </div>
        <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">{todayTip}</p>
      </div>

      {/* ── 바텀 CTA ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Link
          href="/applications"
          className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Calendar size={15} /> 전체 로드맵 보기
        </Link>
        <Link
          href="/consultant"
          className="flex items-center justify-center gap-2 py-3 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl text-sm font-medium transition-colors"
        >
          <MessageSquare size={15} /> AI 상담하기
        </Link>
      </div>

      {/* ── 군·구 지역사업 안내 ────────────────────────────────────────────── */}
      <div className="mt-4 flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4">
        <span className="text-xl shrink-0">🏘️</span>
        <div>
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
            군·구 단위 소규모 지역사업은 지실장에 없을 수 있어요
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            증평군, 진천군처럼 시군구 단위 지원사업은 각 기관 홈페이지에서 직접 확인해 주세요.
            <br />
            <span className="font-medium">시군구청 홈페이지 → 고시·공고 란</span>에서 찾으실 수 있어요.
          </p>
        </div>
      </div>

    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string; value: string | number; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-3">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-1.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Section({ icon, title, titleColor, bg, action, children }: {
  icon: React.ReactNode;
  title: string;
  titleColor?: string;
  bg?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 mb-4 ${bg ?? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-2 font-semibold text-sm ${titleColor ?? 'text-gray-700 dark:text-gray-300'}`}>
          {icon}
          {title}
        </div>
        {action && (
          <Link href={action.href} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
            {action.label} <ArrowRight size={11} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function formatAmt(manwon: number): string {
  if (manwon >= 10000) return `${(manwon / 10000).toFixed(manwon % 10000 === 0 ? 0 : 1)}억원`;
  if (manwon >= 1000) return `${(manwon / 1000).toFixed(manwon % 1000 === 0 ? 0 : 1)}천만원`;
  return `${manwon.toLocaleString()}만원`;
}
