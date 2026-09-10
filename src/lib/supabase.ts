/**
 * Unified auth / data client for VantaOS.
 *
 * AUTH (sign-in / sign-out): Firebase when configured (preferred), else the
 * real Supabase client, else the localStorage demo auth.
 * DATA (Forum + Admin metrics): kept on the optional @supabase/supabase-js
 * Postgres client — only reached when NEXT_PUBLIC_SUPABASE_URL is configured.
 *
 * The exported `supabase` object keeps the same surface consumers already use:
 *   supabase.auth.*  — unified firebase/supabase/demo session facade
 *   supabase.from()  — Supabase data queries (empty stubs when unconfigured)
 *   supabase.channel() / removeChannel() — realtime channels
 */

import { createClient, Session } from '@supabase/supabase-js';
import { demoSupabase, DemoUser as DemoUserType, isSupabaseConfigured as checkSupabaseEnv } from './demoAuth';
import {
  isFirebaseConfigured,
  getCurrentFireUser,
  onFireAuthStateChanged,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordResetLink,
  signOutOfFirebase,
  runProviderSignIn,
  buildGoogleProvider,
  buildGithubProvider,
  friendlyFirebaseError,
  type FirebaseUser,
} from './firebase';
import { clearDriveAccessToken } from './drive';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// Build-time inlined in static export — reliable on the client, unlike a
// runtime process.env read (which is undefined in the browser bundle).
const hasSupabase = checkSupabaseEnv() || !!(rawUrl && !rawUrl.includes('placeholder') && !rawUrl.includes('YOUR_'));
const hasFirebase = isFirebaseConfigured();

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

/* ------------------------------------------------------------------ */
/* Firebase-backed auth adapter                                       */
/* ------------------------------------------------------------------ */

type AuthSessionPayload = { data: { session: Session | null }; error: null };

async function buildSessionResult(user: FirebaseUser | null): Promise<AuthSessionPayload> {
  if (!user) return { data: { session: null }, error: null };
  const tokenResult = await user.getIdTokenResult();
  const claims = tokenResult.claims as Record<string, any>;
  const role = claims?.role || null;
  const username = user.displayName || (user.email ? user.email.split('@')[0] : '');
  const githubToken = (() => {
    try {
      return localStorage.getItem('github_token') || '';
    } catch {
      return '';
    }
  })();
  const session: Session = {
    access_token: tokenResult.token,
    refresh_token: '',
    token_type: 'Bearer',
    expires_at: Math.floor(new Date(tokenResult.expirationTime).getTime() / 1000),
    user: {
      id: user.uid,
      email: user.email || '',
      username,
      role,
      app_metadata: { role, provider: 'firebase' },
      user_metadata: { username, role },
      identities: [],
      aud: authDomainFallback(),
    },
  } as unknown as Session;
  if (githubToken) {
    (session as any).provider_token = githubToken;
  }
  return { data: { session }, error: null };
}

function authDomainFallback(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
}

