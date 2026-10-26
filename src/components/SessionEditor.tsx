import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  addNote,
  deleteImage,
  deleteNote,
  listImages,
  listNotes,
  updateSession,
  uploadImage,
  type LectureImage,
  type LectureSession,
  type Note,
} from '../lib/api';
import Lightbox from './Lightbox';

type Props = {
  subjectSlug: string;
  session: LectureSession;
  canEdit: boolean;
  onPatch: (patch: Partial<LectureSession>) => void;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const formatStamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const formatDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' });

export default function SessionEditor({ subjectSlug, session, canEdit, onPatch }: Props) {
  const [topic, setTopic] = useState(session.topic);
  const [date, setDate] = useState(session.lectureDate ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [images, setImages] = useState<LectureImage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = useRef<{ topic?: string; lecture_date?: string | null }>({});
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listNotes(session.id).then(setNotes).catch((e) => setError(e.message));
    listImages(session.id).then(setImages).catch((e) => setError(e.message));
  }, [session.id]);

  const flush = async () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setSaveState('saving');
    try {
      await updateSession(session.id, patch);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError((e as Error).message);
    }
  };

  // Save any unsaved topic/date edits when switching sessions or leaving the page.
  useEffect(() => () => void flush(), []);

  const queueSave = (patch: { topic?: string; lecture_date?: string | null }) => {
    pending.current = { ...pending.current, ...patch };
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  };

  const onTopic = (value: string) => {
    setTopic(value);
    onPatch({ topic: value });
    queueSave({ topic: value });
  };

  const onDate = (value: string) => {
    setDate(value);
    onPatch({ lectureDate: value || null });
    queueSave({ lecture_date: value || null });
  };

  const submitNote = async () => {
    const body = draft.trim();
    if (!body || !notes) return;
    setAddingNote(true);
    try {
      const note = await addNote(session.id, body);
      const next = [note, ...notes];
      setNotes(next);
      onPatch({ noteCount: next.length });
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingNote(false);
    }
  };

  const onDraftKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitNote();
    }
  };

  const removeNote = async (note: Note) => {
    if (!notes || !confirm('Delete this note?')) return;
    try {
      await deleteNote(note.id);
      const next = notes.filter((n) => n.id !== note.id);
      setNotes(next);
      onPatch({ noteCount: next.length });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUpload({ done: 0, total: files.length });
    let list = images ?? [];
    for (const [i, file] of files.entries()) {
      try {
        const img = await uploadImage(subjectSlug, session.id, file);
        list = [...list, img];
        setImages(list);
        onPatch({ imageCount: list.length });
      } catch (err) {
        setError(`${file.name}: ${(err as Error).message}`);
      }
      setUpload({ done: i + 1, total: files.length });
    }
    setUpload(null);
  };

  const removeImage = async (img: LectureImage) => {
    if (!images || !confirm(`Remove ${img.fileName}?`)) return;
    try {
      await deleteImage(img);
      const next = images.filter((i) => i.id !== img.id);
      setImages(next);
      onPatch({ imageCount: next.length });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="session-editor">
      {error && (
        <div className="error card error-bar">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="card">
        <div className="section-head">
          <h2>Session {session.number}</h2>
          {canEdit && saveState !== 'idle' && (
            <span className={`save-state ${saveState}`}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Not saved'}
            </span>
          )}
        </div>
        {canEdit ? (
          <div className="fields">
            <label className="field-topic">
              Lecture topic
              <input
                type="text"
                value={topic}
                placeholder="e.g. Porter's Five Forces"
                onChange={(e) => onTopic(e.target.value)}
                onBlur={flush}
              />
            </label>
            <label className="field-date">
              Date
              <input type="date" value={date} onChange={(e) => onDate(e.target.value)} onBlur={flush} />
            </label>
          </div>
        ) : (
          <div className="fields-readonly">
            <p className="topic-text">{topic || <span className="muted">No topic yet</span>}</p>
            {date && <p className="muted small">{formatDate(date)}</p>}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Notes</h2>
          <span className="muted small">{notes?.length ?? 0}</span>
        </div>
        {canEdit && (
          <div className="note-compose">
            <textarea
              value={draft}
              rows={4}
              placeholder="Write a note…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onDraftKey}
            />
            <div className="compose-actions">
              <span className="muted small hide-mobile">⌘/Ctrl + Enter to add</span>
              <button className="btn" onClick={submitNote} disabled={addingNote || !draft.trim()}>
                {addingNote ? 'Adding…' : 'Add note'}
              </button>
            </div>
          </div>
        )}
        {notes === null ? (
          <p className="muted small">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="muted small">No notes yet.</p>
        ) : (
          <ul className="note-list">
            {notes.map((n) => (
              <li key={n.id} className="note">
                <div className="note-meta">
                  <time className="muted small">{formatStamp(n.createdAt)}</time>
                  {canEdit && (
                    <button className="icon-btn" onClick={() => removeNote(n)} aria-label="Delete note">
                      Delete
                    </button>
                  )}
                </div>
                <p className="note-body">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Images</h2>
          {canEdit && (
            <>
              <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onFiles} />
              <button className="btn btn-outline" onClick={() => fileInput.current?.click()} disabled={!!upload}>
                {upload ? `Uploading ${upload.done}/${upload.total}…` : 'Upload images'}
              </button>
            </>
          )}
        </div>
        {images === null ? (
          <p className="muted small">Loading…</p>
        ) : images.length === 0 ? (
          <p className="muted small">No images yet.</p>
        ) : (
          <ul className="image-grid">
            {images.map((img, i) => (
              <li key={img.id} className="thumb">
                <button className="thumb-img" onClick={() => setViewing(i)} aria-label={`View ${img.fileName}`}>
                  <img src={img.url} alt={img.fileName} loading="lazy" />
                </button>
                <div className="thumb-meta">
                  <span className="thumb-name" title={img.fileName}>
                    {img.fileName}
                  </span>
                  {canEdit && (
                    <button className="icon-btn" onClick={() => removeImage(img)} aria-label={`Remove ${img.fileName}`}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewing !== null && images && images[viewing] && (
        <Lightbox images={images} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
