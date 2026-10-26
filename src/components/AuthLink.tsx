import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { initials, useProfile } from '../lib/profile';
import Icon from './Icon';

export default function AuthLink() {
  const { session, signOut } = useAuth();
  const profile = useProfile();
  const location = useLocation();
  if (session) {
    const email = session.user.email ?? '';
    return (
      <div className="auth-chip">
        <Link to="/settings" className="account-link" title="Profile & settings">
          <span className="avatar" aria-hidden>
            {initials(profile.name, email)}
          </span>
          <span className="auth-email hide-mobile">{profile.name || email}</span>
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out" aria-label="Sign out">
          <Icon name="logout" size={15} />
          <span className="hide-mobile">Sign out</span>
        </button>
      </div>
    );
  }
  return (
    <Link className="btn btn-ghost btn-sm" to="/login" state={{ from: location.pathname + location.search }}>
      <Icon name="lock" size={15} />
      Sign in
    </Link>
  );
}
