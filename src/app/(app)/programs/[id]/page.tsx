'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { calculateMatch, getMatchLabel } from '@/lib/matching-engine';
import { stripHtml } from '@/lib/data/utils';
import { useBusinessProfile } from '@/lib/business-profile-context';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { Program, UserProgramMatch } from '@/types/database';
import {
  ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, CheckCircle,
  XCircle, Calendar, Building2, MapPin, Users, DollarSign, Clock,
  Loader2, PlusCircle, Tag, FileText, X, CheckCheck, PlayCircle,
  Sparkles, Copy, Check, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  generateBusinessPlanPrompt,
  generateEligibilityCheckPrompt,
  generateDocumentChecklistPrompt,
  generateInquiryPrompt,
} from '@/lib/ai/prompt-generator';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// ── AddApplication Modal ──────────────────────────────────────────────────────
interface AddAppModalProps {
  program: Program;
  onClose: () => void;
  onAdded: () => void;
}

function AddAppModal({ program, onClose, onAdded }: AddAppModalProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from('user_applications').insert({
      user_id: user.id,
      program_id: program.id,
      program_title: program.title,
      managing_org: program.managing_org ?? null,
      application_deadline: program.application_end ?? null,
      status: 'preparing',
      notes: notes.trim() || null,
    });
    setSaving(false);
    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">지원 관리에 추가</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">칸반 보드에서 진행 상황을 추적합니다</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Program preview */}
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 mb-4">
          <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2">{program.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{program.managing_org}</p>
          {program.application_end && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
              📅 마감 {format(new Date(program.application_end), 'yyyy.M.d (EEE)', { locale: ko })}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">메모 <span className="text-gray-400">(선택)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="준비 사항, 담당자 연락처, 신청 링크 등..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            추가하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [match, setMatch] = useState<UserProgramMatch | null>(null);
  const { activeProfile: businessProfile, loading: profileLoading } = useBusinessProfile();
  const [loading, setLoading] = useState(true);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addedToTracker, setAddedToTracker] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prog }, { data: matchData }, { data: appData }] = await Promise.all([
      supabase.from('programs').select('*').eq('id', id).single(),
      supabase.from('user_program_matches').select('*').eq('user_id', user.id).eq('program_id', id).maybeSingle(),
      supabase.from('user_applications').select('id').eq('user_id', user.id).eq('program_id', id).maybeSingle(),
    ]);

    setProgram(prog as Program | null);
    setMatch(matchData as UserProgramMatch | null);
    if (appData) setAddedToTracker(true);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const matchResult = program && businessProfile ? calculateMatch(businessProfile, program) : null;
  const effectiveMatch = match || (matchResult ? {
    match_score: matchResult.score,
    match_reasons: matchResult.reasons,
    mismatch_reasons: matchResult.mismatches,
  } : null);
  const matchInfo = effectiveMatch ? getMatchLabel(effectiveMatch.match_score) : null;

  const handleToggleBookmark = async () => {
    if (!program) return;
    setBookmarkLoading(true);
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBookmarkLoading(false); return; }

    if (match) {
      const { data: updated } = await supabase
        .from('user_program_matches')
        .update({ is_bookmarked: !match.is_bookmarked })
        .eq('id', match.id)
        .select()
        .single();
      setMatch(updated as UserProgramMatch | null);
    } else {
      const score = matchResult?.score ?? 0;
      const { data: newMatch } = await supabase
        .from('user_program_matches')
        .insert({
          user_id: user.id,
          program_id: program.id,
          match_score: score,
          match_reasons: matchResult?.reasons ?? [],
          mismatch_reasons: matchResult?.mismatches ?? [],
          is_bookmarked: true,
        })
        .select()
        .single();
      setMatch(newMatch as UserProgramMatch | null);
    }
    setBookmarkLoading(false);
  };

  const KOREAN_SURNAMES = '김이박최정강조윤장임한오서신권황안송유홍전고문양손배백노하허심도우남엄채원천방공현함변염석선설마길진봉온형민계';
  const isPersonName = (name: string | null | undefined): boolean => {
    if (!name) return false;
    const t = name.trim();
    return /^[가-힣]{2,4}$/.test(t) && KOREAN_SURNAMES.includes(t[0]);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      open:     { label: '모집중',      cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      upcoming: { label: '예정',        cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
      closed:   { label: '마감',        cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
      always:   { label: '상시접수',    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
      expected: { label: '출시예상',    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    };
    const info = map[s] ?? map.always;
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${info.cls}`}>{info.label}</span>;
  };

  // ── Loading / Not Found ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="text-center py-32">
        <p className="text-gray-500 dark:text-gray-400">사업 정보를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline text-sm">← 목록으로 돌아가기</button>
      </div>
    );
  }

  const daysLeft = program.application_end
    ? Math.ceil((new Date(program.application_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> 목록으로
        </button>

        {/* ── Header card ─────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[program.category] ?? CATEGORY_COLORS['기타']}`}>
                  {program.category}
                </span>
                {statusBadge(program.status)}
                {program.is_featured && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">⭐ 추천</span>
                )}
                {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {daysLeft === 0 ? 'D-day' : `D-${daysLeft}`}
                  </span>
                )}
                {addedToTracker && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    ✓ 트래킹 중
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight mb-2">{program.title}</h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                {isPersonName(program.managing_org) ? (
                  <>
                    {program.implementing_org && (
                      <span className="flex items-center gap-1.5"><Building2 size={13} />{program.implementing_org}</span>
                    )}
                    <span className="flex items-center gap-1.5">작성자: {program.managing_org}</span>
                  </>
                ) : (
                  <>
                    {program.managing_org && (
                      <span className="flex items-center gap-1.5"><Building2 size={13} />{program.managing_org}</span>
                    )}
                    {program.implementing_org && program.implementing_org !== program.managing_org && (
                      <span className="flex items-center gap-1.5">· {program.implementing_org}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Score + Bookmark */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              {effectiveMatch && (
                <div className="text-center">
                  <div className={`text-3xl font-bold ${matchInfo?.color}`}>{effectiveMatch.match_score}</div>
                  <div className="text-xs text-gray-400 font-medium">{matchInfo?.label}</div>
                </div>
              )}
              <button
                onClick={handleToggleBookmark}
                disabled={bookmarkLoading}
                title={match?.is_bookmarked ? '북마크 해제' : '북마크'}
                className={`p-2 rounded-xl border transition-colors ${
                  match?.is_bookmarked
                    ? 'border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400'
                    : 'border-gray-200 dark:border-slate-600 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:text-indigo-400'
                }`}
              >
                {match?.is_bookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* ── 출시 예상 안내 배너 ──────────────────────────────────────────────────── */}
        {program.status === 'expected' && (
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="font-semibold text-violet-800 dark:text-violet-300 text-sm mb-1">
                  아직 공고가 나지 않은 사업입니다 — 미리 준비하세요!
                </p>
                <p className="text-xs text-violet-700 dark:text-violet-400 leading-relaxed">
                  이 사업은 <strong>{program.last_active_year ?? '작년'}년에 운영</strong>되었으며,
                  {program.typical_open_month
                    ? ` 보통 ${program.typical_open_month}월경에 모집 공고가 납니다.`
                    : ' 유사한 일정으로 올해도 운영될 가능성이 높습니다.'}
                  {' '}아래 서류를 미리 준비하고, 담당 기관에 문의해 두면 공고 즉시 빠르게 신청할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Key info + Match analysis ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Key info */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">핵심 정보</h2>
            <div className="space-y-3">
              {program.funding_amount_max && (
                <InfoRow icon={<DollarSign size={15} className="text-indigo-500" />} label="지원 금액">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {program.funding_amount_min ? `${program.funding_amount_min.toLocaleString()}~` : '최대 '}
                    {program.funding_amount_max.toLocaleString()}만원
                  </span>
                  {program.self_funding_ratio != null && (
                    <span className="text-xs text-gray-400 ml-1">(자부담 {program.self_funding_ratio}%)</span>
                  )}
                </InfoRow>
              )}
              {program.support_type && (
                <InfoRow icon={<Clock size={15} className="text-indigo-500" />} label="지원 유형">
                  {program.support_type}
                </InfoRow>
              )}
              {program.status === 'expected' ? (
                <InfoRow icon={<Calendar size={15} className="text-violet-500" />} label="신청 기간">
                  <span className="text-violet-600 dark:text-violet-400">
                    {program.typical_open_month
                      ? `${new Date().getFullYear()}년 ${program.typical_open_month}월경 예상 (미확정)`
                      : `${program.last_active_year ?? new Date().getFullYear() - 1}년 운영 기준 올해 예상`}
                  </span>
                </InfoRow>
              ) : (program.application_start || program.application_end) ? (
                <InfoRow icon={<Calendar size={15} className="text-indigo-500" />} label="신청 기간">
                  {program.application_start ? format(new Date(program.application_start), 'yyyy.M.d') : '상시'}
                  {program.application_end && ` ~ ${format(new Date(program.application_end), 'yyyy.M.d')}`}
                </InfoRow>
              ) : null}
              {program.target_regions.length > 0 && (
                <InfoRow icon={<MapPin size={15} className="text-indigo-500" />} label="대상 지역">
                  {program.target_regions[0] === '전국' ? '전국' : program.target_regions.join(', ')}
                </InfoRow>
              )}
              {program.target_company_size.length > 0 && (
                <InfoRow icon={<Users size={15} className="text-indigo-500" />} label="대상 기업">
                  {program.target_company_size.join(', ')}
                </InfoRow>
              )}
              {program.target_industries.length > 0 && (
                <InfoRow icon={<Tag size={15} className="text-indigo-500" />} label="대상 업종">
                  {program.target_industries[0] === '전업종'
                    ? '전 업종'
                    : <>
                        {program.target_industries.slice(0, 3).join(', ')}
                        {program.target_industries.length > 3 && (
                          <span className="text-gray-400"> 외 {program.target_industries.length - 3}개</span>
                        )}
                      </>
                  }
                </InfoRow>
              )}
            </div>
          </div>

          {/* Match analysis */}
          {effectiveMatch ? (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">AI 적합도 분석</h2>

              {/* Score bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500 dark:text-gray-400">내 사업 적합도</span>
                  <span className={`font-bold ${matchInfo?.color}`}>{effectiveMatch.match_score}점 / 100점</span>
                </div>
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      effectiveMatch.match_score >= 80 ? 'bg-emerald-500' :
                      effectiveMatch.match_score >= 60 ? 'bg-blue-500' :
                      effectiveMatch.match_score >= 40 ? 'bg-amber-500' : 'bg-gray-400'
                    }`}
                    style={{ width: `${effectiveMatch.match_score}%` }}
                  />
                </div>
              </div>

              {effectiveMatch.match_reasons.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">✅ 적합 이유</p>
                  <ul className="space-y-1.5">
                    {effectiveMatch.match_reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <CheckCircle size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {effectiveMatch.mismatch_reasons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">⚠️ 확인 필요</p>
                  <ul className="space-y-1.5">
                    {effectiveMatch.mismatch_reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <XCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!businessProfile && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  <Link href="/profile" className="text-indigo-600 dark:text-indigo-400 hover:underline">프로필을 등록</Link>하면 정확한 매칭 분석을 받을 수 있습니다.
                </p>
              )}
            </div>
          ) : profileLoading ? (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : !businessProfile ? (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-3">
              <div className="text-3xl">📊</div>
              <div>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">적합도 분석 미사용</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">사업 프로필을 등록하면 이 사업과의 적합도를 분석해 드립니다.</p>
              </div>
              <Link
                href="/profile"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                프로필 등록하기
              </Link>
            </div>
          ) : null}
        </div>

        {/* ── Description ──────────────────────────────────────────────────────── */}
        {program.description && (() => {
          const cleanDesc = stripHtml(program.description) ?? '';
          const isLong = cleanDesc.length > 120;
          return (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 mb-4">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">사업 개요</h2>
              <p className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${!descExpanded && isLong ? 'line-clamp-5' : 'whitespace-pre-line'}`}>
                {cleanDesc}
              </p>
              {isLong && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="mt-2 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {descExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {descExpanded ? '접기' : '더보기'}
                </button>
              )}
            </div>
          );
        })()}

        {/* ── Eligibility ───────────────────────────────────────────────────────── */}
        {program.eligibility_summary && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 mb-4">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">신청 자격</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{program.eligibility_summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              {(program.min_employee_count != null || program.max_employee_count != null) && (
                <span>👥 직원수 {program.min_employee_count ?? 0}명 이상{program.max_employee_count != null ? ` ${program.max_employee_count}명 이하` : ''}</span>
              )}
              {(program.min_company_age != null || program.max_company_age != null) && (
                <span>📅 업력 {program.min_company_age ?? 0}년 이상{program.max_company_age != null ? ` ${program.max_company_age}년 이하` : ''}</span>
              )}
              {(program.min_revenue != null || program.max_revenue != null) && (
                <span>💰 매출 {program.min_revenue != null ? `${program.min_revenue.toLocaleString()}만원 이상` : ''}{program.max_revenue != null ? ` ${program.max_revenue.toLocaleString()}만원 이하` : ''}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Required Documents ────────────────────────────────────────────────── */}
        {program.required_documents.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">제출 서류</h2>
              <Link
                href="/documents"
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <FileText size={12} /> 서류 가이드 →
              </Link>
            </div>
            <ul className="space-y-2 mb-3">
              {program.required_documents.map((doc, i) => (
                <li key={i} className="flex items-center justify-between gap-2 group">
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="truncate">{doc}</span>
                  </div>
                  <Link
                    href={`/documents?search=${encodeURIComponent(doc)}`}
                    className="flex-shrink-0 text-xs text-indigo-500 dark:text-indigo-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    발급 안내
                  </Link>
                </li>
              ))}
            </ul>
            <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
              <Link
                href={`/consultant?q=${encodeURIComponent(program.title + ' 제출 서류 준비 방법 알려줘')}&mode=document`}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                💬 이 사업 서류 준비, AI에게 물어보기 →
              </Link>
            </div>
          </div>
        )}

        {/* ── 프롬프트 생성 ─────────────────────────────────────────────────────── */}
        {businessProfile && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl mb-4 overflow-hidden">
            <button
              onClick={() => setShowPrompts(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">AI 프롬프트 생성</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">복사 후 원하는 AI에 붙여넣기</span>
              </div>
              {showPrompts ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {showPrompts && (() => {
              const promptTemplates = [
                { id: 'bizplan',     label: '사업계획서 작성',  fn: () => generateBusinessPlanPrompt(businessProfile, program) },
                { id: 'eligibility', label: '자격요건 확인',    fn: () => generateEligibilityCheckPrompt(businessProfile, program) },
                { id: 'documents',   label: '서류 체크리스트',  fn: () => generateDocumentChecklistPrompt(businessProfile, program) },
                { id: 'inquiry',     label: '담당기관 문의 질문', fn: () => generateInquiryPrompt(businessProfile, program) },
              ];
              const handleCopy = (id: string, fn: () => string) => {
                navigator.clipboard.writeText(fn()).then(() => {
                  setCopiedPromptId(id);
                  setTimeout(() => setCopiedPromptId(null), 2000);
                });
              };
              return (
                <div className="px-5 pb-4 grid grid-cols-2 gap-2 border-t border-gray-100 dark:border-slate-700 pt-3">
                  {promptTemplates.map(({ id, label, fn }) => (
                    <button
                      key={id}
                      onClick={() => handleCopy(id, fn)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors ${
                        copiedPromptId === id
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                          : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      }`}
                    >
                      {copiedPromptId === id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedPromptId === id ? '복사됨!' : label}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">다음 단계</h2>
          <div className="flex flex-col gap-3">
            {/* 지원하기 — 주 CTA */}
            <Link
              href={`/apply/${id}`}
              className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              <PlayCircle size={16} /> 지원하기 — 단계별 가이드 보기
            </Link>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Add to tracker */}
              <button
                onClick={() => !addedToTracker && setShowAddModal(true)}
                disabled={addedToTracker}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors border ${
                  addedToTracker
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400 cursor-default'
                    : 'border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                }`}
              >
                {addedToTracker
                  ? <><CheckCheck size={15} /> 트래커에 추가됨</>
                  : <><PlusCircle size={15} /> 트래커에 추가</>
                }
              </button>

              {/* AI consult */}
              <Link
                href={`/consultant?programId=${id}&q=${encodeURIComponent(program.title + ' 지원사업 신청 전략 알려줘')}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                🎯 AI 상담
              </Link>

              {/* Official site */}
              {program.detail_url && (
                <a
                  href={program.detail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl font-medium text-sm transition-colors"
                >
                  <ExternalLink size={14} /> 공식 사이트
                </a>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Add Application Modal */}
      {showAddModal && program && (
        <AddAppModal
          program={program}
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); setAddedToTracker(true); }}
        />
      )}
    </>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm font-medium text-gray-900 dark:text-white">{children}</div>
      </div>
    </div>
  );
}
