'use client';

import { useState, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronUp, ExternalLink,
  Clock, DollarSign, AlertTriangle, Lightbulb,
  ListChecks, CheckCircle2, Building2, FileText, Star,
} from 'lucide-react';
import {
  DOCUMENT_GUIDES,
  DOCUMENT_CATEGORIES,
  CATEGORY_META,
  METHOD_META,
  type DocumentCategory,
  type DocumentGuide,
} from '@/lib/data/documents';
import { useBusinessProfile } from '@/lib/business-profile-context';

// ─── 개별 카드 ────────────────────────────────────────────────────────────────
function DocCard({ doc }: { doc: DocumentGuide }) {
  const [open, setOpen] = useState(false);
  const catMeta = CATEGORY_META[doc.category];
  const methodMeta = METHOD_META[doc.issuingMethod];

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden transition-shadow hover:shadow-md">
      {/* 헤더 (항상 보임) */}
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4"
        onClick={() => setOpen(o => !o)}
      >
        {/* 카테고리 이모지 아이콘 */}
        <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg ${catMeta.bg}`}>
          {catMeta.emoji}
        </div>

        <div className="flex-1 min-w-0">
          {/* 서류명 + 배지 */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
              {doc.name}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catMeta.bg} ${catMeta.color}`}>
              {catMeta.label}
            </span>
            {doc.applicableTo && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                {doc.applicableTo}
              </span>
            )}
          </div>

          {/* 한 줄 설명 */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 leading-snug">
            {doc.description}
          </p>

          {/* 메타 칩 */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Building2 size={12} />
              {doc.issuingOrg}
            </span>
            <span className={`flex items-center gap-1 font-medium ${methodMeta.color}`}>
              {doc.issuingMethod === '온라인' || doc.issuingMethod === '온라인+방문' ? '🌐' : doc.issuingMethod === '방문' ? '🚶' : '✏️'}
              {methodMeta.label}
            </span>
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <DollarSign size={12} />
              {doc.cost}
            </span>
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Clock size={12} />
              {doc.processingTime}
            </span>
          </div>
        </div>

        {/* 토글 화살표 */}
        <div className="shrink-0 mt-1 text-gray-400 dark:text-gray-500">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* 확장 내용 */}
      {open && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-5 py-4 space-y-4">
          {/* 유효기간 */}
          <div className="flex items-start gap-2 text-sm">
            <Clock size={15} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">유효기간 </span>
              <span className="text-gray-600 dark:text-gray-400">{doc.validity}</span>
            </div>
          </div>

          {/* 어디에 쓰이나 */}
          <div className="flex items-start gap-2 text-sm">
            <FileText size={15} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">활용 용도 </span>
              <span className="text-gray-600 dark:text-gray-400">{doc.purpose}</span>
            </div>
          </div>

          {/* 발급 절차 */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <ListChecks size={15} className="text-indigo-500" />
              발급 절차
            </div>
            <ol className="space-y-1.5 ml-1">
              {doc.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* 꿀팁 */}
          {doc.tips.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                <Lightbulb size={14} />
                준비 팁
              </div>
              <ul className="space-y-1">
                {doc.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-indigo-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 주의사항 */}
          {doc.cautions.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                <AlertTriangle size={14} />
                주의사항
              </div>
              <ul className="space-y-1">
                {doc.cautions.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 온라인 발급 링크 */}
          {doc.onlineUrl && (
            <a
              href={doc.onlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ExternalLink size={14} />
              온라인 발급 바로가기 →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const { activeProfile: profile } = useBusinessProfile();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | '전체'>('전체');

  // 프로필 기반 추천 서류 ID 목록
  const recommendedDocIds = useMemo(() => {
    const ids: string[] = ['business-reg', 'tax-cert', 'national-insurance'];  // 기본 필수
    if (!profile) return ids;
    const isCorp = profile.business_entity_type === '법인';
    const isManufacturing = profile.business_type?.includes('제조') ||
      profile.business_category?.includes('제조') ||
      profile.industry_code?.startsWith('C');
    const hasExport = profile.has_export;
    const isVenture = profile.is_venture;
    const isInnobiz = profile.is_innobiz;

    if (isCorp) ids.push('corp-reg', 'financial-stmt');
    if (!isCorp) ids.push('financial-stmt');
    if (isManufacturing) ids.push('facility-reg');
    if (hasExport) ids.push('export-cert');
    if (isVenture) ids.push('venture-cert');
    if (isInnobiz) ids.push('innobiz-cert');
    ids.push('business-plan');  // 항상 추천
    return [...new Set(ids)];
  }, [profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DOCUMENT_GUIDES.filter(doc => {
      const catMatch = activeCategory === '전체' || doc.category === activeCategory;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        doc.issuingOrg.toLowerCase().includes(q) ||
        doc.purpose.toLowerCase().includes(q) ||
        doc.tips.some(t => t.toLowerCase().includes(q)) ||
        (doc.applicableTo?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [search, activeCategory]);

  // 카테고리별 카운트
  const counts = useMemo(() => {
    const result: Record<string, number> = { 전체: DOCUMENT_GUIDES.length };
    for (const cat of DOCUMENT_CATEGORIES) {
      result[cat] = DOCUMENT_GUIDES.filter(d => d.category === cat).length;
    }
    return result;
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">서류 가이드</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          지원사업 신청에 필요한 서류를 미리 준비해두면 훨씬 수월해요 📂
        </p>
      </div>

      {/* 안내 배너 */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4">
        <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-1">
          💡 지실장 TIP
        </p>
        <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
          <strong>기본서류 5종</strong> (사업자등록증명·납세증명 2종·4대보험·재무제표)을 미리 발급해두면
          어떤 지원사업도 빠르게 신청할 수 있어요. 특히 <strong>납세증명서는 유효기간 30일</strong>이라
          신청 직전에 발급하는 것이 좋아요!
        </p>
      </div>

      {/* 프로필 기반 추천 서류 */}
      {profile && recommendedDocIds.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-amber-400 fill-amber-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {profile.business_name}에 필요한 서류
            </p>
            <span className="ml-auto text-xs text-indigo-500 dark:text-indigo-400 font-medium">
              {profile.business_entity_type ?? ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendedDocIds
              .map(id => DOCUMENT_GUIDES.find(d => d.id === id))
              .filter((d): d is DocumentGuide => !!d)
              .map(doc => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setActiveCategory('전체');
                    setSearch(doc.name);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-full text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <span>{CATEGORY_META[doc.category].emoji}</span>
                  {doc.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 검색 + 필터 */}
      <div className="space-y-3">
        {/* 검색창 */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="서류명, 발급기관, 용도로 검색..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2">
          {(['전체', ...DOCUMENT_CATEGORIES] as const).map(cat => {
            const isActive = activeCategory === cat;
            const meta = cat !== '전체' ? CATEGORY_META[cat] : null;
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setSearch('');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                {meta && <span>{meta.emoji}</span>}
                {cat}
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                }`}>
                  {counts[cat]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 결과 수 */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        총 <span className="font-semibold text-gray-600 dark:text-gray-300">{filtered.length}개</span> 서류
        {search && ` — "${search}" 검색 결과`}
      </p>

      {/* 카드 목록 */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(doc => (
            <DocCard key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">검색 결과가 없어요</p>
          <p className="text-sm mt-1 mb-5">다른 키워드로 검색하거나, AI 지실장에게 직접 물어보세요</p>
          <a
            href={`/consultant?q=${encodeURIComponent(search ? `${search} 서류 발급 방법 알려줘` : '필요한 서류 알려줘')}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            🤖 AI 지실장에게 물어보기
          </a>
        </div>
      )}

      {/* 서류 관련 질문 배너 */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-lg shrink-0">
          🤔
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm mb-0.5">
            찾는 서류가 없거나, 발급이 막막하세요?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            AI 지실장이 어떤 서류 질문이든 친절하게 답해드려요.<br />
            &ldquo;○○ 서류 어디서 발급해?&rdquo;, &ldquo;이 사업에 어떤 서류가 필요해?&rdquo; 등 자유롭게 물어보세요.
          </p>
          <a
            href="/consultant"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            💬 AI 지실장에게 서류 질문하기
          </a>
        </div>
      </div>

      {/* 사업계획서 특별 섹션 */}
      <div className="mt-8 rounded-2xl border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-lg">📝</div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">사업계획서, 어떻게 써야 할까요?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">심사위원을 설득하는 사업계획서의 핵심 구조</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { step: '01', title: '현황 분석', desc: '우리 사업의 강점과 현재 문제점을 솔직하게 기술', emoji: '🔍' },
            { step: '02', title: '목표 설정', desc: '지원금으로 달성할 구체적·수치화된 목표 제시', emoji: '🎯' },
            { step: '03', title: '추진 계획', desc: '월별 세부 일정, 예산 배분, 담당자 역할 명시', emoji: '📅' },
            { step: '04', title: '기대 효과', desc: '매출·고용·기술 개선 등 정량적 기대치 제시', emoji: '📈' },
          ].map(({ step, title, desc, emoji }) => (
            <div key={step} className="bg-white dark:bg-slate-800 rounded-xl p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm shrink-0">
                {emoji}
              </div>
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-0.5">STEP {step}</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">✅ 합격 사업계획서의 특징</p>
          <ul className="space-y-1.5">
            {[
              '막연한 표현 대신 수치와 근거 자료 활용 (예: "성장 기대" ❌ → "연 매출 30% 증가 목표, 근거: 시장분석 데이터" ✅)',
              '공고문의 평가 기준 키워드를 계획서에 자연스럽게 반영',
              '기업 규모에 비해 과도한 목표보다는 현실적·달성 가능한 계획 제시',
              '분량 제한 엄수 + 가독성 높은 표·도표 활용',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <a
          href="/consultant"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          🤖 AI 지실장에게 사업계획서 작성 도움 받기
        </a>
      </div>
    </div>
  );
}
