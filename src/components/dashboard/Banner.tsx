import { Link } from 'react-router-dom';
import { useSubjects, type Subject } from '../../subjects';
import { greeting } from '../../lib/time';
import { useProfile } from '../../lib/profile';
import AuthLink from '../AuthLink';
import Icon from '../Icon';
import Logo from '../Logo';

type Props = {
  started: number | null;
  total: number;
  resume: { subject: Subject; sessionNumber: number } | null;
};

export default function Banner({ started, total, resume }: Props) {
  const profile = useProfile();
  const subjects = useSubjects();
  const firstName = profile.name.split(' ')[0];
  const pct = started !== null && total ? Math.round((started / total) * 100) : null;
  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <header className="banner">
      <div className="banner-glow" aria-hidden />
      <div className="banner-top">
        <Logo size={30} className="logo-on-ink" />
        <div className="banner-actions">
          <Link to="/search" className="btn btn-ghost btn-sm" aria-label="Search" title="Search (/)">
            <Icon name="search" size={15} />
            <span className="hide-mobile">Search</span>
          </Link>
          <Link to="/calendar" className="btn btn-ghost btn-sm" aria-label="Calendar">
            <Icon name="calendarDays" size={15} />
            <span className="hide-mobile">Calendar</span>
          </Link>
          <Link to="/shared" className="btn btn-ghost btn-sm" aria-label="Sharing" title="Sharing">
            <Icon name="users" size={15} />
            <span className="hide-mobile">Sharing</span>
          </Link>
          <AuthLink />
        </div>
      </div>

      <div className="banner-body">
        <div className="banner-text">
          <span className="banner-eyebrow">Your study notebook</span>
          <h1>
            {greeting()}
            {firstName ? (
              <>
                , <em>{firstName}</em>
              </>
            ) : null}
            .
          </h1>
          <div className="banner-pills">
            {[profile.programme, profile.university, profile.academicYear].filter(Boolean).map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
          {resume ? (
            <Link className="banner-cta" to={`/subjects/${resume.subject.slug}?session=${resume.sessionNumber}`}>
              <span className="banner-cta-label">Continue where you left off</span>
              <span className="banner-cta-target">
                <span className="mini-badge" style={{ background: resume.subject.color }}>
                  {resume.subject.number}
                </span>
                {resume.subject.title} · Session {resume.sessionNumber}
                <Icon name="arrowRight" size={16} />
              </span>
            </Link>
          ) : subjects[0] ? (
            <Link className="banner-cta" to={`/subjects/${subjects[0].slug}`}>
              <span className="banner-cta-label">Get started</span>
              <span className="banner-cta-target">
                Open your first subject <Icon name="arrowRight" size={16} />
              </span>
            </Link>
          ) : null}
        </div>

        <div className="banner-ring" role="img" aria-label={pct === null ? 'Loading progress' : `${pct}% of sessions covered`}>
          <svg viewBox="0 0 80 80" width="132" height="132">
            <circle cx="40" cy="40" r={r} className="ring-track" />
            <circle
              cx="40"
              cy="40"
              r={r}
              className="ring-fill"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - (pct ?? 0) / 100)}
            />
          </svg>
          <div className="ring-label">
            <strong>{pct === null ? '–' : `${pct}%`}</strong>
            <span>
              {started ?? '–'} of {total || '–'} sessions
            </span>
          </div>
        </div>
      </div>

      <div className="banner-stripe" aria-hidden>
        {subjects.map((s) => (
          <span key={s.slug} style={{ background: s.color }} />
        ))}
      </div>
    </header>
  );
}
