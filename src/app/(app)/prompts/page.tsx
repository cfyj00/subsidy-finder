'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, FileText, Search, ClipboardList, MessageSquare, Lightbulb, ChevronDown } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { BusinessProfile, Program } from '@/types/database';
import {
  generateConsultingPrompt,
  generateSingleProgramPrompt,
  generateBusinessPlanPrompt,
  generateEligibilityCheckPrompt,
  generateDocumentChecklistPrompt,
  generateInquiryPrompt,
} from '@/lib/ai/prompt-generator';
import { calculateMatch } from '@/lib/matching-engine';

// ── 템플릿 정의 ────────────────────────────────────────────────────────────────
interface Template {
  id: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  needsProgram: boolean;
  color: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'consulting',
    icon: Lightbulb,
    title: '종합 상담 프롬프트',
    desc: '매칭된 지원사업 전체를 바탕으로 AI에게 전략 상담 요청',
    needsProgram: false,
    color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  },
  {
    id: 'business-plan',
    icon: FileText,
    title: '사업계획서 작성',
    desc: '선택한 지원사업에 맞는 사업계획서 초안 작성 요청',
    needsProgram: true,
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  },
  {
    id: 'eligibility',
    icon: Search,
    title: '자격요건 확인',
    desc: '우리 회사가 해당 사업에 신청 가능한지 분석 요청',
    needsProgram: true,
    color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  },
  {
    id: 'documents',
    icon: ClipboardList,
    title: '서류 체크리스트',
    desc: '신청에 필요한 서류 목록과 준비 방법 정리 요청',
    needsProgram: true,
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  },
  {
    id: 'inquiry',
    icon: MessageSquare,
    title: '담당기관 문의 질문',
    desc: '담당 기관에 전화/이메일 문의할 때 쓸 질문 목록 생성',
    needsProgram: true,
    color: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  },
  {
    id: 'single',
    icon: FileText,
    title: '심층 상담 (단일 사업)',
    desc: '특정 사업 하나에 집중해서 신청 전략 전반 상담 요청',
    needsProgram: true,
    color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  },
];

// ── 복사 버튼 ──────────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? '복사됨!' : '복사하기'}
    </button>
  );
}


// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function PromptsPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: prof }, { data: progs }] = await Promise.all([
        supabase.from('business_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('programs').select('*').in('status', ['open', 'upcoming']).limit(50),
      ]);

      if (prof) setProfile(prof as BusinessProfile);
      if (progs) {
        // 매칭 점수 순으로 정렬
        const sorted = prof
          ? (progs as Program[]).sort((a, b) => calculateMatch(prof as BusinessProfile, b).score - calculateMatch(prof as BusinessProfile, a).score)
          : (progs as Program[]);
        setPrograms(sorted);
        if (sorted.length > 0) setSelectedProgramId(sorted[0].id);
      }
      setLoading(false);
    }
    load();
  }, []);

  const selectedProgram = programs.find(p => p.id === selectedProgramId) ?? null;

  const generate = useCallback(() => {
    if (!profile) return;
    const t = selectedTemplate;

    if (t.id === 'consulting') {
      const top5 = programs.slice(0, 5).map(p => ({
        program: p,
        ...calculateMatch(profile, p),
      }));
      setGeneratedPrompt(generateConsultingPrompt(profile, top5));
      return;
    }

    if (!selectedProgram) return;
    const matchInfo = calculateMatch(profile, selectedProgram);

    const map: Record<string, string> = {
      'business-plan': generateBusinessPlanPrompt(profile, selectedProgram),
      'eligibility':   generateEligibilityCheckPrompt(profile, selectedProgram),
      'documents':     generateDocumentChecklistPrompt(profile, selectedProgram),
      'inquiry':       generateInquiryPrompt(profile, selectedProgram),
      'single':        generateSingleProgramPrompt(profile, selectedProgram, matchInfo),
    };
    setGeneratedPrompt(map[t.id] ?? '');
  }, [profile, selectedTemplate, selectedProgram, programs]);

  // 템플릿/프로그램 변경 시 자동 생성
  useEffect(() => {
    if (profile && (!selectedTemplate.needsProgram || selectedProgram)) {
      generate();
    }
  }, [selectedTemplate, selectedProgram, profile, generate]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">불러오는 중...</div>;
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center p-8">
        <p className="text-slate-500 dark:text-slate-400 mb-4">프롬프트를 생성하려면 먼저 사업 프로필을 등록해 주세요.</p>
        <a href="/profile" className="text-indigo-600 font-medium hover:underline">프로필 등록하기 →</a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI 프롬프트 라이브러리</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          아래 프롬프트를 복사해서 원하는 AI 서비스에 붙여넣으세요.
          <span className="font-medium text-indigo-600 dark:text-indigo-400"> {profile.business_name}</span> 정보가 자동으로 포함됩니다.
        </p>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        {/* 왼쪽: 템플릿 목록 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">템플릿 선택</p>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedTemplate.id === t.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <t.icon size={15} className={selectedTemplate.id === t.id ? 'text-indigo-600' : 'text-slate-400'} />
                <span className={`text-sm font-medium ${selectedTemplate.id === t.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {t.title}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 pl-5">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* 오른쪽: 프롬프트 영역 */}
        <div className="space-y-4">
          {/* 프로그램 선택 (needsProgram인 경우) */}
          {selectedTemplate.needsProgram && (
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">지원사업 선택</label>
              <div className="relative">
                <select
                  value={selectedProgramId}
                  onChange={e => setSelectedProgramId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 pr-8 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {programs.map(p => {
                    const score = calculateMatch(profile, p).score;
                    return (
                      <option key={p.id} value={p.id}>
                        [{score}점] {p.title}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* 생성된 프롬프트 */}
          <div className={`rounded-xl border p-4 ${selectedTemplate.color}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <selectedTemplate.icon size={16} className="text-slate-600 dark:text-slate-300" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedTemplate.title}</span>
              </div>
              {generatedPrompt && <CopyButton text={generatedPrompt} />}
            </div>
            {generatedPrompt ? (
              <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
                {generatedPrompt}
              </pre>
            ) : (
              <p className="text-sm text-slate-400">프롬프트를 생성 중...</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
