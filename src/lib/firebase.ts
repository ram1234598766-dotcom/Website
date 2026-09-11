/**
 * Firebase client initialization for VantaOS.
 *
 * Firebase handles account sign-in / sign-out and mints a Google OAuth
 * access token that the Google Drive REST API can consume
 * (drive.readonly + drive.file). Its Cloud Firestore instance backs the
 * Forum and Admin data tier (src/lib/firestore.ts).
 *
 * All NEXT_PUBLIC_FIREBASE_* values are inlined at build time (static export).
 * If no Firebase project is configured, isFirebaseConfigured() returns false
 * and the app falls back to the local demo auth (src/lib/demoAuth.ts).
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  GithubAuthProvider,
  type User,
} from 'firebase/auth';

export type FirebaseUser = User;

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';

export function isFirebaseConfigured(): boolean {
  return !!(
    apiKey &&
    authDomain &&
    projectId &&
    appId &&
    !apiKey.includes('YOUR_') &&
    !authDomain.includes('placeholder')
  );
}

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in your environment.');
  }
  const existing = getApps()[0];
  app =
    existing ??
    initializeApp({
      apiKey,
      authDomain,
      projectId,
      appId,
      storageBucket: storageBucket || undefined,
      messagingSenderId: messagingSenderId || undefined,
    });
  return app;
}

export function getFireAuth() {
  return getAuth(getFirebaseApp());
}

/** Subscribe to Firebase auth state; returns an unsubscribe function. */
export function onFireAuthStateChanged(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFireAuth(), cb);
}

export function getCurrentFireUser(): User | null {
  return getFireAuth().currentUser;
}

export async function signUpWithEmail(email: string, password: string, username?: string): Promise<User> {
  const auth = getFireAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (username) {
    try {
      await updateProfile(credential.user, { displayName: username });
    } catch {
      // Non-fatal — display name is cosmetic.
    }
  }
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFireAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function sendPasswordResetLink(email: string): Promise<void> {
  const auth = getFireAuth();
  await sendPasswordResetEmail(auth, email);
}

export async function signOutOfFirebase(): Promise<void> {
  const auth = getFireAuth();
  await firebaseSignOut(auth);
}

export function buildGoogleProvider(withDriveScopes = false): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  if (withDriveScopes) {
    // read-only browse of the full Drive + write to app-created files only.
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
  }
  return provider;
}

export function buildGithubProvider(): GithubAuthProvider {
  const provider = new GithubAuthProvider();
  provider.addScope('user:email');
  provider.addScope('repo');
  return provider;
}

export async function runProviderSignIn(
  provider: GoogleAuthProvider | GithubAuthProvider
): Promise<{ user: User; accessToken: string | null }> {
  const auth = getFireAuth();
  const result = await signInWithPopup(auth, provider);
  const googleCred = GoogleAuthProvider.credentialFromResult(result);
  const githubCred = GithubAuthProvider.credentialFromResult(result);
  const accessToken = googleCred?.accessToken ?? githubCred?.accessToken ?? null;
  return { user: result.user, accessToken };
}

/** Map terse Firebase error codes to messages a non-expert can act on. */
export function friendlyFirebaseError(err: any): string {
  const code: string = err?.code || '';
  const map: Record<string, string> = {
    'auth/popup-closed-by-user': 'The sign-in window was closed before you finished. Try again.',
    'auth/cancelled-popup-request': 'The sign-in request was cancelled.',
    'auth/popup-blocked': 'The sign-in popup was blocked. Allow popups for this site and try again.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
    'auth/invalid-email': 'That email address doesn\u2019t look valid.',
    'auth/weak-password': 'Password is too weak — use at least 6 characters.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Invalid login credentials.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in your Firebase project.',
    'auth/account-exists-with-different-credential':
      'An account already exists with this email using a different sign-in method.',
    'auth/unauthorized-domain':
      'This domain isn\u2019t authorized for Firebase sign-in. Add it in Firebase console \u2192 Authentication \u2192 Authorized domains.',
  };
  return map[code] || err?.message || 'An unexpected error occurred. Please try again.';
}