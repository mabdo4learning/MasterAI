import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { initials, useProfile, type Profile } from '../lib/profile';
import { MIN_PASSWORD, strength } from '../lib/password';
import AuthLink from '../components/AuthLink';
import Icon, { type IconName } from '../components/Icon';
import { useTheme, type ThemeChoice } from '../lib/theme';
import { useInstall } from '../lib/install';
import { todayKey } from '../lib/exams';
import { formatBytes } from '../lib/files';
import type { BackupProgress } from '../lib/backup';
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
        <AppSettings />
        <BackupSettings onError={(m) => toast(m, 'error')} />
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

const THEMES: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Automatic', icon: 'devices' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

function AppSettings() {
  const [theme, setTheme] = useTheme();
  const { state, install } = useInstall();

  return (
    <section className="card settings-card">
      <div className="settings-head">
        <h2>
          <Icon name="phone" /> App
        </h2>
        <p className="muted small">Saved on this device only, so your phone and laptop can look different.</p>
      </div>

      <div className="app-row">
        <div className="app-row-text">
          <strong>Appearance</strong>
          <span className="muted small">Automatic follows your device's light or dark setting.</span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Appearance">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              className={theme === t.value ? 'active' : undefined}
              onClick={() => setTheme(t.value)}
            >
              <Icon name={t.icon} size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="app-row">
        <div className="app-row-text">
          <strong>Install as an app</strong>
          <span className="muted small">
            {state === 'installed' && 'You are using the installed app.'}
            {state === 'available' && 'Opens full screen from your home screen or dock, like any other app.'}
            {state === 'ios' && (
              <>
                In Safari, tap <b>Share</b> <Icon name="upload" size={13} /> then <b>Add to Home Screen</b>.
              </>
            )}
            {state === 'manual' &&
              'Open your browser menu and choose “Install app” or “Add to Home screen”. On iPhone, use Safari.'}
          </span>
        </div>
        {state === 'installed' && (
          <span className="app-installed">
            <Icon name="check" size={15} /> Installed
          </span>
        )}
        {state === 'available' && (
          <button type="button" className="btn btn-sm" onClick={install}>
            <Icon name="download" size={15} /> Install app
          </button>
        )}
      </div>
    </section>
  );
}

const LAST_BACKUP = 'lastBackup';

function readLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP);
  } catch {
    return null;
  }
}

function progressLabel(p: BackupProgress | null): string {
  if (!p || p.step === 'data') return 'Collecting your notes…';
  if (p.step === 'files') return `Downloading files ${p.done} of ${p.total}…`;
  return 'Creating the zip…';
}

/** Downloads everything in the account as a zip the user keeps themselves, independent of Supabase. */
function BackupSettings({ onError }: { onError: (message: string) => void }) {
  const toast = useToast();
  const [withFiles, setWithFiles] = useState(true);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(readLastBackup);

  const download = async () => {
    setBusy(true);
    setProgress(null);
    try {
      // Loaded on demand so the zip library isn't part of every page load.
      const { createBackup } = await import('../lib/backup');
      const blob = await createBackup(withFiles, setProgress);
      const now = new Date();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `lecture-notes-backup-${todayKey(now)}.zip`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      try {
        localStorage.setItem(LAST_BACKUP, now.toISOString());
      } catch {
        // Private mode: the backup still downloaded, it just isn't remembered.
      }
      setLast(now.toISOString());
      toast(`Backup downloaded · ${formatBytes(blob.size)}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <section className="card settings-card">
      <div className="settings-head">
        <h2>
          <Icon name="download" /> Backup
        </h2>
        <p className="muted small">
          Download a copy of everything in your account — sessions, notes, exam questions, checklist and exam dates — as a
          zip file you keep yourself.
        </p>
      </div>

      <ul className="backup-contents">
        <li>
          <Icon name="note" size={15} /> <strong>notes.md</strong>
          <span className="muted small">readable in any text editor</span>
        </li>
        <li>
          <Icon name="file" size={15} /> <strong>backup.json</strong>
          <span className="muted small">the complete data</span>
        </li>
        {withFiles && (
          <li>
            <Icon name="image" size={15} /> <strong>files/</strong>
            <span className="muted small">your images, PDFs and slides, a folder per session</span>
          </li>
        )}
      </ul>

      <label className="toggle backup-toggle">
        <input type="checkbox" checked={withFiles} disabled={busy} onChange={(e) => setWithFiles(e.target.checked)} />
        <span>Include images and files (bigger download)</span>
      </label>

      {busy && (
        <div className="backup-progress" role="status">
          <span className="muted small">{progressLabel(progress)}</span>
          <span className="weekly-bar">
            <span style={{ width: `${progress?.step === 'zip' ? 100 : percent}%` }} />
          </span>
        </div>
      )}

      <div className="settings-actions backup-actions">
        <span className="muted small">
          {last ? `Last backup on this device: ${new Date(last).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : 'No backup downloaded on this device yet.'}
        </span>
        <button className="btn" onClick={download} disabled={busy}>
          <Icon name="download" size={16} />
          {busy ? 'Preparing…' : 'Download backup'}
        </button>
      </div>
    </section>
  );
}

