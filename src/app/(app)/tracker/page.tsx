'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { UserApplication } from '@/types/database';
import {
  CheckCircle2, Circle, ChevronRight, ExternalLink,
  Plus, Loader2, LayoutList, MessageSquare,
  ClipboardCheck, FolderOpen, Send, Clock, PartyPopper,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// ── 지원 단계 정의 ────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: 'check',  label: '자격확인', icon: <ClipboardCheck size={14} />, statuses: ['preparing'] },
  { id: 'docs',   label: '서류준비', icon: <FolderOpen size={14} />, statuses: ['preparing'] },
  { id: 'apply',  label: '신청완료', icon: <Send size={14} />, statuses: ['submitted'] },
  { id: 'review', label: '심사중',   icon: <Clock size={14} />, statuses: ['reviewing'] },
  { id: 'result', label: '결과',     icon: <PartyPopper size={14} />, statuses: ['approved', 'rejected'] },
] as const;

type PipelineStatus = UserApplication['status'];

function stepIndex(status: PipelineStatus): number {
  const map: Record<PipelineStatus, number> = {
    preparing: 1,   // 서류준비까지 (0, 1)
    submitted: 2,
    reviewing: 3,
    approved: 4,
    rejected: 4,
  };
  return map[status] ?? 0;
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function dday(deadline: string | null): { label: string; color: string } | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return { label: '마감', color: 'text-gray-400' };
  if (diff === 0) return { label: 'D-Day', color: 'text-red-600 dark:text-red-400 font-bold' };
  if (diff <= 7)  return { label: `D-${diff}`, color: 'text-red-600 dark:text-red-400 font-semibold' };
  if (diff <= 30) return { label: `D-${diff}`, color: 'text-amber-600 dark:text-amber-400' };
  return { label: `D-${diff}`, color: 'text-gray-400' };
}

function nextAction(status: PipelineStatus): string {
  const map: Record<PipelineStatus, string> = {
    preparing:  '서류 준비 · 사업계획서 작성 후 신청',
    submitted:  '심사 결과 대기 · 추가 서류 요청 확인',
    reviewing:  '결과 발표일 확인 · 담당자 연락 대기',
    approved:   '협약 체결 및 사업비 집행 계획 수립',
    rejected:   '탈락 사유 확인 후 재도전 사업 탐색',
  };
  return map[status] ?? '';
}

function formatAmt(manwon: number): string {
  if (manwon >= 10000) return `${(manwon / 10000).toFixed(manwon % 10000 === 0 ? 0 : 1)}억원`;
  if (manwon >= 1000)  return `${(manwon / 1000).toFixed(manwon % 1000 === 0 ? 0 : 1)}천만원`;
  return `${manwon.toLocaleString()}만원`;
}

