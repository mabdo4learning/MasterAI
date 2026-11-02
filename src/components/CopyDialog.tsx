import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PALETTE, createSubjects, findSubject, useSubjects } from '../subjects';
import { listSessions, type LectureSession } from '../lib/api';
import { copyToNotebook, sessionIsEmpty, type CopyProgress, type CopyResult, type SharedContent } from '../lib/sharing';
import Icon from './Icon';
import Sheet from './Sheet';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Copies a share into the signed-in user's own notebook, where it becomes theirs to edit. */
export default function CopyDialog({ content, onClose }: { content: SharedContent; onClose: () => void }) {
  const whole = content.kind === 'subject';
  const sessions = content.sessions.filter((s) => !sessionIsEmpty(s));
  const single = content.sessions[0];
  const subjects = useSubjects();
  // The owner's subject: copied into one of mine with the same slug, or created as a new subject.
  const source = content.subject ?? { title: content.subjectSlug, color: PALETTE[0] };
  const [haveSource] = useState(() => !!findSubject(content.subjectSlug));
  const [slug, setSlug] = useState(content.subjectSlug);
  const [mine, setMine] = useState<LectureSession[] | null>(null);
  const [number, setNumber] = useState<number>(single?.number ?? 1);
  const [progress, setProgress] = useState<CopyProgress | null>(null);
  const [result, setResult] = useState<CopyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (whole) return;
    setMine(null);
    listSessions(slug)
      .then((list) => {
        setMine(list);
        // Keep the same session number when it exists, otherwise default to the first empty one.
        setNumber((n) =>
          list.length === 0 || list.some((s) => s.number === n)
            ? n
            : (list.find((s) => !s.topic && s.noteCount + s.imageCount + s.documentCount === 0)?.number ?? list[0]?.number ?? 1),
        );
      })
      .catch((e) => setError(e.message));
  }, [slug, whole]);

  const run = async () => {
    setError(null);
    try {
      // Copying into a subject I don't have yet creates it, with the owner's name and colour.
      if ((whole || slug === content.subjectSlug) && !findSubject(content.subjectSlug)) {
        await createSubjects([{ title: source.title, color: source.color, sessions: 0, slug: content.subjectSlug }]);
      }
      const targets = whole
        ? sessions.map((s) => ({ from: s, subjectSlug: content.subjectSlug, number: s.number }))
        : [{ from: single, subjectSlug: slug, number }];
      const extras = whole
        ? { subjectSlug: content.subjectSlug, details: content.details, images: content.subjectImages, documents: content.subjectDocuments }
        : undefined;
      setResult(await copyToNotebook(targets, setProgress, extras));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const target = findSubject(whole ? content.subjectSlug : slug);
  const nextNumber = Math.max(0, ...(mine ?? []).map((s) => s.number)) + 1;
  const busy = progress !== null;
  const openLink = target && `/subjects/${target.slug}${whole ? '' : `?session=${number}`}`;

  return (
    <Sheet title="Add to my notebook" onClose={busy ? () => {} : onClose}>
      {result ? (
        <div className="copy-done">
          <span className="done-icon">
            <Icon name="check" size={24} />
          </span>
          <p>
            Copied {plural(result.notes, 'note')}, {plural(result.files, 'file')}
            {result.questions > 0 && ` and ${plural(result.questions, 'question')}`}
            {result.details && ', plus the course info,'} into your notebook. They are yours now —
            edit them like any other note.
          </p>
          {result.failedFiles.length > 0 && (
            <p className="error">Couldn't copy: {result.failedFiles.join(', ')}</p>
          )}
          <div className="compose-actions">
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            {openLink && (
              <Link className="btn" to={openLink}>
                Open in my notebook <Icon name="arrowRight" size={16} />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="copy-form">
          {whole ? (
            <p className="muted">
              Copies {plural(sessions.length, 'session')} with notes or files into {haveSource ? 'your' : 'a new subject,'} <strong>{target?.title ?? source.title}</strong>,
              keeping the same session numbers, along with the subject details and attachments. Anything you already have stays — copies are added next to it, and course info only fills fields you left empty.
            </p>
          ) : (
            <>
              <p className="muted">
                Choose where to put it. The copy is added next to anything already in that session, and fills the topic and date
                only if yours are empty.
              </p>
              <div className="copy-fields">
                <label>
                  <span>Subject</span>
                  <select value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy}>
                    {subjects.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.number} · {s.title}
                      </option>
                    ))}
                    {!haveSource && <option value={content.subjectSlug}>New subject · {source.title}</option>}
                  </select>
                </label>
                <label>
                  <span>Session</span>
                  <select value={number} onChange={(e) => setNumber(Number(e.target.value))} disabled={busy || mine === null}>
                    {mine?.map((s) => (
                      <option key={s.id} value={s.number}>
                        Session {s.number}
                        {s.topic ? ` · ${s.topic}` : ''}
                      </option>
                    ))}
                    <option value={nextNumber}>New session {nextNumber}</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {progress && (
            <div className="backup-progress" role="status">
              <span className="muted small">
                Copying {progress.done} of {progress.total}…
              </span>
              <span className="weekly-bar">
                <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </span>
            </div>
          )}
          {error && <p className="error">{error}</p>}

          <div className="compose-actions">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn" onClick={run} disabled={busy || (whole ? sessions.length === 0 && !content.details && content.subjectImages.length + content.subjectDocuments.length === 0 : mine === null)}>
              <Icon name="copy" size={16} />
              {busy ? 'Copying…' : 'Copy to my notebook'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
