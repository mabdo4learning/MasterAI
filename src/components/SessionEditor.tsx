import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import {
  addNote,
  deleteDocument,
  deleteImage,
  deleteNote,
  documentUrl,
  listDocuments,
  listImages,
  listNotes,
  updateNote,
  updateSession,
  uploadDocument,
  uploadImage,
  type LectureDocument,
  type LectureImage,
  type LectureSession,
  type Note,
} from '../lib/api';
import { ACCEPT, MAX_UPLOAD_BYTES, docType, fileKind, formatBytes } from '../lib/files';
import ConfirmButton from './ConfirmButton';
import DocumentViewer from './DocumentViewer';
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

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Grow a textarea to fit its text, so long notes don't need an inner scrollbar. */
const fitHeight = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
};

/** Phone cameras name every shot "image.jpg"; give photos a readable, unique name instead. */
const photoName = (file: File, i: number) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/heic' ? 'heic' : 'jpg';
  return new File([file], `photo-${stamp}${i ? `-${i}` : ''}.${ext}`, { type: file.type || 'image/jpeg' });
};

export default function SessionEditor({ subjectSlug, session, total, canEdit, onPatch, onPrev, onNext }: Props) {
  const toast = useToast();
  const [topic, setTopic] = useState(session.topic);
  const [date, setDate] = useState(session.lectureDate ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [images, setImages] = useState<LectureImage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [documents, setDocuments] = useState<LectureDocument[] | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{ key: string; name: string; size: number }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [viewingDoc, setViewingDoc] = useState<LectureDocument | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const unsaved = useRef<{ topic?: string; lecture_date?: string | null }>({});
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listNotes(session.id).then(setNotes).catch((e) => toast(e.message, 'error'));
    listImages(session.id).then(setImages).catch((e) => toast(e.message, 'error'));
    listDocuments(session.id).then(setDocuments).catch((e) => toast(e.message, 'error'));
  }, [session.id, toast]);

  // Keep the counts in the session list in sync.
  useEffect(() => {
    if (notes) onPatch({ noteCount: notes.length });
  }, [notes?.length]);
  useEffect(() => {
    if (images) onPatch({ imageCount: images.length });
  }, [images?.length]);
  useEffect(() => {
    if (documents) onPatch({ documentCount: documents.length });
  }, [documents?.length]);

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

  const autoGrow = () => fitHeight(textarea.current);

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

  const saveEdit = async () => {
    if (!editing) return;
    const body = editing.body.trim();
    const original = notes?.find((n) => n.id === editing.id);
    if (!body || body === original?.body) {
      setEditing(null);
      return;
    }
    setSavingEdit(true);
    try {
      const note = await updateNote(editing.id, body);
      setNotes((list) => list?.map((n) => (n.id === note.id ? note : n)) ?? null);
      setEditing(null);
      toast('Note updated');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  const uploadFiles = async (files: File[]) => {
    const unsupported = files.filter((f) => !fileKind(f));
    const tooBig = files.filter((f) => fileKind(f) === 'document' && f.size > MAX_UPLOAD_BYTES);
    if (unsupported.length) toast(`Can't upload ${unsupported.map((f) => f.name).join(', ')} — unsupported file type`, 'error');
    if (tooBig.length) toast(`${tooBig.map((f) => f.name).join(', ')} is over the 50 MB limit`, 'error');

    const imgs = files.filter((f) => fileKind(f) === 'image');
    const docs = files.filter((f) => fileKind(f) === 'document' && f.size <= MAX_UPLOAD_BYTES);
    if (imgs.length === 0 && docs.length === 0) return;

    const imageQueue = imgs.map((file) => ({
      file,
      item: { key: crypto.randomUUID(), name: file.name, preview: URL.createObjectURL(file) },
    }));
    const docQueue = docs.map((file) => ({ file, item: { key: crypto.randomUUID(), name: file.name, size: file.size } }));
    setPending((p) => [...p, ...imageQueue.map((q) => q.item)]);
    setPendingDocs((p) => [...p, ...docQueue.map((q) => q.item)]);

    let imagesDone = 0;
    let docsDone = 0;
    for (const { file, item } of imageQueue) {
      try {
        const img = await uploadImage(subjectSlug, session.id, file);
        setImages((list) => [...(list ?? []), img]);
        imagesDone += 1;
      } catch (err) {
        toast(`${file.name}: ${(err as Error).message}`, 'error');
      }
      setPending((p) => p.filter((x) => x.key !== item.key));
      URL.revokeObjectURL(item.preview);
    }
    for (const { file, item } of docQueue) {
      try {
        const doc = await uploadDocument(subjectSlug, session.id, file);
        setDocuments((list) => [...(list ?? []), doc]);
        docsDone += 1;
      } catch (err) {
        toast(`${file.name}: ${(err as Error).message}`, 'error');
      }
      setPendingDocs((p) => p.filter((x) => x.key !== item.key));
    }

    const parts = [
      imagesDone && (imagesDone === 1 ? '1 image' : `${imagesDone} images`),
      docsDone && (docsDone === 1 ? '1 document' : `${docsDone} documents`),
    ].filter(Boolean);
    if (parts.length) toast(`${parts.join(' and ')} uploaded`);
  };

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    uploadFiles(files);
  };

  const onPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    uploadFiles(files.map(photoName));
  };

  // Paste screenshots (or files copied in Finder/Explorer) straight from the clipboard.
  useEffect(() => {
    if (!canEdit) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => fileKind(f));
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

  const removeDocument = async (doc: LectureDocument) => {
    try {
      await deleteDocument(doc);
      setDocuments((list) => list?.filter((d) => d.id !== doc.id) ?? null);
      toast('Document removed');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const download = async (doc: LectureDocument) => {
    try {
      window.location.href = await documentUrl(doc, true);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const imageCount = (images?.length ?? 0) + pending.length;
  const docCount = (documents?.length ?? 0) + pendingDocs.length;
  const fileCount = imageCount + docCount;

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
            {notes.map((n) =>
              editing?.id === n.id ? (
                <li key={n.id} className="note editing">
                  <textarea
                    ref={(el) => fitHeight(el)}
                    value={editing.body}
                    autoFocus
                    aria-label="Edit note"
                    onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                    onChange={(e) => {
                      setEditing({ id: n.id, body: e.target.value });
                      fitHeight(e.target);
                    }}
                    onKeyDown={onEditKey}
                  />
                  <div className="compose-actions">
                    <span className="muted small hide-mobile">
                      <kbd>Esc</kbd> to cancel
                    </span>
                    <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={savingEdit}>
                      Cancel
                    </button>
                    <button className="btn" onClick={saveEdit} disabled={savingEdit || !editing.body.trim()}>
                      <Icon name="check" size={16} />
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </li>
              ) : (
                <li key={n.id} className="note">
                  <div className="note-meta">
                    <span className="note-stamp">
                      <time dateTime={n.createdAt}>{formatStamp(n.createdAt)}</time>
                      {n.updatedAt && (
                        <span className="note-edited" title={`Edited ${formatStamp(n.updatedAt)}`}>
                          · edited
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <span className="note-actions">
                        <button
                          className="icon-btn"
                          onClick={() => setEditing({ id: n.id, body: n.body })}
                          aria-label="Edit note"
                          title="Edit"
                        >
                          <Icon name="pencil" size={16} />
                        </button>
                        <ConfirmButton label="Delete note" onConfirm={() => removeNote(n)} />
                      </span>
                    )}
                  </div>
                  <p className="note-body">{n.body}</p>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className={`card images-section${dragging ? ' dragging' : ''}`} {...dragProps}>
        <div className="section-head">
          <h2>
            <Icon name="image" /> Images & documents {fileCount > 0 && <span className="count">{fileCount}</span>}
          </h2>
          {canEdit && (
            <>
              <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={onFiles} />
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhotos} />
              <button className="btn btn-outline btn-sm" onClick={() => fileInput.current?.click()} aria-label="Upload files">
                <Icon name="upload" size={15} />
                <span className="hide-mobile">Upload files</span>
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
        ) : fileCount === 0 && documents !== null && !canEdit ? (
          <p className="empty-line">No images or documents yet.</p>
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

        {docCount > 0 && (
          <ul className="doc-list">
            {documents?.map((doc) => {
              const type = docType(doc.fileName);
              return (
                <li key={doc.id} className="doc-row">
                  <button className="doc-main" onClick={() => setViewingDoc(doc)} title={`Open ${doc.fileName}`}>
                    <span className="doc-badge" style={{ background: type.color }}>
                      {type.label}
                    </span>
                    <span className="doc-text">
                      <span className="doc-name">{doc.fileName}</span>
                      <span className="doc-meta">
                        {formatBytes(doc.sizeBytes)} · {formatShortDate(doc.createdAt)}
                      </span>
                    </span>
                  </button>
                  <button className="icon-btn" onClick={() => download(doc)} aria-label={`Download ${doc.fileName}`} title="Download">
                    <Icon name="download" size={16} />
                  </button>
                  {canEdit && <ConfirmButton label={`Remove ${doc.fileName}`} onConfirm={() => removeDocument(doc)} />}
                </li>
              );
            })}
            {pendingDocs.map((p) => {
              const type = docType(p.name);
              return (
                <li key={p.key} className="doc-row uploading">
                  <span className="doc-main">
                    <span className="doc-badge" style={{ background: type.color }}>
                      {type.label}
                    </span>
                    <span className="doc-text">
                      <span className="doc-name">{p.name}</span>
                      <span className="doc-meta">Uploading · {formatBytes(p.size)}</span>
                    </span>
                  </span>
                  <span className="doc-spinner" aria-label="Uploading" />
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <button
            type="button"
            className={`btn capture-btn${fileCount > 0 ? ' compact' : ''}`}
            onClick={() => cameraInput.current?.click()}
          >
            <Icon name="camera" size={18} />
            Take photo
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            className={`dropzone${fileCount > 0 ? ' compact' : ''}`}
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="upload" size={fileCount > 0 ? 16 : 22} />
            <span>
              <strong>Choose files</strong>
              <span className="hide-mobile"> or drag them here</span>
            </span>
            <span className="muted small">
              Images, PDF, PowerPoint, Word, Excel · <span className="nowrap">up to 50 MB</span>
            </span>
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
      {viewingDoc && <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} onDownload={() => download(viewingDoc)} />}
    </div>
  );
}
