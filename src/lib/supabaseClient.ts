import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// If env vars aren't set, create a dummy client that logs warnings
// instead of crashing the app
let supabase: ReturnType<typeof createClient>;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase env vars not configured. Forum, auth, and sync features will be unavailable.',
      { url: !!supabaseUrl, key: !!supabaseAnonKey }
    );
    // Create with dummy values — it won't work but won't crash either
    supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key');
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (e) {
  console.warn('Supabase client creation failed:', e);
  // Stand-in object so imports don't crash
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };