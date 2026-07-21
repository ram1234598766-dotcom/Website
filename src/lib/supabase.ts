import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
// Strip /rest/v1 or /rest/v1/ if the user accidentally provided it as the base URL
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function checkSupabaseConfig() {
  console.log('Supabase Configuration Check:');
  console.log('- URL is set:', supabaseUrl !== 'https://placeholder.supabase.co');
  console.log('- Key is set:', supabaseKey !== 'placeholder');
  console.log('- Raw URL:', rawUrl);
  return {
    urlSet: supabaseUrl !== 'https://placeholder.supabase.co',
    keySet: supabaseKey !== 'placeholder'
  };
}
