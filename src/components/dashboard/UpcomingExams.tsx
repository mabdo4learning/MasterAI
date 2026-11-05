import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { findSubject } from '../../subjects';
import type { DashboardSession } from '../../lib/api';
import { countdown, daysUntil, examDate, useExams } from '../../lib/exams';
import Icon from '../Icon';

export default function UpcomingExams({ sessions }: { sessions: DashboardSession[] | null }) {
  const exams = useExams();
  const upcoming = Object.entries(exams)
    .filter(([slug, date]) => findSubject(slug) && daysUntil(date) >= 0)
    .sort(([, a], [, b]) => a.localeCompare(b));

  return (
    <section className="card exams-card">
      <div className="chart-head">
        <div>
          <h2>Upcoming exams</h2>
          <p className="muted small">Countdown and the sessions you still need notes for</p>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="recent-empty">
          <Icon name="cap" size={22} />
          <p>No upcoming exams. Open a subject and choose “Set exam date” to start a countdown.</p>
        </div>
      ) : (
        <ul className="exam-tiles">
          {upcoming.map(([slug, date]) => {
            const subject = findSubject(slug)!;
            const own = sessions?.filter((s) => s.subjectSlug === slug) ?? [];
            const missing = own.filter((s) => s.noteCount === 0);
            const days = daysUntil(date);
            const target = missing[0] ? `/subjects/${slug}?session=${missing[0].number}` : `/subjects/${slug}`;
            return (
              <li key={slug}>
                <Link
                  to={target}
                  className={`exam-tile${days <= 7 ? ' urgent' : days <= 21 ? ' soon' : ''}`}
                  style={{ '--accent': subject.color } as CSSProperties}
                >
                  <span className="exam-tile-head">
                    <span className="mini-badge" style={{ background: subject.color }}>
                      {subject.number}
                    </span>
                    <span className="exam-tile-title" title={subject.title}>
                      {subject.title}
                    </span>
                  </span>
                  <span className="exam-tile-count">
                    <strong>{days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}</strong>
                    <span>{examDate(date)}</span>
                  </span>
                  <span className="segments" aria-hidden>
                    {own.map((s) => (
                      <span
                        key={s.id}
                        className="segment"
                        style={s.noteCount > 0 ? { background: subject.color } : undefined}
                      />
                    ))}
                  </span>
                  <span className="exam-tile-foot">
                    {sessions === null
                      ? 'Loading…'
                      : missing.length === 0
                        ? 'All sessions have notes'
                        : `${missing.length} of ${own.length} sessions without notes`}
                    <Icon name="arrowRight" size={14} />
                  </span>
                  <span className="sr-only">{countdown(date)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
