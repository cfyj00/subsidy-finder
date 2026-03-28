'use client';
// v2 — prompt-first redesign
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { calculateMatch } from '@/lib/matching-engine';
import { useBusinessProfile } from '@/lib/business-profile-context';
import { useProfile } from '@/lib/profile-context';
import {
  generateConsultingPrompt,
  generateSingleProgramPrompt,
} from '@/lib/ai/prompt-generator';
import type { BusinessProfile, Program } from '@/types/database';
import {
  Sparkles, ChevronRight, Loader2, AlertCircle, Send, Square,
  RefreshCw, Bot, User, Clock, ArrowLeft, History, X,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
type ChatMode = 'general' | 'bizplan' | 'document';

interface MatchInfo {
  program: Program;
  score: number;
  reasons: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  savedAt: number;
}

const STORAGE_KEY = 'jisiljang_chat_history';

function loadHistory(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToHistory(msgs: ChatMessage[]) {
  if (msgs.length < 2) return;
  const firstUser = msgs.find(m => m.role === 'user');
  const title = firstUser?.content.slice(0, 40) ?? '대화';
  const newEntry: SavedConversation = {
    id: `conv_${Date.now()}`,
    title,
    messages: msgs,
    savedAt: Date.now(),
  };
  const prev = loadHistory().slice(0, 9);  // 최대 10개 유지
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...prev]));
}

function deleteFromHistory(id: string) {
  const prev = loadHistory().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
}

// ─── Markdown-lite renderer ─────────────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1 leading-relaxed text-sm">
      {lines.map((line, i) => {
        if (line.startsWith('### '))
          return <p key={i} className="font-bold text-gray-900 dark:text-white mt-3 mb-1">{line.slice(4)}</p>;
        if (line.startsWith('## '))
          return <p key={i} className="font-bold text-gray-900 dark:text-white text-base mt-4 mb-1">{line.slice(3)}</p>;
        if (line.startsWith('# '))
          return <p key={i} className="font-bold text-gray-900 dark:text-white text-lg mt-4 mb-1">{line.slice(2)}</p>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <p key={i} className="pl-3">• {line.slice(2)}</p>;
        if (/^\d+\.\s/.test(line))
          return <p key={i} className="pl-3">{line}</p>;
        if (line === '---')
          return <hr key={i} className="border-gray-200 dark:border-slate-600 my-2" />;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.*?)\*\*/g);
        if (parts.length > 1) {
          return (
            <p key={i}>
              {parts.map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
              )}
            </p>
          );
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─── 모드별 빠른 질문 ───────────────────────────────────────────────
const QUICK_QUESTIONS: Record<ChatMode, string[]> = {
  general: [
    '내 사업에 맞는 지원사업을 분석해주세요',
    '자격 요건을 충족하는지 확인해주세요',
    '신청 전략과 합격 포인트를 알려주세요',
    '필요한 서류 체크리스트를 만들어주세요',
  ],
  bizplan: [
    '사업계획서 전체 목차와 구조를 제안해주세요',
    '우리 사업의 강점과 차별점을 정리해주세요',
    '시장 현황과 문제점을 어떻게 서술할까요?',
    '기대효과를 수치화하는 방법을 알려주세요',
  ],
  document: [
    '이 사업에 필요한 서류 목록을 알려주세요',
    '국세납세증명서 발급 방법을 알려주세요',
    '4대보험 가입자 명부는 어디서 발급하나요?',
    '소상공인 확인서 발급 방법이 궁금해요',
  ],
};

// ─── Premium Gate (AI 채팅 전용) ─────────────────────────────────────
function PremiumGate() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-4">
        <Sparkles size={26} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">AI 상담은 유료 기능이에요</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
        지원사업 검색·매칭·서류 가이드는 모두 무료예요.<br />
        AI와 직접 대화하려면 월 <strong className="text-indigo-600">₩4,900</strong>으로 업그레이드하세요.
      </p>
      <Link href="/upgrade"
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
        <Sparkles size={14} /> 월 ₩4,900으로 시작하기
      </Link>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">언제든 해지 가능 · 카드 등록 필요</p>
    </div>
  );
}

