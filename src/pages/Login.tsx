import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { SITE } from '../config';
import { SUBJECTS } from '../subjects';
import Icon from '../components/Icon';
import Splash from '../components/Splash';

const FEATURES = [
  { icon: 'note', title: 'Notes for every session', text: 'Write during the lecture, find it again in seconds.' },
  { icon: 'image', title: 'Slides & whiteboard photos', text: 'Upload, drag in or paste screenshots.' },
  { icon: 'devices', title: 'Synced everywhere', text: 'The same notes on your laptop and your phone.' },
] as const;

const friendlyError = (message: string) =>
  /invalid login credentials/i.test(message)
    ? "That email and password don't match. Please try again."
    : /email not confirmed/i.test(message)
      ? 'This account has not been confirmed yet.'
      : message;

export default function Login() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
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

  const onPasswordKey = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  return (
    <div className="auth-page">
      <aside className="auth-showcase">
        <div className="banner-glow" aria-hidden />
        <div className="showcase-inner">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="note" size={20} />
            </span>
            My lecture notes
          </div>

          <div className="showcase-copy">
            <h1>
              Every lecture,
              <br />
              in one place.
            </h1>
            <p>
              {SITE.programme} · {SITE.university} · {SITE.academicYear}
            </p>
          </div>

          <div className="subject-mosaic" aria-label={`${SUBJECTS.length} subjects`}>
            {SUBJECTS.map((s, i) => (
              <span key={s.slug} title={s.title} style={{ background: s.color, animationDelay: `${i * 45}ms` }}>
                {s.number}
              </span>
            ))}
          </div>

          <ul className="feature-list">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="feature-icon">
                  <Icon name={f.icon} size={18} />
                </span>
                <span>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="banner-stripe" aria-hidden>
          {SUBJECTS.map((s) => (
            <span key={s.slug} style={{ background: s.color }} />
          ))}
        </div>
      </aside>

      <main className="auth-main">
        <form className="auth-form" onSubmit={submit} noValidate={false}>
          <div className="auth-form-head">
            <span className="brand-mark auth-mobile-mark">
              <Icon name="note" size={20} />
            </span>
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
            <div className="input-wrap">
              <Icon name="lock" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onPasswordKey}
                onKeyUp={onPasswordKey}
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
            {capsLock && <span className="field-hint">Caps Lock is on</span>}
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

          <p className="auth-foot">
            <Icon name="shield" size={15} />
            Private site. Only the owner can sign in.
          </p>
        </form>
      </main>
    </div>
  );
}
