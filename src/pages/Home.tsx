import { Link } from 'react-router-dom';
import { SITE } from '../config';
import { SUBJECTS } from '../subjects';
import AuthLink from '../components/AuthLink';

export default function Home() {
  return (
    <div className="page">
      <header className="home-header">
        <div>
          <h1>My lecture notes</h1>
          <p className="muted">
            {SITE.programme} · {SITE.university} · {SITE.academicYear}
          </p>
        </div>
        <AuthLink />
      </header>

      <main className="subject-grid">
        {SUBJECTS.map((s) => (
          <Link key={s.slug} to={`/subjects/${s.slug}`} className="card subject-card">
            <span className="badge" style={{ background: s.color }}>
              {s.number}
            </span>
            <h2>{s.title}</h2>
            <span className="open-link" style={{ color: s.color }}>
              Open sessions <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </main>
    </div>
  );
}
