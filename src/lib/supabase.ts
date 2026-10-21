import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or publishable key is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.');
}

export const publicSupabaseUrl = supabaseUrl;
export const publicSupabaseAnonKey = supabaseAnonKey;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
