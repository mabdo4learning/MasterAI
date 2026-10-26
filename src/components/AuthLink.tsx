import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Icon from './Icon';

export default function AuthLink() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  if (session) {
    return (
      <div className="auth-chip">
        <span className="auth-dot" aria-hidden />
        <span className="auth-email hide-mobile">{session.user.email}</span>
        <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">
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