// ─── Chat component ──────────────────────────────────────────────────
function ChatSection({
  systemContext,
  initialQuestion,
  mode,
}: {
  systemContext: string;
  initialQuestion?: string;
  mode: ChatMode;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [chatError, setChatError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedConversation[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const didAutoSend = useRef(false);

  // 히스토리 로드
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // 대화 완료 시 자동 저장
  useEffect(() => {
    if (!isStreaming && messages.length >= 2) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.content) {
        saveToHistory(messages);
        setHistory(loadHistory());
      }
    }
  }, [isStreaming, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setRateLimitMsg('');
      setChatError('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const assistantId = `a_${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            systemContext,
            mode,
          }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setRateLimitMsg('⏱️ 잠시 여유가 필요해요. 1분 후 다시 질문해 주세요.');
          return;
        }
        if (!response.ok || !response.body) {
          let errMsg = `서버 오류 (${response.status})`;
          try { const j = await response.json(); errMsg = j.error ?? errMsg; } catch { /* noop */ }
          throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m),
          );
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setChatError((err as Error)?.message ?? '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [isStreaming, messages, systemContext, mode],
  );

  // initialQuestion이 있으면 자동 전송 (서류 CTA, 특정 사업 모드)
  useEffect(() => {
    if (initialQuestion && !didAutoSend.current && messages.length === 0) {
      didAutoSend.current = true;
      // input pre-fill 먼저
      setInput(initialQuestion);
      const t = setTimeout(() => sendMessage(initialQuestion), 400);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const quickQuestions = QUICK_QUESTIONS[mode];

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col">
      {/* 채팅 헤더 */}
      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Bot size={14} className="text-white" />
          </div>
          <span className="font-semibold text-white text-sm">지실장 AI</span>
          <span className="text-white/50 text-xs">· 상담사</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className={`flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded-lg ${showHistory ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
            >
              <History size={12} /> 이전 대화
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setInput('');
                setRateLimitMsg('');
                setChatError('');
                setShowHistory(false);
                didAutoSend.current = false;
              }}
              className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
            >
              <RefreshCw size={11} /> 새 대화
            </button>
          )}
        </div>
      </div>

      {/* 이전 대화 목록 패널 */}
      {showHistory && (
        <div className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 px-4 py-3 max-h-52 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">이전 대화 목록</p>
          <div className="space-y-1.5">
            {history.map(conv => (
              <div key={conv.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => {
                    setMessages(conv.messages);
                    setShowHistory(false);
                    didAutoSend.current = true;
                  }}
                  className="flex-1 text-left px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
                >
                  <span className="text-gray-400 dark:text-gray-500 mr-1.5">
                    {new Date(conv.savedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                  {conv.title}
                </button>
                <button
                  onClick={() => {
                    deleteFromHistory(conv.id);
                    setHistory(loadHistory());
                  }}
                  className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="h-[460px] overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !initialQuestion && (
          <div className="py-3">
            {/* 환영 메시지 */}
            <div className="flex gap-3 mb-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Bot size={13} className="text-white" />
              </div>
              <div className="bg-gray-50 dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
                  {mode === 'bizplan'
                    ? '안녕하세요! 사업계획서 작성을 도와드릴게요 📝\n어떤 부분부터 시작할까요?'
                    : mode === 'document'
                    ? '서류 관련해서 궁금한 점 뭐든지 물어보세요! 📂\n어떤 서류가 필요하신가요?'
                    : '안녕하세요! 지실장이에요 🤝\n지원사업 관련해서 무엇이든 물어보세요!'}
                </p>
              </div>
            </div>
            {/* 빠른 질문 */}
            <div className="space-y-2 ml-10">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isStreaming}
                  className="block w-full text-left px-3 py-2.5 text-sm bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl transition-colors disabled:opacity-40 border border-indigo-100 dark:border-indigo-800"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && initialQuestion && (
          <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-sm">지실장이 답변을 준비하는 중...</span>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div key={message.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                isUser ? 'bg-indigo-500' : 'bg-gradient-to-br from-violet-500 to-indigo-600'
              }`}>
                {isUser ? <User size={13} className="text-white" /> : <Bot size={13} className="text-white" />}
              </div>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                isUser
                  ? 'bg-indigo-600 text-white rounded-tr-sm text-sm'
                  : 'bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
              }`}>
                {isUser ? (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                ) : message.content === '' && isStreaming ? (
                  <div className="flex gap-1 items-center py-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                ) : (
                  <SimpleMarkdown text={message.content} />
                )}
              </div>
            </div>
          );
        })}

        {rateLimitMsg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
            <Clock size={15} className="flex-shrink-0" /> {rateLimitMsg}
          </div>
        )}
        {chatError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
            <AlertCircle size={15} className="flex-shrink-0" /> {chatError}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex gap-2 bg-white dark:bg-slate-800"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
          }}
          placeholder={
            mode === 'bizplan' ? '사업계획서 관련 질문을 입력하세요...'
            : mode === 'document' ? '서류 관련 질문을 입력하세요...'
            : '지원사업 관련 질문을 입력하세요... (Enter 전송)'
          }
          disabled={isStreaming}
          className="flex-1 px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
        />
        {isStreaming ? (
          <button type="button" onClick={() => abortRef.current?.abort()}
            className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 transition-colors" title="중지">
            <Square size={15} />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()}
            className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors" title="전송">
            <Send size={15} />
          </button>
        )}
      </form>
    </div>
  );
}

// ─── 사업계획서 가이드 카드 ─────────────────────────────────────────
function BizplanGuideCard() {
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4">
      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">📝 사업계획서 핵심 구조</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { step: '01', label: '현황 분석', desc: '강점·문제점 솔직하게' },
          { step: '02', label: '목표 설정', desc: '수치화된 구체적 목표' },
          { step: '03', label: '추진 계획', desc: '월별 일정·예산 배분' },
          { step: '04', label: '기대 효과', desc: '매출·고용 정량적 제시' },
        ].map(({ step, label, desc }) => (
          <div key={step} className="bg-white dark:bg-slate-800 rounded-lg p-2.5 flex items-start gap-2">
            <span className="text-xs font-bold text-indigo-500 shrink-0">{step}</span>
            <div>
              <p className="text-xs font-semibold text-gray-800 dark:text-white">{label}</p>
              <p className="text-xs text-gray-400 leading-tight">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Content (uses useSearchParams) ───────────────────────────
function ConsultantContent() {
  const searchParams = useSearchParams();
  const programId = searchParams.get('programId');
  const qParam = searchParams.get('q');
  const modeParam = searchParams.get('mode');

  const { profile } = useProfile();
  const isPremium = profile?.is_premium ?? false;
  const { activeProfile: businessProfile, loading: profileLoading } = useBusinessProfile();
  const [topMatches, setTopMatches] = useState<MatchInfo[]>([]);
  const [singleProgram, setSingleProgram] = useState<Program | null>(null);
  const [singleMatchInfo, setSingleMatchInfo] = useState<{
    score: number; reasons: string[]; mismatches: string[];
  } | null>(null);
  const [consultingPrompt, setConsultingPrompt] = useState('');
  const [loading, setLoading] = useState(true);

  // 채팅 모드: URL 파라미터 or ?q= 내용 기반으로 초기값 결정
  const [mode, setMode] = useState<ChatMode>(() => {
    if (modeParam === 'bizplan') return 'bizplan';
    if (modeParam === 'document') return 'document';
    if (qParam?.includes('서류')) return 'document';
    return 'general';
  });

  const loadData = useCallback(async () => {
    try {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    if (programId) {
      const { data: prog } = await supabase.from('programs').select('id, external_id, source, title, managing_org, category, subcategory, support_type, target_regions, target_industries, target_company_size, min_employee_count, max_employee_count, min_company_age, max_company_age, min_revenue, max_revenue, funding_amount_min, funding_amount_max, self_funding_ratio, application_start, application_end, status, description, eligibility_summary, detail_url, is_featured, is_recurring, typical_open_month, created_at').eq('id', programId).single();
      const program = prog as Program | null;
      setSingleProgram(program);

      if (businessProfile && program) {
        const r = calculateMatch(businessProfile, program);
        setSingleMatchInfo({ score: r.score, reasons: r.reasons, mismatches: r.mismatches });
        setConsultingPrompt(generateSingleProgramPrompt(businessProfile, program, {
          score: r.score, reasons: r.reasons, mismatches: r.mismatches,
        }));
      } else if (program) {
        setConsultingPrompt(generateSingleProgramPrompt(
          businessProfile ?? { business_name: '(프로필 미등록)' } as BusinessProfile,
          program,
        ));
      }
    } else if (businessProfile) {
      // 저장된 매칭 점수 상위 10개 로드 (전체 프로그램 fetch 방지)
      const { data: savedMatches } = await supabase
        .from('user_program_matches')
        .select('*, programs(*)')
        .eq('user_id', user.id)
        .order('match_score', { ascending: false })
        .limit(10);

      let scored: MatchInfo[] = [];

      if (savedMatches && savedMatches.length >= 3) {
        // 저장된 점수 활용 (빠른 경로)
        scored = savedMatches
          .filter((m) => m.programs && (m.programs as Program).status !== 'closed')
          .slice(0, 5)
          .map((m) => {
            const p = m.programs as Program;
            const r = calculateMatch(businessProfile, p);
            return { program: p, score: m.match_score ?? r.score, reasons: r.reasons };
          });
      } else {
        // 저장된 점수가 없으면 최신 공모 100건만 가져와 계산
        const { data: progs } = await supabase
          .from('programs').select('id, external_id, source, title, managing_org, category, subcategory, support_type, target_regions, target_industries, target_company_size, min_employee_count, max_employee_count, min_company_age, max_company_age, min_revenue, max_revenue, funding_amount_min, funding_amount_max, self_funding_ratio, application_start, application_end, status, description, eligibility_summary, detail_url, is_featured, is_recurring, typical_open_month, created_at')
          .in('status', ['open', 'always'])
          .order('is_featured', { ascending: false })
          .limit(100);

        if (progs && progs.length > 0) {
          scored = (progs as Program[])
            .map((p) => { const r = calculateMatch(businessProfile, p); return { program: p, score: r.score, reasons: r.reasons }; })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        }
      }

      if (scored.length > 0) {
        setTopMatches(scored);
        setConsultingPrompt(generateConsultingPrompt(businessProfile, scored));
      }
    }
    } catch (err) {
      console.error('[ConsultantPage] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [programId, businessProfile]);

  useEffect(() => {
    if (!profileLoading) loadData();
  }, [loadData, profileLoading]);

  const isSingleMode = !!programId && !!singleProgram;
  const systemContext = consultingPrompt.slice(0, 2500);

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!businessProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={28} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">AI 지실장 상담</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">
          AI 상담을 받으려면 먼저 사업 프로필을 등록해 주세요.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
          프로필이 있어야 내 사업에 딱 맞는 맞춤 상담이 가능해요 😊
        </p>
        <Link href="/profile" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
          프로필 등록하기 <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  if (!programId && topMatches.length === 0 && !qParam) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">지원사업 데이터 없음</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">먼저 지원사업 데이터를 로드해 주세요.</p>
        <Link href="/programs" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
          지원사업 페이지로 이동 <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  // 초기 채팅 질문 결정
  const initialQuestion = isSingleMode
    ? `"${singleProgram?.title ?? ''}" 지원사업에 대해 제 사업 상황에서 신청 가능한지, 그리고 가장 효과적인 신청 전략을 상세히 알려주세요.`
    : qParam ?? undefined;


  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">

      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        {isSingleMode && (
          <Link href={`/programs/${programId}`}
            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0">
            <ArrowLeft size={18} />
          </Link>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot size={20} className="text-indigo-500" /> AI 채팅 상담
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isSingleMode
              ? <span className="line-clamp-1"><strong className="text-gray-700 dark:text-gray-300">{singleProgram?.title ?? ''}</strong> · AI와 직접 상담</span>
              : `${businessProfile.business_name} · AI와 직접 상담`
            }
          </p>
        </div>
        {/* AI 프롬프트 페이지 링크 */}
        <Link
          href={isSingleMode ? `/prompts?programId=${programId}` : '/prompts'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex-shrink-0"
        >
          <Sparkles size={13} /> AI 프롬프트
        </Link>
      </div>

      {/* ── 매칭 배지 / 프로필 칩 ────────────────────────────────────── */}
      {isSingleMode && singleMatchInfo ? (
        <div className="flex flex-wrap gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            singleMatchInfo.score >= 80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
            singleMatchInfo.score >= 60 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
            'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>AI 적합도 {singleMatchInfo.score}점</span>
          {singleMatchInfo.reasons.slice(0, 3).map((r, i) => (
            <span key={i} className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-xs">✅ {r}</span>
          ))}
          {singleMatchInfo.mismatches.slice(0, 2).map((r, i) => (
            <span key={i} className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs">⚠️ {r}</span>
          ))}
        </div>
      ) : !isSingleMode ? (
        <div className="flex flex-wrap gap-2">
          {[
            businessProfile.business_type,
            businessProfile.region_sido + (businessProfile.region_sigungu ? ` ${businessProfile.region_sigungu}` : ''),
            businessProfile.employee_count != null && `직원 ${businessProfile.employee_count}명`,
            businessProfile.company_age_years != null && `업력 ${businessProfile.company_age_years}년`,
          ].filter(Boolean).map((chip, i) => (
            <span key={i} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
              {chip as string}
            </span>
          ))}
        </div>
      ) : null}

      {/* ── AI 채팅 풀스크린 ─────────────────────────────────────────── */}
      {!isPremium ? (
        <PremiumGate />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          {/* 채팅 헤더 */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">지실장 AI</p>
              <p className="text-xs text-gray-400">내 사업 맥락을 이해하는 AI 상담사</p>
            </div>
            {/* 채팅 모드 탭 (일반 모드에서만) */}
            {!isSingleMode && (
              <div className="flex gap-1 ml-auto">
                {([
                  { key: 'general',  label: '💬 상담' },
                  { key: 'bizplan',  label: '📝 사업계획서' },
                  { key: 'document', label: '📂 서류' },
                ] as { key: ChatMode; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      mode === key
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ChatSection
            key={`${mode}-${isSingleMode}`}
            systemContext={systemContext}
            initialQuestion={undefined}
            mode={isSingleMode ? 'general' : mode}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────
export default function ConsultantPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    }>
      <ConsultantContent />
    </Suspense>
  );
}
