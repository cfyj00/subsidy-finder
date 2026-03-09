'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnread(count ?? 0);
    };

    load();

    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative p-2 rounded-lg hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
      aria-label={`알림${unread > 0 ? ` (읽지 않음 ${unread}개)` : ''}`}
    >
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
