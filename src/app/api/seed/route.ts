import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SEED_PROGRAMS } from '@/lib/seed-programs';

export async function POST() {
  // 1. 인증 확인 (일반 클라이언트)
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. 데이터 삽입은 admin 클라이언트 사용 (RLS 우회)
  const admin = createSupabaseAdmin();
  const results = { inserted: 0, skipped: 0, errors: [] as string[] };

  for (const program of SEED_PROGRAMS) {
    // 이미 있으면 스킵
    const { data: existing } = await admin
      .from('programs')
      .select('id')
      .eq('external_id', program.external_id)
      .maybeSingle();

    if (existing) {
      results.skipped++;
      continue;
    }

    const { error } = await admin.from('programs').insert(program);
    if (error) {
      results.errors.push(`${program.title}: ${error.message}`);
    } else {
      results.inserted++;
    }
  }

  return NextResponse.json({
    message: `시드 완료: ${results.inserted}개 삽입, ${results.skipped}개 스킵`,
    ...results,
  });
}
