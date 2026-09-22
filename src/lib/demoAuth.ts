/**
 * DemoAuth — A memory-only authentication system that works
 * entirely in the browser without any external service.
 *
 * Used only when no Firebase project is configured
 * (NEXT_PUBLIC_FIREBASE_* unset). Passwords are hashed with PBKDF2
 * (Web Crypto) with per-user salts before storage. No plaintext
 * passwords are ever persisted.
 */

export interface DemoUser {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  role?: string;
}

interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  role?: string;
}

interface ResetTokenEntry {
  token: string;
  expiresAt: number;
}

const USERS_KEY = 'vantaos_demo_users';
const SESSION_KEY = 'vantaos_demo_session';

let memoryUsers: StoredUser[] = [];
let memorySession: Omit<DemoUser, never> | null = null;
const memoryResetTokens = new Map<string, ResetTokenEntry>();

// ─── Rate limiting ──────────────────────────────────────────────────

const MAX_ATTEMPTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const rateLimitStore = new Map<string, Array<number>>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const attempts = rateLimitStore.get(key) ?? [];
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentAttempts = attempts.filter(t => t > windowStart);
  rateLimitStore.set(key, recentAttempts);
  if (recentAttempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
    return true;
  }
  recentAttempts.push(now);
  return false;
}

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

const PBKDF2_ITERATIONS = 200_000;
const HASH_ALGORITHM = 'PBKDF2-HMAC-SHA-256';

