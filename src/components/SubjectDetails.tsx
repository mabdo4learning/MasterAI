import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  EMPTY_DETAILS,
  deleteSubjectFile,
  documentUrl,
  getSubjectDetails,
  listSubjectFiles,
  saveSubjectDetails,
  uploadSubjectFile,
  type LectureDocument,
  type LectureImage,
  type SubjectDetails as Details,
} from '../lib/api';
import { ACCEPT, MAX_UPLOAD_BYTES, docType, fileKind, formatBytes } from '../lib/files';
import ConfirmButton from './ConfirmButton';
import DocumentViewer from './DocumentViewer';
import Icon, { type IconName } from './Icon';
import Lightbox from './Lightbox';
import { useToast } from './Toast';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type InfoKey = Exclude<keyof Details, 'overview' | 'updatedAt'>;

const INFO: { key: InfoKey; label: string; placeholder: string; icon: IconName; wide?: boolean; type?: string }[] = [
  { key: 'lecturer', label: 'Lecturer', placeholder: 'e.g. Dr Sara Ahmed', icon: 'users' },
  { key: 'lecturerEmail', label: 'Lecturer email', placeholder: 'name@university.edu', icon: 'mail', type: 'email' },
  { key: 'schedule', label: 'When', placeholder: 'e.g. Mondays 18:00–21:00', icon: 'clock' },
  { key: 'room', label: 'Where', placeholder: 'Room, building or online link', icon: 'pin' },
  { key: 'officeHours', label: 'Office hours', placeholder: 'e.g. Wednesdays 14:00–15:00', icon: 'clock' },
  { key: 'credits', label: 'Credits', placeholder: 'e.g. 15 credits', icon: 'cap' },
  { key: 'assessment', label: 'Assessment', placeholder: 'e.g. Exam 60% · Group report 40%, due 12 Dec', icon: 'check', wide: true },
];

const fitHeight = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
};

const formatShortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The subject's own page: course info, an overview and attachments that belong to the whole subject. */
export default function SubjectDetails({ subjectSlug, canEdit }: { subjectSlug: string; canEdit: boolean }) {
  const toast = useToast();
  const [details, setDetails] = useState<Details | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const unsaved = useRef<Partial<Details>>({});
  const timer = useRef<number | undefined>(undefined);
  const overview = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getSubjectDetails(subjectSlug)
      .then(setDetails)
      .catch((e) =>
        setFailed(/schema cache|does not exist/.test(e.message) ? 'Subject details are not set up yet: run migrations-009-subject-details.sql in Supabase.' : e.message),
      );
  }, [subjectSlug]);

  useEffect(() => fitHeight(overview.current), [details === null]);

  const flush = async () => {
    window.clearTimeout(timer.current);
    const patch = unsaved.current;
    if (Object.keys(patch).length === 0) return;
    unsaved.current = {};
    setSaveState('saving');
    try {
      await saveSubjectDetails(subjectSlug, patch);
      setSaveState('saved');
    } catch (e) {
      unsaved.current = { ...patch, ...unsaved.current };
      setSaveState('error');
      toast((e as Error).message, 'error');
    }
  };

  // Save anything still pending when switching tabs or leaving the page.
  useEffect(() => () => void flush(), []);

  const change = (key: keyof Details, value: string) => {
    setDetails((d) => ({ ...(d ?? EMPTY_DETAILS), [key]: value }));
    unsaved.current = { ...unsaved.current, [key]: value };
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 800);
  };

  if (failed) return <p className="error card">{failed}</p>;

  if (!details) {
    return (
      <div className="session-editor">
        <div className="card skeleton-block tall" />
      </div>
    );
  }

  const filled = INFO.filter((f) => details[f.key]);

  return (
    <div className="session-editor subject-details">
      <section className="card">
        <div className="section-head">
          <h2>
            <Icon name="cap" /> Course info
          </h2>
          {canEdit && saveState !== 'idle' && (
            <span className={`save-state ${saveState}`}>
              {saveState === 'saved' && <Icon name="check" size={13} />}
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Not saved'}
            </span>
          )}
        </div>
        {canEdit ? (
          <div className="details-grid">
            {INFO.map((f) => (
              <label key={f.key} className={f.wide ? 'wide' : undefined}>
                <span>{f.label}</span>
                <input
                  type={f.type ?? 'text'}
                  value={details[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => change(f.key, e.target.value)}
                  onBlur={flush}
                />
              </label>
            ))}
          </div>
        ) : (
          <DetailsInfo details={details} />
        )}
        {!canEdit && filled.length === 0 && <p className="empty-line">No course info yet.</p>}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>
            <Icon name="note" /> Overview
          </h2>
        </div>
        {canEdit ? (
          <textarea
            ref={overview}
            className="overview-input"
            value={details.overview}
            rows={5}
            placeholder="Anything about the subject as a whole: syllabus summary, learning outcomes, key readings, what the exam covers…"
            onChange={(e) => {
              change('overview', e.target.value);
              fitHeight(e.target);
            }}
            onBlur={flush}
          />
        ) : details.overview ? (
          <p className="note-body">{details.overview}</p>
        ) : (
          <p className="empty-line">No overview yet.</p>
        )}
      </section>

      <SubjectAttachments subjectSlug={subjectSlug} canEdit={canEdit} />
    </div>
  );
}

