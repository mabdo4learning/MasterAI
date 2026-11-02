import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  createSubjects,
  deleteSubject,
  reorderSubjects,
  updateSubject,
  useSubjects,
  type Subject,
} from '../subjects';
import { ColorPicker, DraftSubjects, newDraft, type DraftSubject } from '../components/SubjectFields';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import { useToast } from '../components/Toast';
import { BRAND } from '../brand';

/** Settings → Subjects: rename, recolour, reorder, add and delete subjects. */
export default function ManageSubjectsPage() {
  const subjects = useSubjects();
  const toast = useToast();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [drafts, setDrafts] = useState<DraftSubject[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  useEffect(() => {
    document.title = `Subjects · ${BRAND.name}`;
    return () => {
      document.title = BRAND.name;
    };
  }, []);

  useEffect(() => {
    supabase
      .from('sessions')
      .select('subject_slug')
      .then(({ data }) => {
        const c: Record<string, number> = {};
        for (const r of data ?? []) c[r.subject_slug] = (c[r.subject_slug] ?? 0) + 1;
        setCounts(c);
      });
  }, [subjects.length]);

  const fail = (e: unknown) => toast((e as Error).message, 'error');

  const move = (i: number, by: -1 | 1) => {
    const slugs = subjects.map((s) => s.slug);
    [slugs[i], slugs[i + by]] = [slugs[i + by], slugs[i]];
    reorderSubjects(slugs).catch(fail);
  };

  const addDrafts = async (e: FormEvent) => {
    e.preventDefault();
    const named = (drafts ?? []).filter((d) => d.title.trim());
    if (!named.length) return;
    setAdding(true);
    try {
      await createSubjects(named.map((d) => ({ title: d.title, color: d.color, sessions: d.sessions })));
      toast(named.length === 1 ? 'Subject added' : `${named.length} subjects added`);
      setDrafts(null);
    } catch (err) {
      fail(err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/settings" className="btn btn-ghost btn-sm back" aria-label="Settings">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Settings</span>
          </Link>
          <div className="topbar-title">
            <div className="topbar-text">
              <h1>Your subjects</h1>
              <p className="muted small">
                {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
              </p>
            </div>
          </div>
          <AuthLink />
        </div>
      </header>

      <div className="page settings-body">
        <section className="card settings-card">
          <div className="settings-head">
            <h2>
              <Icon name="cap" /> Subjects
            </h2>
            <p className="muted small">Changes save as you go. Renaming keeps every note, file and share link.</p>
          </div>

          {subjects.length === 0 ? (
            <p className="muted">No subjects yet. Add your first one below.</p>
          ) : (
            <ol className="manage-list">
              {subjects.map((s, i) => (
                <li key={s.slug} className="manage-row" style={{ '--accent': s.color } as CSSProperties}>
                  <ColorPicker
                    value={s.color}
                    label={s.title}
                    onChange={(color) => updateSubject(s.slug, { color }).catch(fail)}
                  />
                  <TitleField subject={s} onError={fail} />
                  <span className="manage-meta muted small">
                    {counts ? `${counts[s.slug] ?? 0} sessions` : '…'}
                  </span>
                  <div className="manage-actions">
                    <button type="button" className="icon-btn" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <Icon name="chevronUp" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Move ${s.title} down`}
                      disabled={i === subjects.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <Icon name="chevronDown" size={16} />
                    </button>
                    <Link to={`/subjects/${s.slug}`} className="icon-btn" aria-label={`Open ${s.title}`} title="Open">
                      <Icon name="arrowRight" size={16} />
                    </Link>
                    <button type="button" className="icon-btn danger" aria-label={`Delete ${s.title}`} title="Delete" onClick={() => setDeleting(s)}>
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <form className="card settings-card" onSubmit={addDrafts}>
          <div className="settings-head">
            <h2>
              <Icon name="plus" /> Add subjects
            </h2>
            <p className="muted small">New subjects go at the end of your list, each with its own sessions.</p>
          </div>
          {drafts ? (
            <>
              <DraftSubjects drafts={drafts} onChange={setDrafts} colorOffset={subjects.length} disabled={adding} />
              <div className="settings-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setDrafts(null)} disabled={adding}>
                  Cancel
                </button>
                <button className="btn" disabled={adding || !drafts.some((d) => d.title.trim())}>
                  {adding ? 'Adding…' : 'Save subjects'}
                </button>
              </div>
            </>
          ) : (
            <div>
              <button type="button" className="btn btn-outline" onClick={() => setDrafts([newDraft(subjects.length)])}>
                <Icon name="plus" size={16} /> New subject
              </button>
            </div>
          )}
        </form>
      </div>

      {deleting && (
        <DeleteSubject
          subject={deleting}
          sessions={counts?.[deleting.slug] ?? 0}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            toast(`Deleted ${deleting.title}`);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

/** Subject name, saved when the field loses focus or on Enter. */
function TitleField({ subject, onError }: { subject: Subject; onError: (e: unknown) => void }) {
  const [value, setValue] = useState(subject.title);
  useEffect(() => setValue(subject.title), [subject.title]);

  const save = () => {
    const title = value.trim();
    if (!title) return setValue(subject.title);
    if (title !== subject.title) updateSubject(subject.slug, { title }).catch((e) => {
      setValue(subject.title);
      onError(e);
    });
  };

  return (
    <input
      type="text"
      value={value}
      maxLength={200}
      aria-label="Subject name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setValue(subject.title);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Deleting a subject removes everything in it, so it asks for the subject's name first. */
function DeleteSubject({
  subject,
  sessions,
  onClose,
  onDeleted,
}: {
  subject: Subject;
  sessions: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === subject.title.trim().toLowerCase();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSubject(subject.slug);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Delete ${subject.title}?`} onClose={busy ? () => {} : onClose}>
      <form className="copy-form" onSubmit={submit}>
        <p className="muted">
          This permanently deletes its {sessions} {sessions === 1 ? 'session' : 'sessions'} with every note, image, document and
          question in them, the course info and attachments, and any share links for it. It can’t be undone — download a backup
          in Settings first if you might need it.
        </p>
        <label>
          <span>Type the subject name to confirm</span>
          <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={subject.title} autoFocus disabled={busy} />
        </label>
        {error && <p className="error small">{error}</p>}
        <div className="compose-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn danger-fill" disabled={!matches || busy}>
            <Icon name="trash" size={15} /> {busy ? 'Deleting…' : 'Delete subject'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
