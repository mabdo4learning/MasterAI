import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
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
import ConfirmButton from './ConfirmButton';
import Icon from './Icon';
import Lightbox from './Lightbox';
import { useToast } from './Toast';

type Props = {
  subjectSlug: string;
  session: LectureSession;
  total: number;
  canEdit: boolean;
  onPatch: (patch: Partial<LectureSession>) => void;
  onPrev?: () => void;
  onNext?: () => void;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type PendingUpload = { key: string; name: string; preview: string };

const formatStamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const formatDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const isImage = (f: File) => f.type.startsWith('image/');

export default function SessionEditor({ subjectSlug, session, total, canEdit, onPatch, onPrev, onNext }: Props) {
  const toast = useToast();
  const [topic, setTopic] = useState(session.topic);
  const [date, setDate] = useState(session.lectureDate ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [images, setImages] = useState<LectureImage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const unsaved = useRef<{ topic?: string; lecture_date?: string | null }>({});
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listNotes(session.id).then(setNotes).catch((e) => toast(e.message, 'error'));
    listImages(session.id).then(setImages).catch((e) => toast(e.message, 'error'));
  }, [session.id, toast]);

  // Keep the counts in the session list in sync.
  useEffect(() => {
    if (notes) onPatch({ noteCount: notes.length });
  }, [notes?.length]);
  useEffect(() => {
    if (images) onPatch({ imageCount: images.length });
  }, [images?.length]);

  const flush = async () => {
    window.clearTimeout(timer.current);
    const patch = unsaved.current;
    if (Object.keys(patch).length === 0) return;
    unsaved.current = {};
    setSaveState('saving');
    try {
      await updateSession(session.id, patch);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      toast((e as Error).message, 'error');
    }
  };

  // Save any unsaved topic/date edits when switching sessions or leaving the page.
  useEffect(() => () => void flush(), []);

  const queueSave = (patch: { topic?: string; lecture_date?: string | null }) => {
    unsaved.current = { ...unsaved.current, ...patch };
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

  const autoGrow = () => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  const submitNote = async () => {
    const body = draft.trim();
    if (!body) return;
    setAddingNote(true);
    try {
      const note = await addNote(session.id, body);
      setNotes((list) => [note, ...(list ?? [])]);
      setDraft('');
      requestAnimationFrame(autoGrow);
      toast('Note added');
    } catch (e) {
      toast((e as Error).message, 'error');
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
    try {
      await deleteNote(note.id);
      setNotes((list) => list?.filter((n) => n.id !== note.id) ?? null);
      toast('Note deleted');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const uploadFiles = async (files: File[]) => {
    const imgs = files.filter(isImage);
    if (imgs.length < files.length) toast('Only image files can be uploaded', 'error');
    if (imgs.length === 0) return;

    const queue = imgs.map((file) => ({
      file,
      item: { key: crypto.randomUUID(), name: file.name, preview: URL.createObjectURL(file) },
    }));
    setPending((p) => [...p, ...queue.map((q) => q.item)]);

    let ok = 0;
    for (const { file, item } of queue) {
      try {
        const img = await uploadImage(subjectSlug, session.id, file);
        setImages((list) => [...(list ?? []), img]);
        ok += 1;
      } catch (err) {
        toast(`${file.name}: ${(err as Error).message}`, 'error');
      }
      setPending((p) => p.filter((x) => x.key !== item.key));
      URL.revokeObjectURL(item.preview);
    }
    if (ok) toast(ok === 1 ? 'Image uploaded' : `${ok} images uploaded`);
  };

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    uploadFiles(files);
  };

  // Paste screenshots straight from the clipboard.
  useEffect(() => {
    if (!canEdit) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(isImage);
      if (files.length === 0) return;
      e.preventDefault();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      uploadFiles(
        files.map((f, i) =>
          f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${stamp}${i ? `-${i}` : ''}.png`, { type: f.type }),
        ),
      );
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  const dragProps = canEdit
    ? {
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: (e: DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  const removeImage = async (img: LectureImage) => {
    try {
      await deleteImage(img);
      setImages((list) => list?.filter((i) => i.id !== img.id) ?? null);
      toast('Image removed');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const imageCount = (images?.length ?? 0) + pending.length;

  return (
    <div className="session-editor">
      <section className="card session-header">
        <div className="session-header-top">
          <span className="eyebrow">
            Session {session.number} <span className="muted">of {total}</span>
          </span>
          <div className="header-actions">
            {canEdit && saveState !== 'idle' && (
              <span className={`save-state ${saveState}`}>
                {saveState === 'saved' && <Icon name="check" size={13} />}
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Not saved'}
              </span>
            )}
            <div className="pager">
              <button className="icon-btn" onClick={onPrev} disabled={!onPrev} aria-label="Previous session">
                <Icon name="chevronLeft" />
              </button>
              <button className="icon-btn" onClick={onNext} disabled={!onNext} aria-label="Next session">
                <Icon name="chevronRight" />
              </button>
            </div>
          </div>
        </div>

        {canEdit ? (
          <div className="fields">
            <label className="field-topic">
              <span>Lecture topic</span>
              <input
                className="topic-input"
                type="text"
                value={topic}
                placeholder="What was this lecture about?"
                onChange={(e) => onTopic(e.target.value)}
                onBlur={flush}
              />
            </label>
            <label className="field-date">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => onDate(e.target.value)} onBlur={flush} />
            </label>
          </div>
        ) : (
          <div className="fields-readonly">
            <p className={`topic-text${topic ? '' : ' muted'}`}>{topic || 'No topic yet'}</p>
            {date && (
              <p className="muted small date-line">
                <Icon name="calendar" size={14} /> {formatDate(date)}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>
            <Icon name="note" /> Notes {notes && notes.length > 0 && <span className="count">{notes.length}</span>}
          </h2>
        </div>

        {canEdit && (
          <div className="note-compose">
            <textarea
              ref={textarea}
              value={draft}
              rows={3}
              placeholder="Write a note…"
              onChange={(e) => {
                setDraft(e.target.value);
                autoGrow();
              }}
              onKeyDown={onDraftKey}
            />
            <div className="compose-actions">
              <span className="muted small hide-mobile">
                <kbd>⌘</kbd> + <kbd>Enter</kbd> to add
              </span>
              <button className="btn" onClick={submitNote} disabled={addingNote || !draft.trim()}>
                <Icon name="plus" size={16} />
                {addingNote ? 'Adding…' : 'Add note'}
              </button>
            </div>
          </div>
        )}

        {notes === null ? (
          <div className="note-list">
            <div className="skeleton-block note-skeleton" />
            <div className="skeleton-block note-skeleton" />
          </div>
        ) : notes.length === 0 ? (
          <p className="empty-line">No notes yet{canEdit ? ' — your first note will appear here.' : '.'}</p>
        ) : (
          <ul className="note-list">
            {notes.map((n) => (
              <li key={n.id} className="note">
                <div className="note-meta">
                  <time dateTime={n.createdAt}>{formatStamp(n.createdAt)}</time>
                  {canEdit && <ConfirmButton label="Delete note" onConfirm={() => removeNote(n)} />}
                </div>
                <p className="note-body">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`card images-section${dragging ? ' dragging' : ''}`} {...dragProps}>
        <div className="section-head">
          <h2>
            <Icon name="image" /> Images {imageCount > 0 && <span className="count">{imageCount}</span>}
          </h2>
          {canEdit && (
            <>
              <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onFiles} />
              <button className="btn btn-outline btn-sm" onClick={() => fileInput.current?.click()}>
                <Icon name="upload" size={15} />
                Upload images
              </button>
            </>
          )}
        </div>

        {images === null ? (
          <div className="image-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-block thumb-skeleton" />
            ))}
          </div>
        ) : imageCount === 0 && !canEdit ? (
          <p className="empty-line">No images yet.</p>
        ) : (
          imageCount > 0 && (
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
                    {canEdit && <ConfirmButton label={`Remove ${img.fileName}`} onConfirm={() => removeImage(img)} />}
                  </div>
                </li>
              ))}
              {pending.map((p) => (
                <li key={p.key} className="thumb uploading">
                  <div className="thumb-img">
                    <img src={p.preview} alt="" />
                    <span className="spinner" aria-label="Uploading" />
                  </div>
                  <div className="thumb-meta">
                    <span className="thumb-name">{p.name}</span>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {canEdit && (
          <button
            type="button"
            className={`dropzone${imageCount > 0 ? ' compact' : ''}`}
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="upload" size={imageCount > 0 ? 16 : 22} />
            <span>
              <strong>Choose images</strong>
              <span className="hide-mobile"> or drag them here</span>
            </span>
            <span className="muted small hide-mobile">You can also paste screenshots with ⌘V</span>
          </button>
        )}

        {dragging && (
          <div className="drop-overlay">
            <Icon name="upload" size={28} />
            Drop to upload
          </div>
        )}
      </section>

      {viewing !== null && images && images[viewing] && (
        <Lightbox images={images} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
