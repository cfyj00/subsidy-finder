'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { calculateMatch } from '@/lib/matching-engine';
import type { Program, BusinessProfile, UserApplication, ApplicationStatus } from '@/types/database';
import {
  ArrowLeft, CheckCircle2, Circle, ChevronRight,
  ExternalLink, MessageSquare, FileText, Loader2,
  ClipboardCheck, FolderOpen, PenLine, Send, Clock, PartyPopper,
  PlusCircle, CheckCheck, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// ── 지원 단계 정의 ────────────────────────────────────────────────────────────
interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  linkedStatus?: ApplicationStatus[];  // 이 단계에 해당하는 tracker 상태
}

const STEPS: Step[] = [
  {
    id: 'check',
    icon: <ClipboardCheck size={20} />,
    title: '1단계 · 자격 확인',
    desc: '지원 조건을 꼼꼼히 확인하세요',
    linkedStatus: ['preparing'],
  },
  {
    id: 'docs',
    icon: <FolderOpen size={20} />,
    title: '2단계 · 서류 준비',
    desc: '제출 서류를 미리 발급·준비하세요',
    linkedStatus: ['preparing'],
  },
  {
    id: 'plan',
    icon: <PenLine size={20} />,
    title: '3단계 · 사업계획서 작성',
    desc: '심사 기준에 맞는 계획서를 작성하세요',
    linkedStatus: ['preparing'],
  },
  {
    id: 'apply',
    icon: <Send size={20} />,
    title: '4단계 · 온라인 신청',
    desc: '공식 사이트에서 신청서를 제출하세요',
    linkedStatus: ['submitted'],
  },
  {
    id: 'wait',
    icon: <Clock size={20} />,
    title: '5단계 · 심사 대기',
    desc: '심사 결과를 기다리며 추가 서류에 대비하세요',
    linkedStatus: ['reviewing'],
  },
  {
    id: 'result',
    icon: <PartyPopper size={20} />,
    title: '6단계 · 결과 확인',
    desc: '결과를 확인하고 다음 단계를 준비하세요',
    linkedStatus: ['approved', 'rejected'],
  },
];

// 트래커 상태 → 현재 활성 스텝 인덱스
function activeStepIndex(status?: ApplicationStatus): number {
  if (!status) return 0;
  const map: Record<ApplicationStatus, number> = {
    preparing: 0,
    submitted: 3,
    reviewing: 4,
    approved: 5,
    rejected: 5,
  };
  return map[status] ?? 0;
}