async function hashPassword(password: string): Promise<string> {
  try {
    // crypto.subtle is only available in secure contexts (https / localhost).
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      // Generate a per-user random salt (16 bytes)
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: HASH_ALGORITHM, salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        256
      );
      const hashArray = Array.from(new Uint8Array(derivedBits));
      const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      // Format: iterations$salt$hash — all stored with the hash for verification
      return `${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
    }
  } catch {
    // fall through to the simple hash below
  }
  // Non-crypto fallback for insecure contexts (demo auth only — not for security).
  // WARN: this is cryptographically weak and only acceptable for local demos.
  const salt = 'vantaos_salt_v1';
  let hash = 0;
  const data = password + salt;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return `fallback$${salt}${(hash >>> 0).toString(16)}`;
}

/** Verify a password against a stored PBKDF2 hash. */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && storedHash.startsWith(PBKDF2_ITERATIONS.toString() + '$')) {
      const [iterationsStr, saltHex, expectedHashHex] = storedHash.split('$');
      const iterations = parseInt(iterationsStr, 10);
      const saltBytes = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await crypto.subtle.deriveBits(
        { name: HASH_ALGORITHM, salt: saltBytes, iterations, hash: 'SHA-256' },
        keyMaterial,
        256
      );
      const hashArray = Array.from(new Uint8Array(derivedBits));
      const actualHashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      // Constant-time comparison
      if (actualHashHex.length !== expectedHashHex.length) return false;
      let result = 0;
      for (let i = 0; i < actualHashHex.length; i++) {
        result |= actualHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
      }
      return result === 0;
    }
  } catch {
    // fall through to simple comparison
  }
  // Fallback comparison for non-crypto hashes
  return storedHash === hashPasswordSync(password);
}

/** Synchronous fallback hash for comparison only (not for new hashes). */
function hashPasswordSync(password: string): string {
  const salt = 'vantaos_salt_v1';
  let hash = 0;
  const data = password + salt;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return `fallback$${salt}${(hash >>> 0).toString(16)}`;
}

/**
 * Persist the demo session and notify listeners in the SAME tab.
 * The native `storage` event only fires in other tabs, so we dispatch a
 * synthetic one here to keep onAuthStateChange subscribers in sync.
 */
function setSession(user: Omit<DemoUser, never> | null) {
  memorySession = user;
  try {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: SESSION_KEY,
        newValue: user ? JSON.stringify(user) : null,
      })
    );
  } catch {
    // StorageEvent constructor unavailable — skip the synthetic event.
  }
}

function getUsers(): StoredUser[] {
  return memoryUsers;
}

function saveUsers(users: StoredUser[]) {
  memoryUsers = users;
}

export async function demoAuth(): Promise<{
  auth: {
    signUp: (email: string, password: string, username?: string) => Promise<{ error: string | null }>;
    signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    getSession: () => Promise<{ data: { session: DemoUser | null }, error: string | null }>;
    onAuthStateChange: (callback: (event: string, user: DemoUser | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
    oauthSignIn: (provider: 'google' | 'github') => Promise<{ error: string | null; user: DemoUser | null }>;
    resetPasswordForEmail: (email: string) => Promise<{ error: string | null; resetToken?: string }>;
    validateResetToken: (token: string) => Promise<{ valid: boolean; email?: string }>;
  }
}> {
  // In a real build, process.env is replaced at build time
  // We check at runtime via the window or direct check
  return {
    auth: {
      async signUp(email: string, password: string, username?: string) {
        if (isRateLimited(`signup:${email}`)) {
          return { error: 'Too many attempts. Please wait before trying again.' };
        }
        const users = getUsers();
        if (users.find(u => u.email === email)) {
          return { error: 'Invalid request.' };
        }
        if (!email || typeof email !== 'string' || email.length > 254) {
          return { error: 'Invalid email address.' };
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
          return { error: 'Password must be at least 6 characters.' };
        }
        const passwordHash = await hashPassword(password);
        const newUser: StoredUser = {
          id: generateId(),
          email,
          username: username || email.split('@')[0],
          passwordHash,
          createdAt: new Date().toISOString(),
        };
        users.push(newUser);
        saveUsers(users);
        // Auto sign in
        setSession({
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          createdAt: newUser.createdAt,
        });
        return { error: null };
      },

      async signInWithPassword(email: string, password: string) {
        if (isRateLimited(`signin:${email}`)) {
          return { error: 'Too many attempts. Please wait before trying again.' };
        }
        const users = getUsers();
        const user = users.find(u => u.email === email);
        if (!user) {
          return { error: 'Invalid login credentials.' };
        }
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return { error: 'Invalid login credentials.' };
        }
        setSession({
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
          role: user.role,
        });
        return { error: null };
      },

      async signOut() {
        setSession(null);
      },

      async getSession() {
        if (memorySession) {
          return { data: { session: memorySession }, error: null };
        }
        return { data: { session: null }, error: null };
      },

      onAuthStateChange(callback: (event: string, user: DemoUser | null) => void) {
        const handler = (e: StorageEvent) => {
          if (e.key === SESSION_KEY) {
            if (e.newValue) {
              callback('SIGNED_IN', JSON.parse(e.newValue));
            } else {
              callback('SIGNED_OUT', null);
            }
          }
        };
        window.addEventListener('storage', handler);
        return {
          data: {
            subscription: {
              unsubscribe: () => window.removeEventListener('storage', handler),
            },
          },
        };
      },

      async oauthSignIn(provider: 'google' | 'github') {
        const users = getUsers();
        const providerLabel = provider === 'google' ? 'google' : 'github';
        const email = `${providerLabel}.demo@vantaos.local`;
        const existing = users.find(u => u.email === email);
        const user: StoredUser = existing ?? {
          id: generateId(),
          email,
          username: `${providerLabel}-user`,
          passwordHash: '',
          createdAt: new Date().toISOString(),
        };
        if (!existing) {
          users.push(user);
          saveUsers(users);
        }
        setSession({
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
          role: user.role,
        });
        return { error: null, user: { ...user, passwordHash: undefined } as unknown as DemoUser };
      },

      async resetPasswordForEmail(email: string) {
        // Always return success — never reveal whether an email is registered
        const resetToken = generateId();
        memoryResetTokens.set(email, { token: resetToken, expiresAt: Date.now() + 900_000 }); // 15 min
        return { error: null, resetToken };
      },

      /** Validate a reset token. Returns the email if valid, null otherwise. */
      async validateResetToken(resetToken: string): Promise<{ valid: boolean; email?: string }> {
        for (const [email, entry] of memoryResetTokens) {
          if (entry.token === resetToken) {
            if (Date.now() > entry.expiresAt) {
              memoryResetTokens.delete(email);
              return { valid: false };
            }
            memoryResetTokens.delete(email); // one-time use
            return { valid: true, email };
          }
        }
        return { valid: false };
      },
    },
  };
}

export async function getDemoSession(): Promise<{ session: DemoUser | null; error: string | null }> {
  if (memorySession) {
    return { session: memorySession, error: null };
  }
  return { session: null, error: null };
}
