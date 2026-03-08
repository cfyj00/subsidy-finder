'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
        <Bell size={28} className="text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">알림 센터</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-2">알림 기능은 Phase 3에서 제공됩니다.</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
        마감 D-7/3/1 알림, 신규 프로그램 알림, 상태 변경 알림을 Web Push로 받을 수 있습니다.
      </p>
      <Link href="/dashboard" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
        대시보드로 이동
      </Link>
    </div>
  );
}
