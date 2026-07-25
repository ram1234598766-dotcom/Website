import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function checkSupabaseConfig() {
  console.log('Supabase Configuration Check:');
  console.log('- URL is set:', !!supabaseUrl);
  console.log('- Key is set:', !!supabaseKey);
  return {
    urlSet: !!supabaseUrl,
    keySet: !!supabaseKey
  };
}