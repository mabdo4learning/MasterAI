import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MAX_SESSIONS, PALETTE } from '../subjects';
import Icon from './Icon';

/** A colour swatch that opens a small palette. */
export function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="color-picker" ref={ref}>
      <button
        type="button"
        className="swatch swatch-button"
        style={{ background: value }}
        aria-label={`${label}: change colour`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="swatch-pop" role="listbox" aria-label="Colours">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={c.toLowerCase() === value.toLowerCase()}
              aria-label={c}
              className="swatch"
              style={{ background: c }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              {c.toLowerCase() === value.toLowerCase() && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** − n + control for a number of sessions. */
export function SessionCount({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  const clamp = (n: number) => Math.max(min, Math.min(MAX_SESSIONS, n));
  return (
    <div className="stepper" role="group" aria-label="Sessions">
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Fewer sessions">
        −
      </button>
      <span>
        <strong>{value}</strong> <span className="muted">{value === 1 ? 'session' : 'sessions'}</span>
      </span>
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= MAX_SESSIONS} aria-label="More sessions">
        +
      </button>
    </div>
  );
}

export type DraftSubject = { key: number; title: string; color: string; sessions: number };

let nextKey = 1;
export const newDraft = (index: number, sessions = 8): DraftSubject => ({
  key: nextKey++,
  title: '',
  color: PALETTE[index % PALETTE.length],
  sessions,
});

/** Rows for subjects that are about to be added: name, colour and number of sessions. */
export function DraftSubjects({
  drafts,
  onChange,
  colorOffset = 0,
  disabled = false,
}: {
  drafts: DraftSubject[];
  onChange: (d: DraftSubject[]) => void;
  /** Where in the palette new rows start, so they don't repeat colours already in use. */
  colorOffset?: number;
  disabled?: boolean;
}) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const lastInput = useRef<HTMLInputElement>(null);
  const [focusLast, setFocusLast] = useState(false);

  useEffect(() => {
    if (focusLast) {
      lastInput.current?.focus();
      setFocusLast(false);
    }
  }, [focusLast]);

  const patch = (key: number, p: Partial<DraftSubject>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const sessionsDefault = drafts[drafts.length - 1]?.sessions ?? 8;
  const add = () => {
    onChange([...drafts, newDraft(colorOffset + drafts.length, sessionsDefault)]);
    setFocusLast(true);
  };

  const applyPaste = () => {
    const titles = pasted
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
    const kept = drafts.filter((d) => d.title.trim());
    onChange([
      ...kept,
      ...titles.map((title, i) => ({ ...newDraft(colorOffset + kept.length + i, sessionsDefault), title })),
    ]);
    setPasted('');
    setPasting(false);
  };

  return (
    <div className="draft-subjects">
      <ol className="draft-list">
        {drafts.map((d, i) => (
          <li key={d.key} className="draft-row" style={{ '--accent': d.color } as CSSProperties}>
            <ColorPicker value={d.color} onChange={(color) => patch(d.key, { color })} label={d.title || `Subject ${i + 1}`} />
            <input
              ref={i === drafts.length - 1 ? lastInput : undefined}
              type="text"
              value={d.title}
              maxLength={200}
              placeholder={i === 0 ? 'e.g. Corporate Finance' : 'Subject name'}
              aria-label={`Subject ${i + 1} name`}
              disabled={disabled}
              onChange={(e) => patch(d.key, { title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (i === drafts.length - 1 && d.title.trim()) add();
                }
              }}
            />
            <SessionCount value={d.sessions} onChange={(sessions) => patch(d.key, { sessions })} />
            <button
              type="button"
              className="icon-btn danger"
              aria-label="Remove"
              disabled={disabled || drafts.length === 1}
              onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
            >
              <Icon name="x" size={16} />
            </button>
          </li>
        ))}
      </ol>

      {pasting ? (
        <div className="paste-box">
          <textarea
            autoFocus
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'One subject per line, e.g.\nCorporate Finance\nMarketing Strategy\nLeadership'}
            rows={5}
          />
          <div className="compose-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPasting(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm" onClick={applyPaste} disabled={!pasted.trim()}>
              Add these subjects
            </button>
          </div>
        </div>
      ) : (
        <div className="draft-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={disabled}>
            <Icon name="plus" size={15} /> Add a subject
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPasting(true)} disabled={disabled}>
            <Icon name="list" size={15} /> Paste a list
          </button>
        </div>
      )}
    </div>
  );
}
