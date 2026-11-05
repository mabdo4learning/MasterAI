import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { joinShare } from '../lib/sharing';
import { rememberShareLink } from '../components/PendingShare';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import Splash from '../components/Splash';

/**
 * Where a share link lands. Signed in: join and open it. Signed out: explain, and remember the link
 * so it opens after signing in, even when sign-up goes through an email confirmation first.
 */
export default function JoinSharePage() {
  const { token = '' } = useParams();
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      rememberShareLink(token);
      return;
    }
    joinShare(token)
      .then((id) => navigate(`/shared/${id}`, { replace: true }))
      .catch((e) => setError(e.message));
  }, [ready, session, token, navigate]);

  if (!ready) return <Splash />;
  if (!token) return <Navigate to="/" replace />;

  if (!session) {
    const from = { from: location.pathname };
    return (
      <AuthLayout>
        <div className="auth-form auth-done">
          <span className="done-icon">
            <Icon name="share" size={26} />
          </span>
          <h2>Lecture notes were shared with you</h2>
          <p>Sign in or create a free account to open them. You'll see them read-only and can copy them into your own notebook.</p>
          <Link className="btn btn-block" to="/login" state={from}>
            Sign in
          </Link>
          <Link className="btn btn-ghost btn-block" to="/signup" state={from}>
            Create an account
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="auth-form auth-done">
          <span className="done-icon">
            <Icon name="lock" size={26} />
          </span>
          <h2>Can't open this link</h2>
          <p>{error}</p>
          <Link className="btn btn-block" to="/">
            Go to my notes
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return <Splash />;
}
