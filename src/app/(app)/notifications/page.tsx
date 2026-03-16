'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import {
  Bell, BellOff, Clock, Sparkles, CheckCheck,
  ChevronRight, Loader2, Trash2, Check,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; iconCls: string }> = {
  deadline:      { icon: Clock,    bg: 'bg-red-100 dark:bg-red-900/30',       iconCls: 'text-red-500' },
  new_match:     { icon: Sparkles, bg: 'bg-indigo-100 dark:bg-indigo-900/30', iconCls: 'text-indigo-500' },
  status_change: { icon: Check,    bg: 'bg-green-100 dark:bg-green-900/30',   iconCls: 'text-green-500' },
  tip:           { icon: Bell,     bg: 'bg-amber-100 dark:bg-amber-900/30',   iconCls: 'text-amber-500' },
};

function typeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.tip;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)  return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr  < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7)  return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export default function NotificationsPage() {
  const [items,   setItems]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    const supabase = getSupabaseBrowser();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const deleteNotif = async (id: string) => {
    const supabase = getSupabaseBrowser();
    await supabase.from('notifications').delete().eq('id', id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const displayed = filter === 'unread' ? items.filter((n) => !n.is_read) : items;
  const unreadCount = items.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Bell className="text-amber-600 dark:text-amber-400" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">알림 센터</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모두 읽음'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            <CheckCheck size={15} /> 모두 읽음
          </button>
        )}
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {f === 'all' ? `전체 ${items.length}` : `읽지 않음 ${unreadCount}`}
          </button>
        ))}
      </div>

      {/* 알림 목록 */}
      {displayed.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <BellOff size={40} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {filter === 'unread' ? '읽지 않은 알림이 없어요' : '알림이 없어요'}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
            지원사업을 북마크하거나 지원 신청을 등록하면<br />
            마감 D-7·D-3·D-1 알림을 받을 수 있어요.
          </p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            지원사업 찾기 <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((n) => {
            const cfg  = typeConfig(n.type);
            const Icon = cfg.icon;

            const inner = (
              <div
                className={`group relative flex items-start gap-3.5 p-4 rounded-xl border transition-all ${
                  n.is_read
                    ? 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50 shadow-sm'
                }`}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                  <Icon size={17} className={cfg.iconCls} />
                </div>
                <div className="flex-1 min-w-0 pr-10">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${n.is_read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                      {n.title}
                    </p>
                    <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {n.body}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="absolute top-4 right-12 w-2 h-2 rounded-full bg-indigo-500" />
                )}
                <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                  {!n.is_read && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }}
                      className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                      title="읽음 표시"
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotif(n.id); }}
                    className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );

            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => { if (!n.is_read) markRead(n.id); }}
              >
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-4">
          알림은 최근 100개까지 표시됩니다.
        </p>
      )}
    </div>
  );
}
