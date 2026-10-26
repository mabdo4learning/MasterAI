import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { initials, useProfile, type Profile } from '../lib/profile';
import { MIN_PASSWORD, strength } from '../lib/password';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import StrengthMeter from '../components/StrengthMeter';
import { useToast } from '../components/Toast';

const FIELDS: { key: keyof Profile; label: string; placeholder: string; autoComplete?: string }[] = [
  { key: 'name', label: 'Full name', placeholder: 'Your name', autoComplete: 'name' },
  { key: 'programme', label: 'Programme', placeholder: 'e.g. MSc Strategic Management' },
  { key: 'university', label: 'University', placeholder: 'Your university', autoComplete: 'organization' },
  { key: 'academicYear', label: 'Academic year', placeholder: 'e.g. 2026–2027' },
];

export default function SettingsPage() {
  const { session, signOut } = useAuth();
  const saved = useProfile();
  const toast = useToast();
  const email = session?.user.email ?? '';

  useEffect(() => {
    document.title = 'Settings · My lecture notes';
    return () => {
      document.title = 'My lecture notes';
    };
  }, []);

  return (
    <div className="settings-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="btn btn-ghost btn-sm back" aria-label="Dashboard">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Dashboard</span>
          </Link>
          <div className="topbar-title">
            <span className="avatar avatar-lg" aria-hidden>
              {initials(saved.name, email)}
            </span>
            <div className="topbar-text">
              <h1>{saved.name || 'Your profile'}</h1>
              <p className="muted small">{email}</p>
            </div>
          </div>
          <AuthLink />
        </div>
      </header>

      <div className="page settings-body">
        <ProfileForm
          key={JSON.stringify(saved)}
          saved={saved}
          onSaved={() => toast('Profile saved')}
          onError={(m) => toast(m, 'error')}
        />
        <PasswordForm onSaved={() => toast('Password changed')} />

        <section className="card settings-card">
          <div className="settings-head">
            <h2>
              <Icon name="logout" /> Sign out
            </h2>
            <p className="muted small">Sign out of this device. Your notes stay saved in your account.</p>
          </div>
          <div className="settings-actions">
            <button className="btn btn-outline danger-outline" onClick={signOut}>
              <Icon name="logout" size={16} /> Sign out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileForm({
  saved,
  onSaved,
  onError,
}: {
  saved: Profile;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [values, setValues] = useState<Profile>(saved);
  const [busy, setBusy] = useState(false);
  const dirty = FIELDS.some((f) => values[f.key].trim() !== saved[f.key]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: values.name.trim(),
        programme: values.programme.trim(),
        university: values.university.trim(),
        academic_year: values.academicYear.trim(),
      },
    });
    setBusy(false);
    if (error) onError(error.message);
    else onSaved();
  };

  return (
    <form className="card settings-card" onSubmit={submit}>
      <div className="settings-head">
        <h2>
          <Icon name="note" /> Profile
        </h2>
        <p className="muted small">Shown on your dashboard banner. Leave programme, university or year empty to hide it.</p>
      </div>

      <div className="settings-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className={`field${f.key === 'name' ? ' span-2' : ''}`}>
            <span>{f.label}</span>
            <input
              type="text"
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <div className="banner-preview" aria-label="Banner preview">
        <span className="preview-label">Preview</span>
        <span className="preview-greeting">
          Good day{values.name.trim() && `, ${values.name.trim().split(/\s+/)[0]}`}
        </span>
        <div className="banner-pills">
          {[values.programme, values.university, values.academicYear]
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => (
              <span key={v}>{v}</span>
            ))}
        </div>
      </div>

      <div className="settings-actions">
        {dirty && (
          <button type="button" className="link-btn" onClick={() => setValues(saved)}>
            Discard changes
          </button>
        )}
        <button className="btn" disabled={busy || !dirty}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden /> Saving…
            </>
          ) : (
            <>
              <Icon name="check" size={16} /> Save profile
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function PasswordForm({ onSaved }: { onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (strength(password).score === 0) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(
        /different from the old/i.test(error.message)
          ? 'Your new password must be different from your current one.'
          : /reauthenticat/i.test(error.message)
            ? 'For security, please sign out and use "Forgot password?" to change it.'
            : error.message,
      );
      return;
    }
    setPassword('');
    setConfirm('');
    onSaved();
  };

  return (
    <form className="card settings-card" onSubmit={submit}>
      <div className="settings-head">
        <h2>
          <Icon name="lock" /> Password
        </h2>
        <p className="muted small">Choose a new password for signing in on all your devices.</p>
      </div>

      <div className="settings-grid">
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
      </div>

      {error && (
        <div className="form-error" role="alert">
          <Icon name="x" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="settings-actions">
        <button className="btn" disabled={busy || !password || !confirm}>
          {busy ? (
            <>
              <span className="btn-spinner" aria-hidden /> Saving…
            </>
          ) : (
            'Change password'
          )}
        </button>
      </div>
    </form>
  );
}
