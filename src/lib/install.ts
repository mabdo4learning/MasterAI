import { useEffect, useState } from 'react';

// Chrome, Edge and Android fire `beforeinstallprompt` once, early, so it is
// captured at startup and kept until the user taps "Install app".
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPhone/iPad have no install prompt: Safari's Share menu is the only way.
export const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installing is optional; the site works the same without it.
      });
    });
  }
}

export type InstallState = 'installed' | 'available' | 'ios' | 'manual';

export function useInstall(): { state: InstallState; install: () => Promise<void> } {
  const [, rerender] = useState(0);

  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const state: InstallState = standalone() ? 'installed' : deferred ? 'available' : isIOS ? 'ios' : 'manual';

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    notify();
  };

  return { state, install };
}