/** Read-only course info, also used for a shared subject. */
export function DetailsInfo({ details }: { details: Details }) {
  const filled = INFO.filter((f) => details[f.key]);
  if (filled.length === 0) return null;
  return (
    <dl className="details-list">
      {filled.map((f) => (
        <div key={f.key} className={f.wide ? 'wide' : undefined}>
          <dt>
            <Icon name={f.icon} size={14} /> {f.label}
          </dt>
          <dd>
            {f.key === 'lecturerEmail' ? <a href={`mailto:${details.lecturerEmail}`}>{details.lecturerEmail}</a> : details[f.key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type Pending = { key: string; name: string; preview?: string; size: number };

function SubjectAttachments({ subjectSlug, canEdit }: { subjectSlug: string; canEdit: boolean }) {
  const toast = useToast();
  const [images, setImages] = useState<LectureImage[] | null>(null);
  const [documents, setDocuments] = useState<LectureDocument[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listSubjectFiles(subjectSlug)
      .then((f) => {
        setImages(f.images);
        setDocuments(f.documents);
      })
      .catch((e) => toast(e.message, 'error'));
  }, [subjectSlug, toast]);

  const upload = async (files: File[]) => {
    const unsupported = files.filter((f) => !fileKind(f));
    const tooBig = files.filter((f) => fileKind(f) === 'document' && f.size > MAX_UPLOAD_BYTES);
    if (unsupported.length) toast(`Can't upload ${unsupported.map((f) => f.name).join(', ')} — unsupported file type`, 'error');
    if (tooBig.length) toast(`${tooBig.map((f) => f.name).join(', ')} is over the 50 MB limit`, 'error');
    const ok = files.filter((f) => fileKind(f) && !tooBig.includes(f));
    if (ok.length === 0) return;

    const queue = ok.map((file) => ({
      file,
      kind: fileKind(file)!,
      item: { key: crypto.randomUUID(), name: file.name, size: file.size, preview: fileKind(file) === 'image' ? URL.createObjectURL(file) : undefined },
    }));
    setPending((p) => [...p, ...queue.map((q) => q.item)]);

    let done = 0;
    for (const { file, kind, item } of queue) {
      try {
        const res = await uploadSubjectFile(subjectSlug, file, kind);
        if (res.kind === 'image') setImages((list) => [...(list ?? []), res.image]);
        else setDocuments((list) => [...(list ?? []), res.document]);
        done += 1;
      } catch (err) {
        toast(`${file.name}: ${(err as Error).message}`, 'error');
      }
      setPending((p) => p.filter((x) => x.key !== item.key));
      if (item.preview) URL.revokeObjectURL(item.preview);
    }
    if (done) toast(done === 1 ? '1 file uploaded' : `${done} files uploaded`);
  };

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    upload(files);
  };

  const remove = async (file: LectureImage | LectureDocument) => {
    try {
      await deleteSubjectFile(file);
      setImages((list) => list?.filter((x) => x.id !== file.id) ?? null);
      setDocuments((list) => list?.filter((x) => x.id !== file.id) ?? null);
      toast(`${file.fileName} removed`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const dragProps = canEdit
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: (e: DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          upload(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  return (
    <section className={`card images-section${dragging ? ' dragging' : ''}`} {...dragProps}>
      <div className="section-head">
        <h2>
          <Icon name="file" /> Subject attachments
          {images && documents && images.length + documents.length > 0 && <span className="count">{images.length + documents.length}</span>}
        </h2>
        {canEdit && (
          <>
            <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={onFiles} />
            <button className="btn btn-outline btn-sm" onClick={() => fileInput.current?.click()} aria-label="Upload files">
              <Icon name="upload" size={15} />
              <span className="hide-mobile">Upload files</span>
            </button>
          </>
        )}
      </div>

      {images === null || documents === null ? (
        <div className="skeleton-block note-skeleton" />
      ) : (
        <Attachments
          images={images}
          documents={documents}
          pending={pending}
          onRemove={canEdit ? remove : undefined}
          empty={canEdit ? null : 'No attachments yet.'}
        />
      )}

      {canEdit && (
        <button
          type="button"
          className={`dropzone${(images?.length ?? 0) + (documents?.length ?? 0) + pending.length > 0 ? ' compact' : ''}`}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="upload" size={20} />
          <span>
            <strong>Add the syllabus, handbook, reading list or past papers</strong>
            <span className="hide-mobile"> — or drag files here</span>
          </span>
          <span className="muted small">
            Images, PDF, PowerPoint, Word, Excel · <span className="nowrap">up to 50 MB</span>
          </span>
        </button>
      )}

      {dragging && (
        <div className="drop-overlay">
          <Icon name="upload" size={28} />
          Drop to add to the subject
        </div>
      )}
    </section>
  );
}

/** Image grid plus document list, with full-size viewing. Also used for a shared subject. */
export function Attachments({
  images,
  documents,
  pending = [],
  onRemove,
  empty,
}: {
  images: LectureImage[];
  documents: LectureDocument[];
  pending?: Pending[];
  onRemove?: (f: LectureImage | LectureDocument) => void;
  empty: string | null;
}) {
  const toast = useToast();
  const [viewing, setViewing] = useState<number | null>(null);
  const [viewingDoc, setViewingDoc] = useState<LectureDocument | null>(null);
  const pendingImages = pending.filter((p) => p.preview);
  const pendingDocs = pending.filter((p) => !p.preview);

  const download = async (doc: LectureDocument) => {
    try {
      window.location.href = await documentUrl(doc, true);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (images.length + documents.length + pending.length === 0) return empty ? <p className="empty-line">{empty}</p> : null;

  return (
    <>
      {images.length + pendingImages.length > 0 && (
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
                {onRemove && <ConfirmButton label={`Remove ${img.fileName}`} onConfirm={() => onRemove(img)} />}
              </div>
            </li>
          ))}
          {pendingImages.map((p) => (
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
      )}

      {documents.length + pendingDocs.length > 0 && (
        <ul className="doc-list">
          {documents.map((doc) => {
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
                {onRemove && <ConfirmButton label={`Remove ${doc.fileName}`} onConfirm={() => onRemove(doc)} />}
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

      {viewing !== null && images[viewing] && (
        <Lightbox images={images} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
      )}
      {viewingDoc && <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} onDownload={() => download(viewingDoc)} />}
    </>
  );
}
