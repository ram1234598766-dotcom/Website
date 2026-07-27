import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Only initialize if Firebase hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Graceful auth initialization — wraps in try/catch so a missing/invalid
// Firebase project doesn't crash the entire application.
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

try {
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase Auth initialization failed:', e);
}

try {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn('Firebase Firestore initialization failed:', e);
}

export { auth, db };
