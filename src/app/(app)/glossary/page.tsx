'use client';

import { useState, useMemo } from 'react';
import { Search, BookOpen, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import {
  GLOSSARY_TERMS,
  DISPLAY_CONSONANTS,
  getInitialConsonant,
  normalizeConsonant,
  type GlossaryTerm,
} from '@/lib/data/glossary';

// 카테고리별 색상
const CATEGORY_COLORS: Record<string, string> = {
  '자격요건':    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  '자금지원':    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  '비자금 지원': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  '행정':        'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
  '신청·접수':   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  '평가·심사':   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  '기업 인증':   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  '기업 분류':   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  '창업·스타트업':'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  '연구개발':    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  '재무·회계':   'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  '기관·조직':   'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  '지원유형':    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  '사업계획':    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  '기술·혁신':   'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
}

// ─── 용어 카드 컴포넌트 ────────────────────────────────────────────────
function TermCard({ term }: { term: GlossaryTerm }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-shadow hover:shadow-md">
      <button
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            {term.term.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white text-base">
              {term.term}
            </p>
            {!expanded && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {term.definition}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(term.category)}`}>
            <Tag size={10} />
            {term.category}
          </span>
          {expanded
            ? <ChevronUp size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-3">
          {/* 모바일용 카테고리 태그 */}
          <span className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(term.category)}`}>
            <Tag size={10} />
            {term.category}
          </span>

          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">📖 정의</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {term.definition}
            </p>
          </div>

          {term.example && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
              <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400 mb-1">💡 예시</p>
              <p className="text-sm text-indigo-600 dark:text-indigo-300 leading-relaxed">
                {term.example}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────
export default function GlossaryPage() {
  const [query, setQuery] = useState('');
  const [activeConsonant, setActiveConsonant] = useState<string | null>(null);

  // 실제 데이터에서 사용되는 자음만 추출
  const availableConsonants = useMemo(() => {
    const set = new Set(
      GLOSSARY_TERMS.map((t) => normalizeConsonant(getInitialConsonant(t.term))),
    );
    return DISPLAY_CONSONANTS.filter((c) => set.has(c));
  }, []);

  // 필터링
  const filtered = useMemo(() => {
    let list = GLOSSARY_TERMS;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.example?.toLowerCase().includes(q) ?? false),
      );
    }

    if (activeConsonant) {
      list = list.filter(
        (t) => normalizeConsonant(getInitialConsonant(t.term)) === activeConsonant,
      );
    }

    return list.sort((a, b) => a.term.localeCompare(b.term, 'ko'));
  }, [query, activeConsonant]);

  // 자음별 그룹화 (검색어 없을 때만)
  const grouped = useMemo(() => {
    if (query.trim()) return null; // 검색 중에는 그룹 없이 평면 목록
    const map = new Map<string, GlossaryTerm[]>();
    for (const term of filtered) {
      const c = normalizeConsonant(getInitialConsonant(term.term));
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(term);
    }
    return map;
  }, [filtered, query]);

  const handleConsonantClick = (c: string) => {
    setActiveConsonant((prev) => (prev === c ? null : c));
    setQuery('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <BookOpen className="text-indigo-600 dark:text-indigo-400" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">용어사전</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            정부지원사업에서 자주 쓰이는 {GLOSSARY_TERMS.length}개 용어 설명
          </p>
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="용어, 설명, 카테고리로 검색..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setActiveConsonant(null);
          }}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5"
          >
            초기화
          </button>
        )}
      </div>

      {/* 자음 필터 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">자음별 검색</p>
        <div className="flex flex-wrap gap-2">
          {availableConsonants.map((c) => (
            <button
              key={c}
              onClick={() => handleConsonantClick(c)}
              className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                activeConsonant === c
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300'
              }`}
            >
              {c}
            </button>
          ))}
          {activeConsonant && (
            <button
              onClick={() => setActiveConsonant(null)}
              className="px-3 h-10 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              필터 해제
            </button>
          )}
        </div>
      </div>

      {/* 결과 수 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {query || activeConsonant ? (
            <>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">{filtered.length}개</span>
              {' '}검색됨
              {activeConsonant && <span className="ml-1 font-medium">· [{activeConsonant}]</span>}
            </>
          ) : (
            <>전체 <span className="font-medium text-slate-700 dark:text-slate-200">{GLOSSARY_TERMS.length}개</span> 용어</>
          )}
        </p>
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400">검색 결과가 없습니다.</p>
        )}
      </div>

      {/* 용어 목록 */}
      {query.trim() ? (
        // 검색 결과: 평면 목록
        <div className="space-y-2">
          {filtered.map((t) => (
            <TermCard key={t.term} term={t} />
          ))}
        </div>
      ) : grouped && grouped.size > 0 ? (
        // 자음별 그룹 목록
        <div className="space-y-8">
          {DISPLAY_CONSONANTS.filter((c) => grouped.has(c)).map((c) => (
            <section key={c} id={`section-${c}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-700 flex items-center justify-center text-white font-bold text-base shadow-sm">
                  {c}
                </div>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400">{grouped.get(c)!.length}개</span>
              </div>
              <div className="space-y-2">
                {grouped.get(c)!.map((t) => (
                  <TermCard key={t.term} term={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">검색 결과가 없습니다</p>
          <p className="text-sm mt-1">다른 키워드로 검색해 보세요.</p>
        </div>
      ) : null}

      {/* 하단 안내 */}
      <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/40">
        <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
          💡 <strong>도움말</strong>: 궁금한 용어가 없으신가요? AI 상담에서 직접 물어보세요.
          사업 상황에 맞는 맞춤 설명을 받을 수 있습니다.
        </p>
      </div>
    </div>
  );
}
