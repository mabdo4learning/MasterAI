import { Link } from 'react-router-dom';
import { findSubject } from '../../subjects';
import type { ActivityItem } from '../../lib/api';
import { timeAgo } from '../../lib/time';
import { docType } from '../../lib/files';
import Icon from '../Icon';

export default function RecentActivity({ items }: { items: ActivityItem[] | null }) {
  return (
    <section className="card recent-card">
      <div className="chart-head">
        <div>
          <h2>Recent activity</h2>
          <p className="muted small">Your latest notes, images and documents</p>
        </div>
      </div>

      {items === null ? (
        <div className="recent-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-block recent-skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="recent-empty">
          <Icon name="note" size={22} />
          <p>Nothing yet. Notes, images and documents you add will show up here.</p>
        </div>
      ) : (
        <ul className="recent-list">
          {items.map((item) => {
            const subject = findSubject(item.subjectSlug);
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link to={`/subjects/${item.subjectSlug}?session=${item.sessionNumber}`} className="recent-item">
                  {item.kind === 'image' ? (
                    <img className="recent-thumb" src={item.url} alt="" loading="lazy" />
                  ) : item.kind === 'document' ? (
                    <span className="recent-icon recent-doc" style={{ background: docType(item.text).color }}>
                      {docType(item.text).label}
                    </span>
                  ) : (
                    <span className="recent-icon">
                      <Icon name="note" size={18} />
                    </span>
                  )}
                  <span className="recent-text">
                    <span className={item.kind === 'note' ? 'recent-note' : 'recent-file'}>{item.text}</span>
                    <span className="recent-meta">
                      <span className="dot" style={{ background: subject?.color }} />
                      {subject ? `${subject.number} · Session ${item.sessionNumber}` : 'Session'}
                      <span className="sep">·</span>
                      {timeAgo(item.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