const STATUS_CONFIG: Record<PipelineStatus, { label: string; badgeCls: string }> = {
  preparing: { label: '준비중',   badgeCls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  submitted: { label: '제출완료', badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  reviewing: { label: '심사중',   badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  approved:  { label: '합격 🎉',  badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  rejected:  { label: '불합격',   badgeCls: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
};

type FilterTab = 'active' | 'all' | 'done';

// ── 메인 ──────────────────────────────────────────────────────────────────────
export default function TrackerPage() {
  const [apps, setApps] = useState<UserApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('active');

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setApps((data ?? []) as UserApplication[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = apps.filter(a => !['approved', 'rejected'].includes(a.status));
  const done   = apps.filter(a => ['approved', 'rejected'].includes(a.status));

  const displayed =
    filter === 'active' ? active :
    filter === 'done'   ? done :
    apps;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">지원 트래커</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            내 모든 지원사업의 진행 로드맵
          </p>
        </div>
        <Link
          href="/applications"
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <LayoutList size={14} /> 칸반 보기
        </Link>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: '진행 중', value: active.length, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: '합격',    value: done.filter(a => a.status === 'approved').length, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: '전체',    value: apps.length, color: 'text-gray-700 dark:text-gray-300' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
        {([
          ['active', `진행 중 (${active.length})`],
          ['all',    `전체 (${apps.length})`],
          ['done',   `완료 (${done.length})`],
        ] as [FilterTab, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              filter === val
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 빈 상태 */}
      {apps.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">아직 추적 중인 지원사업이 없어요</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
            지원사업 상세 페이지에서 &apos;지원 트래커에 추가&apos;를 눌러보세요
          </p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} /> 지원사업 탐색하기
          </Link>
        </div>
      )}

      {displayed.length === 0 && apps.length > 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          해당 항목이 없어요
        </div>
      )}

      {/* 지원 카드 목록 */}
      <div className="space-y-4">
        {displayed.map(app => {
          const cfg = STATUS_CONFIG[app.status];
          const dd = dday(app.application_deadline);
          const curStep = stepIndex(app.status);

          return (
            <div
              key={app.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              {/* 상단 정보 */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeCls}`}>
                      {cfg.label}
                    </span>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm mt-1.5 leading-snug">
                      {app.program_title}
                    </p>
                    {app.managing_org && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{app.managing_org}</p>
                    )}
                  </div>
                  {dd && (
                    <span className={`shrink-0 text-xs font-medium ${dd.color}`}>{dd.label}</span>
                  )}
                </div>

                {/* 파이프라인 진행 바 */}
                <div className="flex items-center gap-0 mb-3">
                  {PIPELINE_STEPS.map((step, i) => {
                    const isCompleted = i < curStep;
                    const isCurrent = i === curStep;
                    const isLast = i === PIPELINE_STEPS.length - 1;

                    return (
                      <div key={step.id} className="flex items-center flex-1 min-w-0">
                        {/* 스텝 점 */}
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isCompleted ? 'bg-indigo-500 text-white' :
                            isCurrent   ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-400' :
                            'bg-gray-100 dark:bg-slate-700 text-gray-400'
                          }`}>
                            {isCompleted ? <CheckCircle2 size={14} /> : isCurrent ? step.icon : <Circle size={12} />}
                          </div>
                          <span className={`text-[10px] mt-0.5 whitespace-nowrap ${
                            isCompleted ? 'text-indigo-500' :
                            isCurrent   ? 'text-indigo-600 dark:text-indigo-400 font-semibold' :
                            'text-gray-400'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {/* 연결선 */}
                        {!isLast && (
                          <div className={`flex-1 h-0.5 mx-1 mb-4 rounded-full ${i < curStep ? 'bg-indigo-400' : 'bg-gray-200 dark:bg-slate-700'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 다음 액션 */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">다음 할 일</p>
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    👉 {nextAction(app.status)}
                  </p>
                  {app.application_deadline && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      📅 마감 {format(new Date(app.application_deadline), 'yyyy.M.d (EEE)', { locale: ko })}
                    </p>
                  )}
                </div>

                {/* 합격 시 확정 금액 */}
                {app.status === 'approved' && app.result_amount && (
                  <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">🎉 확정 지원금</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatAmt(app.result_amount)}</p>
                  </div>
                )}
              </div>

              {/* 하단 액션 */}
              <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
                {app.program_id && (
                  <Link
                    href={`/apply/${app.program_id}`}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    지원 여정 가이드 <ChevronRight size={12} />
                  </Link>
                )}
                <div className="flex-1" />
                <Link
                  href={`/consultant?q=${encodeURIComponent(app.program_title + ' ' + nextAction(app.status))}`}
                  className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <MessageSquare size={12} /> AI 상담
                </Link>
                {app.program_id && (
                  <Link
                    href={`/programs/${app.program_id}`}
                    className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <ExternalLink size={12} /> 상세보기
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 CTA */}
      {apps.length > 0 && (
        <div className="mt-6 flex gap-3">
          <Link
            href="/programs"
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} /> 새 지원사업 추가
          </Link>
          <Link
            href="/briefing"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            브리핑으로 돌아가기
          </Link>
        </div>
      )}

    </div>
  );
}
