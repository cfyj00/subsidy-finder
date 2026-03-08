import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { ProfileProviderWrapper } from '@/components/ProfileProviderWrapper';
import { AppShell } from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <ProfileProviderWrapper>
      <AppShell>{children}</AppShell>
    </ProfileProviderWrapper>
  );
}
