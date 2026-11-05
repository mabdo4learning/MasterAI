import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';

export default function ForgotPassword() {
  const initialEmail = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Only rate limits and similar are shown; whether the email has an account is never revealed.
    if (error && /rate limit|too many/i.test(error.message)) {
      setError('Too many requests — please wait a few minutes and try again.');
    } else if (error && !/not found|user/i.test(error.message)) {
      setError(error.message);
    } else {
      setSentTo(email.trim());
    }
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="auth-form auth-done">
          <span className="done-icon">
            <Icon name="mail" size={26} />
          </span>
          <h2>Check your inbox</h2>
          <p>
            If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset your password. It
            works once and expires in an hour.
          </p>
          <p className="muted small">Nothing there? Check your spam folder, or try again in a minute.</p>
          <Link className="btn btn-block" to="/login">
            Back to sign in
          </Link>
          <button type="button" className="link-btn" onClick={() => setSentTo(null)}>
            Use a different email
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form-head">
          <span className="done-icon small-icon">
            <Icon name="lock" size={20} />
          </span>
          <h2>Forgot your password?</h2>
          <p>Enter your account's email and we'll send you a link to choose a new one.</p>
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

        {error && (
          <div className="form-error" role="alert">
            <Icon name="x" size={16} />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-block" disabled={busy || !email}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden /> Sending link…
            </>
          ) : (
            <>
              Send reset link <Icon name="arrowRight" size={17} />
            </>
          )}
        </button>

        <p className="auth-switch">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
