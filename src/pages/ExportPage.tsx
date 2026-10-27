import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findSubject } from '../subjects';
import { getSubjectExport, type ExportSession } from '../lib/api';
import { examDate, useExams } from '../lib/exams';
import { useProfile } from '../lib/profile';
import { docType } from '../lib/files';
import Icon from '../components/Icon';
import NotFound from './NotFound';

const lectureDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const stamp = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const isEmpty = (s: ExportSession) => !s.topic.trim() && !s.notes.length && !s.images.length && !s.documents.length;

/** Wait until every image on the page has loaded (or failed), so the PDF isn't missing pictures. */
const imagesReady = () =>
  Promise.all(
    Array.from(document.querySelectorAll<HTMLImageElement>('.export-doc img')).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((done) => {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }),
    ),
  );

export default function ExportPage() {
  const { slug } = useParams();
  const subject = findSubject(slug);
  const profile = useProfile();
  const exams = useExams();
  const [sessions, setSessions] = useState<ExportSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withImages, setWithImages] = useState(true);
  const [skipEmpty, setSkipEmpty] = useState(true);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!subject) return;
    // The browser suggests the document title as the PDF file name.
    document.title = `${subject.number} ${subject.title} – notes`;
    getSubjectExport(subject.slug)
      .then(setSessions)
      .catch((e) => setError(e.message));
    return () => {
      document.title = 'My lecture notes';
    };
  }, [subject]);

  if (!subject) return <NotFound />;

  const shown = (sessions ?? []).filter((s) => !skipEmpty || !isEmpty(s));
  const totals = shown.reduce(
    (t, s) => ({ notes: t.notes + s.notes.length, images: t.images + s.images.length }),
    { notes: 0, images: 0 },
  );
  const exam = exams[subject.slug];

  const print = async () => {
    setPreparing(true);
    await imagesReady();
    setPreparing(false);
    window.print();
  };

  return (
    <div className="export-page" style={{ '--accent': subject.color } as CSSProperties}>
      <header className="topbar no-print">
        <div className="topbar-inner export-toolbar">
          <Link to={`/subjects/${subject.slug}`} className="btn btn-ghost btn-sm back" aria-label="Back to subject">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Back</span>
          </Link>
          <div className="export-options">
            <label className="toggle">
              <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} />
              <span>Images</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={skipEmpty} onChange={(e) => setSkipEmpty(e.target.checked)} />
              <span>Skip empty</span>
            </label>
          </div>
          <button className="btn btn-sm" onClick={print} disabled={!sessions || preparing}>
            <Icon name="printer" size={15} />
            {preparing ? 'Preparing…' : 'Save as PDF'}
          </button>
        </div>
      </header>

      <p className="export-hint no-print">
        Choose <strong>Save as PDF</strong> as the printer. On iPhone: Share → Print, then Share again → Save to Files.
      </p>

      <article className="export-doc">
        <header className="export-cover">
          <span className="badge">{subject.number}</span>
          <div>
            <h1>{subject.title}</h1>
            <p>
              {[profile.name, profile.programme, profile.university, profile.academicYear].filter(Boolean).join(' · ')}
            </p>
            <p className="export-meta">
              {sessions ? `${shown.length} sessions · ${totals.notes} notes${withImages ? ` · ${totals.images} images` : ''}` : 'Loading…'}
              {exam && ` · Exam ${examDate(exam, true)}`}
              {` · Exported ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
          </div>
        </header>

        {error && <p className="error">{error}</p>}
        {sessions === null && !error && <div className="skeleton-block tall" />}
        {sessions && shown.length === 0 && <p className="muted">Nothing to export yet — add notes to this subject first.</p>}

        {shown.map((s) => (
          <section key={s.id} className="export-session">
            <h2>
              <span>Session {s.number}</span>
              {s.topic && ` · ${s.topic}`}
            </h2>
            {s.lectureDate && <p className="export-date">{lectureDate(s.lectureDate)}</p>}

            {s.notes.length > 0 ? (
              <div className="export-notes">
                {s.notes.map((n) => (
                  <div key={n.id} className="export-note">
                    <p className="note-body">{n.body}</p>
                    <time dateTime={n.createdAt}>{stamp(n.createdAt)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">No notes.</p>
            )}

            {withImages && s.images.length > 0 && (
              <div className="export-images">
                {s.images.map((img) => (
                  <figure key={img.id}>
                    <img src={img.url} alt={img.fileName} />
                    <figcaption>{img.fileName}</figcaption>
                  </figure>
                ))}
              </div>
            )}

            {s.documents.length > 0 && (
              <p className="export-docs">
                <strong>Attached:</strong>{' '}
                {s.documents.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ', '}
                    {d.fileName} <em>({docType(d.fileName).label})</em>
                  </span>
                ))}
              </p>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
