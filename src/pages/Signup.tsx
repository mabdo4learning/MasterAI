import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { SITE } from '../config';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import Splash from '../components/Splash';
import StrengthMeter from '../components/StrengthMeter';
import { MIN_PASSWORD, strength } from '../lib/password';

const friendlyError = (message: string) =>
  /already registered|already exists/i.test(message)
    ? 'An account with this email already exists. Try signing in instead.'
    : /signups not allowed|signup.*disabled/i.test(message)
      ? 'Sign-ups are closed at the moment.'
      : /rate limit/i.test(message)
        ? 'Too many attempts — please wait a few minutes and try again.'
        : message;

export default function Signup() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [programme, setProgramme] = useState('');
  const [university, setUniversity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!ready) return <Splash />;
  if (session) return <Navigate to={from} replace />;

  const pw = strength(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.score === 0) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: name.trim(),
          programme: programme.trim(),
          university: university.trim(),
          academic_year: SITE.academicYear,
        },
      },
    });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    // Supabase hides whether an email is taken: an existing address comes back with no identities.
    if (data.user && data.user.identities?.length === 0) {
      return setError(friendlyError('already registered'));
    }
    if (data.session) navigate(from, { replace: true });
    else setSentTo(email.trim());
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
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to finish creating
            your account.
          </p>
          <p className="muted small">Nothing there? Check your spam folder, or wait a minute and try again.</p>
          <Link className="btn btn-block" to="/login">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form-head">
          <h2>Create your account</h2>
          <p>Get your own private notebook with all 10 subjects ready to go.</p>
        </div>

        <label className="field">
          <span>Full name</span>
          <div className="input-wrap">
            <Icon name="note" size={18} />
            <input
              type="text"
              autoComplete="name"
              placeholder="Your name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </label>

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            minLength={MIN_PASSWORD}
          />
          <StrengthMeter password={password} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>
              Programme <em>optional</em>
            </span>
            <input
              type="text"
              placeholder="e.g. MSc Management"
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              University <em>optional</em>
            </span>
            <input
              type="text"
              autoComplete="organization"
              placeholder="Your university"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <div className="form-error" role="alert">
            <Icon name="x" size={16} />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-block" disabled={busy || !name.trim() || !email || !password}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden /> Creating account…
            </>
          ) : (
            <>
              Create account <Icon name="arrowRight" size={17} />
            </>
          )}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login" state={{ from }}>Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
