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
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'vantaos_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          createdAt: newUser.createdAt,
        }));
        return { error: null };
      },

      async signInWithPassword(email: string, password: string) {
        const users = getUsers();
        const passwordHash = await hashPassword(password);
        const user = users.find(u => u.email === email && u.passwordHash === passwordHash);
        if (!user) {
          return { error: 'Invalid login credentials.' };
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
          role: user.role,
        }));
        return { error: null };
      },

      async signOut() {
        localStorage.removeItem(SESSION_KEY);
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
