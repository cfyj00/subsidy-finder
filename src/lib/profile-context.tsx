'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from './supabase-browser';
import type { Profile } from '@/types/database';

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  refresh: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  refresh: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, phone, is_premium, onboarding_done, created_at, active_business_profile_id')
      .eq('id', user.id)
      .single();
    setProfile(data as Profile | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
