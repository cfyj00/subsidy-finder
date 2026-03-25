import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, CheckCircle, Search, MessageSquare, FileText, TrendingUp, MapPin, DollarSign, Clock } from 'lucide-react';
import type { Program } from '@/types/database';

export const metadata: Metadata = {
  title: '지실장 — 소상공인·중소기업 정부지원사업 AI 매칭',
  description: '소상공인·소기업·중소기업을 위한 정부지원사업 AI 매칭 서비스. 업종·지역·규모로 맞춤 보조금·융자·R&D 지원사업을 자동 추천. 5분 등록으로 내 사업에 딱 맞는 지원사업 찾기.',
  keywords: ['소상공인 지원사업', '중소기업 보조금', '정부지원사업', '소기업 융자', '창업 지원금', '스마트공장 지원', '수출 지원사업', 'R&D 지원', '지역 지원사업', '사업계획서 작성'],
  openGraph: {
    title: '지실장 — 내 사업에 맞는 정부지원사업, AI로 찾기',
    description: '소상공인·중소기업 정부지원사업 AI 매칭. 5분 등록으로 100점 만점 적합도 분석.',
    type: 'website',
  },
};

async function getFeaturedPrograms(): Promise<Program[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase
      .from('programs')
      .select('id, title, managing_org, category, support_type, target_regions, funding_amount_min, funding_amount_max, application_end, status, is_featured')
      .in('status', ['open', 'upcoming'])
      .order('is_featured', { ascending: false })
      .order('application_end', { ascending: true })
      .limit(6);
    return (data ?? []) as Program[];
  } catch {
    return [];
  }
}

const FEATURES = [
  { icon: Search, title: '맞춤 사업 매칭', desc: '업종·지역·규모·인증을 분석해 100점 만점 적합도로 최적 사업을 추천합니다.' },
  { icon: MessageSquare, title: 'AI 컨설턴트 상담', desc: 'AI가 지원사업 전문가처럼 사업계획서 작성부터 신청까지 안내합니다.' },
  { icon: FileText, title: '서류 자동 가이드', desc: '프로그램별 체크리스트와 핵심 템플릿으로 서류 준비 부담을 줄여드립니다.' },
  { icon: TrendingUp, title: '지원 현황 관리', desc: '준비→제출→심사→결과까지 모든 지원 현황을 한눈에 관리하세요.' },
];

const TESTIMONIALS = [
  { text: '컨설턴트 없이도 스마트공장 지원사업을 혼자 찾고 신청할 수 있었어요.', name: '충북 제조업 대표', company: '(주)○○정밀' },
  { text: '12개 부처 사업을 동시에 추적하는 게 이렇게 쉬울 줄 몰랐습니다.', name: '서울 서비스업 대표', company: '○○기술' },
  { text: 'AI가 사업계획서 작성을 도와줘서 처음 신청인데도 선정됐어요!', name: '경기 제조업 대표', company: '○○산업' },
];

const CATEGORIES = [
  { label: '소상공인 지원', q: '소상공인' },
  { label: '스마트공장', q: '스마트공장' },
  { label: 'R&D 기술개발', q: 'R&D' },
  { label: '수출·해외진출', q: '수출' },
  { label: '창업 지원', q: '창업' },
  { label: '인력·고용', q: '인력' },
  { label: '환경·에너지', q: '환경' },
  { label: '마케팅·판로', q: '마케팅' },
];

