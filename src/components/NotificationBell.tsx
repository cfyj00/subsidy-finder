'use client';

import { Bell } from 'lucide-react';

export function NotificationBell() {
  return (
    <button
      className="relative p-2 rounded-lg hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
      aria-label="알림"
    >
      <Bell size={20} />
    </button>
  );
}
