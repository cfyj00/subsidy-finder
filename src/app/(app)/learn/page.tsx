'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown, ChevronUp, BookOpen, Lightbulb, Target,
  FileText, Clock, Trophy, AlertCircle, CheckCircle2, ArrowRight,
  Building2, Users, TrendingUp, Zap,
} from 'lucide-react';
import { DAILY_TIPS } from '@/lib/constants';

// ── 학습 콘텐츠 정의 ────────────────────────────────────────────────────────

interface LearnItem {
  id: string;
  icon: React.ReactNode;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  content: React.ReactNode;
}

const LEARN_ITEMS: LearnItem[] = [
  {
    id: 'what',
    icon: <BookOpen size={20} />,
    emoji: '📖',
    title: '정부지원사업이란?',
    subtitle: '개념부터 종류까지 한눈에 이해해요',
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    content: (
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>
          정부지원사업은 <strong className="text-gray-900 dark:text-white">중앙정부·지방자치단체·공공기관</strong>이
          소상공인·소기업·중소기업의 성장을 돕기 위해 제공하는 다양한 지원 프로그램이에요.
          자금 지원부터 기술 개발, 인력 채용, 수출 지원까지 종류가 매우 다양해요.
        </p>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-3">📌 지원사업의 주요 종류</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: '💰', name: '보조금', desc: '갚지 않아도 되는 직접 지원금' },
              { emoji: '🏦', name: '융자·대출', desc: '저금리 정책 자금 대출' },
              { emoji: '🎟️', name: '바우처', desc: '특정 서비스 이용권 지급' },
              { emoji: '🏭', name: '현물지원', desc: '장비·시설 무상 제공/설치' },
              { emoji: '🎓', name: '교육·컨설팅', desc: '전문가 자문·교육 지원' },
              { emoji: '📉', name: '세제감면', desc: '세금 감면·공제 혜택' },
            ].map(item => (
              <div key={item.name} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50">
                <span className="text-lg">{item.emoji}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-xs">{item.name}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
          <p className="font-semibold text-indigo-800 dark:text-indigo-200 mb-2">💡 핵심 포인트</p>
          <ul className="space-y-1.5 text-indigo-700 dark:text-indigo-300 text-sm">
            <li>• 한 기업이 여러 사업에 동시에 지원하는 것이 가능해요 (부처가 다를 때)</li>
            <li>• 연간 수천억 원 규모의 예산이 집행되지 못하고 남는 경우가 많아요</li>
            <li>• 신청하지 않으면 받을 수 없어요 — 아는 사람만 받는 혜택이에요</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'who',
    icon: <Users size={20} />,
    emoji: '🏢',
    title: '누가 받을 수 있나요?',
    subtitle: '소상공인 · 소기업 · 중소기업 기준 한번에 정리',
    color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    content: (
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <div className="space-y-3">
          {[
            {
              type: '소상공인',
              emoji: '🛒',
              color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
              badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
              criteria: '상시 근로자 5인 미만 (제조·건설·운수 등은 10인 미만)',
              examples: '동네 음식점, 소매점, 미용실, 카페 등',
              programs: '소상공인시장진흥공단, 전통시장 지원, 온라인 판로 지원',
            },
            {
              type: '소기업',
              emoji: '🏪',
              color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
              badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
              criteria: '상시 근로자 50인 미만 (업종에 따라 다름)',
              examples: '성장 초기 제조업체, 식품 가공업체 등',
              programs: '중소기업부, 지역 소기업 지원사업',
            },
            {
              type: '중기업',
              emoji: '🏭',
              color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
              badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
              criteria: '상시 근로자 300인 미만, 매출 또는 자산 기준 충족',
              examples: '중견 규모 제조·IT·서비스 기업',
              programs: 'R&D 지원, 수출바우처, 스마트공장 고도화',
            },
          ].map(item => (
            <div key={item.type} className={`rounded-xl p-4 border ${item.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{item.emoji}</span>
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${item.badge}`}>{item.type}</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-1"><strong>기준:</strong> {item.criteria}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">예) {item.examples}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">주요 지원: {item.programs}</p>
            </div>
          ))}
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200">
          ⚠️ <strong>주의:</strong> 기업 규모 기준은 업종마다 다를 수 있어요. 프로필을 등록하면 지실장이 자동으로 해당 기준을 확인해드려요.
        </div>
      </div>
    ),
  },
  {
    id: 'when',
    icon: <Clock size={20} />,
    emoji: '📅',
    title: '언제 신청하나요?',
    subtitle: '분기별 공고 시기와 준비 타이밍',
    color: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
    content: (
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>정부지원사업은 <strong className="text-gray-900 dark:text-white">연중 상시 모집하는 사업</strong>도 있지만, 대부분은 <strong className="text-gray-900 dark:text-white">분기별로 공고</strong>가 나와요.</p>

        <div className="space-y-2">
          {[
            { month: '1~2월', label: '상반기 준비', color: 'bg-blue-500', tip: '연간 계획 수립, 서류 미리 준비. 신년도 예산이 풀리는 시기로 공고가 집중돼요!' },
            { month: '4~5월', label: '봄 시즌', color: 'bg-emerald-500', tip: '상반기 핵심 공고 시기. 스마트공장·바우처 등 주요 사업이 이 시기에 공고돼요.' },
            { month: '7~8월', label: '하반기 준비', color: 'bg-amber-500', tip: '상반기 미집행 예산 추가 공고. 경쟁률이 조금 낮은 경우도 있어요.' },
            { month: '10~11월', label: '연말 시즌', color: 'bg-red-500', tip: '연말 집중 공고 + 내년도 사전 안내. 다음 해 준비를 미리 시작하기 좋은 시기예요.' },
          ].map(item => (
            <div key={item.month} className="flex items-start gap-3 bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
              <div className={`shrink-0 ${item.color} text-white rounded-lg px-2 py-1.5 text-xs font-bold min-w-[56px] text-center`}>
                {item.month}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-xs mb-0.5">{item.label}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{item.tip}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300">
          💡 <strong>팁:</strong> 소상공인시장진흥공단의 <strong>온라인 진흥원 사업</strong>과 중소기업부의 <strong>스마트공장</strong> 사업은 매년 1~2월에 공고가 나와요. 미리 체크해두세요!
        </div>
      </div>
    ),
  },
  {
    id: 'process',
    icon: <TrendingUp size={20} />,
    emoji: '🔄',
    title: '신청부터 지원금 수령까지',
    subtitle: '전체 프로세스 7단계 한눈에 보기',
    color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <div className="space-y-2">
          {[
            { step: '1', title: '공고 확인', desc: '기업마당·소상공인마당에서 공고 확인 → 지원 자격 검토', time: '마감 2~4주 전', color: 'bg-indigo-500' },
            { step: '2', title: '서류 준비', desc: '사업자등록증·재무제표·기타 필수 서류 발급', time: '마감 1~2주 전', color: 'bg-blue-500' },
            { step: '3', title: '사업계획서 작성', desc: '양식에 맞춰 사업계획서·견적서 등 작성', time: '마감 1주 전', color: 'bg-cyan-500' },
            { step: '4', title: '온라인 신청', desc: '해당 기관 홈페이지 또는 정부24에서 접수', time: '마감일까지', color: 'bg-emerald-500' },
            { step: '5', title: '서류 심사', desc: '기관에서 서류 검토. 보완 요청이 올 수 있어요', time: '접수 후 2~4주', color: 'bg-amber-500' },
            { step: '6', title: '현장 심사/발표', desc: '심사위원 면접 또는 현장 방문 심사', time: '서류 심사 후', color: 'bg-orange-500' },
            { step: '7', title: '협약 체결 & 집행', desc: '선정 통보 → 협약서 체결 → 사업비 집행 → 결과 보고', time: '선정 후 4~6개월', color: 'bg-rose-500' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className={`${item.color} text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5`}>
                {item.step}
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.title}</p>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{item.time}</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'strategy',
    icon: <Target size={20} />,
    emoji: '🎯',
    title: '합격률 높이는 5가지 전략',
    subtitle: '컨설턴트들이 말하는 합격 비법',
    color: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
    content: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        {[
          {
            num: '①',
            title: '자격 조건부터 꼭 확인하세요',
            desc: '업종·기업 규모·업력·매출 기준이 맞지 않으면 아무리 좋은 계획서도 탈락해요. 신청 전에 꼭 확인하세요.',
            emoji: '🔍',
          },
          {
            num: '②',
            title: '경쟁률 낮은 사업부터 시작하세요',
            desc: '지역 사업·기관 자체 사업은 국가 사업보다 경쟁률이 낮아요. 첫 합격 경험을 쌓는 것이 중요해요.',
            emoji: '🌟',
          },
          {
            num: '③',
            title: '담당자에게 전화해보세요',
            desc: '사업 공고 기관에 전화 한 통이 큰 차이를 만들어요. 심사 중점사항, 가점 항목을 미리 알 수 있어요.',
            emoji: '📞',
          },
          {
            num: '④',
            title: '수치로 구체적으로 작성하세요',
            desc: '"매출 증가 예상"보다 "1년 내 매출 20% 증가, 고용 2명 창출"처럼 구체적 수치가 훨씬 설득력 있어요.',
            emoji: '📊',
          },
          {
            num: '⑤',
            title: '서류는 마감 3일 전에 제출하세요',
            desc: '마감 당일은 시스템 오류·자료 오류가 많아요. 여유 있게 제출하고 보완 요청에 대비하세요.',
            emoji: '⏰',
          },
        ].map(item => (
          <div key={item.num} className="flex items-start gap-3 bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-gray-100 dark:border-slate-700">
            <div className="shrink-0 w-8 h-8 bg-rose-100 dark:bg-rose-900/40 rounded-full flex items-center justify-center text-sm font-bold text-rose-600 dark:text-rose-400">
              {item.emoji}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-1">{item.num} {item.title}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'bizplan',
    icon: <FileText size={20} />,
    emoji: '✍️',
    title: '사업계획서 잘 쓰는 법',
    subtitle: '심사위원이 원하는 계획서의 비밀',
    color: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
    content: (
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-3">📋 계획서의 황금 구조</p>
          <div className="space-y-2">
            {[
              { step: '1. 현황 및 문제점', desc: '우리 회사의 현재 상황과 해결이 필요한 문제를 명확하게 기술해요', icon: '🔍' },
              { step: '2. 해결 방안 (지원 요청)', desc: '이 사업을 통해 어떻게 문제를 해결할지 구체적으로 설명해요', icon: '💡' },
              { step: '3. 추진 계획 (일정·예산)', desc: '언제, 무엇을, 얼마에 할지 월별 계획과 예산 내역을 작성해요', icon: '📅' },
              { step: '4. 기대 효과', desc: '지원 후 매출·고용·기술 향상 등 구체적인 수치로 효과를 제시해요', icon: '📈' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-2">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{item.step}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-100 dark:border-teal-800">
          <p className="font-semibold text-teal-800 dark:text-teal-200 mb-2">✅ 합격 계획서의 특징</p>
          <ul className="space-y-1.5 text-teal-700 dark:text-teal-300 text-xs leading-relaxed">
            <li>• 심사위원이 이해하기 쉬운 <strong>쉬운 용어</strong>로 작성</li>
            <li>• "약 30% 향상 예상"처럼 <strong>구체적인 수치</strong> 포함</li>
            <li>• 사진·도표·도면으로 <strong>시각화</strong>된 내용</li>
            <li>• 우리 회사만의 <strong>차별점과 강점</strong> 강조</li>
            <li>• 사업비 집행 계획이 <strong>현실적이고 구체적</strong></li>
          </ul>
        </div>

        <div className="rounded-xl p-3 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-xs text-indigo-700 dark:text-indigo-300">
          🤖 막막하다면 <strong>AI 상담</strong> 메뉴에서 사업계획서 작성을 함께 진행해 드려요!
        </div>
      </div>
    ),
  },
  {
    id: 'mistakes',
    icon: <AlertCircle size={20} />,
    emoji: '⚠️',
    title: '절대 하면 안 되는 실수들',
    subtitle: '이것만 피해도 합격률이 올라가요',
    color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    content: (
      <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
        {[
          { emoji: '❌', mistake: '자격 조건 확인 안 하고 신청', result: '서류 심사에서 바로 탈락. 시간과 노력이 낭비돼요.' },
          { emoji: '❌', mistake: '마감 당일 서류 제출', result: '시스템 오류, 서류 누락 시 보완 불가. 반드시 3일 전에 제출하세요.' },
          { emoji: '❌', mistake: '현금으로 사업비 집행', result: '지원금 환수 대상이 될 수 있어요. 반드시 계좌이체·카드 결제만 사용하세요.' },
          { emoji: '❌', mistake: '협약서 내용 꼼꼼히 안 읽음', result: '용도 외 집행, 기한 초과 등으로 지원금을 돌려줘야 할 수 있어요.' },
          { emoji: '❌', mistake: '세금·4대보험 미납 상태로 신청', result: '대부분의 지원사업에서 납세·보험료 완납 증명이 필수예요.' },
          { emoji: '❌', mistake: '사업계획서를 복사·붙여넣기', result: '심사위원은 비슷한 계획서를 수백 개 읽어요. 우리 회사만의 내용으로 작성하세요.' },
        ].map(item => (
          <div key={item.mistake} className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-gray-100 dark:border-slate-700">
            <div className="flex items-start gap-2">
              <span className="text-lg">{item.emoji}</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{item.mistake}</p>
                <p className="text-orange-600 dark:text-orange-400 text-xs leading-relaxed">→ {item.result}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

// ── 메인 ──────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [openId, setOpenId] = useState<string | null>('what');
  const randomTips = [...DAILY_TIPS].sort(() => 0.5 - Math.random()).slice(0, 4);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-1">
          <BookOpen size={13} />
          <span>지원사업 배우기</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          정부지원사업 가이드 📚
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
          처음이어도 괜찮아요. 지실장이 정부지원사업의 개념부터 합격 전략까지 쉽게 설명해 드려요.
        </p>
      </div>

      {/* 학습 아이템 */}
      <div className="space-y-3 mb-8">
        {LEARN_ITEMS.map(item => (
          <div
            key={item.id}
            className={`rounded-2xl border overflow-hidden transition-all ${item.color}`}
          >
            {/* 아코디언 헤더 */}
            <button
              onClick={() => setOpenId(openId === item.id ? null : item.id)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="text-2xl shrink-0">{item.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
                  {item.title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.subtitle}</p>
              </div>
              <div className="shrink-0 text-gray-400 dark:text-gray-500">
                {openId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {/* 아코디언 내용 */}
            {openId === item.id && (
              <div className="px-4 pb-5 border-t border-white/30 dark:border-slate-700/50 pt-4">
                {item.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 오늘의 팁 모음 */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500" /> 지실장 꿀팁 모음
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">총 {DAILY_TIPS.length}개</span>
        </div>
        <div className="space-y-3">
          {randomTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
              <CheckCircle2 size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 CTA */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/programs"
          className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Zap size={15} /> 지원사업 찾기
        </Link>
        <Link
          href="/consultant"
          className="flex items-center justify-center gap-2 py-3.5 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl text-sm font-semibold transition-colors"
        >
          <BookOpen size={15} /> AI에게 물어보기
        </Link>
      </div>

    </div>
  );
}
