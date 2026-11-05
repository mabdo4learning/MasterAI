import { useEffect, useState } from 'react';
import { DEFAULT_ACCENT, findAccent } from './accents';

export type ThemeChoice = 'system' | 'light' | 'dark';

// Kept per device: a phone and a laptop can use different themes.
// index.html reads the same key before the app loads, so there is no flash.
const KEY = 'theme';
const dark = window.matchMedia('(prefers-color-scheme: dark)');

export function savedTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** The browser/status bar colour follows the page background. */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  syncThemeColor();
}

export function initTheme() {
  applyTheme(savedTheme());
  dark.addEventListener('change', syncThemeColor);
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState(savedTheme);

  useEffect(() => {
    applyTheme(choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Private mode: the choice still applies until the tab closes.
    }
  }, [choice]);

  return [choice, setChoice];
}

// ---------- Colour theme (accent) ----------
// Saved on the account (user_metadata.accent) so it follows you to every device, and cached
// per device under ACCENT_KEY so index.html can apply it before the first paint.
const ACCENT_KEY = 'accent';
const accentListeners = new Set<() => void>();

export function savedAccent(): string {
  try {
    return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Applies a colour theme on this device (no account change). */
export function applyAccent(id: string) {
  const accent = findAccent(id).id;
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) delete root.dataset.accent;
  else root.dataset.accent = accent;
  try {
    if (accent === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
    else localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
  accentListeners.forEach((l) => l());
}

export function initAccent() {
  applyAccent(savedAccent());
}

/** The current colour theme, and a setter that applies it and saves it to the account. */
export function useAccent(): [string, (id: string) => Promise<void>] {
  const [accent, setAccent] = useState(savedAccent);
  useEffect(() => {
    const update = () => setAccent(savedAccent());
    accentListeners.add(update);
    return () => {
      accentListeners.delete(update);
    };
  }, []);
  const choose = async (id: string) => {
    applyAccent(id);
    const { supabase } = await import('./supabase');
    const { error } = await supabase.auth.updateUser({ data: { accent: findAccent(id).id } });
    if (error) throw error;
  };
  return [accent, choose];
}
