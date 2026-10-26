import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import Splash from '../components/Splash';

const friendlyError = (message: string) =>
  /invalid login credentials/i.test(message)
    ? "That email and password don't match. Please try again."
    : /email not confirmed/i.test(message)
      ? 'Please confirm your email first — check your inbox for the link we sent.'
      : message;

export default function Login() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return <Splash />;
  if (session) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(friendlyError(error.message));
    else navigate(from, { replace: true });
  };

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form-head">
          <h2>Welcome back</h2>
          <p>Sign in to open your lecture notes.</p>
        </div>

        <label className="field">
          <span>Email</span>
          <div className="input-wrap">
            <Icon name="mail" size={18} />
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" placeholder="Your password" />
        </label>

        {error && (
          <div className="form-error" role="alert">
            <Icon name="x" size={16} />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-block" disabled={busy || !email || !password}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden /> Signing in…
            </>
          ) : (
            <>
              Sign in <Icon name="arrowRight" size={17} />
            </>
          )}
        </button>

        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
