import { useEffect, useState } from 'react';
import { documentUrl, type LectureDocument } from '../lib/api';
import { docType, formatBytes, isOffice, isPdf } from '../lib/files';
import Icon from './Icon';

type Props = { doc: LectureDocument; onClose: () => void; onDownload: () => void };

/**
 * Full-screen viewer for a document. PDFs render in the browser; Office files can be previewed with
 * Microsoft's online viewer, which only happens after the user agrees because it sends Microsoft a
 * temporary link to the file.
 */
export default function DocumentViewer({ doc, onClose, onDownload }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [officeConsent, setOfficeConsent] = useState(false);
  const type = docType(doc.fileName);
  const pdf = isPdf(doc.fileName);
  const office = isOffice(doc.fileName);

  useEffect(() => {
    documentUrl(doc)
      .then(setUrl)
      .catch((e) => setError(e.message));
  }, [doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  let body;
  if (error) {
    body = <p className="viewer-message">{error}</p>;
  } else if (!url) {
    body = <span className="spinner viewer-spinner" aria-label="Loading" />;
  } else if (pdf) {
    body = <iframe className="viewer-frame" src={url} title={doc.fileName} />;
  } else if (office && officeConsent) {
    body = (
      <iframe
        className="viewer-frame"
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
        title={doc.fileName}
      />
    );
  } else {
    body = (
      <div className="viewer-card">
        <span className="doc-badge doc-badge-lg" style={{ background: type.color }}>
          {type.label}
        </span>
        <h3>{doc.fileName}</h3>
        <p className="muted small">{formatBytes(doc.sizeBytes)}</p>
        {office ? (
          <>
            <p className="viewer-note">
              Browsers can't show {type.label === 'PPT' ? 'PowerPoint' : type.label === 'DOC' ? 'Word' : 'Excel'} files
              directly. You can preview it with Microsoft's free Office viewer — this sends Microsoft a temporary link
              to the file (it expires in a few hours) — or download it.
            </p>
            <div className="viewer-actions">
              <button className="btn" onClick={() => setOfficeConsent(true)}>
                <Icon name="eye" size={16} /> Preview with Office viewer
              </button>
              <button className="btn btn-ghost" onClick={onDownload}>
                <Icon name="download" size={16} /> Download
              </button>
            </div>
          </>
        ) : (
          <div className="viewer-actions">
            <a className="btn" href={url} target="_blank" rel="noreferrer">
              <Icon name="external" size={16} /> Open in new tab
            </a>
            <button className="btn btn-ghost" onClick={onDownload}>
              <Icon name="download" size={16} /> Download
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={doc.fileName}>
      <div className="viewer-bar">
        <span className="doc-badge" style={{ background: type.color }}>
          {type.label}
        </span>
        <span className="viewer-name">{doc.fileName}</span>
        {url && (pdf || officeConsent) && (
          <a className="lightbox-btn" href={url} target="_blank" rel="noreferrer" aria-label="Open in new tab" title="Open in new tab">
            <Icon name="external" size={18} />
          </a>
        )}
        <button className="lightbox-btn" onClick={onDownload} aria-label="Download" title="Download">
          <Icon name="download" size={18} />
        </button>
        <button className="lightbox-btn" onClick={onClose} aria-label="Close" title="Close">
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className="viewer-body">{body}</div>
    </div>
  );
}
