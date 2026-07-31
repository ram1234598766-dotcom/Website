/**
 * Unified Supabase / Demo Auth client.
 *
 * When NEXT_PUBLIC_SUPABASE_URL is configured, uses the real Supabase client.
 * Otherwise, falls back to a localStorage-based demo auth that works entirely
 * in the browser.
 */

import { createClient, Session } from '@supabase/supabase-js';
import { demoSupabase, DemoUser as DemoUserType, isSupabaseConfigured as checkSupabaseEnv } from './demoAuth';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// Build-time inlined in static export — reliable on the client, unlike a
// runtime process.env read (which is undefined in the browser bundle).
const hasSupabase = checkSupabaseEnv() || !!(rawUrl && !rawUrl.includes('placeholder') && !rawUrl.includes('YOUR_'));

// Create supabase client (placeholder if not configured — only ever reached
// by the demo auth fall-through paths, never used for real network calls).
const supabaseClient: ReturnType<typeof createClient> = hasSupabase
  ? createClient(supabaseUrl, supabaseKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

// Demo auth instance
let demoAuthInstance: Awaited<ReturnType<typeof demoSupabase>> | null = null;
async function getDemoAuth() {
  if (!demoAuthInstance) {
    demoAuthInstance = await demoSupabase();
  }
  return demoAuthInstance;
}

// Exported unified auth interface
export const supabase = new Proxy(supabaseClient, {
  get(target, prop, receiver) {
    // Intercept 'auth' property to provide unified auth
    if (prop === 'auth') {
      return new Proxy(target.auth, {
        get(authTarget, authProp) {
          if (hasSupabase) {
            // Use real Supabase
            const value = (authTarget as any)[authProp];
            if (typeof value === 'function') {
              return value.bind(authTarget);
            }
            return value;
          } else {
            // Use demo auth - return async functions
            if (authProp === 'signUp') {
              return async ({ email, password, options }: any) => {
                const demo = await getDemoAuth();
                const result = await demo.auth.signUp(email, password, options?.data?.username);
                return { data: result.error ? null : { user: { id: '', email } }, error: result.error ? { message: result.error } : null };
              };
            }
            if (authProp === 'signInWithPassword') {
              return async ({ email, password }: any) => {
                const demo = await getDemoAuth();
                const result = await demo.auth.signInWithPassword(email, password);
                return { data: result.error ? null : { user: { id: '', email } }, error: result.error ? { message: result.error } : null };
              };
            }
            if (authProp === 'signOut') {
              return async () => {
                const demo = await getDemoAuth();
                await demo.auth.signOut();
              };
            }
            if (authProp === 'getSession') {
              return async () => {
                const demo = await getDemoAuth();
                return demo.auth.getSession();
              };
            }
            if (authProp === 'onAuthStateChange') {
              return (callback: any) => {
                let realUnsubscribe: (() => void) | null = null;
                getDemoAuth().then(demo => {
                  const sub = demo.auth.onAuthStateChange(callback);
                  realUnsubscribe = sub.data.subscription.unsubscribe;
                });
                return {
                  data: {
                    subscription: {
                      unsubscribe: () => realUnsubscribe?.(),
                    },
                  },
                };
              };
            }
            if (authProp === 'getUser') {
              return async () => {
                const demo = await getDemoAuth();
                const session = await demo.auth.getSession();
                return { data: { user: session.data.session }, error: session.error };
              };
            }
            if (authProp === 'refreshSession') {
              return async () => {
                const demo = await getDemoAuth();
                return demo.auth.getSession();
              };
            }
            if (authProp === 'signInWithOAuth') {
              return async () => ({
                data: null,
                error: { message: 'GitHub OAuth requires a configured Supabase project.' },
              });
            }
            if (authProp === 'resetPasswordForEmail') {
              return async ({ email }: any) => {
                const demo = await getDemoAuth();
                const result = await demo.auth.resetPasswordForEmail(email);
                return { data: result.error ? null : {}, error: result.error ? { message: result.error } : null };
              };
            }
            // Fall through to original
            const value = (authTarget as any)[authProp];
            if (typeof value === 'function') {
              return value.bind(authTarget);
            }
            return value;
          }
        }
      });
    }
    // Handle from or channel methods normally
    if (prop === 'from') {
      if (!hasSupabase) {
        // Return a proxy that returns empty data for all queries
        return (table: string) => {
          const queryBuilder = {
            select: (...args: any[]) => ({
              ...queryBuilder,
              data: [],
              error: null,
              eq: () => queryBuilder,
              order: () => queryBuilder,
              then: (resolve: any) => resolve({ data: [], error: null, count: 0 }),
            }),
            insert: (...args: any[]) => ({
              ...queryBuilder,
              data: null,
              error: null,
              select: () => queryBuilder,
              then: (resolve: any) => resolve({ data: [], error: null }),
            }),
            update: (...args: any[]) => ({
              ...queryBuilder,
              data: null,
              error: null,
              eq: () => queryBuilder,
              then: (resolve: any) => resolve({ data: [], error: null }),
            }),
            delete: (...args: any[]) => ({
              ...queryBuilder,
              data: null,
              error: null,
              eq: () => queryBuilder,
              then: (resolve: any) => resolve({ data: [], error: null }),
            }),
            // For count queries
            then: (resolve: any) => resolve({ data: [], error: null, count: 0 }),
          };
          return queryBuilder;
        };
      }
      return (target as any).from.bind(target);
    }
    if (prop === 'channel') {
      if (!hasSupabase) {
        return () => ({
          on: () => ({ subscribe: () => {} }),
          subscribe: () => {},
        });
      }
      return (target as any).channel.bind(target);
    }
    if (prop === 'removeChannel') {
      if (!hasSupabase) return () => {};
      return (target as any).removeChannel.bind(target);
    }
    const value = (target as any)[prop];
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  }
});

export { hasSupabase };

export function checkSupabaseConfig() {
  console.log('[VantaOS] Supabase configured:', hasSupabase);
  return { configured: hasSupabase };
}
