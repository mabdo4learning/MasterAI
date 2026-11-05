import { useEffect, useRef, useState } from 'react';
import { addQuestion } from '../lib/api';
import { ProRequiredError, streamSummary, suggestQuestions, type SuggestedQuestion } from '../lib/assistant';
import { useAuth } from '../lib/auth';
import { refreshSubscription, useSubscription } from '../lib/billing';
import UpgradeSheet from './UpgradeSheet';
import NoteContent from './NoteContent';
import Icon from './Icon';
import { useToast } from './Toast';

type Props = {
  sessionId: string;
  noteCount: number;
  /** Saves the summary as a note in this session. */
  onSaveNote: (markdown: string) => Promise<void>;
  /** Called after questions were added, so the question bank reloads. */
  onQuestionsAdded: () => void;
};

type State =
  | { kind: 'idle' }
  | { kind: 'summary'; text: string; streaming: boolean; truncated?: boolean }
  | { kind: 'questions-loading' }
  | { kind: 'questions'; items: SuggestedQuestion[]; picked: Set<number> }
  | { kind: 'error'; message: string; retry: () => void };

/** Revision help from the session's notes: a summary to keep as a note, or practice questions. */
export default function StudyAssistant({ sessionId, noteCount, onSaveNote, onQuestionsAdded }: Props) {
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const { session } = useAuth();
  const { isPro, loading: planLoading } = useSubscription(session?.user.id);
  const [upgrading, setUpgrading] = useState(false);

  // The server said this account isn't Pro (e.g. just cancelled): refresh and show the upgrade.
  const proRequired = (e: unknown) => {
    if (!(e instanceof ProRequiredError)) return false;
    if (session) void refreshSubscription(session.user.id);
    setState({ kind: 'idle' });
    setUpgrading(true);
    return true;
  };

  // A new session starts fresh; leaving stops a summary that's still being written.
  useEffect(() => {
    setState({ kind: 'idle' });
    return () => abort.current?.abort();
  }, [sessionId]);

  const summarise = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    let text = '';
    setState({ kind: 'summary', text: '', streaming: true });
    try {
      const { truncated } = await streamSummary(
        sessionId,
        (piece) => {
          text += piece;
          setState({ kind: 'summary', text, streaming: true });
        },
        controller.signal,
      );
      setState({ kind: 'summary', text, streaming: false, truncated });
    } catch (e) {
      if (proRequired(e)) return;
      if ((e as Error).name === 'AbortError') {
        setState(text ? { kind: 'summary', text, streaming: false, truncated: true } : { kind: 'idle' });
      } else {
        setState({ kind: 'error', message: (e as Error).message, retry: summarise });
      }
    }
  };

  const questions = async () => {
    setState({ kind: 'questions-loading' });
    try {
      const items = await suggestQuestions(sessionId);
      setState({ kind: 'questions', items, picked: new Set(items.map((_, i) => i)) });
    } catch (e) {
      if (proRequired(e)) return;
      setState({ kind: 'error', message: (e as Error).message, retry: questions });
    }
  };

  const saveSummary = async (text: string) => {
    setSaving(true);
    try {
      await onSaveNote(text);
      setState({ kind: 'idle' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addPicked = async (items: SuggestedQuestion[], picked: Set<number>) => {
    setSaving(true);
    let added = 0;
    try {
      for (const i of [...picked].sort((a, b) => a - b)) {
        await addQuestion(sessionId, items[i].question, items[i].answer);
        added++;
      }
      toast(`Added ${added} ${added === 1 ? 'question' : 'questions'} to the question bank`);
      setState({ kind: 'idle' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      if (added) onQuestionsAdded();
      setSaving(false);
    }
  };

  const busy = state.kind === 'questions-loading' || (state.kind === 'summary' && state.streaming);
  const empty = noteCount === 0;

  return (
    <section className="card assistant">
      <div className="assistant-glow" aria-hidden />
      <div className="section-head">
        <h2>
          <span className="assistant-mark">
            <Icon name="sparkle" size={15} />
          </span>
          Study assistant
        </h2>
        {state.kind !== 'idle' && !busy && (
          <button className="icon-btn" onClick={() => setState({ kind: 'idle' })} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {state.kind === 'idle' && !planLoading && !isPro && (
        <div className="assistant-idle">
          <p className="muted">
            Turn this session’s notes into a revision summary or exam-style practice questions —{' '}
            <span className="pro-pill">Pro</span>
          </p>
          <div className="assistant-actions">
            <button className="btn" onClick={() => setUpgrading(true)}>
              <Icon name="sparkle" size={16} /> Upgrade to Pro
            </button>
          </div>
        </div>
      )}

      {state.kind === 'idle' && (planLoading || isPro) && (
        <div className="assistant-idle">
          <p className="muted">
            {empty
              ? 'Add a note to this session, then turn it into a revision summary or practice questions.'
              : 'Turn this session’s notes into a revision summary or exam-style practice questions.'}
          </p>
          <div className="assistant-actions">
            <button className="btn" onClick={summarise} disabled={empty || planLoading}>
              <Icon name="note" size={16} /> Summarise notes
            </button>
            <button className="btn btn-outline" onClick={questions} disabled={empty || planLoading}>
              <Icon name="help" size={16} /> Suggest questions
            </button>
          </div>
        </div>
      )}

      {state.kind === 'summary' && (
        <div className="assistant-result" aria-live="polite" aria-busy={state.streaming}>
          {state.text ? (
            <div className={`assistant-summary${state.streaming ? ' streaming' : ''}`}>
              <NoteContent markdown={state.text} />
            </div>
          ) : (
            <p className="assistant-thinking">
              <span className="assistant-dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              Reading your notes…
            </p>
          )}
          {state.truncated && !state.streaming && <p className="muted small">The summary stopped early — it may be incomplete.</p>}
          <div className="compose-actions">
            {state.streaming ? (
              <button className="btn btn-ghost" onClick={() => abort.current?.abort()}>
                Stop
              </button>
            ) : (
              <>
                <span className="muted small assistant-note hide-mobile">AI can make mistakes — check it against your slides.</span>
                <button className="btn btn-ghost" onClick={summarise} disabled={saving}>
                  <Icon name="refresh" size={15} /> Again
                </button>
                <button className="btn" onClick={() => saveSummary(state.text)} disabled={saving || !state.text.trim()}>
                  <Icon name="plus" size={16} /> {saving ? 'Saving…' : 'Save as note'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {state.kind === 'questions-loading' && (
        <div className="assistant-result">
          <p className="assistant-thinking">
            <span className="assistant-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            Writing practice questions…
          </p>
          <div className="skeleton-block note-skeleton" />
          <div className="skeleton-block note-skeleton" />
        </div>
      )}

      {state.kind === 'questions' && (
        <div className="assistant-result">
          <p className="muted small">Pick the ones to keep. They go into this session’s question bank, ready for practice mode.</p>
          <ul className="suggested">
            {state.items.map((q, i) => (
              <li key={i}>
                <label className={state.picked.has(i) ? 'picked' : ''}>
                  <input
                    type="checkbox"
                    checked={state.picked.has(i)}
                    disabled={saving}
                    onChange={() => {
                      const picked = new Set(state.picked);
                      if (picked.has(i)) picked.delete(i);
                      else picked.add(i);
                      setState({ ...state, picked });
                    }}
                  />
                  <span>
                    <strong>{q.question}</strong>
                    <span className="muted">{q.answer}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="compose-actions">
            <span className="muted small assistant-note hide-mobile">AI can make mistakes — check the answers.</span>
            <button className="btn btn-ghost" onClick={questions} disabled={saving}>
              <Icon name="refresh" size={15} /> New set
            </button>
            <button className="btn" onClick={() => addPicked(state.items, state.picked)} disabled={saving || state.picked.size === 0}>
              <Icon name="plus" size={16} />
              {saving ? 'Adding…' : `Add ${state.picked.size} to question bank`}
            </button>
          </div>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="assistant-result">
          <p className="error">{state.message}</p>
          <div className="compose-actions">
            <button className="btn btn-ghost" onClick={() => setState({ kind: 'idle' })}>
              Close
            </button>
            <button className="btn" onClick={state.retry}>
              <Icon name="refresh" size={15} /> Try again
            </button>
          </div>
        </div>
      )}
      {upgrading && <UpgradeSheet onClose={() => setUpgrading(false)} reason="The study assistant is part of Pro." />}
    </section>
  );
}
