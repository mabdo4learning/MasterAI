import { useEffect, useRef } from 'react';
import type { LectureImage } from '../lib/api';
import Icon from './Icon';

type Props = {
  images: LectureImage[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
};

export default function Lightbox({ images, index, onChange, onClose }: Props) {
  const img = images[index];
  const touchX = useRef<number | null>(null);
  const prev = () => onChange((index - 1 + images.length) % images.length);
  const next = () => onChange((index + 1) % images.length);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={img.fileName}
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || images.length < 2) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
      }}
    >
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span className="lightbox-name">
          {img.fileName}
          {images.length > 1 && (
            <span className="lightbox-index">
              {index + 1} / {images.length}
            </span>
          )}
        </span>
        <a className="lightbox-btn" href={img.url} target="_blank" rel="noreferrer" aria-label="Open original">
          <Icon name="external" size={18} />
        </a>
        <button className="lightbox-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" size={20} />
        </button>
      </div>
      <img key={img.id} src={img.url} alt={img.fileName} onClick={(e) => e.stopPropagation()} />
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
            <Icon name="chevronLeft" size={26} />
          </button>
          <button
            className="lightbox-nav right"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            <Icon name="chevronRight" size={26} />
          </button>
        </>
      )}
    </div>
  );
}
