'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { useProfile } from '@/lib/profile-context';
import { useBusinessProfile } from '@/lib/business-profile-context';
import { calculateMatch, getMatchLabel } from '@/lib/matching-engine';
import { PROGRAM_CATEGORIES, CATEGORY_COLORS } from '@/lib/constants';
import type { Program, UserProgramMatch } from '@/types/database';
import type { NaverNewsItem } from '@/app/api/naver-news/route';
import {
  Search, Bookmark, BookmarkCheck,
  ExternalLink, ChevronRight, Filter, X, Loader2, Newspaper, Sparkles, MapPin,
  ArrowUpDown, DollarSign, Clock,
} from 'lucide-react';

type SortBy = 'score' | 'amount' | 'deadline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { matchesSearch } from '@/lib/search-keywords';
import { stripHtml } from '@/lib/data/utils';

// ── 지역명 정규화 ─────────────────────────────────────────────────────────────
// 프로그램 DB에는 '충북', '경기' 등 약칭이 올 수 있고
// 사용자 프로필에는 '충청북도', '경기도' 등 전체명이 저장됨 → 양방향 매핑
const SIDO_ALIASES: Record<string, string[]> = {
  '서울특별시':     ['서울'],
  '부산광역시':     ['부산'],
  '대구광역시':     ['대구'],
  '인천광역시':     ['인천'],
  '광주광역시':     ['광주'],
  '대전광역시':     ['대전'],
  '울산광역시':     ['울산'],
  '세종특별자치시':  ['세종'],
  '경기도':        ['경기'],
  '강원특별자치도':  ['강원', '강원도'],
  '충청북도':       ['충북'],
  '충청남도':       ['충남'],
  '전북특별자치도':  ['전북', '전라북도'],
  '전라남도':       ['전남'],
  '경상북도':       ['경북'],
  '경상남도':       ['경남'],
  '제주특별자치도':  ['제주', '제주도'],
};
// source → 소속 시도 full name (target_regions 미입력 시 fallback)
const SOURCE_SIDO: Record<string, string> = {
  seoul: '서울특별시', gyeonggi: '경기도', busan: '부산광역시',
  incheon: '인천광역시', daegu: '대구광역시', daejeon: '대전광역시',
  gwangju: '광주광역시', ulsan: '울산광역시',
};
/** 프로그램 지역 문자열 r 이 사용자의 sido(전체명)에 해당하는지 판단 */
function sidoMatches(r: string, sido: string): boolean {
  if (r.includes(sido) || sido.includes(r)) return true;
  const aliases = SIDO_ALIASES[sido] ?? [];
  return aliases.some(a => r.includes(a) || a.includes(r));
}

// 제목 "[경남]", "[대구ㆍ경북]" 패턴에서 지역 목록 추출 (bizinfo DB 기존 데이터 대응)
const TITLE_REGION_MAP: Record<string, string> = {
  '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시',
  '인천': '인천광역시', '광주': '광주광역시', '대전': '대전광역시',
  '울산': '울산광역시', '세종': '세종특별자치시', '경기': '경기도',
  '강원': '강원특별자치도', '충북': '충청북도', '충남': '충청남도',
  '전북': '전북특별자치도', '전남': '전라남도',
  '경북': '경상북도', '경남': '경상남도', '제주': '제주특별자치도',
};
function getEffectiveRegions(p: Program): string[] {
  if (p.target_regions.length > 0) return p.target_regions;
  // target_regions 없으면 제목 [지역] 태그 파싱
  const match = p.title.match(/^\[([^\]]+)\]/);
  if (!match) return [];
  const result: string[] = [];
  match[1].split(/[·ㆍ,\/]/).forEach(part => {
    const key = part.trim().slice(0, 2);
    const full = TITLE_REGION_MAP[key] ?? TITLE_REGION_MAP[part.trim()];
    if (full && !result.includes(full)) result.push(full);
  });
  return result;
}

