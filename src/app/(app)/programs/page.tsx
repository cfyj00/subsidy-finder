'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { useProfile } from '@/lib/profile-context';
import { calculateMatch, getMatchLabel } from '@/lib/matching-engine';
import { PROGRAM_CATEGORIES, SUPPORT_TYPES, CATEGORY_COLORS } from '@/lib/constants';
import type { Program, BusinessProfile, UserProgramMatch } from '@/types/database';
import {
  Search, SlidersHorizontal, Bookmark, BookmarkCheck,
  ExternalLink, ChevronRight, Filter, X, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { matchesSearch } from '@/lib/search-keywords';

export default function ProgramsPage() {
  const { profile } = useProfile();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [matches, setMatches] = useState<Record<string, UserProgramMatch>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load business profile
    const { data: bp } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).single();
    setBusinessProfile(bp as BusinessProfile | null);

    // Load programs
    let query = supabase.from('programs').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    if (filterCategory) query = query.eq('category', filterCategory);
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data: progs } = await query;
    setPrograms((progs || []) as Program[]);

    // Load existing matches/bookmarks
    const { data: matchData } = await supabase
      .from('user_program_matches')
      .select('*')
      .eq('user_id', user.id);

    const matchMap: Record<string, UserProgramMatch> = {};
    (matchData || []).forEach((m: UserProgramMatch) => { matchMap[m.program_id] = m; });
    setMatches(matchMap);
    setLoading(false);
  }, [filterCategory, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleBookmark = async (programId: string) => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existing = matches[programId];
    if (existing) {
      await supabase.from('user_program_matches').update({ is_bookmarked: !existing.is_bookmarked }).eq('id', existing.id);
      setMatches(prev => ({ ...prev, [programId]: { ...existing, is_bookmarked: !existing.is_bookmarked } }));
    } else {
      const program = programs.find(p => p.id === programId);
      const matchResult = businessProfile && program ? calculateMatch(businessProfile, program) : { score: 0, reasons: [], mismatches: [] };
      const { data: newMatch } = await supabase.from('user_program_matches').insert({
        user_id: user.id,
        program_id: programId,
        match_score: matchResult.score,
        match_reasons: matchResult.reasons,
        mismatch_reasons: matchResult.mismatches,
        is_bookmarked: true,
      }).select().single();
      if (newMatch) setMatches(prev => ({ ...prev, [programId]: newMatch as UserProgramMatch }));
    }
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    const res = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    setSeedMsg(data.message);
    setSeedLoading(false);
    setTimeout(() => { setSeedMsg(''); loadData(); }, 2000);
  };

  const getMatchScore = (programId: string) => {
    if (!businessProfile) return null;
    const program = programs.find(p => p.id === programId);
    if (!program) return null;
    const existing = matches[programId];
    if (existing) return existing.match_score;
    return calculateMatch(businessProfile, program).score;
  };

  const bookmarkCount = Object.values(matches).filter(m => m.is_bookmarked).length;

  const filteredPrograms = programs.filter(p => {
    // ── 키워드 검색 (동의어 확장) ──────────────────
    if (searchQuery) {
      if (!matchesSearch(p, searchQuery)) return false;
    }
    // ── 지역 필터 ────────────────────────────────
    if (filterRegion !== 'all') {
      if (p.target_regions.length > 0 && !p.target_regions.includes('전국') && !p.target_regions.some(r => r.includes(filterRegion))) return false;
    }
    // ── 북마크 필터 ──────────────────────────────
    if (filterBookmarked) {
      if (!matches[p.id]?.is_bookmarked) return false;
    }
    return true;
  });

  const statusLabel = (s: string) => {
    switch (s) {
      case 'open':     return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">모집중</span>;
      case 'upcoming': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">예정</span>;
      case 'closed':   return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">마감</span>;
      case 'expected': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">출시예상</span>;
      default:         return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">상시</span>;
    }
  };

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">지원사업 검색</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">총 {filteredPrograms.length}개 사업</p>
        </div>
        <div className="flex gap-2">
          {programs.length === 0 && !loading && (
            <button
              onClick={handleSeed}
              disabled={seedLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {seedLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              데이터 로드
            </button>
          )}
        </div>
      </div>

      {seedMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
          ✅ {seedMsg}
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="창업, 수출, R&D, 스마트팩토리, 인력 등 키워드 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setFilterBookmarked(!filterBookmarked)}
          className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
            filterBookmarked
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
          }`}
        >
          <BookmarkCheck size={15} />
          {filterBookmarked ? `북마크 ${bookmarkCount}` : '북마크'}
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
            showFilters
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
          }`}
        >
          <Filter size={15} /> 필터
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">카테고리</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                {PROGRAM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">모집 상태</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                <option value="open">모집중</option>
                <option value="upcoming">예정</option>
                <option value="expected">출시예상 (작년기준)</option>
                <option value="always">상시</option>
                <option value="closed">마감</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterRegion('all'); setSearchQuery(''); setFilterBookmarked(false); }}
                className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category quick filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCategory('')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            !filterCategory ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
          }`}
        >
          전체
        </button>
        {PROGRAM_CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setFilterCategory(filterCategory === c.value ? '' : c.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filterCategory === c.value ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Program list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">검색 결과가 없습니다</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {programs.length === 0
              ? '"데이터 로드" 버튼을 눌러 지원사업을 불러오세요.'
              : '다른 키워드를 시도해 보세요. 예: 창업, 수출, R&D, 스마트팩토리, 인력지원'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPrograms.map(program => {
            const score = getMatchScore(program.id);
            const matchInfo = score !== null ? getMatchLabel(score) : null;
            const bookmarked = matches[program.id]?.is_bookmarked;
            const daysLeft = program.application_end
              ? Math.ceil((new Date(program.application_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div
                key={program.id}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[program.category] || CATEGORY_COLORS['기타']}`}>
                        {program.category}
                      </span>
                      {statusLabel(program.status)}
                      {program.is_featured && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          ⭐ 추천
                        </span>
                      )}
                      {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          D-{daysLeft}
                        </span>
                      )}
                    </div>
                    <Link href={`/programs/${program.id}`} className="group">
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {program.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{program.managing_org}</p>
                    {program.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 line-clamp-2">{program.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-gray-500 dark:text-gray-400">
                      {program.funding_amount_max && (
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          최대 {program.funding_amount_max.toLocaleString()}만원
                        </span>
                      )}
                      {program.status === 'expected' && program.typical_open_month ? (
                        <span className="font-medium text-violet-600 dark:text-violet-400">
                          📅 예상 {new Date().getFullYear()}년 {program.typical_open_month}월 모집
                        </span>
                      ) : program.application_end ? (
                        <span>마감 {format(new Date(program.application_end), 'M월 d일', { locale: ko })}</span>
                      ) : null}
                      {program.status === 'expected' && program.last_active_year && (
                        <span className="text-violet-500 dark:text-violet-500">작년({program.last_active_year}) 기준</span>
                      )}
                      {program.target_regions.length > 0 && program.target_regions[0] !== '전국' && (
                        <span>📍 {program.target_regions.slice(0, 2).join(', ')}{program.target_regions.length > 2 ? ' 외' : ''}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {matchInfo && (
                      <div className="text-center">
                        <div className={`text-lg font-bold ${score! >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score! >= 60 ? 'text-blue-600 dark:text-blue-400' : score! >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                          {score}
                        </div>
                        <div className="text-xs text-gray-400">{matchInfo.label}</div>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleBookmark(program.id)}
                        className={`p-1.5 rounded-lg transition-colors ${bookmarked ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      >
                        {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                      </button>
                      <Link href={`/programs/${program.id}`} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
