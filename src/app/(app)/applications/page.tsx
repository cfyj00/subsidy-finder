'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, ChevronRight, ChevronLeft, Pencil, Trash2,
  Calendar, Building2, X, Check, CheckCircle2, XCircle, Circle,
  ClipboardList, ClipboardCheck, Banknote, StickyNote, Trophy,
  FolderOpen, Send, Clock, PartyPopper, Map,
  MessageSquare, Loader2, LayoutList, ExternalLink, FileCheck2,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { UserApplication, ApplicationStatus } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────────────
type ViewMode = 'roadmap' | 'kanban';
type RoadmapFilter = 'active' | 'all' | 'done';

// ── Pipeline steps (roadmap view) ─────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: 'check',  label: '자격확인', icon: <ClipboardCheck size={14} /> },
  { id: 'docs',   label: '서류준비', icon: <FolderOpen size={14} /> },
  { id: 'apply',  label: '신청완료', icon: <Send size={14} /> },
  { id: 'review', label: '심사중',   icon: <Clock size={14} /> },
  { id: 'result', label: '결과',     icon: <PartyPopper size={14} /> },
] as const;

// ── Kanban columns ─────────────────────────────────────────────────────────
const COLUMNS = [
  { id: 'preparing', statuses: ['preparing'] as ApplicationStatus[] },
  { id: 'submitted', statuses: ['submitted'] as ApplicationStatus[] },
  { id: 'reviewing', statuses: ['reviewing'] as ApplicationStatus[] },
  { id: 'result',    statuses: ['approved', 'rejected'] as ApplicationStatus[], label: '결과', emoji: '🏆' },
] as const;

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ApplicationStatus, {
  label: string; emoji: string; borderTop: string;
  colBg: string; cardBg: string; badge: string; badgeCls: string;
}> = {
  preparing: {
    label: '준비중',   emoji: '📋',
    borderTop: 'border-t-4 border-gray-400',
    colBg: 'bg-gray-50 dark:bg-slate-700/30',
    cardBg: 'bg-white dark:bg-slate-800',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    badgeCls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
  submitted: {
    label: '제출완료', emoji: '📤',
    borderTop: 'border-t-4 border-blue-400',
    colBg: 'bg-blue-50 dark:bg-blue-900/20',
    cardBg: 'bg-white dark:bg-slate-800',
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  reviewing: {
    label: '심사중',   emoji: '🔍',
    borderTop: 'border-t-4 border-amber-400',
    colBg: 'bg-amber-50 dark:bg-amber-900/20',
    cardBg: 'bg-white dark:bg-slate-800',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  approved: {
    label: '합격',     emoji: '✅',
    borderTop: 'border-t-4 border-emerald-500',
    colBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    cardBg: 'bg-emerald-50/60 dark:bg-emerald-900/10',
    badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  rejected: {
    label: '불합격',   emoji: '❌',
    borderTop: 'border-t-4 border-red-400',
    colBg: 'bg-red-50 dark:bg-red-900/20',
    cardBg: 'bg-red-50/60 dark:bg-red-900/10',
    badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400',
    badgeCls: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  },
};

// ── Utils ──────────────────────────────────────────────────────────────────
function formatAmt(manwon: number | null): string {
  if (!manwon) return '';
  if (manwon >= 10000) return `${(manwon / 10000).toFixed(manwon % 10000 === 0 ? 0 : 1)}억원`;
  if (manwon >= 1000)  return `${(manwon / 1000).toFixed(manwon % 1000 === 0 ? 0 : 1)}천만원`;
  return `${manwon.toLocaleString()}만원`;
}

function dday(deadline: string | null): { label: string; color: string } | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return { label: '마감',  color: 'text-gray-400' };
  if (diff === 0) return { label: 'D-Day', color: 'text-red-600 dark:text-red-400 font-bold' };
  if (diff <= 7)  return { label: `D-${diff}`, color: 'text-red-600 dark:text-red-400 font-semibold' };
  if (diff <= 30) return { label: `D-${diff}`, color: 'text-amber-600 dark:text-amber-400' };
  return { label: `D-${diff}`, color: 'text-gray-400' };
}

function pipelineStep(status: ApplicationStatus): number {
  const map: Record<ApplicationStatus, number> = {
    preparing: 1, submitted: 2, reviewing: 3, approved: 4, rejected: 4,
  };
  return map[status] ?? 0;
}

function nextAction(status: ApplicationStatus): string {
  const map: Record<ApplicationStatus, string> = {
    preparing:  '서류 준비 · 사업계획서 작성 후 신청',
    submitted:  '심사 결과 대기 · 추가 서류 요청 확인',
    reviewing:  '결과 발표일 확인 · 담당자 연락 대기',
    approved:   '협약 체결 및 사업비 집행 계획 수립',
    rejected:   '탈락 사유 확인 후 재도전 사업 탐색',
  };
  return map[status] ?? '';
}

// ── 단계별 가이드 config ───────────────────────────────────────────────────

const STAGE_GUIDE: Record<ApplicationStatus, {
  title: string;
  items: { label: string; href?: string }[];
  advanceLabel?: string;
  advanceTo?: ApplicationStatus;
}> = {
  preparing: {
    title: '지실장 체크리스트',
    items: [
      { label: '📌 공식사이트에서 신청요건 직접 확인 (업종·업력·매출)' },
      { label: '💬 AI 채팅으로 신청 전략 상담받기',  href: '/consultant' },
      { label: '📄 필수 서류 준비 (사업자등록증, 재무제표 등)', href: '/documents' },
      { label: '📝 AI 프롬프트로 사업계획서 작성',   href: '/prompts' },
      { label: '✅ 온라인 신청서 작성 및 제출' },
    ],
    advanceLabel: '신청 완료로 기록',
    advanceTo: 'submitted',
  },
  submitted: {
    title: '제출 후 확인 목록',
    items: [
      { label: '신청 접수번호 확인 (이메일·문자)' },
      { label: '추가 서류 요청 여부 확인' },
      { label: '결과 발표 예정일 확인' },
    ],
    advanceLabel: '심사중으로 이동',
    advanceTo: 'reviewing',
  },
  reviewing: {
    title: '심사 진행 중',
    items: [
      { label: '담당 기관에서 서류 검토 중이에요' },
      { label: '결과 발표 후 아래 버튼으로 기록하세요' },
    ],
  },
  approved: {
    title: '선정 후 할 일',
    items: [
      { label: '협약 체결 완료' },
      { label: '사업비 집행 계획 수립' },
      { label: '사후 관리 일정 확인' },
    ],
  },
  rejected: {
    title: '다음 도전을 위해',
    items: [
      { label: '탈락 사유 확인 및 분석' },
      { label: '유사 지원사업 재탐색', href: '/programs' },
    ],
  },
};

// ── 체크리스트 훅 (localStorage) ───────────────────────────────────────────

function useChecklist(appId: string, stage: ApplicationStatus) {
  const guide = STAGE_GUIDE[stage];
  const total = guide.items.length;

  const key   = `checklist-${appId}-${stage}`;

  const [checks, setChecks] = useState<boolean[]>(() => Array(total).fill(false));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed: boolean[] = JSON.parse(saved);
        setChecks(Array(total).fill(false).map((_, i) => parsed[i] ?? false));
      } else {
        setChecks(Array(total).fill(false));
      }
    } catch { /* ignore */ }
  }, [key, total]);

  const toggle = useCallback((i: number) => {
    setChecks(prev => {
      const next = [...prev];
      next[i] = !next[i];
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  const doneCount = checks.filter(Boolean).length;
  return { checks, toggle, doneCount, total, allDone: doneCount === total };
}

// ── 커스텀 서류 체크리스트 훅 ──────────────────────────────────────────────

interface CustomDoc { id: string; text: string; checked: boolean; }

function useCustomDocs(appId: string) {
  const key = `custom-docs-${appId}`;
  const [docs, setDocs] = useState<CustomDoc[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setDocs(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [key]);

  const save = (next: CustomDoc[]) => {
    setDocs(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const add = (text: string) => {
    if (!text.trim()) return;
    save([...docs, { id: Date.now().toString(), text: text.trim(), checked: false }]);
  };
  const toggle = (id: string) => save(docs.map(d => d.id === id ? { ...d, checked: !d.checked } : d));
  const remove = (id: string) => save(docs.filter(d => d.id !== id));

  return { docs, add, toggle, remove };
}

// ── 커스텀 서류 섹션 컴포넌트 ──────────────────────────────────────────────

function CustomDocSection({ appId }: { appId: string }) {
  const { docs, add, toggle, remove } = useCustomDocs(appId);
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleAdd = () => {
    if (!input.trim()) return;
    add(input);
    setInput('');
  };

  const doneCount = docs.filter(d => d.checked).length;

  return (
    <div className="border border-indigo-100 dark:border-indigo-900/50 rounded-xl overflow-hidden">
      {/* 헤더 토글 */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
      >
        <FileCheck2 size={14} className="text-indigo-500 shrink-0" />
        <span className="flex-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 text-left">
          내 필수서류 체크리스트
        </span>
        {docs.length > 0 && (
          <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">
            {doneCount}/{docs.length}
          </span>
        )}
        <ChevronRight
          size={13}
          className={`text-indigo-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* 펼쳐진 내용 */}
      {expanded && (
        <div className="px-3 py-3 space-y-2 bg-white dark:bg-slate-800/50">
          {/* 항목 목록 */}
          {docs.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">
              아래에 서류명을 입력해 추가해 보세요
            </p>
          )}
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 group">
              <button
                type="button"
                onClick={() => toggle(doc.id)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  doc.checked
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'border-gray-300 dark:border-slate-600 hover:border-indigo-400'
                }`}
              >
                {doc.checked && <Check size={9} />}
              </button>
              <span className={`flex-1 text-xs leading-relaxed ${
                doc.checked ? 'line-through text-gray-300 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {doc.text}
              </span>
              <button
                type="button"
                onClick={() => remove(doc.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X size={11} className="text-red-400" />
              </button>
            </div>
          ))}

          {/* 입력창 */}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="서류명 입력 후 Enter"
              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!input.trim()}
              className="p-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={13} className="text-white disabled:text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StageGuide 컴포넌트 ────────────────────────────────────────────────────

function StageGuide({ app, onAdvance, onResult }: {
  app: UserApplication;
  onAdvance: (status: ApplicationStatus) => void;
  onResult: () => void;
}) {
  const guide       = STAGE_GUIDE[app.status];
  const isCheckable = app.status === 'preparing' || app.status === 'submitted';
  const { checks, toggle, doneCount, total, allDone } = useChecklist(app.id, app.status);

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl px-3 py-3 space-y-2.5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {guide.title}
        </p>
        {isCheckable && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
            allDone
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-gray-200 dark:bg-slate-700 text-gray-400'
          }`}>
            {doneCount}/{total}
          </span>
        )}
      </div>

      {/* 진행 바 */}
      {isCheckable && (
        <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* 항목 */}
      <div className="space-y-2">
        {guide.items.map((item, i) =>
          isCheckable ? (
            <div key={i} className="flex items-start gap-2.5 text-xs w-full group">
              <button
                type="button"
                onClick={() => toggle(i)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-px transition-all ${
                  checks[i]
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'border-gray-300 dark:border-slate-600 hover:border-indigo-400'
                }`}
              >
                {checks[i] && <Check size={9} />}
              </button>
              <span
                onClick={() => toggle(i)}
                className={`flex-1 leading-relaxed cursor-pointer ${
                  checks[i]
                    ? 'line-through text-gray-300 dark:text-gray-600'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {item.label}
              </span>
              {item.href && !checks[i] && (
                <Link
                  href={item.href}
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  바로가기 →
                </Link>
              )}
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="shrink-0 mt-px">
                {app.status === 'reviewing' ? '⏳' : app.status === 'approved' ? '✅' : '•'}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.href && (
                <Link
                  href={item.href}
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  바로가기 →
                </Link>
              )}
            </div>
          )
        )}
      </div>

      {/* 커스텀 서류 체크리스트 (준비중 단계에서만) */}
      {app.status === 'preparing' && (
        <CustomDocSection appId={app.id} />
      )}

      {/* 서류가이드 참조 배너 (준비중 단계에서만) */}
      {app.status === 'preparing' && (
        <Link
          href="/documents"
          className="flex items-center gap-2.5 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <span className="text-lg shrink-0">📂</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">서류가이드 참조하기</p>
            <p className="text-xs text-amber-600/70 dark:text-amber-500/70">필요한 서류 목록과 작성 팁을 확인해요</p>
          </div>
          <ChevronRight size={14} className="text-amber-400 shrink-0" />
        </Link>
      )}

      {/* 액션 버튼 */}
      {app.status === 'reviewing' ? (
        <button
          type="button"
          onClick={onResult}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Trophy size={14} /> 결과 입력하기 →
        </button>
      ) : guide.advanceTo ? (
        <button
          type="button"
          onClick={() => onAdvance(guide.advanceTo!)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            allDone
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-slate-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
          }`}
        >
          {allDone ? <CheckCircle2 size={14} /> : <ChevronRight size={14} />}
          {allDone ? `완료! ${guide.advanceLabel ?? '다음으로'} →` : `${guide.advanceLabel ?? '다음으로'} →`}
        </button>
      ) : null}
    </div>
  );
}

// ── Form state ─────────────────────────────────────────────────────────────
interface FormState {
  program_title: string;
  managing_org: string;
  application_deadline: string;
  applied_amount: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  program_title: '', managing_org: '', application_deadline: '',
  applied_amount: '', notes: '',
};

// ── Modal: Add / Edit ──────────────────────────────────────────────────────
function AppModal({ initial, onClose, onSave, title }: {
  initial?: Partial<FormState>;
  onClose: () => void;
  onSave: (data: FormState) => Promise<void>;
  title: string;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.program_title.trim()) { setErr('사업명은 필수입니다'); return; }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch { setErr('저장 중 오류가 발생했어요. 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              사업명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={form.program_title} onChange={set('program_title')}
              placeholder="예: 스마트공장 기초 구축 지원사업"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">주관기관</label>
            <input
              type="text" value={form.managing_org} onChange={set('managing_org')}
              placeholder="예: 중소벤처기업부"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">신청 마감일</label>
              <input
                type="date" value={form.application_deadline} onChange={set('application_deadline')}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">예상 지원금 (만원)</label>
              <input
                type="number" value={form.applied_amount} onChange={set('applied_amount')}
                placeholder="예: 5000"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {form.applied_amount && (
                <p className="text-xs text-indigo-500 mt-1">= {formatAmt(Number(form.applied_amount))}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">메모</label>
            <textarea
              value={form.notes} onChange={set('notes')} rows={3}
              placeholder="신청 관련 메모, 준비 사항, 담당자 연락처 등"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Result ──────────────────────────────────────────────────────────
function ResultModal({ app, onClose, onSave }: {
  app: UserApplication;
  onClose: () => void;
  onSave: (status: 'approved' | 'rejected', resultAmount?: number, notes?: string) => Promise<void>;
}) {
  const [picked, setPicked] = useState<'approved' | 'rejected' | null>(null);
  const [resultAmount, setResultAmount] = useState('');
  const [notes, setNotes] = useState(app.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await onSave(picked, resultAmount ? Number(resultAmount) : undefined, notes || undefined);
      onClose();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">결과 입력</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">{app.program_title}</span> 결과를 선택하세요
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPicked('approved')}
              className={`py-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                picked === 'approved'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                  : 'border-gray-200 dark:border-slate-600 hover:border-emerald-300'
              }`}
            >
              <CheckCircle2 size={28} className={picked === 'approved' ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'} />
              <span className={`text-sm font-semibold ${picked === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                합격 🎉
              </span>
            </button>
            <button
              onClick={() => setPicked('rejected')}
              className={`py-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                picked === 'rejected'
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/30'
                  : 'border-gray-200 dark:border-slate-600 hover:border-red-300'
              }`}
            >
              <XCircle size={28} className={picked === 'rejected' ? 'text-red-500' : 'text-gray-300 dark:text-gray-600'} />
              <span className={`text-sm font-semibold ${picked === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                불합격
              </span>
            </button>
          </div>
          {picked === 'approved' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">확정 지원금 (만원)</label>
              <input
                type="number" value={resultAmount}
                onChange={e => setResultAmount(e.target.value)}
                placeholder={app.applied_amount?.toString() ?? ''}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              {resultAmount && <p className="text-xs text-emerald-600 mt-1">= {formatAmt(Number(resultAmount))}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">메모 (선택)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="결과 관련 메모 (심사 피드백, 다음 준비 사항 등)"
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              취소
            </button>
            <button type="button" onClick={handleSave} disabled={!picked || saving}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {saving ? '저장 중...' : '결과 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Kanban card ────────────────────────────────────────────────────────────
function AppCard({ app, onMoveBack, onMoveForward, onEdit, onDelete, onResult }: {
  app: UserApplication;
  onMoveBack?: () => void;
  onMoveForward?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResult?: () => void;
}) {
  const cfg = STATUS_CONFIG[app.status];
  const dd = dday(app.application_deadline);

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-3 ${cfg.cardBg}`}>
      <div className="flex items-start justify-between gap-2">
        {app.program_id ? (
          <Link href={`/programs/${app.program_id}`}
            className="font-semibold text-gray-900 dark:text-white text-sm leading-snug flex-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            {app.program_title}
          </Link>
        ) : (
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug flex-1">{app.program_title}</p>
        )}
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
          {cfg.emoji} {cfg.label}
        </span>
      </div>
      <div className="space-y-1.5">
        {app.managing_org && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Building2 size={11} />{app.managing_org}
          </div>
        )}
        {app.application_deadline && (
          <div className={`flex items-center gap-1.5 text-xs ${dd?.color ?? 'text-gray-500'}`}>
            <Calendar size={11} />{app.application_deadline}
            {dd && <span className="font-medium">({dd.label})</span>}
          </div>
        )}
        {app.applied_amount && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Banknote size={11} />
            {app.status === 'approved' && app.result_amount
              ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">확정 {formatAmt(app.result_amount)}</span>
              : <span>예상 {formatAmt(app.applied_amount)}</span>
            }
          </div>
        )}
        {app.notes && (
          <div className="flex items-start gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <StickyNote size={11} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{app.notes}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 pt-1 border-t border-gray-100 dark:border-slate-700">
        {onMoveBack && (
          <button onClick={onMoveBack} title="이전 단계로"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={15} />
          </button>
        )}
        {onResult && (
          <button onClick={onResult}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
            <Trophy size={12} />결과 입력
          </button>
        )}
        {onMoveForward && !onResult && (
          <button onClick={onMoveForward} title="다음 단계로"
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
            <ChevronRight size={15} />
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onEdit} title="편집"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} title="삭제"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Roadmap View ───────────────────────────────────────────────────────────
function RoadmapView({ apps, onAddClick, onMoveApp, onEditApp, onDeleteApp, onResultApp }: {
  apps: UserApplication[];
  onAddClick: () => void;
  onMoveApp: (app: UserApplication, status: ApplicationStatus) => void;
  onEditApp: (app: UserApplication) => void;
  onDeleteApp: (id: string) => void;
  onResultApp: (app: UserApplication) => void;
}) {
  const [filter, setFilter] = useState<RoadmapFilter>('active');
  const active = apps.filter(a => !['approved', 'rejected'].includes(a.status));
  const done   = apps.filter(a =>  ['approved', 'rejected'].includes(a.status));
  const displayed = filter === 'active' ? active : filter === 'done' ? done : apps;

  if (apps.length === 0) {
    return (
      <div className="py-8 space-y-5">
        {/* 안내 헤더 */}
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">아직 추적 중인 지원사업이 없어요</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">아래 순서로 따라오시면 쉽게 시작할 수 있어요!</p>
        </div>

        {/* 3단계 여정 가이드 */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">시작 가이드</p>
          {[
            { step: '1', icon: '🔍', label: '지원사업 탐색', desc: '지원사업 메뉴에서 내 사업에 맞는 프로그램을 찾아요', href: '/programs', cta: '지원사업 보러 가기 →' },
            { step: '2', icon: '➕', label: '트래커에 추가', desc: '상세 페이지의 \'지원트래커에 추가하기\'를 클릭하면 여기에 자동으로 등록돼요', href: null, cta: null },
            { step: '3', icon: '📂', label: '서류 준비 & 관리', desc: '단계별 체크리스트와 서류가이드로 서류를 준비해요', href: '/documents', cta: '서류가이드 보기 →' },
          ].map(({ step, icon, label, desc, href, cta }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{icon} {label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                {href && cta && (
                  <Link href={href} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1 inline-block hover:underline">{cta}</Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA 버튼 */}
        <div className="flex justify-center gap-3">
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            🔍 지원사업 탐색하러 가기
          </Link>
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={15} /> 직접 추가
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
        {([
          ['active', `진행 중 (${active.length})`],
          ['all',    `전체 (${apps.length})`],
          ['done',   `완료 (${done.length})`],
        ] as [RoadmapFilter, string][]).map(([val, label]) => (
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

      {displayed.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">해당 항목이 없어요</div>
      )}

      {/* 카드 목록 */}
      <div className="space-y-4">
        {displayed.map(app => {
          const cfg    = STATUS_CONFIG[app.status];
          const dd     = dday(app.application_deadline);
          const curStep = pipelineStep(app.status);

          return (
            <div
              key={app.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="p-4">
                {/* 상단 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeCls}`}>{cfg.label}</span>
                    {app.program_id ? (
                      <Link href={`/programs/${app.program_id}`}
                        className="font-semibold text-gray-900 dark:text-white text-sm mt-1.5 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block">
                        {app.program_title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-gray-900 dark:text-white text-sm mt-1.5 leading-snug">{app.program_title}</p>
                    )}
                    {app.managing_org && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{app.managing_org}</p>}
                  </div>
                  {dd && <span className={`shrink-0 text-xs font-medium ${dd.color}`}>{dd.label}</span>}
                </div>

                {/* 파이프라인 진행 바 */}
                <div className="flex items-center gap-0 mb-3">
                  {PIPELINE_STEPS.map((step, i) => {
                    const isCompleted = i < curStep;
                    const isCurrent   = i === curStep;
                    const isLast      = i === PIPELINE_STEPS.length - 1;
                    return (
                      <div key={step.id} className="flex items-center flex-1 min-w-0">
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
                        {!isLast && (
                          <div className={`flex-1 h-0.5 mx-1 mb-4 rounded-full ${i < curStep ? 'bg-indigo-400' : 'bg-gray-200 dark:bg-slate-700'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 단계별 가이드 & 체크리스트 */}
                <StageGuide
                  app={app}
                  onAdvance={(status) => onMoveApp(app, status)}
                  onResult={() => onResultApp(app)}
                />
                {app.application_deadline && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    📅 마감 {format(new Date(app.application_deadline), 'yyyy.M.d (EEE)', { locale: ko })}
                  </p>
                )}

                {/* 합격 금액 */}
                {app.status === 'approved' && app.result_amount && (
                  <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">🎉 확정 지원금</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatAmt(app.result_amount)}</p>
                  </div>
                )}
              </div>

              {/* 하단 액션 */}
              <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
                {app.program_url && (
                  <a
                    href={app.program_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    <ExternalLink size={11} /> 공식사이트
                  </a>
                )}
                <div className="flex-1" />
                <Link
                  href={`/consultant?programId=${app.program_id ?? ''}&q=${encodeURIComponent(app.program_title + ' ' + nextAction(app.status))}`}
                  className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <MessageSquare size={12} /> AI 상담
                </Link>
                <button onClick={() => onEditApp(app)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => onDeleteApp(app.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 추가 CTA */}
      <div className="mt-6">
        <button
          onClick={onAddClick}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={15} /> 새 지원사업 추가
        </button>
      </div>
    </>
  );
}

// ── Kanban View ────────────────────────────────────────────────────────────
function KanbanView({ apps, onAddClick, onMoveApp, onEditApp, onDeleteApp, onResultApp }: {
  apps: UserApplication[];
  onAddClick: () => void;
  onMoveApp: (app: UserApplication, status: ApplicationStatus) => void;
  onEditApp: (app: UserApplication) => void;
  onDeleteApp: (id: string) => void;
  onResultApp: (app: UserApplication) => void;
}) {
  const appsInCol = (statuses: readonly ApplicationStatus[]) =>
    apps.filter(a => (statuses as ApplicationStatus[]).includes(a.status));

  const prevStatus = (s: ApplicationStatus): ApplicationStatus | undefined =>
    ({ submitted: 'preparing', reviewing: 'submitted', approved: 'reviewing', rejected: 'reviewing' } as Record<ApplicationStatus, ApplicationStatus>)[s];

  const nextStatus = (s: ApplicationStatus): ApplicationStatus | undefined =>
    ({ preparing: 'submitted', submitted: 'reviewing' } as Partial<Record<ApplicationStatus, ApplicationStatus>>)[s];

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
          <ClipboardList size={28} className="text-indigo-500" />
        </div>
        <p className="font-semibold text-gray-900 dark:text-white mb-2">아직 신청한 지원사업이 없어요</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">관심 있는 지원사업을 추가하고 진행 상황을 관리해 보세요 📋</p>
        <button onClick={onAddClick}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> 첫 지원사업 추가하기
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-4">
        {COLUMNS.map(col => {
          const colCfg = col.id === 'result'
            ? { label: '결과', emoji: '🏆', borderTop: 'border-t-4 border-indigo-400', colBg: 'bg-slate-50 dark:bg-slate-700/30' }
            : STATUS_CONFIG[col.id as ApplicationStatus];
          const colApps = appsInCol(col.statuses);

          return (
            <div key={col.id} className={`w-72 shrink-0 rounded-xl ${colCfg.colBg} ${colCfg.borderTop} flex flex-col`}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{colCfg.emoji}</span>
                  <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                    {'label' in col ? col.label : (colCfg as typeof STATUS_CONFIG[ApplicationStatus]).label}
                  </span>
                  <span className="text-xs bg-white/70 dark:bg-slate-800/70 px-2 py-0.5 rounded-full text-gray-500 dark:text-gray-400 font-medium">
                    {colApps.length}
                  </span>
                </div>
                {col.id === 'preparing' && (
                  <button onClick={onAddClick}
                    className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-white/60 dark:hover:bg-slate-700 transition-colors">
                    <Plus size={15} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3 max-h-[60vh]">
                {colApps.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-500">
                    {col.id === 'preparing' ? '+ 버튼으로 추가해요' : '아직 없어요'}
                  </div>
                )}
                {colApps.map(app => {
                  const isReviewing = app.status === 'reviewing';
                  const prev = prevStatus(app.status);
                  const next = nextStatus(app.status);
                  return (
                    <AppCard
                      key={app.id}
                      app={app}
                      onMoveBack={prev ? () => onMoveApp(app, prev) : undefined}
                      onMoveForward={!isReviewing && next ? () => onMoveApp(app, next) : undefined}
                      onResult={isReviewing ? () => onResultApp(app) : undefined}
                      onEdit={() => onEditApp(app)}
                      onDelete={() => onDeleteApp(app.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ApplicationsPage() {
  const [apps, setApps] = useState<UserApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('roadmap');

  // Modal state
  const [addOpen, setAddOpen]       = useState(false);
  const [editTarget, setEditTarget] = useState<UserApplication | null>(null);
  const [resultTarget, setResultTarget] = useState<UserApplication | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_applications')
      .select('id, user_id, program_id, program_title, managing_org, application_deadline, applied_amount, status, notes, program_url, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setApps((data as UserApplication[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  // ── CRUD ────────────────────────────────────────────────────────────────
  const handleAdd = async (form: FormState) => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('no user');
    await supabase.from('user_applications').insert({
      user_id: user.id,
      program_title: form.program_title.trim(),
      managing_org: form.managing_org.trim() || null,
      application_deadline: form.application_deadline || null,
      applied_amount: form.applied_amount ? Number(form.applied_amount) : null,
      notes: form.notes.trim() || null,
      status: 'preparing',
    });
    await loadApps();
  };

  const handleEdit = async (form: FormState) => {
    if (!editTarget) return;
    const supabase = getSupabaseBrowser();
    await supabase.from('user_applications').update({
      program_title: form.program_title.trim(),
      managing_org: form.managing_org.trim() || null,
      application_deadline: form.application_deadline || null,
      applied_amount: form.applied_amount ? Number(form.applied_amount) : null,
      notes: form.notes.trim() || null,
    }).eq('id', editTarget.id);
    await loadApps();
  };

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseBrowser();
    await supabase.from('user_applications').delete().eq('id', id);
    setDeleteTarget(null);
    await loadApps();
  };

  const handleMove = async (app: UserApplication, newStatus: ApplicationStatus) => {
    const supabase = getSupabaseBrowser();
    await supabase.from('user_applications').update({ status: newStatus }).eq('id', app.id);
    await loadApps();
  };

  const handleResult = async (status: 'approved' | 'rejected', resultAmount?: number, notes?: string) => {
    if (!resultTarget) return;
    const supabase = getSupabaseBrowser();
    await supabase.from('user_applications').update({
      status,
      result_at: new Date().toISOString(),
      result_amount: resultAmount ?? null,
      notes: notes ?? resultTarget.notes,
    }).eq('id', resultTarget.id);
    await loadApps();
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    active:   apps.filter(a => !['approved', 'rejected'].includes(a.status)).length,
    approved: apps.filter(a => a.status === 'approved').length,
    totalWon: apps
      .filter(a => a.status === 'approved' && a.result_amount)
      .reduce((s, a) => s + (a.result_amount ?? 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">지원 관리</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">신청한 지원사업의 로드맵과 상태를 관리해요</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} /> 지원 추가
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: '진행 중',  value: stats.active,                                     color: 'text-indigo-600 dark:text-indigo-400' },
            { label: '합격',     value: stats.approved,                                   color: 'text-emerald-600 dark:text-emerald-400' },
            { label: '확정 금액', value: stats.totalWon ? formatAmt(stats.totalWon) : '-', color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 dark:bg-slate-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setViewMode('roadmap')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'roadmap'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            <Map size={13} /> 로드맵 뷰
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'kanban'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            <LayoutList size={13} /> 칸반 뷰
          </button>
        </div>
      </div>

      {/* View content */}
      <div className={`flex-1 ${viewMode === 'kanban' ? 'overflow-hidden' : 'overflow-y-auto'} px-4 sm:px-6 py-5`}>
        {viewMode === 'roadmap' ? (
          <RoadmapView
            apps={apps}
            onAddClick={() => setAddOpen(true)}
            onMoveApp={handleMove}
            onEditApp={setEditTarget}
            onDeleteApp={setDeleteTarget}
            onResultApp={setResultTarget}
          />
        ) : (
          <KanbanView
            apps={apps}
            onAddClick={() => setAddOpen(true)}
            onMoveApp={handleMove}
            onEditApp={setEditTarget}
            onDeleteApp={setDeleteTarget}
            onResultApp={setResultTarget}
          />
        )}
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">삭제하시겠어요?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">이 기록을 삭제하면 복구할 수 없어요.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                취소
              </button>
              <button onClick={() => handleDelete(deleteTarget)}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && <AppModal title="지원사업 추가" onClose={() => setAddOpen(false)} onSave={handleAdd} />}
      {editTarget && (
        <AppModal
          title="편집"
          initial={{
            program_title: editTarget.program_title,
            managing_org: editTarget.managing_org ?? '',
            application_deadline: editTarget.application_deadline ?? '',
            applied_amount: editTarget.applied_amount?.toString() ?? '',
            notes: editTarget.notes ?? '',
          }}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
        />
      )}
      {resultTarget && (
        <ResultModal
          app={resultTarget}
          onClose={() => setResultTarget(null)}
          onSave={handleResult}
        />
      )}
    </div>
  );
}
