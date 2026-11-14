import { createContext, useContext } from 'react';

/**
 * Theme preference. `system` follows the OS and is the default, so a user who
 * has never touched the toggle gets whatever their device is set to.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Keep in sync with the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = 'cpf-theme';

export interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually on screen after resolving `system`. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
