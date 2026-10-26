import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { MIN_PASSWORD, strength } from '../lib/password';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import Splash from '../components/Splash';
import StrengthMeter from '../components/StrengthMeter';
import { useToast } from '../components/Toast';

/** Error Supabase appends to the redirect URL when a reset link is expired or already used. */
function linkError(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
  return params.get('error_description')?.replace(/\+/g, ' ') ?? null;
}

const friendlyError = (message: string) =>
  /different from the old/i.test(message)
    ? 'Your new password must be different from your current one.'
    : /weak|at least/i.test(message)
      ? `Please choose a stronger password (at least ${MIN_PASSWORD} characters).`
      : message;

export default function ResetPassword() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return <Splash />;

  if (!session) {
    const reason = linkError();
    return (
      <AuthLayout>
        <div className="auth-form auth-done">
          <span className="done-icon warn">
            <Icon name="clock" size={26} />
          </span>
          <h2>This link has expired</h2>
          <p>Password reset links work once and only for an hour. Request a new one and use the newest email.</p>
          {reason && <p className="muted small">({reason})</p>}
          <Link className="btn btn-block" to="/forgot-password">
            Send a new link
          </Link>
          <Link className="link-btn" to="/login">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (strength(password).score === 0) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    toast('Password updated — you are signed in');
    navigate('/', { replace: true });
  };

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form-head">
          <span className="done-icon small-icon">
            <Icon name="shield" size={20} />
          </span>
          <h2>Choose a new password</h2>
          <p>
            For <strong>{session.user.email}</strong>. You'll stay signed in after saving it.
          </p>
        </div>

        <label className="field">
          <span>New password</span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            minLength={MIN_PASSWORD}
          />
          <StrengthMeter password={password} />
        </label>

        <label className="field">
          <span>Confirm new password</span>
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" />
          {mismatch && <span className="field-hint">Passwords don't match yet</span>}
          {!mismatch && confirm && confirm === password && (
            <span className="field-ok">
              <Icon name="check" size={13} /> Passwords match
            </span>
          )}
        </label>

        {error && (
          <div className="form-error" role="alert">
            <Icon name="x" size={16} />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-block" disabled={busy || !password || !confirm}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden /> Saving…
            </>
          ) : (
            <>
              Save new password <Icon name="arrowRight" size={17} />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
