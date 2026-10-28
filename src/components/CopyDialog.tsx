import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUBJECTS, findSubject } from '../subjects';
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
  const [slug, setSlug] = useState(findSubject(content.subjectSlug) ? content.subjectSlug : SUBJECTS[0].slug);
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
          list.some((s) => s.number === n)
            ? n
            : (list.find((s) => !s.topic && s.noteCount + s.imageCount + s.documentCount === 0)?.number ?? list[0]?.number ?? 1),
        );
      })
      .catch((e) => setError(e.message));
  }, [slug, whole]);

  const run = async () => {
    setError(null);
    try {
      const targets = whole
        ? sessions.map((s) => ({ from: s, subjectSlug: content.subjectSlug, number: s.number }))
        : [{ from: single, subjectSlug: slug, number }];
      setResult(await copyToNotebook(targets, setProgress));
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
            {result.questions > 0 && ` and ${plural(result.questions, 'question')}`} into your notebook. They are yours now —
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
              Copies {plural(sessions.length, 'session')} with notes or files into your <strong>{target?.title ?? content.subjectSlug}</strong>,
              keeping the same session numbers. Anything you already have there stays — the copies are added next to it.
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
                    {SUBJECTS.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.number} · {s.title}
                      </option>
                    ))}
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
            <button className="btn" onClick={run} disabled={busy || (whole ? sessions.length === 0 : mine === null)}>
              <Icon name="copy" size={16} />
              {busy ? 'Copying…' : 'Copy to my notebook'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
