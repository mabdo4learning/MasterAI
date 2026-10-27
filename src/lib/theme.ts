import { useEffect, useState } from 'react';

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
