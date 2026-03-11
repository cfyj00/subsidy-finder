'use client';

import { Suspense } from 'react';
import { ProfileProvider } from '@/lib/profile-context';
import { BusinessProfileProvider } from '@/lib/business-profile-context';

export function ProfileProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ProfileProvider>
        <BusinessProfileProvider>
          {children}
        </BusinessProfileProvider>
      </ProfileProvider>
    </Suspense>
  );
}
