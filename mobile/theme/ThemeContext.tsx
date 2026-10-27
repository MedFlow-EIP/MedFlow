import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, lightColors, darkColors, withHighContrast } from './colors';

type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  /** Contraste élevé (accessibilité, F60). */
  highContrast: boolean;
  setHighContrast: (on: boolean) => void;
};

const STORAGE_KEY = '@medflow/theme-preference';
const CONTRAST_KEY = '@medflow/high-contrast';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [highContrast, setHighContrastState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, CONTRAST_KEY])
      .then(([[, stored], [, contrast]]) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
        setHighContrastState(contrast === 'true');
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setHighContrast = (on: boolean) => {
    setHighContrastState(on);
    AsyncStorage.setItem(CONTRAST_KEY, String(on)).catch(() => {});
  };

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {
      // Non bloquant : si la persistence échoue, le choix reste actif
      // pour la session en cours, juste pas mémorisé au prochain lancement.
    });
  };

  const isDark =
    preference === 'dark' || (preference === 'system' && systemScheme === 'dark');

  const colors = useMemo(() => {
    const base = isDark ? darkColors : lightColors;
    return highContrast ? withHighContrast(base, isDark) : base;
  }, [isDark, highContrast]);

  const value = useMemo(
    () => ({ colors, isDark, preference, setPreference, highContrast, setHighContrast }),
    [colors, isDark, preference, highContrast]
  );

  // Évite un flash clair→sombre au démarrage le temps de lire AsyncStorage
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() doit être utilisé à l\'intérieur de <ThemeProvider>');
  }
  return ctx;
}