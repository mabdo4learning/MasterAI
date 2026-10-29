import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { findSubject } from '../subjects';
import { useAuth } from '../lib/auth';
import { getSharedContent, removeRecipient, sessionIsEmpty, type SharedContent } from '../lib/sharing';
import AuthLink from '../components/AuthLink';
import CopyDialog from '../components/CopyDialog';
import Icon from '../components/Icon';
import SharedSessionView from '../components/SharedSessionView';
import { Attachments, DetailsInfo } from '../components/SubjectDetails';
import { useToast } from '../components/Toast';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** A live, read-only view of something another account shared, with a way to copy it. */
export default function SharedViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const userId = useAuth().session?.user.id;
  const [params, setParams] = useSearchParams();
  const [content, setContent] = useState<SharedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSharedContent(id)
      .then(setContent)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (content) document.title = `${content.title} · Shared`;
    return () => {
      document.title = 'My lecture notes';
    };
  }, [content]);

  const subject = content ? findSubject(content.subjectSlug) : undefined;
  const color = subject?.color ?? '#4B5563';
  const visible = content ? (content.kind === 'subject' ? content.sessions.filter((s) => !sessionIsEmpty(s)) : content.sessions) : [];
  const hasDetails =
    !!content && content.kind === 'subject' && (!!content.details || content.subjectImages.length + content.subjectDocuments.length > 0);
  const view = hasDetails && (params.get('view') === 'details' || visible.length === 0) ? 'details' : 'sessions';
  const selected = visible.find((s) => s.number === Number(params.get('session'))) ?? visible[0];
  const totals = visible.reduce(
    (t, s) => ({ notes: t.notes + s.notes.length, files: t.files + s.images.length + s.documents.length }),
    { notes: 0, files: content ? content.subjectImages.length + content.subjectDocuments.length : 0 },
  );

  const leave = async () => {
    if (!id || !userId) return;
    try {
      await removeRecipient(id, userId);
      toast('Removed from your shared list');
      navigate('/shared', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="subject-page shared-page" style={{ '--accent': color } as CSSProperties}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/shared" className="btn btn-ghost btn-sm back" aria-label="Sharing">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Sharing</span>
          </Link>
          <div className="topbar-title">
            <span className="badge">{subject?.number ?? '·'}</span>
            <div className="topbar-text">
              <h1>{content ? content.title : error ? 'Shared notes' : <span className="skeleton skeleton-text" />}</h1>
              <p className="muted small">
                {content &&
                  (content.isOwner
                    ? 'Shared by you — this is what others see'
                    : `Shared by ${content.ownerName || 'another student'} · read-only`)}
                {content && subject && content.kind !== 'subject' && ` · ${subject.title}`}
              </p>
            </div>
          </div>
          <AuthLink />
        </div>
      </header>

      <div className="page subject-body">
        {error && (
          <div className="card practice-empty">
            <span className="practice-empty-icon">
              <Icon name="lock" size={24} />
            </span>
            <h2>Can't open this</h2>
            <p className="muted">{error}</p>
            <Link to="/shared" className="btn">
              Go to Sharing
            </Link>
          </div>
        )}

        {content === null && !error && <div className="card skeleton-block tall" />}

        {content && (
          <section className="card shared-bar">
            <span className="shared-bar-icon">
              <Icon name="share" size={18} />
            </span>
            <div className="shared-bar-text">
              <strong>
                {plural(visible.length, 'session')} · {plural(totals.notes, 'note')} · {plural(totals.files, 'file')}
              </strong>
              <span className="muted small">
                {content.isOwner
                  ? 'Manage who has access from the Share button on the subject or session.'
                  : 'Always shows the latest version. Copy it to edit your own version.'}
              </span>
            </div>
            {!content.isOwner && (
              <div className="shared-bar-actions">
                {confirmLeave ? (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-sm danger-fill" onClick={leave}>
                      Remove
                    </button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave(true)} title="Remove from your shared list">
                    <Icon name="x" size={15} />
                    <span className="hide-mobile">Remove</span>
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => setCopying(true)} disabled={visible.length === 0 && !hasDetails}>
                  <Icon name="copy" size={15} /> Add to my notebook
                </button>
              </div>
            )}
          </section>
        )}

        {hasDetails && content && (
          <div className="subject-tabs" role="tablist" aria-label="Shared subject">
            <button
              role="tab"
              aria-selected={view === 'sessions'}
              className={view === 'sessions' ? 'active' : undefined}
              onClick={() => setParams({}, { replace: true })}
            >
              <Icon name="calendar" size={15} /> Sessions <span className="count">{visible.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={view === 'details'}
              className={view === 'details' ? 'active' : undefined}
              onClick={() => setParams({ view: 'details' }, { replace: true })}
            >
              <Icon name="cap" size={15} /> Subject details
            </button>
          </div>
        )}

        {view === 'details' && content && (
          <div className="details-layout shared-details">
            {content.details && (
              <section className="card">
                <div className="section-head">
                  <h2>
                    <Icon name="cap" /> Course info
                  </h2>
                </div>
                <DetailsInfo details={content.details} />
                {content.details.overview && <p className="note-body details-overview">{content.details.overview}</p>}
              </section>
            )}
            <section className="card images-section">
              <div className="section-head">
                <h2>
                  <Icon name="file" /> Subject attachments
                </h2>
              </div>
              <Attachments images={content.subjectImages} documents={content.subjectDocuments} empty="No attachments." />
            </section>
          </div>
        )}

        {view === 'sessions' && content && visible.length === 0 && (
          <div className="card empty-state">
            <p>Nothing here yet.</p>
            <p className="muted small">When {content.ownerName || 'they'} add notes or files, they show up here.</p>
          </div>
        )}

        {view === 'sessions' && content && selected && (
          <div className={content.kind === 'subject' ? 'subject-layout' : 'shared-single'}>
            {content.kind === 'subject' && (
              <aside className="session-list" aria-label="Sessions">
                {visible.map((s) => (
                  <button
                    key={s.id}
                    className={`session-item${s.id === selected.id ? ' active' : ''}`}
                    onClick={() => setParams({ session: String(s.number) }, { replace: true })}
                    aria-current={s.id === selected.id ? 'true' : undefined}
                  >
                    <span className="session-item-head">
                      <strong>Session {s.number}</strong>
                      {s.lectureDate && <span className="session-date">{shortDate(s.lectureDate)}</span>}
                    </span>
                    <span className={`session-topic${s.topic ? '' : ' empty'}`}>{s.topic || 'No topic'}</span>
                    <span className="session-counts">
                      <span className="session-counts-text">
                        {plural(s.notes.length, 'note')} · {plural(s.images.length + s.documents.length, 'file')}
                      </span>
                    </span>
                  </button>
                ))}
              </aside>
            )}
            <main className="session-main">
              <SharedSessionView key={selected.id} session={selected} partial={content.kind === 'items'} />
            </main>
          </div>
        )}
      </div>

      {copying && content && <CopyDialog content={content} onClose={() => setCopying(false)} />}
    </div>
  );
}
