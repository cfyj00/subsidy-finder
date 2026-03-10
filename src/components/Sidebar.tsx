'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Newspaper, Search, User, MessageSquare, Sparkles,
  FileText, ClipboardList, LogOut, Sun, Moon, X, BookOpen, GraduationCap,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { useTheme } from '@/lib/theme';
import { NotificationBell } from './NotificationBell';

const NAV_ITEMS = [
  { href: '/briefing',     icon: Newspaper,      label: '지실장 브리핑' },
  { href: '/programs',     icon: Search,         label: '지원사업 검색' },
  { href: '/profile',      icon: User,           label: '사업 프로필' },
  { href: '/prompts',      icon: Sparkles,       label: 'AI 프롬프트' },
  { href: '/consultant',   icon: MessageSquare,  label: 'AI 상담' },
  { href: '/documents',    icon: FileText,       label: '서류 가이드' },
  { href: '/applications', icon: ClipboardList,  label: '지원 관리' },
  { href: '/learn',        icon: GraduationCap,  label: '지원사업 배우기' },
  { href: '/glossary',     icon: BookOpen,       label: '용어사전' },
];

interface SidebarProps {
  onClose?: () => void;
  mobile?: boolean;
}

export function Sidebar({ onClose, mobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login?message=signout');
    router.refresh();
  };

  return (
    <aside className="w-64 h-full flex flex-col sidebar-gradient">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-indigo-800/50">
        <Link href="/briefing" className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={onClose}>
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-base">🤝</div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">지실장</p>
            <p className="text-indigo-300 text-xs">소상공인·중소기업 지원사업</p>
          </div>
        </Link>
        {mobile && (
          <button onClick={onClose} className="text-indigo-300 hover:text-white p-1 ml-auto">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-indigo-800/50 space-y-1">
        <div className="flex items-center justify-between px-3 py-2">
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-200 hover:bg-indigo-800/50 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
