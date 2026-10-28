import { useState } from 'react';
import { documentUrl, type LectureDocument } from '../lib/api';
import { docType, formatBytes } from '../lib/files';
import type { SharedSession } from '../lib/sharing';
import DocumentViewer from './DocumentViewer';
import Icon from './Icon';
import Lightbox from './Lightbox';
import { useToast } from './Toast';

const formatStamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const formatDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** One shared session, read-only: same layout as the editor, without any of the controls. */
export default function SharedSessionView({ session, partial }: { session: SharedSession; partial: boolean }) {
  const toast = useToast();
  const [viewing, setViewing] = useState<number | null>(null);
  const [viewingDoc, setViewingDoc] = useState<LectureDocument | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const fileCount = session.images.length + session.documents.length;

  const download = async (doc: LectureDocument) => {
    try {
      window.location.href = await documentUrl(doc, true);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const toggle = (id: string) =>
    setRevealed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="session-editor">
      <section className="card session-header">
        <span className="eyebrow">
          Session {session.number}
          {partial && <span className="muted"> · selected items</span>}
        </span>
        <div className="fields-readonly">
          <p className={`topic-text${session.topic ? '' : ' muted'}`}>{session.topic || 'No topic'}</p>
          {session.lectureDate && (
            <p className="muted small date-line">
              <Icon name="calendar" size={14} /> {formatDate(session.lectureDate)}
            </p>
          )}
        </div>
      </section>

      {(session.notes.length > 0 || !partial) && (
        <section className="card">
          <div className="section-head">
            <h2>
              <Icon name="note" /> Notes {session.notes.length > 0 && <span className="count">{session.notes.length}</span>}
            </h2>
          </div>
          {session.notes.length === 0 ? (
            <p className="empty-line">No notes.</p>
          ) : (
            <ul className="note-list">
              {session.notes.map((n) => (
                <li key={n.id} className="note">
                  <div className="note-meta">
                    <span className="note-stamp">
                      <time dateTime={n.createdAt}>{formatStamp(n.createdAt)}</time>
                      {n.updatedAt && <span className="note-edited">· edited</span>}
                    </span>
                  </div>
                  <p className="note-body">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {session.questions.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>
              <Icon name="help" /> Exam questions <span className="count">{session.questions.length}</span>
            </h2>
          </div>
          <ol className="question-list">
            {session.questions.map((q, i) => (
              <li key={q.id} className="question-item">
                <div className="question-row">
                  <span className="question-number">Q{i + 1}</span>
                  <p className="question-text">{q.question}</p>
                </div>
                <button
                  type="button"
                  className={`answer-toggle${revealed.has(q.id) ? ' open' : ''}`}
                  aria-expanded={revealed.has(q.id)}
                  onClick={() => toggle(q.id)}
                >
                  <Icon name="chevronDown" size={14} />
                  {revealed.has(q.id) ? 'Hide answer' : 'Show answer'}
                </button>
                {revealed.has(q.id) && (
                  <p className={`answer-text${q.answer ? '' : ' muted'}`}>{q.answer || 'No answer written.'}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(fileCount > 0 || !partial) && (
        <section className="card images-section">
          <div className="section-head">
            <h2>
              <Icon name="image" /> Images & documents {fileCount > 0 && <span className="count">{fileCount}</span>}
            </h2>
          </div>
          {fileCount === 0 && <p className="empty-line">No images or documents.</p>}
          {session.images.length > 0 && (
            <ul className="image-grid">
              {session.images.map((img, i) => (
                <li key={img.id} className="thumb">
                  <button className="thumb-img" onClick={() => setViewing(i)} aria-label={`View ${img.fileName}`}>
                    <img src={img.url} alt={img.fileName} loading="lazy" />
                  </button>
                  <div className="thumb-meta">
                    <span className="thumb-name" title={img.fileName}>
                      {img.fileName}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {session.documents.length > 0 && (
            <ul className="doc-list">
              {session.documents.map((doc) => {
                const type = docType(doc.fileName);
                return (
                  <li key={doc.id} className="doc-row">
                    <button className="doc-main" onClick={() => setViewingDoc(doc)} title={`Open ${doc.fileName}`}>
                      <span className="doc-badge" style={{ background: type.color }}>
                        {type.label}
                      </span>
                      <span className="doc-text">
                        <span className="doc-name">{doc.fileName}</span>
                        <span className="doc-meta">{formatBytes(doc.sizeBytes)}</span>
                      </span>
                    </button>
                    <button className="icon-btn" onClick={() => download(doc)} aria-label={`Download ${doc.fileName}`} title="Download">
                      <Icon name="download" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {viewing !== null && session.images[viewing] && (
        <Lightbox images={session.images} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
      )}
      {viewingDoc && <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} onDownload={() => download(viewingDoc)} />}
    </div>
  );
}
