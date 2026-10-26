import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../config';
import { SUBJECTS } from '../subjects';
import { listSubjectStats, type SubjectStats } from '../lib/api';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function Home() {
  const [stats, setStats] = useState<Record<string, SubjectStats> | null>(null);

  useEffect(() => {
    listSubjectStats()
      .then(setStats)
      .catch(() => setStats({}));
  }, []);

  const totals = Object.values(stats ?? {}).reduce(
    (t, s) => ({ notes: t.notes + s.notes, images: t.images + s.images }),
    { notes: 0, images: 0 },
  );

  return (
    <div className="page">
      <header className="home-header">
        <div className="home-heading">
          <h1>My lecture notes</h1>
          <div className="meta-pills">
            <span className="pill">{SITE.programme}</span>
            <span className="pill">{SITE.university}</span>
            <span className="pill">{SITE.academicYear}</span>
          </div>
        </div>
        <AuthLink />
      </header>

      <div className="summary-strip">
        <span>
          <strong>{SUBJECTS.length}</strong> subjects
        </span>
        <span className={stats ? '' : 'loading-text'}>
          <Icon name="note" size={15} /> <strong>{totals.notes}</strong> {totals.notes === 1 ? 'note' : 'notes'}
        </span>
        <span className={stats ? '' : 'loading-text'}>
          <Icon name="image" size={15} /> <strong>{totals.images}</strong> {totals.images === 1 ? 'image' : 'images'}
        </span>
      </div>

      <main className="subject-grid">
        {SUBJECTS.map((s) => {
          const st = stats?.[s.slug];
          const pct = st && st.sessions ? Math.round((st.started / st.sessions) * 100) : 0;
          return (
            <Link
              key={s.slug}
              to={`/subjects/${s.slug}`}
              className="card subject-card"
              style={{ '--accent': s.color } as CSSProperties}
            >
              <div className="subject-card-top">
                <span className="badge">{s.number}</span>
                {st && (
                  <span className="card-counts">
                    <span title={plural(st.notes, 'note')}>
                      <Icon name="note" size={14} />
                      {st.notes}
                    </span>
                    <span title={plural(st.images, 'image')}>
                      <Icon name="image" size={14} />
                      {st.images}
                    </span>
                  </span>
                )}
              </div>
              <h2>{s.title}</h2>
              <div className="progress" aria-hidden>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="subject-card-foot">
                <span className="muted small">
                  {st ? `${st.started} of ${st.sessions} sessions` : <span className="skeleton skeleton-text" />}
                </span>
                <span className="open-link">
                  Open sessions <Icon name="arrowRight" size={15} />
                </span>
              </div>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
