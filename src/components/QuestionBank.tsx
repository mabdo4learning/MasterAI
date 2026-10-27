import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { addQuestion, deleteQuestion, listQuestions, updateQuestion, type Question } from '../lib/api';
import ConfirmButton from './ConfirmButton';
import Icon from './Icon';
import { useToast } from './Toast';

type Props = { subjectSlug: string; sessionId: string; canEdit: boolean };

type Draft = { question: string; answer: string };
const EMPTY: Draft = { question: '', answer: '' };

/** Exam-style questions for one session. Answers stay hidden until asked for, so the list doubles as a quick self-test. */
export default function QuestionBank({ subjectSlug, sessionId, canEdit }: Props) {
  const toast = useToast();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<(Draft & { id: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const questionInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listQuestions(sessionId)
      .then(setQuestions)
      .catch(() => setFailed(true));
  }, [sessionId]);

  const toggle = (id: string) =>
    setRevealed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const question = draft.question.trim();
    if (!question) return;
    setAdding(true);
    try {
      const q = await addQuestion(sessionId, question, draft.answer.trim());
      setQuestions((list) => [...(list ?? []), q]);
      setDraft(EMPTY);
      questionInput.current?.focus();
      toast('Question added');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const question = editing.question.trim();
    const answer = editing.answer.trim();
    const original = questions?.find((q) => q.id === editing.id);
    if (!question || (question === original?.question && answer === original?.answer)) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      const q = await updateQuestion(editing.id, { question, answer });
      setQuestions((list) => list?.map((x) => (x.id === q.id ? q : x)) ?? null);
      setEditing(null);
      toast('Question updated');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q: Question) => {
    try {
      await deleteQuestion(q.id);
      setQuestions((list) => list?.filter((x) => x.id !== q.id) ?? null);
      toast('Question deleted');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const onKey = (save: () => void, cancel?: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape' && cancel) {
      cancel();
    }
  };

  const count = questions?.length ?? 0;

  return (
    <section className="card">
      <div className="section-head">
        <h2>
          <Icon name="help" /> Exam questions {count > 0 && <span className="count">{count}</span>}
        </h2>
        {count > 0 && (
          <Link to={`/subjects/${subjectSlug}/practice`} className="btn btn-outline btn-sm">
            <Icon name="shuffle" size={15} /> Practice
          </Link>
        )}
      </div>

      {canEdit && !failed && (
        <form className="question-compose" onSubmit={submit}>
          <label>
            <span>Question</span>
            <textarea
              ref={questionInput}
              rows={2}
              value={draft.question}
              placeholder="e.g. What is the difference between best-fit and best-practice?"
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              onKeyDown={onKey(submit)}
            />
          </label>
          <label>
            <span>Answer</span>
            <textarea
              rows={3}
              value={draft.answer}
              placeholder="The answer you'd write in the exam (you can add it later)"
              onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              onKeyDown={onKey(submit)}
            />
          </label>
          <div className="compose-actions">
            <span className="muted small hide-mobile">
              <kbd>⌘</kbd> + <kbd>Enter</kbd> to add
            </span>
            <button className="btn" disabled={adding || !draft.question.trim()}>
              <Icon name="plus" size={16} />
              {adding ? 'Adding…' : 'Add question'}
            </button>
          </div>
        </form>
      )}

      {failed ? (
        <p className="empty-line">Couldn't load questions. Try reloading the page.</p>
      ) : questions === null ? (
        <div className="note-list">
          <div className="skeleton-block note-skeleton" />
        </div>
      ) : questions.length === 0 ? (
        <p className="empty-line">
          No questions yet{canEdit ? ' — write the questions you expect in the exam, then practise them before it.' : '.'}
        </p>
      ) : (
        <ol className="question-list">
          {questions.map((q, i) =>
            editing?.id === q.id ? (
              <li key={q.id} className="question-item editing">
                <label>
                  <span>Question</span>
                  <textarea
                    rows={2}
                    autoFocus
                    value={editing.question}
                    onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                    onKeyDown={onKey(saveEdit, () => setEditing(null))}
                  />
                </label>
                <label>
                  <span>Answer</span>
                  <textarea
                    rows={3}
                    value={editing.answer}
                    onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                    onKeyDown={onKey(saveEdit, () => setEditing(null))}
                  />
                </label>
                <div className="compose-actions">
                  <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={saving}>
                    Cancel
                  </button>
                  <button className="btn" onClick={saveEdit} disabled={saving || !editing.question.trim()}>
                    <Icon name="check" size={16} />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </li>
            ) : (
              <li key={q.id} className="question-item">
                <div className="question-row">
                  <span className="question-number">Q{i + 1}</span>
                  <p className="question-text">{q.question}</p>
                  {q.lastResult && (
                    <span
                      className={`result-pill ${q.lastResult}`}
                      title={q.practicedAt ? `Last practised ${new Date(q.practicedAt).toLocaleDateString()}` : undefined}
                    >
                      <Icon name={q.lastResult === 'right' ? 'check' : 'x'} size={12} />
                      {q.lastResult === 'right' ? 'Got it' : 'Missed'}
                    </span>
                  )}
                  {canEdit && (
                    <span className="note-actions">
                      <button
                        className="icon-btn"
                        onClick={() => setEditing({ id: q.id, question: q.question, answer: q.answer })}
                        aria-label="Edit question"
                        title="Edit"
                      >
                        <Icon name="pencil" size={16} />
                      </button>
                      <ConfirmButton label="Delete question" onConfirm={() => remove(q)} />
                    </span>
                  )}
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
                  <p className={`answer-text${q.answer ? '' : ' muted'}`}>{q.answer || 'No answer written yet.'}</p>
                )}
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
