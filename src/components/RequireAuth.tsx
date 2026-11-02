import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { loadSubjects, useSubjectsState } from '../subjects';
import Splash from './Splash';
import Icon from './Icon';

// Pages that work before any subjects exist: the wizard itself, settings, and notes others shared.
const NO_SUBJECTS_OK = ['/welcome', '/settings', '/shared'];

/**
 * Sends visitors who aren't signed in to /login, then back here afterwards. Loads the user's
 * subjects before showing the page, and sends accounts without any to the onboarding wizard.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const location = useLocation();
  const subjects = useSubjectsState();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (userId && subjects.userId !== userId) loadSubjects(userId);
  }, [userId, subjects.userId]);

  if (!ready) return <Splash />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (subjects.userId !== userId || (subjects.status === 'loading' && subjects.list.length === 0)) return <Splash />;

  if (subjects.status === 'error') {
    return (
      <div className="center-page">
        <div className="card narrow-card center">
          <p className="error">{subjects.error}</p>
          <button className="btn" onClick={() => loadSubjects(session.user.id)}>
            <Icon name="refresh" size={16} /> Try again
          </button>
        </div>
      </div>
    );
  }

  const exempt = NO_SUBJECTS_OK.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  if (subjects.list.length === 0 && !exempt) return <Navigate to="/welcome" replace />;
  return children;
}
