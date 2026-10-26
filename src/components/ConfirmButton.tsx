import { useEffect, useState } from 'react';
import Icon from './Icon';

type Props = { onConfirm: () => void; label: string; className?: string };

/** Delete button that asks for a second click instead of a browser dialog. */
export default function ConfirmButton({ onConfirm, label, className = '' }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={`icon-btn danger ${armed ? 'armed' : ''} ${className}`}
      aria-label={armed ? `Confirm: ${label}` : label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      <Icon name="trash" size={15} />
      {armed && <span>Delete?</span>}
    </button>
  );
}
