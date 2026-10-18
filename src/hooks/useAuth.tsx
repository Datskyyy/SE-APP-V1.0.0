import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { supabase } from '../services/supabase';
import { AppUser, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = async (authUser: any) => {
    if (!authUser) {
      setUser(null);
      return;
    }

    let { data: profile } = await supabase
      .from('users')
      .select('id, email, full_name, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    // Self-heal profile tables in case DB trigger is absent/disabled.
    if (!profile) {
      const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';

      await supabase.from('users').upsert({
        id: authUser.id,
        email: authUser.email,
        full_name: fullName
      });

      await supabase.from('streaks').upsert({
        user_id: authUser.id,
        current_streak: 0,
        longest_streak: 0,
        last_activity_date: null
      });

      await supabase.from('progress').upsert({
        user_id: authUser.id,
        completion_rate: 0,
        total_reviewers: 0,
        total_quizzes: 0
      });

      const { data: refreshedProfile } = await supabase
        .from('users')
        .select('id, email, full_name, created_at')
        .eq('id', authUser.id)
        .maybeSingle();

      profile = refreshedProfile;
    }

    setUser({
      id: authUser.id,
      email: profile?.email || authUser.email,
      fullName: profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      createdAt: profile?.created_at
    });
  };

  const refreshUser = async () => {
    const { data } = await supabase.auth.getSession();
    await syncUser(data.session?.user ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await syncUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await syncUser(session?.user ?? null);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      signIn: authService.signIn,
      signUp: authService.signUp,
      signOut: authService.signOut,
      resetPassword: authService.resetPassword,
      refreshUser
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
