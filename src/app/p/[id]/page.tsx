// 공개 지원사업 상세 페이지 — 로그인 불필요, 구글 SEO 인덱싱 대상
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowRight, Building2, MapPin, Calendar, DollarSign, Users, Tag, ExternalLink, CheckCircle } from 'lucide-react';
import type { Program } from '@/types/database';

// 서버 전용 Supabase (공개 데이터 조회)
function getPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getProgram(id: string): Promise<Program | null> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from('programs')
    .select('id, title, managing_org, category, subcategory, support_type, target_regions, target_industries, target_company_size, min_employee_count, max_employee_count, funding_amount_min, funding_amount_max, application_start, application_end, status, description, eligibility_summary, detail_url, is_featured, typical_open_month')
    .eq('id', id)
    .single();
  return data as Program | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) return { title: '지원사업 정보 — 지실장' };

  const amount = program.funding_amount_max
    ? ` (최대 ${program.funding_amount_max.toLocaleString()}만원)`
    : '';
  const region = (program.target_regions ?? []).length > 0 && program.target_regions![0] !== '전국'
    ? ` [${program.target_regions!.slice(0, 2).join('·')}]`
    : '';

  return {
    title: `${program.title}${region} — 지실장`,
    description: `${program.managing_org ?? ''} | ${program.category} | ${program.support_type ?? ''}${amount}. ${(program.eligibility_summary ?? program.description ?? '').slice(0, 120)}`,
    keywords: [
      program.title,
      program.category,
      program.support_type ?? '',
      program.managing_org ?? '',
      '소상공인 지원사업',
      '중소기업 보조금',
      '정부지원사업',
      ...(program.target_regions ?? []).slice(0, 2),
    ].filter(Boolean),
    openGraph: {
      title: `${program.title} — 지실장`,
      description: `${program.category} · ${program.support_type ?? ''}${amount}`,
      type: 'article',
    },
  };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open:     { label: '모집중', cls: 'bg-emerald-100 text-emerald-700' },
    upcoming: { label: '예정',   cls: 'bg-blue-100 text-blue-700' },
    closed:   { label: '마감',   cls: 'bg-gray-100 text-gray-500' },
    expected: { label: '상시예정', cls: 'bg-violet-100 text-violet-700' },
    always:   { label: '상시',   cls: 'bg-teal-100 text-teal-700' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex items-center gap-1.5 text-gray-500 text-sm w-28 shrink-0">{icon}<span>{label}</span></div>
      <div className="text-sm text-gray-800 font-medium">{children}</div>
    </div>
  );
}

