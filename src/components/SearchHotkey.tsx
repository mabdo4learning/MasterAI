import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Press "/" (or Ctrl/⌘+K) anywhere outside a text field to open search. */
export default function SearchHotkey() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      const slash = e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey;
      const cmdK = e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey);
      if (!slash && !cmdK) return;
      e.preventDefault();
      if (pathname === '/search') document.querySelector<HTMLInputElement>('.search-box input')?.focus();
      else navigate('/search');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, pathname, session]);

  return null;
}
