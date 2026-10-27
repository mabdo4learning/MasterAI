import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Subject } from '../subjects';
import type { LectureSession } from '../lib/api';
import { countdown, daysUntil, examDate, saveExam, todayKey, useExams } from '../lib/exams';
import Icon from './Icon';
import { useToast } from './Toast';

type Props = {
  subject: Subject;
  sessions: LectureSession[] | null;
  canEdit: boolean;
  onSelect: (sessionNumber: number) => void;
};

export default function ExamBar({ subject, sessions, canEdit, onSelect }: Props) {
  const toast = useToast();
  const exams = useExams();
  const date = exams[subject.slug];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(date ?? '');
  const [busy, setBusy] = useState(false);

  const missing = (sessions ?? []).filter((s) => s.noteCount === 0);
  const days = date ? daysUntil(date) : null;
  const urgency = days === null || days < 0 ? '' : days <= 7 ? ' urgent' : days <= 21 ? ' soon' : '';

  const save = async (next: string | null) => {
    setBusy(true);
    try {
      await saveExam(exams, subject.slug, next);
      setEditing(false);
      toast(next ? `Exam set for ${examDate(next)}` : 'Exam date removed');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`card exam-bar${urgency}`} aria-label="Exam">
      <div className="exam-main">
        <span className="exam-icon">
          <Icon name="cap" size={20} />
        </span>

        {editing ? (
          <form
            className="exam-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (value) save(value);
            }}
          >
            <label className="sr-only" htmlFor="exam-date">
              Exam date
            </label>
            <input id="exam-date" type="date" value={value} min={todayKey()} onChange={(e) => setValue(e.target.value)} autoFocus />
            <button className="btn btn-sm" disabled={busy || !value}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            {date && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(null)}>
                Remove
              </button>
            )}
            <button type="button" className="link-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : date ? (
          <div className="exam-text">
            <span className="exam-label">Exam · {examDate(date, true)}</span>
            <strong className="exam-countdown">{countdown(date)}</strong>
          </div>
        ) : (
          <div className="exam-text">
            <span className="exam-label">No exam date yet</span>
            <span className="muted small">Add it to get a countdown and see what to revise.</span>
          </div>
        )}

        {!editing && (
          <div className="exam-actions">
            {canEdit && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setValue(date ?? '');
                  setEditing(true);
                }}
              >
                <Icon name={date ? 'pencil' : 'calendar'} size={15} />
                {date ? <span className="hide-mobile">Change date</span> : 'Set exam date'}
              </button>
            )}
            <Link to={`/subjects/${subject.slug}/export`} className="btn btn-outline btn-sm" title="Export as PDF">
              <Icon name="printer" size={15} />
              <span className="hide-mobile">Export PDF</span>
              <span className="show-mobile">PDF</span>
            </Link>
          </div>
        )}
      </div>

      {sessions && sessions.length > 0 && (
        <div className="exam-gaps">
          {missing.length === 0 ? (
            <span className="exam-gaps-done">
              <Icon name="check" size={14} /> Every session has notes
            </span>
          ) : (
            <>
              <span className="muted small">
                {missing.length} of {sessions.length} sessions without notes:
              </span>
              <span className="gap-chips">
                {missing.map((s) => (
                  <button key={s.id} className="gap-chip" onClick={() => onSelect(s.number)} title={s.topic || `Session ${s.number}`}>
                    S{s.number}
                  </button>
                ))}
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}
