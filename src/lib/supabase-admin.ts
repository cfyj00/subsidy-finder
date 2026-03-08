import { createClient } from '@supabase/supabase-js';

// Service Role 클라이언트 — RLS 우회, 서버 사이드에서만 사용
// 절대 클라이언트(브라우저)에 노출 금지
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase admin credentials missing in environment variables');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
