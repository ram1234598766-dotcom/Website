import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Immediate recovery from localStorage to prevent flash
    const saved = localStorage.getItem('vantaos_theme');
    return (saved as Theme) || 'system';
  });

  // Apply theme to document
  const applyTheme = (currentTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (currentTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(currentTheme);
    }
  };

  // Synchronize with local storage and apply classes on change
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('vantaos_theme', theme);
  }, [theme]);

  // Listen to system changes if theme is set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Sync with Firestore on authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'user_themes', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const remoteTheme = docSnap.data().theme as Theme;
            if (remoteTheme && remoteTheme !== theme) {
              setThemeState(remoteTheme);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch theme from Firestore:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    const user = auth.currentUser;
    if (user) {
      try {
        const docRef = doc(db, 'user_themes', user.uid);
        await setDoc(docRef, {
          theme: newTheme,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error('Failed to save theme to Firestore:', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
