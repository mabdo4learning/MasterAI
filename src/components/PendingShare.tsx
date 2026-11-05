import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const KEY = 'pendingShare';

/** Remembers a share link opened while signed out, so it can be opened once the visitor is in. */
export function rememberShareLink(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Storage blocked: the link just has to be opened again after signing in.
  }
}

/** After sign-in (or a sign-up confirmed by email), continues to the share link that brought them here. */
export default function PendingShare() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!session) return;
    let token: string | null = null;
    try {
      token = localStorage.getItem(KEY);
      localStorage.removeItem(KEY);
    } catch {
      return;
    }
    if (token && !pathname.startsWith('/share/')) navigate(`/share/${token}`, { replace: true });
  }, [session, pathname, navigate]);

  return null;
}