export default async function PublicProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getProgram(id);

  if (!program) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">사업 정보를 찾을 수 없습니다.</p>
          <Link href="/" className="text-indigo-600 hover:underline">← 홈으로</Link>
        </div>
      </div>
    );
  }

  const daysLeft = program.application_end
    ? Math.ceil((new Date(program.application_end).getTime() - Date.now()) / 86400000)
    : null;
  const amount = program.funding_amount_max
    ? `최대 ${program.funding_amount_max.toLocaleString()}만원`
    : program.funding_amount_min
    ? `${program.funding_amount_min.toLocaleString()}만원~`
    : null;

  // JSON-LD 구조화 데이터
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: program.title,
    provider: { '@type': 'Organization', name: program.managing_org ?? '정부기관' },
    description: program.eligibility_summary ?? program.description ?? '',
    areaServed: (program.target_regions ?? []).length > 0 ? program.target_regions!.join(', ') : '대한민국 전국',
    url: program.detail_url ?? '',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-sm">🤝</div>
            <span className="font-bold text-gray-900 text-sm">지실장</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">로그인</Link>
            <Link href="/signup" className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              무료 시작
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* 브레드크럼 */}
        <nav className="text-sm text-gray-400 mb-4">
          <Link href="/" className="hover:text-indigo-600">지실장</Link>
          <span className="mx-2">›</span>
          <Link href="/programs" className="hover:text-indigo-600">지원사업</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-600">{program.category}</span>
        </nav>

        {/* 메인 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-4">
          {/* 배지 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{program.category}</span>
            <StatusBadge status={program.status} />
            {program.is_featured && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">⭐ 추천</span>}
            {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {daysLeft === 0 ? 'D-day' : `D-${daysLeft}`}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-2">{program.title}</h1>

          {program.managing_org && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
              <Building2 size={14} />
              <span>{program.managing_org}</span>
            </div>
          )}

          {/* 핵심 정보 */}
          <div className="space-y-3 border-t border-gray-100 pt-5">
            {amount && (
              <InfoRow icon={<DollarSign size={14} />} label="지원금액">
                <span className="text-indigo-700 font-bold">{amount}</span>
              </InfoRow>
            )}
            {program.support_type && (
              <InfoRow icon={<Tag size={14} />} label="지원유형">{program.support_type}</InfoRow>
            )}
            {(program.target_regions ?? []).length > 0 && (
              <InfoRow icon={<MapPin size={14} />} label="대상지역">
                {program.target_regions![0] === '전국' ? '전국' : program.target_regions!.join(', ')}
              </InfoRow>
            )}
            {(program.target_company_size ?? []).length > 0 && (
              <InfoRow icon={<Users size={14} />} label="대상기업">{program.target_company_size!.join(', ')}</InfoRow>
            )}
            {program.application_end && (
              <InfoRow icon={<Calendar size={14} />} label="신청마감">
                {new Date(program.application_end).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                {daysLeft !== null && daysLeft >= 0 && <span className="ml-2 text-red-500 font-semibold">({daysLeft === 0 ? '오늘 마감' : `${daysLeft}일 남음`})</span>}
              </InfoRow>
            )}
          </div>

          {/* 원문 링크 */}
          {program.detail_url && (
            <a href={program.detail_url} target="_blank" rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <ExternalLink size={14} /> 공식 공고문 보기
            </a>
          )}
        </div>

        {/* 사업 개요 */}
        {(program.description || program.eligibility_summary) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3">사업 개요</h2>
            {program.eligibility_summary && (
              <p className="text-sm text-gray-700 leading-relaxed mb-3 p-3 bg-blue-50 rounded-xl">
                <span className="font-semibold text-blue-700">신청 자격: </span>{program.eligibility_summary}
              </p>
            )}
            {program.description && (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {program.description.slice(0, 800)}{program.description.length > 800 ? '...' : ''}
              </p>
            )}
          </div>
        )}

        {/* ── CTA: 핵심 전환 구간 ─────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white mb-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold mb-2">이 사업, 우리 회사에 맞을까요?</h2>
            <p className="text-indigo-200 text-sm leading-relaxed">
              사업프로필 5분 등록하면 AI가 <strong className="text-white">100점 만점 적합도</strong>로 분석해드립니다.<br />
              지원자격 충족 여부, 필요 서류, 사업계획서 작성까지 한번에.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={`/signup?next=/programs/${program.id}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-indigo-700 rounded-xl font-semibold text-sm hover:bg-indigo-50 transition-colors">
              무료로 AI 매칭 분석 받기 <ArrowRight size={16} />
            </Link>
            <Link href="/login"
              className="flex items-center justify-center gap-2 py-3 px-4 border border-indigo-400 text-white rounded-xl text-sm hover:bg-indigo-700 transition-colors">
              이미 회원이에요
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-indigo-300">
            {['무료 서비스', '5분 등록', '즉시 결과 확인', '카드 등록 불필요'].map(t => (
              <span key={t} className="flex items-center gap-1"><CheckCircle size={11} />{t}</span>
            ))}
          </div>
        </div>

        {/* 지실장 소개 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
          <p className="text-sm text-gray-500 mb-1">지실장은 소상공인·소기업·중소기업을 위한</p>
          <p className="text-sm font-semibold text-gray-800">AI 정부지원사업 매칭 서비스입니다 🤝</p>
        </div>
      </main>
    </div>
  );
}
