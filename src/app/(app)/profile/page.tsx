'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { useProfile } from '@/lib/profile-context';
import {
  REGIONS_SIDO, BUSINESS_TYPES, CHALLENGE_OPTIONS, GOAL_OPTIONS
} from '@/lib/constants';
import { Building2, MapPin, Users, Target, CheckCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

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
              done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
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

function MultiSelect({ options, selected, onChange, label }: {
  options: readonly string[];
  selected: string[];
  onChange: (v: string[]) => void;
  label?: string;
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

export default function ProfilePage() {
  const router = useRouter();
  const { profile, refresh } = useProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [regionSido, setRegionSido] = useState('');
  const [regionSigungu, setRegionSigungu] = useState('');
  const [establishmentDate, setEstablishmentDate] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [isVenture, setIsVenture] = useState(false);
  const [isInnobiz, setIsInnobiz] = useState(false);
  const [isMainbiz, setIsMainbiz] = useState(false);
  const [hasSmartFactory, setHasSmartFactory] = useState(false);
  const [smartFactoryLevel, setSmartFactoryLevel] = useState('');
  const [businessEntityType, setBusinessEntityType] = useState('');
  const [hasExport, setHasExport] = useState(false);
  const [annualExportAmount, setAnnualExportAmount] = useState('');
  const [mainProducts, setMainProducts] = useState('');
  const [challenges, setChallenges] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Load existing profile
  useEffect(() => {
    const loadExisting = async () => {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).single();
      if (data) {
        setBusinessName(data.business_name || '');
        setRepresentativeName(data.representative_name || '');
        setBusinessRegNumber(data.business_reg_number || '');
        setBusinessType(data.business_type || '');
        setBusinessCategory(data.business_category || '');
        setRegionSido(data.region_sido || '');
        setRegionSigungu(data.region_sigungu || '');
        setEstablishmentDate(data.establishment_date || '');
        setEmployeeCount(data.employee_count?.toString() || '');
        setAnnualRevenue(data.annual_revenue?.toString() || '');
        setIsVenture(data.is_venture || false);
        setIsInnobiz(data.is_innobiz || false);
        setIsMainbiz(data.is_mainbiz || false);
        setHasSmartFactory(data.has_smart_factory || false);
        setSmartFactoryLevel(data.smart_factory_level || '');
        setBusinessEntityType(data.business_entity_type || '');
        setHasExport(data.has_export || false);
        setAnnualExportAmount(data.annual_export_amount?.toString() || '');
        setMainProducts(data.main_products || '');
        setChallenges(data.current_challenges || []);
        setGoals(data.goals || []);
        setNotes(data.notes || '');
      }
    };
    loadExisting();
  }, []);

  // Calculate company age from establishment date
  const getCompanyAge = () => {
    if (!establishmentDate) return null;
    const estDate = new Date(establishmentDate);
    const now = new Date();
    return Math.floor((now.getTime() - estDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
  };

  const handleSave = async () => {
    if (!businessName || !businessType || !regionSido) {
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
      business_name: businessName,
      representative_name: representativeName || null,
      business_reg_number: businessRegNumber || null,
      business_type: businessType,
      business_category: businessCategory || null,
      region_sido: regionSido,
      region_sigungu: regionSigungu || null,
      establishment_date: establishmentDate || null,
      company_age_years: getCompanyAge(),
      employee_count: employeeCount ? parseInt(employeeCount) : null,
      annual_revenue: annualRevenue ? parseInt(annualRevenue) : null,
      is_venture: isVenture,
      is_innobiz: isInnobiz,
      is_mainbiz: isMainbiz,
      has_smart_factory: hasSmartFactory,
      smart_factory_level: smartFactoryLevel || null,
      business_entity_type: businessEntityType || null,
      has_export: hasExport,
      annual_export_amount: annualExportAmount ? parseInt(annualExportAmount) : null,
      main_products: mainProducts || null,
      current_challenges: challenges,
      goals,
      notes: notes || null,
    };

    const { error: upsertError } = await supabase
      .from('business_profiles')
      .upsert(payload, { onConflict: 'user_id' });

    if (upsertError) {
      setError('저장 실패: ' + upsertError.message);
      setSaving(false);
      return;
    }

    // Mark onboarding done
    await supabase.from('profiles').update({ onboarding_done: true }).eq('id', user.id);
    refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.push('/dashboard');
    }, 1500);
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">사업 프로필 설정</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">정확한 정보를 입력할수록 더 적합한 지원사업을 매칭해 드립니다.</p>
      </div>

      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm animate-fade-in">
        {/* Step 1: 기본 정보 */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 기본 정보</h2>
            <div>
              <label className={labelCls}>사업체명 <span className="text-red-500">*</span></label>
              <input type="text" className={inputCls} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="예) 홍길동 정밀가공" />
            </div>
            <div>
              <label className={labelCls}>대표자명</label>
              <input type="text" className={inputCls} value={representativeName} onChange={e => setRepresentativeName(e.target.value)} placeholder="예) 홍길동" />
            </div>
            <div>
              <label className={labelCls}>사업자등록번호</label>
              <input type="text" className={inputCls} value={businessRegNumber} onChange={e => setBusinessRegNumber(e.target.value)} placeholder="123-45-67890" />
            </div>
            <div>
              <label className={labelCls}>기업 형태 <span className="text-indigo-400 text-xs font-normal ml-1">(지원 자격에 영향)</span></label>
              <select className={inputCls} value={businessEntityType} onChange={e => setBusinessEntityType(e.target.value)}>
                <option value="">선택하세요</option>
                {['개인사업자', '법인', '협동조합', '사회적기업', '기타'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">많은 지원사업이 법인/개인사업자를 구분해 모집합니다.</p>
            </div>
            <div>
              <label className={labelCls}>업태 <span className="text-red-500">*</span></label>
              <select className={inputCls} value={businessType} onChange={e => setBusinessType(e.target.value)}>
                <option value="">선택하세요</option>
                {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>업종 (세부)</label>
              <input type="text" className={inputCls} value={businessCategory} onChange={e => setBusinessCategory(e.target.value)} placeholder="예) 금속가공, 플라스틱 사출" />
            </div>
          </div>
        )}

        {/* Step 2: 사업 상세 */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📍 사업 상세</h2>
            <div>
              <label className={labelCls}>사업 소재지 (시/도) <span className="text-red-500">*</span></label>
              <select className={inputCls} value={regionSido} onChange={e => setRegionSido(e.target.value)}>
                <option value="">선택하세요</option>
                {REGIONS_SIDO.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>사업 소재지 (시/군/구)</label>
              <input type="text" className={inputCls} value={regionSigungu} onChange={e => setRegionSigungu(e.target.value)} placeholder="예) 청주시 흥덕구" />
            </div>
            <div>
              <label className={labelCls}>설립일</label>
              <input type="date" className={inputCls} value={establishmentDate} onChange={e => setEstablishmentDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>주요 제품·서비스</label>
              <input type="text" className={inputCls} value={mainProducts} onChange={e => setMainProducts(e.target.value)} placeholder="예) 스마트 물류 소프트웨어, 금속 프레스 부품" />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">AI 상담과 지원사업 매칭 정확도를 높이는 데 사용됩니다.</p>
            </div>
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                🌏 수출 현황 <span className="text-indigo-400 text-xs font-normal">(수출바우처 등 매칭에 활용)</span>
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasExport}
                  onChange={e => setHasExport(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">현재 수출 중 (직·간접 수출 포함)</span>
              </label>
              {hasExport && (
                <div>
                  <label className={labelCls}>최근 연 수출 실적 (백만원)</label>
                  <input
                    type="number" min="0"
                    className={inputCls}
                    value={annualExportAmount}
                    onChange={e => setAnnualExportAmount(e.target.value)}
                    placeholder="예) 500 (5억원)"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: 규모 & 재무 */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📊 규모 & 재무</h2>
            <div>
              <label className={labelCls}>상시 근로자 수 (명)</label>
              <input type="number" min="0" className={inputCls} value={employeeCount} onChange={e => setEmployeeCount(e.target.value)} placeholder="예) 15" />
            </div>
            <div>
              <label className={labelCls}>최근 연 매출 (백만원)</label>
              <input type="number" min="0" className={inputCls} value={annualRevenue} onChange={e => setAnnualRevenue(e.target.value)} placeholder="예) 5000 (50억원)" />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>보유 인증</label>
              <div className="space-y-2">
                {[
                  { key: 'venture', label: '벤처기업 인증', val: isVenture, set: setIsVenture },
                  { key: 'innobiz', label: '이노비즈(기술혁신형) 인증', val: isInnobiz, set: setIsInnobiz },
                  { key: 'mainbiz', label: '메인비즈(경영혁신형) 인증', val: isMainbiz, set: setIsMainbiz },
                ].map(({ key, label, val, set }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={e => set(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasSmartFactory}
                    onChange={e => setHasSmartFactory(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">스마트공장 구축 완료</span>
                </label>
              </div>
            </div>
            {hasSmartFactory && (
              <div>
                <label className={labelCls}>스마트공장 수준</label>
                <select className={inputCls} value={smartFactoryLevel} onChange={e => setSmartFactoryLevel(e.target.value)}>
                  <option value="">선택하세요</option>
                  {['기초(1수준)', '중간1(2수준)', '중간2(3수준)', '고도화(4수준)'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Step 4: 목표 & 현황 */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🎯 목표 & 현황</h2>
            <div>
              <label className={`${labelCls} mb-2`}>현재 가장 큰 어려움 (복수 선택)</label>
              <MultiSelect options={CHALLENGE_OPTIONS} selected={challenges} onChange={setChallenges} />
            </div>
            <div>
              <label className={`${labelCls} mb-2`}>올해 사업 목표 (복수 선택)</label>
              <MultiSelect options={GOAL_OPTIONS} selected={goals} onChange={setGoals} />
            </div>
            <div>
              <label className={labelCls}>기타 특이사항</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="추가로 알려주실 내용이 있다면 자유롭게 입력해 주세요."
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={16} /> 이전
        </button>

        {step < 4 ? (
          <button
            onClick={() => {
              if (step === 1 && (!businessName || !businessType)) {
                setError('사업체명과 업태는 필수입니다.');
                return;
              }
              if (step === 2 && !regionSido) {
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
              <><CheckCircle size={16} /> 프로필 저장</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
