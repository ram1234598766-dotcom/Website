/**
 * Unified auth client for VantaOS.
 *
 * AUTH (sign-in / sign-out): Firebase when configured (preferred), else the
 * localStorage demo auth. The Forum and Admin data tier lives in the Firebase
 * Realtime Database (src/lib/firestore.ts).
 *
 * The exported `client.auth.*` keeps the exact surface consumers already use:
 *   client.auth.getSession() / getUser() / onAuthStateChange() /
 *   refreshSession() / signUp() / signInWithPassword() / signInWithOAuth() /
 *   signOut() / resetPasswordForEmail()
 *
 * Engineered cases: when Firebase is unconfigured the existing demo-auth
 * behavior is preserved untouched. GitHub sessions prefer the Phase 5 token
 * boundary — a short-lived grant issued by the Worker — and fall back to a
 * memory-only, tab-scoped direct token when the Worker proxy is unreachable
 * so GitHub still works (see github.ts).
 */

import { demoAuth, DemoUser as DemoUserType } from './demoAuth';
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
import * as githubClient from './github';

/** Build-time inlined — reliable on the client, unlike a runtime env read. */
export const hasFirebase = isFirebaseConfigured();

if (hasFirebase) {
  githubClient.setFirebaseTokenGetter(async () => {
    const user = getCurrentFireUser();
    return user ? user.getIdToken() : null;
  });
}
githubClient.captureGitHubGrantFromUrl();

/* ------------------------------------------------------------------ */
/* Input validation helpers                                            */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return 'A valid email address is required.';
  }
  if (email.length > 254) return 'Email address is too long.';
  return null;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  if (password.length > 128) return 'Password is too long.';
  return null;
}

/* ------------------------------------------------------------------ */
/* Local session types for the unified client                         */
/* ------------------------------------------------------------------ */

export interface ClientSessionUser {
  id: string;
  email: string;
  username: string;
  role: string | null;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  identities: any[];
  aud: string;
  [key: string]: any;
}

export interface ClientSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;
  user: ClientSessionUser | null;
  provider_token?: string;
  [key: string]: any;
}

type SessionPayload = { data: { session: ClientSession | null }; error: null };

// Demo auth instance
let demoAuthInstance: Awaited<ReturnType<typeof demoAuth>> | null = null;
async function getDemoAuth() {
  if (!demoAuthInstance) {
    demoAuthInstance = await demoAuth();
  }
  return demoAuthInstance;
}

/* ------------------------------------------------------------------ */
/* Firebase-backed auth adapter                                        */
/* ------------------------------------------------------------------ */

async function buildSessionResult(user: FirebaseUser | null): Promise<SessionPayload> {
  if (!user) return { data: { session: null }, error: null };
  const tokenResult = await user.getIdTokenResult();
  const claims = tokenResult.claims as Record<string, any>;
  const role = claims?.role || null;
  const username = user.displayName || (user.email ? user.email.split('@')[0] : '');
  const session: ClientSession = {
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
  };
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
      return (callback: (event: string, session: ClientSession | null) => void) => {
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
        const emailErr = validateEmail(email);
        if (emailErr) return { data: null, error: { message: emailErr } };
        const passErr = validatePassword(password);
        if (passErr) return { data: null, error: { message: passErr } };
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
        const emailErr = validateEmail(email);
        if (emailErr) return { data: null, error: { message: emailErr } };
        const passErr = validatePassword(password);
        if (passErr) return { data: null, error: { message: passErr } };
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
          await githubClient.revokeGitHub();
        } catch {
          // Best-effort — grants are memory-only and die with this page anyway.
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
              const user = getCurrentFireUser();
              const firebaseToken = user ? await user.getIdToken() : null;
              if (!firebaseToken) {
                return { data: null, error: { message: 'No active cloud session to bind GitHub to.' } };
              }
              try {
                await githubClient.importGitHubAccessToken(firebaseToken, accessToken);
              } catch {
                // Worker proxy unreachable or not configured (`next dev`, no
                // KV/vars): keep the session working with a memory-only,
                // tab-scoped token instead of failing the whole sign-in.
                await githubClient.connectGitHubWithDirectToken(accessToken);
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
        const emailErr = validateEmail(email);
        if (emailErr) return { data: null, error: { message: emailErr } };
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
/* Demo fallback                                                       */
/* ------------------------------------------------------------------ */

async function demoGetSession() {
  const demo = await getDemoAuth();
  const result = await demo.auth.getSession();
  return { data: { session: (result as any).data?.session ?? null }, error: (result as any).error ?? null };
}

function demoAuthValue(authProp: string) {
  switch (authProp) {
    case 'signUp': {
      return async ({ email, password, options }: any) => {
        const emailErr = validateEmail(email);
        if (emailErr) return { data: null, error: { message: emailErr } };
        const passErr = validatePassword(password);
        if (passErr) return { data: null, error: { message: passErr } };
        const demo = await getDemoAuth();
        const result = await demo.auth.signUp(email, password, options?.data?.username);
        return { data: result.error ? null : { user: { id: '' as string, email } }, error: result.error ? { message: result.error } : null };
      };
    }
    case 'signInWithPassword': {
      return async ({ email, password }: any) => {
        const emailErr = validateEmail(email);
        if (emailErr) return { data: null, error: { message: emailErr } };
        const passErr = validatePassword(password);
        if (passErr) return { data: null, error: { message: passErr } };
        const demo = await getDemoAuth();
        const result = await demo.auth.signInWithPassword(email, password);
        return { data: result.error ? null : { user: { id: '' as string, email } }, error: result.error ? { message: result.error } : null };
      };
    }
    case 'signOut': {
      return async () => {
        const demo = await getDemoAuth();
        await demo.auth.signOut();
      };
    }
    case 'getSession': {
      return demoGetSession;
    }
    case 'onAuthStateChange': {
      return (callback: any) => {
        let realUnsubscribe: (() => void) | null = null;
        getDemoAuth().then((demo) => {
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
    case 'getUser': {
      return async () => {
        const result = await demoGetSession();
        return { data: { user: result.data.session }, error: result.error };
      };
    }
    case 'refreshSession': {
      return demoGetSession;
    }
    case 'signInWithOAuth': {
      return async ({ provider }: any) => {
        const demo = await getDemoAuth();
        const result = await demo.auth.oauthSignIn(provider === 'google' ? 'google' : 'github');
        if (result.error) return { data: null, error: { message: result.error } };
        return { data: { provider, url: null }, error: null };
      };
    }
    case 'resetPasswordForEmail': {
      return async ({ email }: any) => {
        const emailErr = validateEmail(email);
        if (emailErr) return { data: null, error: { message: emailErr } };
        const demo = await getDemoAuth();
        const result = await demo.auth.resetPasswordForEmail(email);
        return { data: result.error ? null : {}, error: result.error ? { message: result.error } : null };
      };
    }
    default:
      return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Exported unified auth interface                                     */
/* ------------------------------------------------------------------ */

export const client = {
  auth: new Proxy({} as Record<string, any>, {
    get: (_target, authProp) => {
      const prop = authProp as string;
      if (hasFirebase) {
        const value = firebaseAuthValue(prop);
        if (value !== undefined) return value;
        return undefined;
      }
      return demoAuthValue(prop);
    },
  }),
};

export function checkAuthConfig() {
  return { firebase: hasFirebase };
}

export type { DemoUserType as DemoUser };
