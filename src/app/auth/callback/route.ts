import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Check if user has a business profile (new user detection)
      const { data: bp } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!bp) {
        // New user: go to onboarding
        return NextResponse.redirect(`${origin}/profile?welcome=true`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?message=error`);
}
