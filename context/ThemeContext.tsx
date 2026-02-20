import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DarkPalette, LightPalette, type ColorPalette } from '../constants/theme';
import { getUserSettings, saveUserSettings } from '../utils/storage';
import type { AppearanceTheme } from '../types';

type ThemeContextValue = {
  theme: AppearanceTheme;
  colors: ColorPalette;
  setTheme: (t: AppearanceTheme) => Promise<void>;
  isLoading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppearanceTheme>('dark');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getUserSettings().then((s) => {
      setThemeState(s.appearanceTheme ?? 'dark');
      setIsLoading(false);
    });
  }, []);

  const setTheme = useCallback(async (t: AppearanceTheme) => {
    const s = await getUserSettings();
    setThemeState(t);
    await saveUserSettings({ ...s, appearanceTheme: t });
  }, []);

  const colors = theme === 'light' ? LightPalette : DarkPalette;

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
