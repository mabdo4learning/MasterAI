import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { findSubject } from '../subjects';
import { listMyShares, sharedWithMe, type IncomingShare, type Share } from '../lib/sharing';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import { ShareManager, shareSummary } from '../components/ShareDialog';

const KIND_LABEL = { subject: 'Subject', session: 'Session', items: 'Selected items' } as const;

const added = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const people = (n: number) => (n === 1 ? '1 person' : `${n} people`);

/** Everything shared with the user, and everything they share. */
export default function SharingPage() {
  const [incoming, setIncoming] = useState<IncomingShare[] | null>(null);
  const [outgoing, setOutgoing] = useState<Share[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState<Share | null>(null);

  useEffect(() => {
    document.title = 'Sharing · My lecture notes';
    Promise.all([sharedWithMe(), listMyShares()])
      .then(([i, o]) => {
        setIncoming(i);
        setOutgoing(o);
      })
      .catch((e) =>
        setError(/schema cache|does not exist/.test(e.message) ? 'Sharing is not set up yet: run migrations-008-sharing.sql in Supabase.' : e.message),
      );
    return () => {
      document.title = 'My lecture notes';
    };
  }, []);

  const badge = (slug: string) => {
    const s = findSubject(slug);
    return (
      <span className="mini-badge" style={{ background: s?.color ?? '#4B5563' }}>
        {s?.number ?? '·'}
      </span>
    );
  };

  return (
    <div className="sharing-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="btn btn-ghost btn-sm back" aria-label="Dashboard">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Dashboard</span>
          </Link>
          <div className="topbar-title">
            <span className="topbar-icon">
              <Icon name="users" size={20} />
            </span>
            <div className="topbar-text">
              <h1>Sharing</h1>
              <p className="muted small">Notes shared with you, and what you share</p>
            </div>
          </div>
          <AuthLink />
        </div>
      </header>

      <div className="page settings-body">
        {error && <p className="error card">{error}</p>}

        <section className="card settings-card">
          <div className="settings-head">
            <h2>
              <Icon name="share" /> Shared with you {incoming && incoming.length > 0 && <span className="count">{incoming.length}</span>}
            </h2>
            <p className="muted small">Read-only and always up to date. Open one to copy it into your own notebook.</p>
          </div>
          {incoming === null && !error ? (
            <div className="skeleton-block note-skeleton" />
          ) : incoming?.length === 0 ? (
            <p className="empty-line">Nothing yet. When a classmate shares a link or adds your email, it appears here.</p>
          ) : (
            <ul className="share-cards">
              {incoming?.map((s) => (
                <li key={s.id}>
                  <Link to={`/shared/${s.id}`} className="share-row" style={{ '--accent': findSubject(s.subjectSlug)?.color } as CSSProperties}>
                    {badge(s.subjectSlug)}
                    <span className="share-row-text">
                      <strong>{s.title}</strong>
                      <span className="muted small">
                        {KIND_LABEL[s.kind]} · from {s.ownerName || 'another student'} · {added(s.addedAt)}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card settings-card">
          <div className="settings-head">
            <h2>
              <Icon name="link" /> Shared by you {outgoing && outgoing.length > 0 && <span className="count">{outgoing.length}</span>}
            </h2>
            <p className="muted small">
              To share, open a subject or session and press <strong>Share</strong>.
            </p>
          </div>
          {outgoing === null && !error ? (
            <div className="skeleton-block note-skeleton" />
          ) : outgoing?.length === 0 ? (
            <p className="empty-line">You haven't shared anything yet.</p>
          ) : (
            <ul className="share-cards">
              {outgoing?.map((s) => (
                <li key={s.id}>
                  <button className="share-row" onClick={() => setManaging(s)}>
                    {badge(s.subjectSlug)}
                    <span className="share-row-text">
                      <strong>{s.title}</strong>
                      <span className="muted small">
                        {shareSummary(s)} · {people(s.recipientCount)} · {s.linkEnabled ? 'link on' : 'link off'}
                      </span>
                    </span>
                    <span className="btn btn-ghost btn-sm" aria-hidden>
                      Manage
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {managing && (
        <Sheet title="Manage sharing" onClose={() => setManaging(null)}>
          <ShareManager
            share={managing}
            onChange={(next) => {
              setManaging(next);
              setOutgoing((list) => list?.map((s) => (s.id === next.id ? next : s)) ?? null);
            }}
            onDeleted={() => {
              setOutgoing((list) => list?.filter((s) => s.id !== managing.id) ?? null);
              setManaging(null);
            }}
          />
          <p className="muted small center">
            <Link to={`/shared/${managing.id}`}>See what they see</Link>
          </p>
        </Sheet>
      )}
    </div>
  );
}