function ProgramCard({ program }: { program: Program }) {
  const daysLeft = program.application_end
    ? Math.ceil((new Date(program.application_end).getTime() - Date.now()) / 86400000)
    : null;
  const amount = program.funding_amount_max
    ? `최대 ${program.funding_amount_max.toLocaleString()}만원`
    : null;

  return (
    <Link href={`/p/${program.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-indigo-300 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">{program.category}</span>
        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
          <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
            <Clock size={10} />{daysLeft === 0 ? 'D-day' : `D-${daysLeft}`}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 group-hover:text-indigo-700 transition-colors line-clamp-2">
        {program.title}
      </h3>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="truncate">{program.managing_org}</span>
        {amount && (
          <span className="text-indigo-700 font-semibold flex items-center gap-0.5 shrink-0 ml-2">
            <DollarSign size={10} />{amount}
          </span>
        )}
      </div>
      {(program.target_regions ?? []).length > 0 && program.target_regions![0] !== '전국' && (
        <div className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
          <MapPin size={10} />{program.target_regions!.slice(0, 2).join(', ')}
        </div>
      )}
    </Link>
  );
}

export default async function LandingPage() {
  const featuredPrograms = await getFeaturedPrograms();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-base">🤝</div>
            <div>
              <span className="font-bold text-gray-900 text-base leading-tight">지실장</span>
              <p className="text-xs text-gray-400 leading-tight hidden sm:block">소상공인·소기업·중소기업 지원사업</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">로그인</Link>
            <Link href="/signup" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors">
              무료 시작
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold mb-6">
            🎯 소상공인·중소기업 맞춤 정부지원사업 AI 매칭
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            내 사업에 딱 맞는<br />
            <span className="text-indigo-600">정부지원사업</span>을 찾아드려요
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            소상공인부터 중소기업까지, 전문 컨설턴트 없이도 괜찮아요.<br />
            AI 지실장이 보조금·융자·R&D 지원사업을 내 업종·지역·규모에 맞게 찾아드립니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link href="/signup"
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-base transition-colors shadow-lg shadow-indigo-200">
              무료로 지원사업 찾기 <ArrowRight size={18} />
            </Link>
            <Link href="#programs"
              className="flex items-center justify-center gap-2 px-8 py-3.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold text-base transition-colors">
              최신 지원사업 보기
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
            {['무료 서비스', '5분 등록', '즉시 결과', '카드 불필요'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-500" />{t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 카테고리 검색 */}
      <section className="py-8 px-4 border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm text-gray-500 mb-4">어떤 지원이 필요하세요?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map(({ label, q }) => (
              <Link key={label} href={`/signup?category=${q}`}
                className="px-4 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 rounded-full text-sm font-medium text-gray-700 transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 최신 지원사업 */}
      {featuredPrograms.length > 0 && (
        <section id="programs" className="py-14 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">지금 모집 중인 지원사업</h2>
              <p className="text-gray-500 text-sm">로그인 없이 바로 확인할 수 있어요</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {featuredPrograms.map(p => <ProgramCard key={p.id} program={p} />)}
            </div>
            <div className="text-center">
              <Link href="/signup"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                내 사업 맞춤으로 더 보기 <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 기능 소개 */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">전문 컨설턴트 없이도 OK</h2>
            <p className="text-gray-500">복잡한 정부지원 절차를 AI가 처음부터 끝까지 안내합니다.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-indigo-950 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">3단계로 지원사업 신청까지</h2>
            <p className="text-indigo-300 text-sm">소상공인·소기업·중소기업 누구나 쉽게</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '01', title: '사업 프로필 등록', desc: '업종, 지역, 규모, 목표 입력. 5분이면 충분.' },
              { step: '02', title: 'AI 매칭 분석', desc: '100점 만점 적합도로 최적 지원사업 자동 추천.' },
              { step: '03', title: 'AI 상담 + 신청', desc: 'AI가 서류 준비부터 사업계획서까지 함께.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-lg font-bold mx-auto mb-4">{step}</div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-indigo-300 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 후기 */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">실제 사용 후기</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ text, name, company }) => (
              <div key={name} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <p className="text-gray-700 text-sm leading-relaxed mb-4">&ldquo;{text}&rdquo;</p>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{name}</div>
                  <div className="text-xs text-gray-400">{company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 최종 CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">지금 바로 내 사업 맞춤 분석 받기</h2>
          <p className="text-indigo-200 mb-8">가입비·구독료 없이 무료로 시작할 수 있어요.</p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold transition-colors">
            무료로 시작하기 <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤝</span>
            <span className="text-sm font-medium text-gray-700">지실장</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 지실장. 소상공인·소기업·중소기업을 응원합니다 💙</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/login" className="hover:text-gray-600">로그인</Link>
            <Link href="/signup" className="hover:text-gray-600">회원가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
