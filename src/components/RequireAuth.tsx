import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Splash from './Splash';

/** Sends visitors who aren't signed in to /login, then back here afterwards. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
