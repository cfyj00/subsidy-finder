'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Home, Search, ClipboardList, MessageSquare } from 'lucide-react';
import { Sidebar } from './Sidebar';

// ── 모바일 바텀 내비게이션 탭 ──────────────────────────────────────────────
const BOTTOM_TABS = [
  { href: '/briefing',     icon: Home,          label: '브리핑' },
  { href: '/programs',     icon: Search,         label: '지원사업' },
  { href: '/applications', icon: ClipboardList,  label: '지원관리' },
  { href: '/consultant',   icon: MessageSquare,  label: 'AI상담' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 flex-shrink-0 animate-slide-in">
            <Sidebar mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 sidebar-gradient text-white shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
            <Menu size={20} />
          </button>
          <Link href="/briefing" className="font-semibold text-sm hover:opacity-80 transition-opacity">
            🤝 지실장
          </Link>
        </header>

        {/* Page content — pb-16 on mobile to avoid bottom nav overlap */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 safe-bottom">
          <div className="flex items-stretch h-14">
            {BOTTOM_TABS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                    active
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
