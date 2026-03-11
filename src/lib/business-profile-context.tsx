'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from './supabase-browser';
import type { BusinessProfile } from '@/types/database';

interface BusinessProfileContextValue {
  /** 현재 활성 프로필 (매칭/AI 상담에 사용) */
  activeProfile: BusinessProfile | null;
  /** 사용자의 모든 프로필 목록 */
  allProfiles: BusinessProfile[];
  loading: boolean;
  refresh: () => void;
  /** 특정 프로필을 활성으로 설정 */
  setActive: (profileId: string) => Promise<void>;
  /** 프로필 삭제 */
  deleteProfile: (profileId: string) => Promise<void>;
}

const BusinessProfileContext = createContext<BusinessProfileContextValue>({
  activeProfile: null,
  allProfiles: [],
  loading: true,
  refresh: () => {},
  setActive: async () => {},
  deleteProfile: async () => {},
});

export function BusinessProfileProvider({ children }: { children: React.ReactNode }) {
  const [allProfiles, setAllProfiles] = useState<BusinessProfile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAllProfiles([]);
      setActiveProfileState(null);
      setLoading(false);
      return;
    }

    // 모든 프로필 로드
    const { data: profiles } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    // profiles 테이블에서 active_business_profile_id 조회
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('active_business_profile_id')
      .eq('id', user.id)
      .single();

    const all = (profiles ?? []) as BusinessProfile[];
    setAllProfiles(all);

    if (userProfile?.active_business_profile_id) {
      const active = all.find(p => p.id === userProfile.active_business_profile_id);
      setActiveProfileState(active ?? all[0] ?? null);
    } else {
      // active 미설정 시 첫 번째 프로필을 기본 사용
      setActiveProfileState(all[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const setActive = useCallback(async (profileId: string) => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ active_business_profile_id: profileId })
      .eq('id', user.id);

    const found = allProfiles.find(p => p.id === profileId);
    if (found) setActiveProfileState(found);
  }, [allProfiles]);

  const deleteProfile = useCallback(async (profileId: string) => {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('business_profiles')
      .delete()
      .eq('id', profileId)
      .eq('user_id', user.id); // RLS 이중 보호

    // 삭제된 게 active였으면 다른 프로필로 전환
    if (activeProfile?.id === profileId) {
      const remaining = allProfiles.filter(p => p.id !== profileId);
      const next = remaining[0] ?? null;
      if (next) {
        await supabase
          .from('profiles')
          .update({ active_business_profile_id: next.id })
          .eq('id', user.id);
        setActiveProfileState(next);
      } else {
        await supabase
          .from('profiles')
          .update({ active_business_profile_id: null })
          .eq('id', user.id);
        setActiveProfileState(null);
      }
    }

    setAllProfiles(prev => prev.filter(p => p.id !== profileId));
  }, [activeProfile, allProfiles]);

  return (
    <BusinessProfileContext.Provider value={{
      activeProfile,
      allProfiles,
      loading,
      refresh: fetchProfiles,
      setActive,
      deleteProfile,
    }}>
      {children}
    </BusinessProfileContext.Provider>
  );
}

export const useBusinessProfile = () => useContext(BusinessProfileContext);
