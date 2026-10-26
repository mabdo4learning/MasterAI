import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { findSubject } from '../subjects';
import { addSession, listSessions, type LectureSession } from '../lib/api';
import { useCanEdit } from '../lib/auth';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';
import SessionEditor from '../components/SessionEditor';
import { useToast } from '../components/Toast';
import NotFound from './NotFound';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function SubjectPage() {
  const { slug } = useParams();
  const subject = findSubject(slug);
  const canEdit = useCanEdit();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [sessions, setSessions] = useState<LectureSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!subject) return;
    setSessions(null);
    listSessions(subject.slug)
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, [subject]);

  useEffect(() => {
    if (subject) document.title = `${subject.title} · My lecture notes`;
    return () => {
      document.title = 'My lecture notes';
    };
  }, [subject]);

  const selectedNumber = Number(params.get('session')) || sessions?.[0]?.number;
  const selectedIndex = sessions ? Math.max(0, sessions.findIndex((s) => s.number === selectedNumber)) : -1;
  const selected = sessions?.[selectedIndex];

  // Keep the active session visible in the (horizontally scrolling on mobile) list.
  useEffect(() => {
    document.querySelector('.session-item.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected?.id]);

  if (!subject) return <NotFound />;

  const select = (n: number) => setParams({ session: String(n) }, { replace: true });

  const patchSession = (id: string, patch: Partial<LectureSession>) =>
    setSessions((list) => list?.map((s) => (s.id === id ? { ...s, ...patch } : s)) ?? null);

  const onAddSession = async () => {
    if (!sessions) return;
    setAdding(true);
    try {
      const next = Math.max(0, ...sessions.map((s) => s.number)) + 1;
      const created = await addSession(subject.slug, next);
      setSessions([...sessions, created]);
      select(created.number);
      toast(`Session ${created.number} added`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const totals = (sessions ?? []).reduce(
    (t, s) => ({ notes: t.notes + s.noteCount, images: t.images + s.imageCount }),
    { notes: 0, images: 0 },
  );

  const prev = sessions && selectedIndex > 0 ? sessions[selectedIndex - 1] : undefined;
  const next = sessions && selectedIndex < sessions.length - 1 ? sessions[selectedIndex + 1] : undefined;

  return (
    <div className="subject-page" style={{ '--accent': subject.color } as CSSProperties}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="btn btn-ghost btn-sm back" aria-label="All subjects">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">All subjects</span>
          </Link>
          <div className="topbar-title">
            <span className="badge">{subject.number}</span>
            <div className="topbar-text">
              <h1>{subject.title}</h1>
              <p className="muted small">
                {sessions ? (
                  <>
                    {plural(sessions.length, 'session')} · {plural(totals.notes, 'note')} ·{' '}
                    {plural(totals.images, 'image')}
                  </>
                ) : (
                  <span className="skeleton skeleton-text" />
                )}
              </p>
            </div>
          </div>
          <AuthLink />
        </div>
      </header>

      <div className="page subject-body">
        {error && <p className="error card">{error}</p>}

        {!canEdit && (
          <p className="readonly-hint">
            <Icon name="lock" size={14} /> Read-only view. Sign in to add notes and images.
          </p>
        )}

        <div className="subject-layout">
          <aside className="session-list" aria-label="Sessions">
            {sessions === null &&
              !error &&
              Array.from({ length: 6 }, (_, i) => <div key={i} className="session-item skeleton-block" />)}
            {sessions?.map((s) => {
              const filled = s.noteCount + s.imageCount > 0;
              return (
                <button
                  key={s.id}
                  className={`session-item${s.id === selected?.id ? ' active' : ''}`}
                  onClick={() => select(s.number)}
                  aria-current={s.id === selected?.id ? 'true' : undefined}
                >
                  <span className="session-item-head">
                    <strong>Session {s.number}</strong>
                    {s.lectureDate && <span className="session-date">{shortDate(s.lectureDate)}</span>}
                  </span>
                  <span className={`session-topic${s.topic ? '' : ' empty'}`}>{s.topic || 'No topic yet'}</span>
                  <span className="session-counts">
                    {filled && <span className="filled-dot" aria-hidden />}
                    {plural(s.noteCount, 'note')} · {plural(s.imageCount, 'image')}
                  </span>
                </button>
              );
            })}
            {canEdit && sessions && (
              <button className="session-item add-session" onClick={onAddSession} disabled={adding}>
                <Icon name="plus" size={16} />
                {adding ? 'Adding…' : 'Add session'}
              </button>
            )}
          </aside>

          <main className="session-main">
            {selected && (
              <SessionEditor
                key={selected.id}
                subjectSlug={subject.slug}
                session={selected}
                total={sessions!.length}
                canEdit={canEdit}
                onPatch={(patch) => patchSession(selected.id, patch)}
                onPrev={prev && (() => select(prev.number))}
                onNext={next && (() => select(next.number))}
              />
            )}
            {sessions === null && !error && <div className="card skeleton-block tall" />}
            {sessions?.length === 0 && (
              <div className="card empty-state">
                <p>No sessions yet.</p>
                {canEdit && <p className="muted small">Use “Add session” to create the first one.</p>}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
