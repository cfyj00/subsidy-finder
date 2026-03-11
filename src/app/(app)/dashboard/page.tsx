'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { useProfile } from '@/lib/profile-context';
import { calculateMatch, getMatchLabel } from '@/lib/matching-engine';
import { CATEGORY_COLORS, DAILY_TIPS } from '@/lib/constants';
import type { Program, BusinessProfile, UserProgramMatch } from '@/types/database';
import {
  Search, User, ChevronRight, TrendingUp, Clock, Star, Lightbulb,
  AlertTriangle, CheckCircle2, BarChart3, Loader2, RefreshCw
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TopMatch {
  program: Program;
  match: { score: number; label: string; color: string; reasons: string[] };
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [topMatches, setTopMatches] = useState<TopMatch[]>([]);
  const [urgentPrograms, setUrgentPrograms] = useState<Program[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [tip] = useState(() => DAILY_TIPS[Math.floor(Math.random() * DAILY_TIPS.length)]);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: bp }, { data: progs }] = await Promise.all([
      supabase.from('business_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('programs').select('*').in('status', ['open', 'upcoming']).order('is_featured', { ascending: false }),
    ]);

    setBusinessProfile(bp as BusinessProfile | null);
    const programs = (progs || []) as Program[];
    setAllPrograms(programs);

    if (bp && programs.length > 0) {
      // Calculate matches
      const scored = programs.map(p => {
        const result = calculateMatch(bp as BusinessProfile, p);
        const matchInfo = getMatchLabel(result.score);
        return { program: p, match: { ...matchInfo, score: result.score, reasons: result.reasons } };
      });
      scored.sort((a, b) => b.match.score - a.match.score);
      setTopMatches(scored.slice(0, 5));

      // Urgent: active programs with deadline within 14 days
      const urgent = programs.filter(p => {
        if (!p.application_end) return false;
        const days = differenceInDays(new Date(p.application_end), new Date());
        return days >= 0 && days <= 14;
      }).sort((a, b) => new Date(a.application_end!).getTime() - new Date(b.application_end!).getTime());
      setUrgentPrograms(urgent.slice(0, 3));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profileLoading) loadData();
  }, [profileLoading, loadData]);

  const runMatching = async () => {
    if (!businessProfile || allPrograms.length === 0) return;
    setMatchingLoading(true);
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMatchingLoading(false); return; }

    // Upsert all match scores
    for (const program of allPrograms) {
      const result = calculateMatch(businessProfile, program);
      await supabase.from('user_program_matches').upsert({
        user_id: user.id,
        program_id: program.id,
        match_score: result.score,
        match_reasons: result.reasons,
        mismatch_reasons: result.mismatches,
      }, { onConflict: 'user_id,program_id' });
    }

    setMatchingLoading(false);
    loadData();
  };

  // Profile completion
  const getProfileCompletion = () => {
    if (!businessProfile) return 0;
    const fields = [
      businessProfile.business_name,
      businessProfile.business_type,
      businessProfile.region_sido,
      businessProfile.representative_name,
      businessProfile.establishment_date,
      businessProfile.employee_count,
      businessProfile.annual_revenue,
      businessProfile.goals.length > 0,
      businessProfile.current_challenges.length > 0,
    ];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  };

  const completion = getProfileCompletion();

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          안녕하세요{profile?.display_name ? `, ${profile.display_name}님` : ''} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {businessProfile?.business_name
            ? `${businessProfile.business_name} — 오늘도 딱 맞는 지원사업을 찾아드릴게요 😊`
            : '사업 프로필을 등록하면 딱 맞는 지원사업을 추천해 드려요!'}
        </p>
      </div>

      {/* Onboarding CTA */}
      {!businessProfile && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-lg mb-1">지원사업, 같이 찾아봐요! 🤝</h2>
              <p className="text-indigo-200 text-sm">딱 5분이면 AI가 우리 사업에 맞는 지원사업을 골라드려요. 처음이라도 걱정 없어요!</p>
            </div>
            <span className="text-3xl">🚀</span>
          </div>
          <Link href="/profile" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors">
            시작하기 <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Stats row */}
      {businessProfile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{allPrograms.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">열려있는 사업</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {topMatches.filter(m => m.match.score >= 60).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">내게 맞는 사업</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{urgentPrograms.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">곧 마감 예정</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <div className={`text-2xl font-bold ${completion >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {completion}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">프로필 완성</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top matches */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Star size={16} className="text-amber-500" /> 맞춤 추천 TOP 5
            </h2>
            <div className="flex gap-2">
              {businessProfile && (
                <button
                  onClick={runMatching}
                  disabled={matchingLoading}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <RefreshCw size={12} className={matchingLoading ? 'animate-spin' : ''} />
                  갱신
                </button>
              )}
              <Link href="/programs" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5">
                전체보기 <ChevronRight size={12} />
              </Link>
            </div>
          </div>

          {!businessProfile ? (
            <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-2xl p-8 text-center">
              <BarChart3 size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">프로필을 등록하면 AI가 딱 맞는 사업을 골라드려요 😊</p>
              <Link href="/profile" className="inline-flex items-center gap-1 mt-3 text-sm text-indigo-600 hover:underline">
                지금 시작하기 <ChevronRight size={14} />
              </Link>
            </div>
          ) : topMatches.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-2xl p-8 text-center">
              <Search size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">추천 사업을 불러오고 있어요. 잠깐만요!</p>
              <Link href="/programs" className="inline-flex items-center gap-1 mt-3 text-sm text-indigo-600 hover:underline">
                지원사업 둘러보기 <ChevronRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {topMatches.map(({ program, match }, i) => {
                const daysLeft = program.application_end
                  ? differenceInDays(new Date(program.application_end), new Date())
                  : null;
                return (
                  <Link
                    key={program.id}
                    href={`/programs/${program.id}`}
                    className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[program.category] || CATEGORY_COLORS['기타']}`}>
                          {program.category}
                        </span>
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            D-{daysLeft}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {program.title}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{program.managing_org}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-lg font-bold ${match.color}`}>{match.score}</div>
                      <div className="text-xs text-gray-400">{match.label}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Urgent deadlines */}
          {urgentPrograms.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 rounded-2xl p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <Clock size={14} className="text-red-500" /> 놓치지 마세요!
              </h3>
              <div className="space-y-2">
                {urgentPrograms.map(p => {
                  const days = differenceInDays(new Date(p.application_end!), new Date());
                  return (
                    <Link key={p.id} href={`/programs/${p.id}`} className="flex items-start gap-2 group">
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0 ${days <= 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        D-{days}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 transition-colors">
                        {p.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Profile completion */}
          {businessProfile && completion < 100 && (
            <div className="bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-amber-500" /> 조금만 더 채워요!
              </h3>
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">완성도</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{completion}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                정보를 조금만 더 채우면 더 정확한 추천을 받을 수 있어요 ✨
              </p>
              <Link href="/profile" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-medium">
                프로필 완성하러 가기 <ChevronRight size={12} />
              </Link>
            </div>
          )}

          {/* Daily tip */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl p-4">
            <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2 mb-2 text-sm">
              <Lightbulb size={14} /> 오늘의 팁
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">{tip}</p>
          </div>

          {/* Quick actions */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">바로 가기</h3>
            <div className="space-y-2">
              <Link href="/programs" className="flex items-center justify-between group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Search size={15} className="text-indigo-500" /> 지원사업 둘러보기
                </div>
                <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </Link>
              <Link href="/profile" className="flex items-center justify-between group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <User size={15} className="text-indigo-500" /> 내 프로필 보기
                </div>
                <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </Link>
              <Link href="/consultant" className="flex items-center justify-between group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <TrendingUp size={15} className="text-indigo-500" /> AI에게 물어보기
                </div>
                <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
