import { useEffect } from 'react';
import type { LectureImage } from '../lib/api';

type Props = {
  images: LectureImage[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
};

export default function Lightbox({ images, index, onChange, onClose }: Props) {
  const img = images[index];
  const prev = () => onChange((index - 1 + images.length) % images.length);
  const next = () => onChange((index + 1) % images.length);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  });

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span className="lightbox-name">
          {img.fileName} <span className="muted">· {index + 1} / {images.length}</span>
        </span>
        <a className="btn btn-sm btn-light" href={img.url} target="_blank" rel="noreferrer">
          Open original
        </a>
        <button className="btn btn-sm btn-light" onClick={onClose}>
          Close
        </button>
      </div>
      <img src={img.url} alt={img.fileName} onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <>
          <button
            className="lightbox-nav left"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            ‹
          </button>
          <button
            className="lightbox-nav right"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
