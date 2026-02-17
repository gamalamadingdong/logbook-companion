import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import type { UserProfile } from '../services/supabase';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextValue {
    themePreference: ThemePreference;
    resolvedTheme: ResolvedTheme;
    setThemePreference: (theme: ThemePreference) => void;
}

const THEME_STORAGE_KEY = 'logbook_theme_preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemePreference = (value: string | null): value is ThemePreference => (
    value === 'dark' || value === 'light' || value === 'system'
);

const getProfileTheme = (profile: UserProfile | null): ThemePreference | null => {
    const preference = profile?.preferences?.theme;
    return typeof preference === 'string' && isThemePreference(preference) ? preference : null;
};

const getStoredTheme = (): ThemePreference | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : null;
};

const resolveTheme = (preference: ThemePreference, prefersDark: boolean): ResolvedTheme => (
    preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
);

const applyTheme = (resolvedTheme: ResolvedTheme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.classList.toggle('light', resolvedTheme === 'light');
    root.style.colorScheme = resolvedTheme;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { profile } = useAuth();
    const [themePreference, setThemePreference] = useState<ThemePreference>('light');
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

    useEffect(() => {
        const stored = getStoredTheme();
        const profileTheme = getProfileTheme(profile);
        const nextPreference = profileTheme ?? stored ?? 'light';
        setThemePreference(nextPreference);

        if (profileTheme && stored !== profileTheme) {
            localStorage.setItem(THEME_STORAGE_KEY, profileTheme);
        }
    }, [profile]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateResolvedTheme = () => {
            const nextResolved = resolveTheme(themePreference, mediaQuery.matches);
            setResolvedTheme(nextResolved);
            applyTheme(nextResolved);
        };

        updateResolvedTheme();
        localStorage.setItem(THEME_STORAGE_KEY, themePreference);

        if (themePreference === 'system') {
            mediaQuery.addEventListener('change', updateResolvedTheme);
            return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
        }
    }, [themePreference]);

    const value = useMemo(
        () => ({ themePreference, resolvedTheme, setThemePreference }),
        [themePreference, resolvedTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
