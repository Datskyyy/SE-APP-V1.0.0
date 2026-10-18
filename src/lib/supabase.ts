import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20));