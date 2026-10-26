import { Link } from 'react-router-dom';
import { SUBJECTS } from '../../subjects';
import type { DashboardSession } from '../../lib/api';

const isStarted = (s: DashboardSession) => !!s.topic.trim() || s.noteCount > 0 || s.imageCount > 0;

export default function SubjectProgress({ sessions }: { sessions: DashboardSession[] | null }) {
  return (
    <section className="card">
      <div className="chart-head">
        <div>
          <h2>Progress by subject</h2>
          <p className="muted small">Each block is a session — filled once it has a topic, note or image</p>
        </div>
      </div>
      <ul className="progress-list">
        {SUBJECTS.map((subject) => {
          const own = sessions?.filter((s) => s.subjectSlug === subject.slug) ?? [];
          const started = own.filter(isStarted).length;
          const notes = own.reduce((n, s) => n + s.noteCount, 0);
          const images = own.reduce((n, s) => n + s.imageCount, 0);
          return (
            <li key={subject.slug}>
              <Link to={`/subjects/${subject.slug}`} className="progress-row">
                <span className="mini-badge" style={{ background: subject.color }}>
                  {subject.number}
                </span>
                <span className="progress-name" title={subject.title}>
                  {subject.title}
                </span>
                {sessions === null ? (
                  <span className="skeleton segments-skeleton" />
                ) : (
                  <span className="segments" aria-label={`${started} of ${own.length} sessions started`}>
                    {own.map((s) => (
                      <span
                        key={s.id}
                        className="segment"
                        title={`Session ${s.number}${s.topic ? ` — ${s.topic}` : ''}`}
                        style={isStarted(s) ? { background: subject.color } : undefined}
                      />
                    ))}
                  </span>
                )}
                <span className="progress-value">
                  {sessions === null ? '' : `${started}/${own.length}`}
                  <span className="progress-sub">
                    {sessions === null ? '' : `${notes} notes · ${images} img`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
