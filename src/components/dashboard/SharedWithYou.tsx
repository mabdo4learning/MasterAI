import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { findSubject } from '../../subjects';
import { sharedWithMe, type IncomingShare } from '../../lib/sharing';
import Icon from '../Icon';

const PREVIEW = 3;

/** Notes other accounts shared with the user. Hidden when there are none (or sharing isn't set up). */
export default function SharedWithYou() {
  const [items, setItems] = useState<IncomingShare[]>([]);

  useEffect(() => {
    sharedWithMe()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="card shared-card">
      <div className="chart-head">
        <div>
          <h2>Shared with you</h2>
          <p className="muted small">Read-only notes from classmates, always up to date</p>
        </div>
        <Link to="/shared" className="btn btn-ghost btn-sm">
          See all <Icon name="arrowRight" size={15} />
        </Link>
      </div>
      <ul className="share-cards">
        {items.slice(0, PREVIEW).map((s) => {
          const subject = findSubject(s.subjectSlug);
          return (
            <li key={s.id}>
              <Link to={`/shared/${s.id}`} className="share-row">
                <span className="mini-badge" style={{ background: subject?.color ?? '#4B5563' }}>
                  {subject?.number ?? '·'}
                </span>
                <span className="share-row-text">
                  <strong>{s.title}</strong>
                  <span className="muted small">from {s.ownerName || 'another student'}</span>
                </span>
                <Icon name="chevronRight" size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
