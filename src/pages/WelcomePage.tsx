import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { createSubjects, useSubjects } from '../subjects';
import { DraftSubjects, newDraft, type DraftSubject } from '../components/SubjectFields';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { BRAND } from '../brand';

type Step = 'profile' | 'subjects' | 'done';
const STEPS: { id: Step; label: string }[] = [
  { id: 'profile', label: 'Your programme' },
  { id: 'subjects', label: 'Your subjects' },
  { id: 'done', label: 'Ready' },
];

/** First-run wizard: programme details, then the subjects and how many sessions each has. */
export default function WelcomePage() {
  const { session } = useAuth();
  const subjects = useSubjects();
  const meta = (session?.user.user_metadata ?? {}) as Partial<Record<string, string>>;

  // Someone who already has subjects (e.g. opened /welcome again) goes straight to the dashboard.
  const hadSubjects = useRef(subjects.length > 0);
  const [step, setStep] = useState<Step>('profile');
  const [profile, setProfile] = useState({
    name: meta.full_name ?? '',
    programme: meta.programme ?? '',
    university: meta.university ?? '',
    academicYear: meta.academic_year ?? '',
  });
  const [drafts, setDrafts] = useState<DraftSubject[]>(() => [newDraft(0), newDraft(1), newDraft(2)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Welcome · ${BRAND.name}`;
    return () => {
      document.title = BRAND.name;
    };
  }, []);

  if (hadSubjects.current) return <Navigate to="/" replace />;

  const named = drafts.filter((d) => d.title.trim());
  const firstName = profile.name.trim().split(/\s+/)[0];

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: profile.name.trim(),
        programme: profile.programme.trim(),
        university: profile.university.trim(),
        academic_year: profile.academicYear.trim(),
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep('subjects');
  };

  const saveSubjects = async (e: FormEvent) => {
    e.preventDefault();
    if (!named.length) return;
    setBusy(true);
    setError(null);
    try {
      await createSubjects(named.map((d) => ({ title: d.title, color: d.color, sessions: d.sessions })));
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const preview = step === 'done' ? subjects : named;
  const pills = [profile.programme, profile.university, profile.academicYear].map((p) => p.trim()).filter(Boolean);

  return (
    <div className="auth-page onboard">
      <aside className="auth-showcase">
        <div className="banner-glow" aria-hidden />
        <div className="showcase-inner">
          <Logo size={36} className="logo-on-ink" />

          <div className="showcase-copy">
            <h1>
              {step === 'done' ? (
                <>
                  Your notebook
                  <br />
                  is <em>ready</em>.
                </>
              ) : (
                <>
                  {firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
                  <br />
                  Let’s make it <em>yours</em>.
                </>
              )}
            </h1>
            {pills.length > 0 ? (
              <div className="banner-pills onboard-pills">
                {pills.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>
            ) : (
              <p>Tell us what you study, and {BRAND.name} sets up a place for every lecture.</p>
            )}
          </div>

          <div className="onboard-preview" aria-live="polite">
            {preview.length === 0 ? (
              <div className="subject-mosaic placeholder" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
            ) : (
              <ul className="preview-list">
                {preview.slice(0, 7).map((d, i) => (
                  <li key={'key' in d ? d.key : d.slug} style={{ animationDelay: `${i * 40}ms` }}>
                    <span className="mini-badge" style={{ background: d.color }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="preview-title">{d.title}</span>
                    {'sessions' in d && <span className="preview-meta">{d.sessions} sessions</span>}
                  </li>
                ))}
                {preview.length > 7 && <li className="preview-more">+ {preview.length - 7} more</li>}
              </ul>
            )}
          </div>
        </div>
        <div className="banner-stripe" aria-hidden>
          {(preview.length ? preview : []).map((d, i) => (
            <span key={i} style={{ background: d.color }} />
          ))}
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-form onboard-form">
          <ol className="steps" aria-label="Setup steps">
            {STEPS.map((s, i) => (
              <li key={s.id} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
                <span className="step-dot">{i < stepIndex ? <Icon name="check" size={12} /> : i + 1}</span>
                <span className="hide-mobile">{s.label}</span>
              </li>
            ))}
          </ol>

          {step === 'profile' && (
            <form className="onboard-step" onSubmit={saveProfile}>
              <div className="auth-form-head">
                <h2>What are you studying?</h2>
                <p>This appears on your dashboard. You can change it any time in Settings.</p>
              </div>
              <label>
                <span>Your name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="e.g. Sara Ahmed"
                  autoFocus
                />
              </label>
              <label>
                <span>Programme</span>
                <input
                  type="text"
                  value={profile.programme}
                  onChange={(e) => setProfile({ ...profile, programme: e.target.value })}
                  placeholder="e.g. MSc Strategic Management"
                />
              </label>
              <div className="onboard-two">
                <label>
                  <span>University</span>
                  <input
                    type="text"
                    autoComplete="organization"
                    value={profile.university}
                    onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                    placeholder="Your university"
                  />
                </label>
                <label>
                  <span>Academic year</span>
                  <input
                    type="text"
                    value={profile.academicYear}
                    onChange={(e) => setProfile({ ...profile, academicYear: e.target.value })}
                    placeholder="e.g. 2026–2027"
                  />
                </label>
              </div>
              {error && <p className="error small">{error}</p>}
              <button className="btn btn-lg" disabled={busy}>
                {busy ? 'Saving…' : 'Continue'} <Icon name="arrowRight" size={16} />
              </button>
            </form>
          )}

          {step === 'subjects' && (
            <form className="onboard-step" onSubmit={saveSubjects}>
              <div className="auth-form-head">
                <h2>Add your subjects</h2>
                <p>Name each module, pick a colour and set how many sessions it has. You can add, rename or reorder them later.</p>
              </div>
              <DraftSubjects drafts={drafts} onChange={setDrafts} disabled={busy} />
              {error && <p className="error small">{error}</p>}
              <div className="onboard-nav">
                <button type="button" className="btn btn-ghost" onClick={() => setStep('profile')} disabled={busy}>
                  <Icon name="arrowLeft" size={16} /> Back
                </button>
                <button className="btn btn-lg" disabled={busy || named.length === 0}>
                  {busy
                    ? 'Creating…'
                    : named.length
                      ? `Create ${named.length} ${named.length === 1 ? 'subject' : 'subjects'}`
                      : 'Add a subject to continue'}
                  {!busy && named.length > 0 && <Icon name="arrowRight" size={16} />}
                </button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="onboard-step onboard-done">
              <span className="done-icon">
                <Icon name="sparkle" size={26} />
              </span>
              <div className="auth-form-head">
                <h2>All set{firstName ? `, ${firstName}` : ''}.</h2>
                <p>
                  {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} with{' '}
                  {named.reduce((n, d) => n + d.sessions, 0)} sessions, ready for your first lecture notes.
                </p>
              </div>
              <Link to="/" className="btn btn-lg">
                Open my dashboard <Icon name="arrowRight" size={16} />
              </Link>
              <Link to={`/subjects/${subjects[0]?.slug ?? ''}`} className="btn btn-ghost">
                Start with {subjects[0]?.title ?? 'your first subject'}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
