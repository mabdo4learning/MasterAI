import { Link } from 'react-router-dom';
import { SUBJECTS } from '../../subjects';
import type { DashboardSession } from '../../lib/api';
import { STEPS, checklist, stepsDone } from '../../lib/checklist';

export default function SubjectProgress({ sessions }: { sessions: DashboardSession[] | null }) {
  return (
    <section className="card">
      <div className="chart-head">
        <div>
          <h2>Progress by subject</h2>
          <p className="muted small">
            Each block is a session, filling up as you tick attended, notes, slides and reviewed
          </p>
        </div>
      </div>
      <ul className="progress-list">
        {SUBJECTS.map((subject) => {
          const own = sessions?.filter((s) => s.subjectSlug === subject.slug) ?? [];
          const complete = own.filter((s) => stepsDone(s) === STEPS).length;
          const reviewed = own.filter((s) => s.reviewed).length;
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
                  <span className="segments" aria-label={`${complete} of ${own.length} sessions complete`}>
                    {own.map((s) => {
                      const pct = (stepsDone(s) / STEPS) * 100;
                      const missing = checklist(s).filter((x) => !x.done).map((x) => x.label.toLowerCase());
                      return (
                        <span
                          key={s.id}
                          className="segment"
                          title={`Session ${s.number}${s.topic ? ` — ${s.topic}` : ''}\n${
                            missing.length ? `To do: ${missing.join(', ')}` : 'All steps done'
                          }`}
                          style={
                            pct > 0
                              ? { background: `linear-gradient(90deg, ${subject.color} ${pct}%, #eceef1 ${pct}%)` }
                              : undefined
                          }
                        />
                      );
                    })}
                  </span>
                )}
                <span className="progress-value">
                  {sessions === null ? '' : `${complete}/${own.length}`}
                  <span className="progress-sub">{sessions === null ? '' : `done · ${reviewed} reviewed`}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
