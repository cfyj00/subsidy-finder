import Link from 'next/link';
import { ArrowRight, CheckCircle, Search, MessageSquare, FileText, TrendingUp } from 'lucide-react';

const FEATURES = [
  { icon: Search, title: '맞춤 사업 매칭', desc: '업종·지역·규모·인증을 분석해 100점 만점 적합도로 최적 사업을 추천합니다.' },
  { icon: MessageSquare, title: 'AI 컨설턴트 상담', desc: 'Claude AI가 지원사업 전문가처럼 사업계획서 작성부터 신청까지 안내합니다.' },
  { icon: FileText, title: '서류 자동 가이드', desc: '프로그램별 체크리스트와 핵심 템플릿으로 서류 준비 부담을 줄여드립니다.' },
  { icon: TrendingUp, title: '지원 현황 관리', desc: '준비→제출→심사→결과까지 모든 지원 현황을 한눈에 관리하세요.' },
];

const TESTIMONIALS = [
  { text: '컨설턴트 없이도 스마트공장 지원사업을 혼자 찾고 신청할 수 있었어요.', name: '충북 제조업 대표', company: '(주)○○정밀' },
  { text: '12개 부처 사업을 동시에 추적하는 게 이렇게 쉬울 줄 몰랐습니다.', name: '서울 서비스업 대표', company: '○○기술' },
  { text: 'AI가 사업계획서 작성을 도와줘서 처음 신청인데도 선정됐어요!', name: '경기 제조업 대표', company: '○○산업' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-base">🤝</div>
            <div>
              <span className="font-bold text-gray-900 dark:text-white text-base leading-tight">지실장</span>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">소상공인·소기업·중소기업 지원사업</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium transition-colors">
              로그인
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              무료 시작
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4 bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-950/50 dark:to-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight mb-4">
            정부지원 사업엔,<br />
            <span className="text-indigo-600">함께가요 지실장!</span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 font-medium mb-6">
            소상공인부터 중소기업까지, 지실장이 함께해요 🤝
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            전문 컨설턴트 없어도 괜찮아요.<br />
            AI 지실장이 내 사업에 딱 맞는 지원사업을 찾고, 신청까지 함께 도와드릴게요 😊
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-base transition-colors"
            >
              무료로 시작하기 <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 px-8 py-3.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-base transition-colors"
            >
              로그인
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-10 text-sm text-gray-500 dark:text-gray-400">
            {['무료 서비스', '5분 프로필 등록', '20개+ 지원사업 DB', 'AI 매칭 분석'].map(badge => (
              <span key={badge} className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-500" /> {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">전문 컨설턴트 없이도 OK</h2>
            <p className="text-gray-500 dark:text-gray-400">복잡한 정부지원 절차를 AI가 처음부터 끝까지 안내합니다.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-indigo-950 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">3단계로 완성</h2>
            <p className="text-indigo-300">소상공인·소기업·중소기업 누구나 쉽게 신청할 수 있습니다.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '01', title: '프로필 등록', desc: '업종, 지역, 규모, 목표를 입력하세요. 5분이면 충분합니다.' },
              { step: '02', title: 'AI 매칭 분석', desc: '100점 만점 적합도로 최적의 지원사업을 자동 추천합니다.' },
              { step: '03', title: '신청 & 관리', desc: 'AI가 서류 준비부터 신청 현황 관리까지 함께합니다.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {step}
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-indigo-300 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">실제 사용 후기</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ text, name, company }) => (
              <div key={name} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">&ldquo;{text}&rdquo;</p>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">{name}</div>
                  <div className="text-xs text-gray-400">{company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">지실장과 함께 시작해요 🤝</h2>
          <p className="text-indigo-200 mb-8">소상공인·소기업·중소기업 모두 환영해요. 회원가입 후 5분이면 딱 맞는 지원사업을 추천받을 수 있어요.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl font-semibold transition-colors"
          >
            무료로 시작하기 <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤝</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-400">지실장</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © 2026 지실장. 소상공인·소기업·중소기업을 응원합니다 💙
          </p>
        </div>
      </footer>
    </div>
  );
}
