import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient>;

try {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase env vars not configured. Using placeholder client.');
    supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.warn('Supabase client creation failed:', e);
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };

export function checkSupabaseConfig() {
  console.log('Supabase Configuration Check:');
  console.log('- URL is set:', !!supabaseUrl);
  console.log('- Key is set:', !!supabaseKey);
  return {
    urlSet: !!supabaseUrl,
    keySet: !!supabaseKey
  };
}