// ── 진행도 바 ─────────────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / (total - 1)) * 100);
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
        {current + 1} / {total} 단계
      </span>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [application, setApplication] = useState<UserApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: prog }, { data: bp }, { data: app }] = await Promise.all([
      supabase.from('programs').select('*').eq('id', id).single(),
      supabase.from('business_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_applications').select('*').eq('user_id', user.id).eq('program_id', id).maybeSingle(),
    ]);

    setProgram(prog as Program | null);
    setProfile(bp as BusinessProfile | null);
    setApplication(app as UserApplication | null);
    if (app) setAdded(true);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddToTracker = async () => {
    if (!program || added) return;
    setAdding(true);
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAdding(false); return; }

    const { data: newApp } = await supabase.from('user_applications').insert({
      user_id: user.id,
      program_id: program.id,
      program_title: program.title,
      managing_org: program.managing_org ?? null,
      application_deadline: program.application_end ?? null,
      status: 'preparing',
    }).select().single();

    setApplication(newApp as UserApplication | null);
    setAdded(true);
    setAdding(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }
  if (!program) {
    return (
      <div className="text-center py-32">
        <p className="text-gray-500 dark:text-gray-400">사업 정보를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline text-sm">← 뒤로</button>
      </div>
    );
  }

  const matchResult = profile ? calculateMatch(profile, program) : null;
  const currentStep = activeStepIndex(application?.status);
  const daysLeft = program.application_end
    ? Math.ceil((new Date(program.application_end).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* 뒤로 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> 뒤로
      </button>

      {/* 헤더 */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 mb-5 text-white shadow-lg">
        <p className="text-indigo-200 text-xs mb-1.5 font-medium">지원 여정 가이드</p>
        <h1 className="font-bold text-lg leading-snug mb-2">{program.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-indigo-100">{program.managing_org}</span>
          {program.funding_amount_max && (
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-medium">
              최대 {program.funding_amount_max.toLocaleString()}만원
            </span>
          )}
          {daysLeft !== null && daysLeft >= 0 && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${daysLeft <= 7 ? 'bg-red-400/40' : 'bg-white/20'}`}>
              D-{daysLeft}
            </span>
          )}
        </div>
      </div>

      {/* 트래커 상태 / 추가 버튼 */}
      {added && application ? (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 mb-5">
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCheck size={16} />
            <span className="font-medium">지원 트래커에 추가됨</span>
            <span className="text-emerald-500 dark:text-emerald-500">· {
              { preparing: '준비중', submitted: '제출완료', reviewing: '심사중', approved: '합격', rejected: '불합격' }[application.status]
            }</span>
          </div>
          <Link href="/applications" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
            트래커 보기 →
          </Link>
        </div>
      ) : (
        <button
          onClick={handleAddToTracker}
          disabled={adding}
          className="w-full flex items-center justify-center gap-2 py-3 mb-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
        >
          {adding ? <Loader2 size={15} className="animate-spin" /> : <PlusCircle size={15} />}
          지원 트래커에 추가하고 시작하기
        </button>
      )}

      {/* 진행도 */}
      <ProgressBar current={currentStep} total={STEPS.length} />

      {/* 단계별 카드 */}
      <div className="space-y-3">

        {/* ── 1단계: 자격 확인 ─────────────────────────────────────────────── */}
        <StepCard
          step={STEPS[0]}
          index={0}
          current={currentStep}
        >
          {matchResult ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className={`text-2xl font-bold ${matchResult.score >= 80 ? 'text-emerald-600' : matchResult.score >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {matchResult.score}점
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">/ 100점 — AI 적합도</span>
              </div>
              {matchResult.reasons.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                  {r}
                </div>
              ))}
              {matchResult.mismatches.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>{matchResult.mismatches[0]}</span>
                </div>
              )}
              <Link
                href={`/programs/${id}`}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
              >
                전체 자격 조건 보기 <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <Link href="/profile" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                사업 프로필을 등록
              </Link>하면 AI가 자격 조건을 자동 분석해드립니다.
            </div>
          )}
        </StepCard>

        {/* ── 2단계: 서류 준비 ─────────────────────────────────────────────── */}
        <StepCard step={STEPS[1]} index={1} current={currentStep}>
          {program.required_documents.length > 0 ? (
            <div className="space-y-2">
              {program.required_documents.map((doc, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    {doc}
                  </div>
                  <Link
                    href={`/documents?search=${encodeURIComponent(doc)}`}
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline shrink-0"
                  >
                    발급 안내
                  </Link>
                </div>
              ))}
              <ActionLink
                href={`/consultant?q=${encodeURIComponent(program.title + ' 서류 준비 방법')}&mode=document`}
                icon={<MessageSquare size={13} />}
              >
                서류 준비 AI에게 물어보기
              </ActionLink>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">제출 서류 목록을 공식 사이트에서 확인하세요.</p>
              <ActionLink
                href={`/consultant?q=${encodeURIComponent(program.title + ' 서류 목록 알려줘')}&mode=document`}
                icon={<MessageSquare size={13} />}
              >
                AI에게 서류 목록 물어보기
              </ActionLink>
            </div>
          )}
        </StepCard>

        {/* ── 3단계: 사업계획서 ─────────────────────────────────────────────── */}
        <StepCard step={STEPS[2]} index={2} current={currentStep}>
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-400">
              {[
                '지원사업의 목적과 내 사업의 연관성 명확히 서술',
                '기대 효과와 성과 지표를 구체적인 숫자로 제시',
                '사업 추진 일정과 예산 집행 계획 상세히 기술',
                '기존 성과 및 사업 역량을 증빙 자료와 함께 첨부',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                  {tip}
                </div>
              ))}
            </div>
            <ActionLink
              href={`/consultant?q=${encodeURIComponent(program.title + ' 사업계획서 작성 방법 도와줘')}&mode=bizplan`}
              icon={<PenLine size={13} />}
              highlight
            >
              지실장 AI와 사업계획서 작성하기
            </ActionLink>
          </div>
        </StepCard>

        {/* ── 4단계: 온라인 신청 ───────────────────────────────────────────── */}
        <StepCard step={STEPS[3]} index={3} current={currentStep}>
          <div className="space-y-3">
            {program.application_end && (
              <div className="flex items-center gap-2 text-sm">
                <div className={`font-semibold ${daysLeft !== null && daysLeft <= 7 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  📅 신청 마감: {format(new Date(program.application_end), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </div>
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${daysLeft <= 7 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700'}`}>
                    D-{daysLeft}
                  </span>
                )}
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>✅ 서류 준비 완료 여부 최종 확인</p>
              <p>✅ 신청 시스템 회원가입 / 공인인증서 준비</p>
              <p>✅ 신청서 임시저장 후 내용 재검토</p>
            </div>
            {program.detail_url ? (
              <a
                href={program.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <ExternalLink size={15} /> 공식 사이트에서 신청하기
              </a>
            ) : (
              <div className="py-3 text-center text-sm text-gray-400 bg-gray-50 dark:bg-slate-800 rounded-xl">
                공식 신청 링크가 아직 없습니다. 기관에 직접 문의하세요.
              </div>
            )}
            {added && application?.status === 'preparing' && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                신청 후 트래커에서 상태를 &apos;제출완료&apos;로 업데이트하세요 →{' '}
                <Link href="/applications" className="text-indigo-500 hover:underline">지원 관리</Link>
              </p>
            )}
          </div>
        </StepCard>

        {/* ── 5단계: 심사 대기 ─────────────────────────────────────────────── */}
        <StepCard step={STEPS[4]} index={4} current={currentStep}>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>심사 기간은 사업마다 다르며 보통 <span className="font-medium text-gray-900 dark:text-white">2~8주</span> 소요됩니다.</p>
            <div className="text-xs space-y-1.5">
              <p>📋 추가 서류 요청에 빠르게 대응할 수 있도록 원본 서류 보관</p>
              <p>📞 담당자 연락처를 메모해 두고 상태 문의 가능</p>
              <p>🔄 결과 발표일을 달력에 체크해 두세요</p>
            </div>
            {added && (
              <ActionLink href="/applications" icon={<FileText size={13} />}>
                지원 관리에서 상태 업데이트하기
              </ActionLink>
            )}
          </div>
        </StepCard>

        {/* ── 6단계: 결과 확인 ─────────────────────────────────────────────── */}
        <StepCard step={STEPS[5]} index={5} current={currentStep}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl mb-1">🎉</p>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">합격 시</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">협약 체결 → 사업비 집행 → 성과 보고</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl mb-1">💪</p>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">불합격 시</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">탈락 이유 확인 → 보완 후 재도전</p>
              </div>
            </div>
            <ActionLink
              href={`/consultant?q=${encodeURIComponent('지원사업 합격 후 협약 절차 알려줘')}`}
              icon={<MessageSquare size={13} />}
            >
              합격 후 절차 AI에게 물어보기
            </ActionLink>
          </div>
        </StepCard>
      </div>

      {/* 하단 CTA */}
      <div className="mt-6 flex gap-3">
        <Link
          href="/applications"
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl text-sm font-medium transition-colors"
        >
          📊 전체 트래커 보기
        </Link>
        <Link
          href={`/consultant?q=${encodeURIComponent(program.title + ' 전략 알려줘')}`}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <MessageSquare size={15} /> AI 전략 상담
        </Link>
      </div>

    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function StepCard({
  step, index, current, children,
}: {
  step: Step;
  index: number;
  current: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(index === current || index === 0);
  const isDone = index < current;
  const isCurrent = index === current;
  const isFuture = index > current;

  return (
    <div className={`rounded-2xl border transition-all ${
      isCurrent
        ? 'border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 shadow-sm'
        : isDone
          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-900/10'
          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-70'
    }`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        {/* 상태 아이콘 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
          isCurrent ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' :
          'bg-gray-100 dark:bg-slate-700 text-gray-400'
        }`}>
          {isDone ? <CheckCircle2 size={18} /> : isCurrent ? step.icon : <Circle size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${
            isDone ? 'text-emerald-700 dark:text-emerald-400' :
            isCurrent ? 'text-indigo-700 dark:text-indigo-300' :
            'text-gray-500 dark:text-gray-400'
          }`}>{step.title}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{step.desc}</p>
        </div>

        {isCurrent && (
          <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full font-medium shrink-0">
            진행중
          </span>
        )}
        {isDone && (
          <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full font-medium shrink-0">
            완료
          </span>
        )}
      </button>

      {(open && !isFuture) && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

function ActionLink({
  href, icon, children, highlight,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors ${
        highlight
          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
