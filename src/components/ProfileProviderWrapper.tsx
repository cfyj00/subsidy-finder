'use client';

import { Suspense } from 'react';
import { ProfileProvider } from '@/lib/profile-context';

export function ProfileProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ProfileProvider>{children}</ProfileProvider>
    </Suspense>
  );
}
