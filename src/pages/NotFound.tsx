import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page center-page">
      <div className="card narrow-card">
        <h1>Page not found</h1>
        <p className="muted">That subject or page doesn't exist.</p>
        <Link className="btn" to="/">
          Back to all subjects
        </Link>
      </div>
    </div>
  );
}
