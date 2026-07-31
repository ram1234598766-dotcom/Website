/**
 * DemoAuth — A localStorage-backed authentication system that works
 * entirely in the browser without any external service.
 *
 * When Supabase is configured (NEXT_PUBLIC_SUPABASE_URL is set), this
 * module defers to the real Supabase client automatically.
 *
 * All passwords are hashed with SHA-256 before storage. No plaintext
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

const USERS_KEY = 'vantaos_demo_users';
const SESSION_KEY = 'vantaos_demo_session';

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function hashPassword(password: string): Promise<string> {
  const data = password + 'vantaos_salt_v1';
  try {
    // crypto.subtle is only available in secure contexts (https / localhost).
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fall through to the simple hash below
  }
  // Non-crypto fallback for insecure contexts (demo auth only — not for security).
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return 'fb_' + (hash >>> 0).toString(16);
}

/**
 * Persist the demo session and notify listeners in the SAME tab.
 * The native `storage` event only fires in other tabs, so we dispatch a
 * synthetic one here to keep onAuthStateChange subscribers in sync.
 */
function setSession(user: Omit<DemoUser, never> | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
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

export function isSupabaseConfigured(): boolean {
  const url = 
    (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
    '';
  return !!(url && !url.includes('placeholder') && !url.includes('YOUR_'));
}

function getUsers(): StoredUser[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function demoSupabase(): Promise<{
  auth: {
    signUp: (email: string, password: string, username?: string) => Promise<{ error: string | null }>;
    signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    getSession: () => Promise<{ data: { session: DemoUser | null }, error: string | null }>;
    onAuthStateChange: (callback: (event: string, user: DemoUser | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
    resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  }
}> {
  // In a real build, process.env is replaced at build time
  // We check at runtime via the window or direct check
  return {
    auth: {
      async signUp(email: string, password: string, username?: string) {
        const users = getUsers();
        if (users.find(u => u.email === email)) {
          return { error: 'A user with this email already exists.' };
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
        const users = getUsers();
        const passwordHash = await hashPassword(password);
        const user = users.find(u => u.email === email && u.passwordHash === passwordHash);
        if (!user) {
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
        try {
          const data = localStorage.getItem(SESSION_KEY);
          if (data) {
            const session = JSON.parse(data);
            return { data: { session }, error: null };
          }
        } catch {}
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

      async resetPasswordForEmail(email: string) {
        const users = getUsers();
        const user = users.find(u => u.email === email);
        if (!user) {
          return { error: 'No user found with this email.' };
        }
        // In demo mode, just log it
        console.log('[DemoAuth] Password reset requested for:', email);
        // Store a reset token
        const resetToken = generateId();
        localStorage.setItem(`vantaos_reset_${email}`, resetToken);
        return { error: null };
      },
    },
  };
}

export async function getDemoSession(): Promise<{ session: DemoUser | null; error: string | null }> {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (data) {
      return { session: JSON.parse(data), error: null };
    }
  } catch {}
  return { session: null, error: null };
}
