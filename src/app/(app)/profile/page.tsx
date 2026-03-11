'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { useProfile } from '@/lib/profile-context';
import { useBusinessProfile } from '@/lib/business-profile-context';
import {
  REGIONS_SIDO, BUSINESS_TYPES, CHALLENGE_OPTIONS, GOAL_OPTIONS
} from '@/lib/constants';
import type { BusinessProfile } from '@/types/database';
import {
  Building2, MapPin, Users, Target, CheckCircle, Loader2,
  ChevronRight, ChevronLeft, Plus, Pencil, Trash2, Star,
  ArrowLeft,
} from 'lucide-react';

// ── 위저드 스텝 ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: '기본 정보', icon: Building2 },
  { id: 2, title: '사업 상세', icon: MapPin },
  { id: 3, title: '규모 & 재무', icon: Users },
  { id: 4, title: '목표 & 현황', icon: Target },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all ${
              done ? 'bg-indigo-600 text-white' : active
                ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
            }`}>
              {done ? <CheckCircle size={16} /> : step.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${step.id < current ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MultiSelect({ options, selected, onChange }: {
  options: readonly string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? selected.filter(s => s !== opt) : [...selected, opt])}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              active
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── 빈 폼 상태 ───────────────────────────────────────────────────────────────
const emptyForm = () => ({
  profileName: '',
  businessName: '',
  representativeName: '',
  businessRegNumber: '',
  businessType: '',
  businessCategory: '',
  businessEntityType: '',
  regionSido: '',
  regionSigungu: '',
  establishmentDate: '',
  mainProducts: '',
  hasExport: false,
  annualExportAmount: '',
  employeeCount: '',
  annualRevenue: '',
  isVenture: false,
  isInnobiz: false,
  isMainbiz: false,
  hasSmartFactory: false,
  smartFactoryLevel: '',
  challenges: [] as string[],
  goals: [] as string[],
  notes: '',
});

type FormState = ReturnType<typeof emptyForm>;

// ── 기존 프로필 → 폼 상태 변환 ───────────────────────────────────────────────
function profileToForm(p: BusinessProfile): FormState {
  return {
    profileName: p.profile_name ?? '',
    businessName: p.business_name ?? '',
    representativeName: p.representative_name ?? '',
    businessRegNumber: p.business_reg_number ?? '',
    businessType: p.business_type ?? '',
    businessCategory: p.business_category ?? '',
    businessEntityType: p.business_entity_type ?? '',
    regionSido: p.region_sido ?? '',
    regionSigungu: p.region_sigungu ?? '',
    establishmentDate: p.establishment_date ?? '',
    mainProducts: p.main_products ?? '',
    hasExport: p.has_export ?? false,
    annualExportAmount: p.annual_export_amount?.toString() ?? '',
    employeeCount: p.employee_count?.toString() ?? '',
    annualRevenue: p.annual_revenue?.toString() ?? '',
    isVenture: p.is_venture ?? false,
    isInnobiz: p.is_innobiz ?? false,
    isMainbiz: p.is_mainbiz ?? false,
    hasSmartFactory: p.has_smart_factory ?? false,
    smartFactoryLevel: p.smart_factory_level ?? '',
    challenges: p.current_challenges ?? [],
    goals: p.goals ?? [],
    notes: p.notes ?? '',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 메인 페이지
// ══════════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {
  const router = useRouter();
  const { profile, refresh: refreshProfile } = useProfile();
  const { allProfiles, activeProfile, refresh: refreshBP, setActive, deleteProfile } = useBusinessProfile();

  // 'list' | 'create' | 'edit'
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  // 위저드 상태
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 삭제 확인
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 모드 전환 핸들러
  function startCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setStep(1);
    setError('');
    setSaved(false);
    setMode('create');
  }

  function startEdit(p: BusinessProfile) {
    setForm(profileToForm(p));
    setEditingId(p.id);
    setStep(1);
    setError('');
    setSaved(false);
    setMode('edit');
  }

  function backToList() {
    setMode('list');
    setEditingId(null);
    setError('');
  }

  // 업력 계산
  function getCompanyAge() {
    if (!form.establishmentDate) return null;
    const est = new Date(form.establishmentDate);
    const now = new Date();
    return Math.floor((now.getTime() - est.getTime()) / (1000 * 60 * 60 * 24 * 365));
  }

  // 저장 핸들러
  async function handleSave() {
    if (!form.businessName || !form.businessType || !form.regionSido) {
      setError('사업체명, 업태, 지역은 필수입니다.');
      setStep(1);
      return;
    }
    setSaving(true);
    setError('');

    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      user_id: user.id,
      profile_name: form.profileName || null,
      business_name: form.businessName,
      representative_name: form.representativeName || null,
      business_reg_number: form.businessRegNumber || null,
      business_type: form.businessType,
      business_category: form.businessCategory || null,
      region_sido: form.regionSido,
      region_sigungu: form.regionSigungu || null,
      establishment_date: form.establishmentDate || null,
      company_age_years: getCompanyAge(),
      employee_count: form.employeeCount ? parseInt(form.employeeCount) : null,
      annual_revenue: form.annualRevenue ? parseInt(form.annualRevenue) : null,
      is_venture: form.isVenture,
      is_innobiz: form.isInnobiz,
      is_mainbiz: form.isMainbiz,
      has_smart_factory: form.hasSmartFactory,
      smart_factory_level: form.smartFactoryLevel || null,
      business_entity_type: form.businessEntityType || null,
      has_export: form.hasExport,
      annual_export_amount: form.annualExportAmount ? parseInt(form.annualExportAmount) : null,
      main_products: form.mainProducts || null,
      current_challenges: form.challenges,
      goals: form.goals,
      notes: form.notes || null,
    };

    let newId: string | null = null;

    if (mode === 'edit' && editingId) {
      // 기존 프로필 수정
      const { error: updErr } = await supabase
        .from('business_profiles')
        .update(payload)
        .eq('id', editingId)
        .eq('user_id', user.id);

      if (updErr) {
        setError('저장 실패: ' + updErr.message);
        setSaving(false);
        return;
      }
      newId = editingId;
    } else {
      // 새 프로필 생성 (INSERT)
      const { data: inserted, error: insErr } = await supabase
        .from('business_profiles')
        .insert(payload)
        .select('id')
        .single();

      if (insErr) {
        setError('저장 실패: ' + insErr.message);
        setSaving(false);
        return;
      }
      newId = inserted?.id ?? null;
    }

    // 첫 프로필이거나 활성 프로필이 없으면 자동 활성화
    if (newId && (!activeProfile || allProfiles.length === 0)) {
      await supabase
        .from('profiles')
        .update({ active_business_profile_id: newId, onboarding_done: true })
        .eq('id', user.id);
    } else {
      // 온보딩 완료 처리
      await supabase.from('profiles').update({ onboarding_done: true }).eq('id', user.id);
    }

    refreshProfile();
    await refreshBP();
    setSaving(false);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
      backToList();
    }, 1200);
  }

  // 삭제 핸들러
  async function handleDelete(id: string) {
    setDeleting(true);
    await deleteProfile(id);
    setDeletingId(null);
    setDeleting(false);
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  // ── 목록 뷰 ─────────────────────────────────────────────────────────────────
  if (mode === 'list') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">사업 프로필</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              사업체가 여러 개라면 각각 프로필을 만들어 관리하세요.
            </p>
          </div>
          <button
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> 프로필 추가
          </button>
        </div>

        {/* 프로필 없음 */}
        {allProfiles.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-12 text-center shadow-sm">
            <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              아직 등록된 사업 프로필이 없습니다.<br />
              첫 프로필을 만들어 지원사업 매칭을 시작하세요!
            </p>
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> 첫 프로필 만들기
            </button>
          </div>
        )}

        {/* 프로필 카드 목록 */}
        <div className="space-y-4">
          {allProfiles.map(p => {
            const isActive = activeProfile?.id === p.id;
            const displayName = p.profile_name || p.business_name;
            return (
              <div
                key={p.id}
                className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-5 transition-all ${
                  isActive
                    ? 'border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-300 dark:ring-indigo-700'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                {/* 카드 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                        {displayName}
                      </h2>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          <Star size={11} /> 활성
                        </span>
                      )}
                    </div>
                    {p.profile_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.business_name}</p>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => setActive(p.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        활성으로 설정
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      title="수정"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeletingId(p.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* 카드 정보 */}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                  <span>📋 {p.business_type}</span>
                  {p.business_category && <span>· {p.business_category}</span>}
                  <span>📍 {p.region_sido}{p.region_sigungu ? ` ${p.region_sigungu}` : ''}</span>
                  {p.employee_count != null && <span>👥 {p.employee_count}명</span>}
                  {p.annual_revenue != null && <span>💰 연매출 {p.annual_revenue.toLocaleString()}백만원</span>}
                </div>

                {/* 인증 배지 */}
                {(p.is_venture || p.is_innobiz || p.is_mainbiz) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.is_venture && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">벤처</span>}
                    {p.is_innobiz && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">이노비즈</span>}
                    {p.is_mainbiz && <span className="px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">메인비즈</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 삭제 확인 모달 */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">프로필 삭제</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                정말 이 프로필을 삭제하시겠어요? 삭제된 프로필은 복구할 수 없습니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 위저드 뷰 (create / edit) ─────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={backToList}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> 프로필 목록으로
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {mode === 'create' ? '새 프로필 만들기' : '프로필 수정'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          정확한 정보를 입력할수록 더 적합한 지원사업을 매칭해 드립니다.
        </p>
      </div>

      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">

        {/* ── Step 1: 기본 정보 ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 기본 정보</h2>
            <div>
              <label className={labelCls}>
                프로필 별칭
                <span className="text-gray-400 font-normal text-xs ml-1">(선택 — 사업체가 여러 개일 때 구분용)</span>
              </label>
              <input
                type="text" className={inputCls}
                value={form.profileName}
                onChange={e => setForm(f => ({ ...f, profileName: e.target.value }))}
                placeholder="예) 본사, 2공장, 농장사업체"
              />
            </div>
            <div>
              <label className={labelCls}>사업체명 <span className="text-red-500">*</span></label>
              <input type="text" className={inputCls} value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                placeholder="예) 홍길동 정밀가공" />
            </div>
            <div>
              <label className={labelCls}>대표자명</label>
              <input type="text" className={inputCls} value={form.representativeName}
                onChange={e => setForm(f => ({ ...f, representativeName: e.target.value }))}
                placeholder="예) 홍길동" />
            </div>
            <div>
              <label className={labelCls}>사업자등록번호</label>
              <input type="text" className={inputCls} value={form.businessRegNumber}
                onChange={e => setForm(f => ({ ...f, businessRegNumber: e.target.value }))}
                placeholder="123-45-67890" />
            </div>
            <div>
              <label className={labelCls}>기업 형태 <span className="text-indigo-400 text-xs font-normal ml-1">(지원 자격에 영향)</span></label>
              <select className={inputCls} value={form.businessEntityType}
                onChange={e => setForm(f => ({ ...f, businessEntityType: e.target.value }))}>
                <option value="">선택하세요</option>
                {['개인사업자', '법인', '협동조합', '사회적기업', '기타'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>업태 <span className="text-red-500">*</span></label>
              <select className={inputCls} value={form.businessType}
                onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}>
                <option value="">선택하세요</option>
                {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>업종 (세부)</label>
              <input type="text" className={inputCls} value={form.businessCategory}
                onChange={e => setForm(f => ({ ...f, businessCategory: e.target.value }))}
                placeholder="예) 금속가공, 플라스틱 사출" />
            </div>
          </div>
        )}

        {/* ── Step 2: 사업 상세 ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📍 사업 상세</h2>
            <div>
              <label className={labelCls}>사업 소재지 (시/도) <span className="text-red-500">*</span></label>
              <select className={inputCls} value={form.regionSido}
                onChange={e => setForm(f => ({ ...f, regionSido: e.target.value }))}>
                <option value="">선택하세요</option>
                {REGIONS_SIDO.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>사업 소재지 (시/군/구)</label>
              <input type="text" className={inputCls} value={form.regionSigungu}
                onChange={e => setForm(f => ({ ...f, regionSigungu: e.target.value }))}
                placeholder="예) 청주시 흥덕구" />
            </div>
            <div>
              <label className={labelCls}>설립일</label>
              <input type="date" className={inputCls} value={form.establishmentDate}
                onChange={e => setForm(f => ({ ...f, establishmentDate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>주요 제품·서비스</label>
              <input type="text" className={inputCls} value={form.mainProducts}
                onChange={e => setForm(f => ({ ...f, mainProducts: e.target.value }))}
                placeholder="예) 스마트 물류 소프트웨어, 금속 프레스 부품" />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">AI 상담과 지원사업 매칭 정확도를 높이는 데 사용됩니다.</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                🌏 수출 현황 <span className="text-indigo-400 text-xs font-normal">(수출바우처 등 매칭에 활용)</span>
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.hasExport}
                  onChange={e => setForm(f => ({ ...f, hasExport: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">현재 수출 중 (직·간접 수출 포함)</span>
              </label>
              {form.hasExport && (
                <div>
                  <label className={labelCls}>최근 연 수출 실적 (백만원)</label>
                  <input type="number" min="0" className={inputCls} value={form.annualExportAmount}
                    onChange={e => setForm(f => ({ ...f, annualExportAmount: e.target.value }))}
                    placeholder="예) 500 (5억원)" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: 규모 & 재무 ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📊 규모 & 재무</h2>
            <div>
              <label className={labelCls}>상시 근로자 수 (명)</label>
              <input type="number" min="0" className={inputCls} value={form.employeeCount}
                onChange={e => setForm(f => ({ ...f, employeeCount: e.target.value }))} placeholder="예) 15" />
            </div>
            <div>
              <label className={labelCls}>최근 연 매출 (백만원)</label>
              <input type="number" min="0" className={inputCls} value={form.annualRevenue}
                onChange={e => setForm(f => ({ ...f, annualRevenue: e.target.value }))} placeholder="예) 5000 (50억원)" />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>보유 인증</label>
              <div className="space-y-2">
                {[
                  { key: 'isVenture', label: '벤처기업 인증' },
                  { key: 'isInnobiz', label: '이노비즈(기술혁신형) 인증' },
                  { key: 'isMainbiz', label: '메인비즈(경영혁신형) 인증' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox"
                      checked={form[key as keyof FormState] as boolean}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.hasSmartFactory}
                    onChange={e => setForm(f => ({ ...f, hasSmartFactory: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">스마트공장 구축 완료</span>
                </label>
              </div>
            </div>
            {form.hasSmartFactory && (
              <div>
                <label className={labelCls}>스마트공장 수준</label>
                <select className={inputCls} value={form.smartFactoryLevel}
                  onChange={e => setForm(f => ({ ...f, smartFactoryLevel: e.target.value }))}>
                  <option value="">선택하세요</option>
                  {['기초(1수준)', '중간1(2수준)', '중간2(3수준)', '고도화(4수준)'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: 목표 & 현황 ── */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🎯 목표 & 현황</h2>
            <div>
              <label className={`${labelCls} mb-2`}>현재 가장 큰 어려움 (복수 선택)</label>
              <MultiSelect options={CHALLENGE_OPTIONS} selected={form.challenges}
                onChange={v => setForm(f => ({ ...f, challenges: v }))} />
            </div>
            <div>
              <label className={`${labelCls} mb-2`}>올해 사업 목표 (복수 선택)</label>
              <MultiSelect options={GOAL_OPTIONS} selected={form.goals}
                onChange={v => setForm(f => ({ ...f, goals: v }))} />
            </div>
            <div>
              <label className={labelCls}>기타 특이사항</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="추가로 알려주실 내용이 있다면 자유롭게 입력해 주세요."
              />
            </div>
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : backToList()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ChevronLeft size={16} /> {step > 1 ? '이전' : '목록으로'}
        </button>

        {step < 4 ? (
          <button
            onClick={() => {
              if (step === 1 && (!form.businessName || !form.businessType)) {
                setError('사업체명과 업태는 필수입니다.');
                return;
              }
              if (step === 2 && !form.regionSido) {
                setError('지역을 선택해 주세요.');
                return;
              }
              setError('');
              setStep(s => s + 1);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            다음 <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> 저장 중...</>
            ) : saved ? (
              <><CheckCircle size={16} /> 저장 완료!</>
            ) : (
              <><CheckCircle size={16} /> {mode === 'create' ? '프로필 저장' : '수정 완료'}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