export default function ProgramsPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const { activeProfile: businessProfile } = useBusinessProfile();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [matches, setMatches] = useState<Record<string, UserProgramMatch>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [filterMyBusiness, setFilterMyBusiness] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [localFirst, setLocalFirst] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  // 뉴스
  const [news, setNews] = useState<NaverNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const newsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase.from('programs').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    if (filterCategory) query = query.eq('category', filterCategory);
    if (filterStatus)   query = query.eq('status', filterStatus);
    const { data: progs } = await query;
    setPrograms((progs || []) as Program[]);

    const { data: matchData } = await supabase.from('user_program_matches').select('*').eq('user_id', user.id);
    const matchMap: Record<string, UserProgramMatch> = {};
    (matchData || []).forEach((m: UserProgramMatch) => { matchMap[m.program_id] = m; });
    setMatches(matchMap);
    setLoading(false);
  }, [filterCategory, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 뉴스 검색 (디바운스 600ms) ──────────────────────────────────────────────
  useEffect(() => {
    if (newsTimerRef.current) clearTimeout(newsTimerRef.current);
    if (!searchQuery.trim()) { setNews([]); return; }

    newsTimerRef.current = setTimeout(async () => {
      setNewsLoading(true);
      try {
        const res = await fetch(`/api/naver-news?q=${encodeURIComponent(searchQuery)}&display=5`);
        const data = await res.json();
        setNews(data.items ?? []);
      } catch { setNews([]); }
      finally { setNewsLoading(false); }
    }, 600);

    return () => { if (newsTimerRef.current) clearTimeout(newsTimerRef.current); };
  }, [searchQuery]);

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
        user_id: user.id, program_id: programId,
        match_score: matchResult.score, match_reasons: matchResult.reasons,
        mismatch_reasons: matchResult.mismatches, is_bookmarked: true,
      }).select().single();
      if (newMatch) setMatches(prev => ({ ...prev, [programId]: newMatch as UserProgramMatch }));
    }
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    const res  = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    setSeedMsg(data.message);
    setSeedLoading(false);
    setTimeout(() => { setSeedMsg(''); loadData(); }, 2000);
  };

  // ── 스크롤 위치 복원 (뒤로가기) ────────────────────────────────────────────
  useEffect(() => {
    const flag = sessionStorage.getItem('programs-from-detail');
    if (!flag) return;
    sessionStorage.removeItem('programs-from-detail');
    const pos = parseInt(sessionStorage.getItem('programs-scroll') || '0');
    if (!pos) return;
    const id = setInterval(() => {
      if (document.documentElement.scrollHeight > pos + window.innerHeight * 0.5) {
        clearInterval(id);
        window.scrollTo(0, pos);
      }
    }, 50);
    setTimeout(() => clearInterval(id), 3000);
  }, []);

  const saveScroll = (programId: string) => {
    sessionStorage.setItem('programs-scroll', String(window.scrollY));
    sessionStorage.setItem('programs-from-detail', '1');
    router.push(`/programs/${programId}`);
  };

  // 항상 최신 매칭 엔진으로 live 계산 (저장된 구 점수 무시)
  const liveScores = useMemo(() => {
    if (!businessProfile) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const p of programs) {
      map[p.id] = calculateMatch(businessProfile, p).score;
    }
    return map;
  }, [businessProfile, programs]);

  const getMatchScore = (programId: string): number | null => {
    if (!businessProfile) return null;
    return liveScores[programId] ?? null;
  };

  const bookmarkCount = Object.values(matches).filter(m => m.is_bookmarked).length;

  // ── 필터 + 정렬 ────────────────────────────────────────────────────────────
  let filteredPrograms = programs.filter(p => {
    if (searchQuery && !matchesSearch(p, searchQuery)) return false;
    if (filterRegion !== 'all') {
      if (p.target_regions.length > 0 && !p.target_regions.includes('전국') && !p.target_regions.some(r => r.includes(filterRegion))) return false;
    }
    if (filterBookmarked && !matches[p.id]?.is_bookmarked) return false;

    // 내사업검색: 마감 제외 + 내 지역 필터 + 매칭 점수 40점 이상
    if (filterMyBusiness && businessProfile) {
      if (p.status === 'closed') return false;

      // 지역 하드 필터: 전국이거나 내 지역 포함 사업만 표시
      const regions = getEffectiveRegions(p); // 제목 [지역] 파싱 포함
      const sido    = businessProfile.region_sido;
      const sigungu = businessProfile.region_sigungu;

      if (regions.length > 0) {
        const isNationwide = regions.some(r =>
          r.includes('전국') || r.includes('전 지역') || r === '전체'
        );
        if (!isNationwide) {
          const inRegion = regions.some(r =>
            (sido    && sidoMatches(r, sido))  ||
            (sigungu && r.includes(sigungu))
          );
          if (!inRegion) return false;
        }
      } else {
        // 제목 파싱도 실패: source가 다른 지역 클라이언트면 제외
        const sourceSido = SOURCE_SIDO[p.source];
        if (sourceSido && !sidoMatches(sourceSido, sido)) return false;
      }

      const score = getMatchScore(p.id) ?? 0;
      if (score < 40) return false;
    }
    return true;
  });

  // ── 정렬 ────────────────────────────────────────────────────────────────────
  // 지역 우선순위: 2=내 지역 명시/소스, 1=전국/미지정(전국소스), 0=다른 지역
  const getRegionPriority = (p: Program): number => {
    if (!businessProfile) return 1;
    const sido    = businessProfile.region_sido;
    const sigungu = businessProfile.region_sigungu;
    const regions = getEffectiveRegions(p); // 제목 [지역] 파싱 포함

    if (regions.length > 0) {
      if (regions.some(r => r.includes('전국') || r.includes('전 지역') || r === '전체')) return 1;
      if (regions.some(r =>
        (sido    && sidoMatches(r, sido))  ||
        (sigungu && r.includes(sigungu))
      )) return 2;
      return 0; // 다른 지역 명시
    }

    // 제목 파싱도 실패 → source로 지역 추론
    const sourceSido = SOURCE_SIDO[p.source];
    if (sourceSido) return sidoMatches(sourceSido, sido) ? 2 : 0;
    return 1; // 전국 소스
  };

  filteredPrograms = [...filteredPrograms].sort((a, b) => {
    // 내 지역 우선 (3단계: 내지역 > 전국/미지정 > 다른지역)
    if (localFirst && businessProfile) {
      const aPri = getRegionPriority(a);
      const bPri = getRegionPriority(b);
      if (bPri !== aPri) return bPri - aPri;
    }
    // 정렬 기준
    if (sortBy === 'amount') {
      const aAmt = a.funding_amount_max ?? a.funding_amount_min ?? 0;
      const bAmt = b.funding_amount_max ?? b.funding_amount_min ?? 0;
      if (bAmt !== aAmt) return bAmt - aAmt;
    }
    if (sortBy === 'deadline') {
      const aEnd = a.application_end ? new Date(a.application_end).getTime() : Infinity;
      const bEnd = b.application_end ? new Date(b.application_end).getTime() : Infinity;
      if (aEnd !== bEnd) return aEnd - bEnd;
    }
    // 점수순 (기본 + 타이브레이커)
    return (getMatchScore(b.id) ?? 0) - (getMatchScore(a.id) ?? 0);
  });

  const KOREAN_SURNAMES = '김이박최정강조윤장임한오서신권황안송유홍전고문양손배백노하허심도우남엄채원천방공현함변염석선설마길진봉온형민계';
  const isPersonName = (name: string | null | undefined): boolean => {
    if (!name) return false;
    const t = name.trim();
    return /^[가-힣]{2,4}$/.test(t) && KOREAN_SURNAMES.includes(t[0]);
  };

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
            <button onClick={handleSeed} disabled={seedLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              {seedLoading && <Loader2 size={14} className="animate-spin" />}
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

      {/* ── 내사업검색 활성 배너 ──────────────────────────────────────────── */}
      {filterMyBusiness && businessProfile && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300 flex-1">
            <span className="font-semibold">{businessProfile.business_name}</span> 에 맞는 사업만 표시 중 · 매칭 점수 높은 순
          </p>
          <button onClick={() => setFilterMyBusiness(false)} className="text-emerald-500 hover:text-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}
      {filterMyBusiness && !businessProfile && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
          ⚠️ 내사업검색을 사용하려면 먼저 <Link href="/profile" className="font-semibold underline">사업 프로필</Link>을 등록하세요.
        </div>
      )}

      {/* Search + Filter bar — 2줄 (모바일 최적화) */}
      <div className="flex flex-col gap-2 mb-4">
        {/* 1줄: 검색창 */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="창업, 수출, R&D, 스마트팩토리, 인력 등..."
            className="w-full pl-9 pr-8 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* 2줄: 버튼들 */}
        <div className="flex gap-2">
          {/* 내사업검색 버튼 */}
          <button
            onClick={() => setFilterMyBusiness(!filterMyBusiness)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              filterMyBusiness
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Sparkles size={14} />
            내사업검색
          </button>

          {/* 북마크 버튼 */}
          <button
            onClick={() => setFilterBookmarked(!filterBookmarked)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              filterBookmarked
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <BookmarkCheck size={14} />
            {filterBookmarked ? `북마크 ${bookmarkCount}` : '북마크'}
          </button>

          {/* 필터 버튼 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Filter size={14} /> 필터
          </button>
        </div>
      </div>

      {/* 정렬 바 */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-0.5">정렬</span>
        {([
          { key: 'score',    label: '점수순',   icon: <ArrowUpDown size={11} /> },
          { key: 'amount',   label: '지원금액순', icon: <DollarSign size={11} /> },
          { key: 'deadline', label: '마감임박순', icon: <Clock size={11} /> },
        ] as { key: SortBy; label: string; icon: React.ReactElement }[]).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setSortBy(key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              sortBy === key
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-300 dark:border-slate-600 text-gray-500 dark:text-gray-400 hover:border-indigo-400'
            }`}>
            {icon}{label}
          </button>
        ))}
        {businessProfile && (
          <button onClick={() => setLocalFirst(!localFirst)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ml-auto ${
              localFirst
                ? 'bg-sky-600 border-sky-600 text-white'
                : 'border-gray-300 dark:border-slate-600 text-gray-500 dark:text-gray-400 hover:border-sky-400'
            }`}>
            <MapPin size={11} />내 지역 우선
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">카테고리</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">전체</option>
                {PROGRAM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">모집 상태</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">전체</option>
                <option value="open">모집중</option>
                <option value="upcoming">예정</option>
                <option value="expected">출시예상 (작년기준)</option>
                <option value="always">상시</option>
                <option value="closed">마감</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">지역</label>
              <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all">전국</option>
                <option value="서울">서울</option>
                <option value="경기">경기</option>
                <option value="인천">인천</option>
                <option value="부산">부산</option>
                <option value="대구">대구</option>
                <option value="광주">광주</option>
                <option value="대전">대전</option>
                <option value="울산">울산</option>
                <option value="세종">세종</option>
                <option value="강원">강원</option>
                <option value="충북">충북</option>
                <option value="충남">충남</option>
                <option value="전북">전북</option>
                <option value="전남">전남</option>
                <option value="경북">경북</option>
                <option value="경남">경남</option>
                <option value="제주">제주</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterRegion('all'); setSearchQuery(''); setFilterBookmarked(false); setFilterMyBusiness(false); setSortBy('score'); setLocalFirst(false); }}
                className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                전체 초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category quick filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setFilterCategory('')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${!filterCategory ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'}`}>
          전체
        </button>
        {PROGRAM_CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setFilterCategory(filterCategory === c.value ? '' : c.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${filterCategory === c.value ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* ── 뉴스 섹션 ─────────────────────────────────────────────────────── */}
      {(newsLoading || news.length > 0) && searchQuery && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper size={15} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">관련 뉴스</span>
            {newsLoading && <Loader2 size={13} className="animate-spin text-gray-400" />}
          </div>
          {newsLoading && news.length === 0 ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {news.map((item, idx) => {
                let pubLabel = '';
                try { pubLabel = format(new Date(item.pubDate), 'M월 d일', { locale: ko }); } catch { /* ignore */ }
                return (
                  <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 line-clamp-1 transition-colors">{item.title}</p>
                      {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-gray-400">
                      {pubLabel && <span>{pubLabel}</span>}
                      <ExternalLink size={12} className="text-blue-400" />
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Program list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">{filterMyBusiness ? '🎯' : '🔍'}</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {filterMyBusiness ? '매칭되는 사업이 없습니다' : '검색 결과가 없습니다'}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {programs.length === 0
              ? '"데이터 로드" 버튼을 눌러 지원사업을 불러오세요.'
              : filterMyBusiness
              ? '사업 프로필을 보완하거나 필터를 조정해 보세요.'
              : '다른 키워드를 시도해 보세요. 예: 창업, 수출, R&D, 스마트팩토리, 인력지원'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPrograms.map(program => {
            const score     = getMatchScore(program.id);
            const matchInfo = score !== null ? getMatchLabel(score) : null;
            const bookmarked = matches[program.id]?.is_bookmarked;
            const daysLeft  = program.application_end
              ? Math.ceil((new Date(program.application_end).getTime() - Date.now()) / 86_400_000)
              : null;

            return (
              <div key={program.id}
                onClick={() => saveScroll(program.id)}
                className={`relative bg-white dark:bg-slate-800 border rounded-xl p-4 transition-colors cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 active:bg-gray-50 dark:active:bg-slate-700/50 ${
                  filterMyBusiness && score !== null && score >= 80
                    ? 'border-emerald-300 dark:border-emerald-700'
                    : 'border-gray-200 dark:border-slate-700'
                }`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[program.category] || CATEGORY_COLORS['기타']}`}>
                        {program.category}
                      </span>
                      {statusLabel(program.status)}
                      {program.is_featured && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">⭐ 추천</span>
                      )}
                      {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">D-{daysLeft}</span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                      {program.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {isPersonName(program.managing_org)
                        ? `${program.implementing_org ? program.implementing_org + ' · ' : ''}작성자: ${program.managing_org}`
                        : program.managing_org}
                    </p>
                    {program.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 line-clamp-2">{stripHtml(program.description)}</p>
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
                        <span className="text-violet-500">작년({program.last_active_year}) 기준</span>
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
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleBookmark(program.id); }}
                      className={`p-1.5 rounded-lg transition-colors ${bookmarked ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                      {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                    </button>
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
