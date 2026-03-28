'use client';

import Link from 'next/link';
import { Check, X, Sparkles, Lock } from 'lucide-react';

const COMPARISON = [
  { feature: '지원사업 검색·필터',   free: true,            paid: true },
  { feature: 'AI 프롬프트 생성',     free: '종합 상담 1종',  paid: '5종 전체' },
  { feature: '서류 체크리스트',      free: true,            paid: true },
  { feature: '지원 관리 트래커',     free: true,            paid: true },
  { feature: 'AI 채팅 (직접 대화)',  free: false,           paid: '무제한' },
  { feature: '마감 알림 이메일',     free: false,           paid: '준비 중' },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true)  return <Check size={16} className="text-emerald-500 mx-auto" />;
  if (value === false) return <X size={16} className="text-gray-300 dark:text-gray-600 mx-auto" />;
  return <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{value}</span>;
}

export default function UpgradePage() {
  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium mb-4">
          <Sparkles size={12} /> 지실장 플랜
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">더 많은 기회를 잡으세요</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">커피 한 잔 값으로 AI 상담 무제한 + 마감 알림까지</p>
      </div>

      {/* 비교 테이블 */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden mb-6">
        <div className="grid grid-cols-3 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">기능</div>
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">무료</div>
          <div className="px-4 py-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 text-center">₩4,900/월</div>
        </div>
        {COMPARISON.map(({ feature, free, paid }) => (
          <div key={feature} className="grid grid-cols-3 border-b border-gray-100 dark:border-slate-700/50 last:border-0">
            <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 flex items-center">{feature}</div>
            <div className="px-4 py-3 flex items-center justify-center"><Cell value={free} /></div>
            <div className="px-4 py-3 flex items-center justify-center bg-indigo-50/30 dark:bg-indigo-900/10"><Cell value={paid} /></div>
          </div>
        ))}
      </div>

      {/* 유료 플랜 카드 */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-indigo-200 text-sm mb-1">AI 채팅 플랜</p>
            <p className="text-3xl font-bold">₩4,900<span className="text-lg font-normal text-indigo-300">/월</span></p>
            <p className="text-xs text-indigo-300 mt-0.5">연간 결제 시 ₩3,900/월 (2개월 무료)</p>
          </div>
          <div className="bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
            커피 한 잔 ☕
          </div>
        </div>
        <div className="w-full py-3 bg-white text-indigo-700 rounded-xl text-sm font-semibold text-center opacity-75 cursor-not-allowed flex items-center justify-center gap-2">
          <Lock size={14} /> 결제 시스템 준비 중
        </div>
      </div>

      {/* 얼리버드 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 text-center mb-6">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">🎉 얼리버드 준비 중</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          결제 시스템 오픈 전 가입하신 분께 첫 3개월 50% 할인 혜택을 드릴 예정이에요.
        </p>
      </div>

      {/* 자주 묻는 질문 */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">❓ 자주 묻는 질문</p>
        <div className="space-y-3 text-xs text-gray-600 dark:text-gray-400">
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-0.5">언제 결제가 가능해지나요?</p>
            <p>결제 시스템 구축이 완료되는 대로 안내드려요. 얼리버드 혜택을 위해 미리 가입해 두세요!</p>
          </div>
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-0.5">환불이 되나요?</p>
            <p>결제 후 7일 이내 전액 환불이 가능해요. 단, 서비스를 실제로 이용한 경우 제외될 수 있어요.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-0.5">AI 채팅은 하루에 몇 번 쓸 수 있나요?</p>
            <p>프리미엄 플랜은 AI 채팅 무제한 이용이 가능해요. 무료 플랜은 AI 프롬프트 기능을 이용하세요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
