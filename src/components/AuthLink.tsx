import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function AuthLink() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  if (session) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={signOut}>
        Sign out
      </button>
    );
  }
  return (
    <Link className="btn btn-ghost btn-sm" to="/login" state={{ from: location.pathname + location.search }}>
      Sign in
    </Link>
  );
}
