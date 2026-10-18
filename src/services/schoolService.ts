import { supabase } from './supabase';

export const schoolService = {
  listUsers: async () => supabase.from('users').select('*').order('created_at', { ascending: false }),
  listActivities: async (userId: string) =>
    supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  listGeneratedContent: async (userId: string) =>
    supabase.from('generated_content').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  listProgress: async (userId: string) => supabase.from('progress').select('*').eq('user_id', userId).maybeSingle(),
  listStreak: async (userId: string) => supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle()
};
