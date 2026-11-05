import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthState = { session: Session | null; ready: boolean; signOut: () => Promise<void> };

const AuthContext = createContext<AuthState>({ session: null, ready: false, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // If Supabase sent a reset link back to the Site URL instead of /reset-password
      // (e.g. the redirect URL isn't allow-listed), still take the user to the reset form.
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
        window.location.replace('/reset-password');
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ session, ready, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
/** Signed in = can edit. Sign-ups are disabled and the database only accepts writes from the owner's email. */
export const useCanEdit = () => !!useAuth().session;
