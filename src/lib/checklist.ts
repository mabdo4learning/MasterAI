import type { LectureSession } from './api';

type Counts = Pick<LectureSession, 'attended' | 'reviewed' | 'noteCount' | 'imageCount' | 'documentCount'>;

export type ChecklistKey = 'attended' | 'notes' | 'files' | 'reviewed';
export type ChecklistItem = { key: ChecklistKey; label: string; done: boolean; auto: boolean };

/**
 * The four steps of a session. "Attended" and "Reviewed" are ticked by hand; "Notes" and
 * "Slides / files" tick themselves from what the session contains, so they can't go stale.
 */
export function checklist(s: Counts): ChecklistItem[] {
  return [
    { key: 'attended', label: 'Attended', done: s.attended, auto: false },
    { key: 'notes', label: 'Notes written', done: s.noteCount > 0, auto: true },
    { key: 'files', label: 'Slides / files', done: s.imageCount + s.documentCount > 0, auto: true },
    { key: 'reviewed', label: 'Reviewed', done: s.reviewed, auto: false },
  ];
}

export const stepsDone = (s: Counts) => checklist(s).filter((i) => i.done).length;
export const STEPS = 4;
export const isComplete = (s: Counts) => stepsDone(s) === STEPS;