function firebaseAuthValue(authProp: string) {
  switch (authProp) {
    case 'getSession': {
      return async () => buildSessionResult(getCurrentFireUser());
    }
    case 'getUser': {
      return async () => {
        const user = getCurrentFireUser();
        if (!user) return { data: { user: null }, error: null };
        const { data } = await buildSessionResult(user);
        return { data: { user: data.session?.user ?? null }, error: null };
      };
    }
    case 'refreshSession': {
      return async () => {
        const user = getCurrentFireUser();
        if (user) {
          try {
            await user.getIdToken(true);
          } catch {
            // Fall through — the cached id token may still be valid.
          }
        }
        return buildSessionResult(getCurrentFireUser());
      };
    }
    case 'onAuthStateChange': {
      return (callback: (event: string, session: Session | null) => void) => {
        let isFirst = true;
        const unsubscribe = onFireAuthStateChanged(async (user) => {
          const res = await buildSessionResult(user);
          const event = isFirst ? 'INITIAL_SESSION' : user ? 'SIGNED_IN' : 'SIGNED_OUT';
          isFirst = false;
          callback(event, res.data.session);
        });
        return {
          data: {
            subscription: { unsubscribe },
          },
        };
      };
    }
    case 'signUp': {
      return async ({ email, password, options }: any) => {
        try {
          const user = await signUpWithEmail(email, password, options?.data?.username);
          const { data } = await buildSessionResult(user);
          return {
            data: { user: data.session?.user ?? null, session: data.session ?? null },
            error: null,
          };
        } catch (err) {
          return { data: null, error: { message: friendlyFirebaseError(err) } };
        }
      };
    }
    case 'signInWithPassword': {
      return async ({ email, password }: any) => {
        try {
          const user = await signInWithEmail(email, password);
          const { data } = await buildSessionResult(user);
          return { data: { user: data.session?.user ?? null }, error: null };
        } catch (err) {
          return { data: null, error: { message: friendlyFirebaseError(err) } };
        }
      };
    }
    case 'signOut': {
      return async () => {
        try {
          await signOutOfFirebase();
        } catch {
          // Emptied session locally regardless.
        }
        clearDriveAccessToken();
        try {
          localStorage.removeItem('github_token');
        } catch {
          // ignore — storage may be unavailable
        }
      };
    }
    case 'signInWithOAuth': {
      return async ({ provider, options }: any) => {
        try {
          const githubScopes =
            typeof options?.scopes === 'string'
              ? options.scopes
              : (typeof options === 'string' ? options : '') || '';
          const scopesNeedGithub = githubScopes.toLowerCase().includes('repo');
          if (provider === 'github') {
            const { accessToken } = await runProviderSignIn(buildGithubProvider());
            if (accessToken) {
              try {
                localStorage.setItem('github_token', accessToken);
              } catch {
                // Token still on the session via the module-level read above.
              }
            }
            if (scopesNeedGithub && !accessToken) {
              return { data: null, error: { message: 'GitHub did not return an access token. Try again.' } };
            }
            return { data: { provider: 'github', url: null }, error: null };
          }
          if (provider === 'google') {
            await runProviderSignIn(buildGoogleProvider(false));
            return { data: { provider: 'google', url: null }, error: null };
          }
          return { data: null, error: { message: `Unsupported OAuth provider: ${String(provider)}` } };
        } catch (err) {
          return { data: null, error: { message: friendlyFirebaseError(err) } };
        }
      };
    }
    case 'resetPasswordForEmail': {
      return async (input: any) => {
        const email = typeof input === 'string' ? input : input?.email;
        if (!email) {
          return { data: null, error: { message: 'An email address is required.' } };
        }
        try {
          await sendPasswordResetLink(email);
          return { data: {}, error: null };
        } catch (err) {
          return { data: null, error: { message: friendlyFirebaseError(err) } };
        }
      };
    }
    default:
      return undefined;
  }
}

/* ------------------------------------------------------------------ */
// Exported unified auth interface
export const supabase = new Proxy(supabaseClient, {
  get(target, prop, receiver) {
    // Intercept 'auth' property to provide unified auth
    if (prop === 'auth') {
      return new Proxy(target.auth, {
        get(authTarget, authProp) {
          if (hasFirebase) {
            const value = firebaseAuthValue(authProp as string);
            if (value !== undefined) return value;
            // Unknown compat path — fall through to the real client.
            const fallback = (authTarget as any)[authProp];
            if (typeof fallback === 'function') return fallback.bind(authTarget);
            return fallback;
          }
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

export { hasSupabase, hasFirebase };

export function checkSupabaseConfig() {
  console.log('[VantaOS] Supabase configured:', hasSupabase, '| Firebase configured:', hasFirebase);
  return { configured: hasSupabase, firebase: hasFirebase };
}