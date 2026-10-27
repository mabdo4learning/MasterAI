import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { findSubject } from '../subjects';
import { listSubjectQuestions, recordResult, type PracticeQuestion, type QuestionResult } from '../lib/api';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import NotFound from './NotFound';

type Mode = 'all' | 'missed' | 'fresh';
type Phase = 'setup' | 'run' | 'done';

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'all', label: 'All questions', hint: 'Everything in this subject' },
  { value: 'missed', label: 'Missed last time', hint: 'The ones you got wrong' },
  { value: 'fresh', label: 'Not practised yet', hint: 'Questions you have never tried' },
];

const inMode = (mode: Mode) => (q: PracticeQuestion) =>
  mode === 'all' || (mode === 'missed' ? q.lastResult === 'wrong' : q.lastResult === null);

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function PracticePage() {
  const { slug } = useParams();
  const subject = findSubject(slug);
  const toast = useToast();
  const [params] = useSearchParams();
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'missed' ? 'missed' : 'all');
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>('setup');
  const [deck, setDeck] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<Record<string, QuestionResult>>({});

  useEffect(() => {
    if (!subject) return;
    document.title = `Practice · ${subject.title}`;
    listSubjectQuestions(subject.slug)
      .then(setQuestions)
      .catch((e) => setError(e.message));
    return () => {
      document.title = 'My lecture notes';
    };
  }, [subject]);

  const current = deck[index];

  const start = (items: PracticeQuestion[]) => {
    setDeck(shuffle(items));
    setIndex(0);
    setShowAnswer(false);
    setResults({});
    setPhase('run');
  };

  const answer = (result: QuestionResult) => {
    if (!current) return;
    setResults((r) => ({ ...r, [current.id]: result }));
    setQuestions((list) => list?.map((q) => (q.id === current.id ? { ...q, lastResult: result } : q)) ?? null);
    recordResult(current.id, result).catch((e) => toast(`Result not saved: ${e.message}`, 'error'));
    if (index + 1 < deck.length) {
      setIndex(index + 1);
      setShowAnswer(false);
    } else {
      setPhase('done');
    }
  };

  // Space shows the answer; 1 / ← = missed it, 2 / → = got it.
  useEffect(() => {
    if (phase !== 'run') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!showAnswer && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShowAnswer(true);
      } else if (showAnswer && (e.key === '1' || e.key === 'ArrowLeft')) {
        answer('wrong');
      } else if (showAnswer && (e.key === '2' || e.key === 'ArrowRight')) {
        answer('right');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!subject) return <NotFound />;

  const all = questions ?? [];
  const sessionNumbers = [...new Set(all.map((q) => q.sessionNumber))];
  const pool = all.filter((q) => !excluded.has(q.sessionNumber));
  const selected = pool.filter(inMode(mode));
  const answered = deck.filter((q) => results[q.id]);
  const right = answered.filter((q) => results[q.id] === 'right').length;
  const missed = answered.filter((q) => results[q.id] === 'wrong');

  const toggleSession = (n: number) =>
    setExcluded((set) => {
      const next = new Set(set);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <div className="practice-page" style={{ '--accent': subject.color } as CSSProperties}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to={`/subjects/${subject.slug}`} className="btn btn-ghost btn-sm back" aria-label="Back to subject">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Back</span>
          </Link>
          <div className="topbar-title">
            <span className="badge">{subject.number}</span>
            <div className="topbar-text">
              <h1>Practice</h1>
              <p className="muted small">
                {subject.title}
                {questions && ` · ${plural(all.length, 'question')}`}
              </p>
            </div>
          </div>
          <AuthLink />
        </div>
      </header>

      <div className="page practice-body">
        {error && <p className="error card">{error}</p>}

        {questions === null && !error && <div className="card skeleton-block tall" />}

        {questions && all.length === 0 && (
          <div className="card practice-empty">
            <span className="practice-empty-icon">
              <Icon name="help" size={26} />
            </span>
            <h2>No questions yet</h2>
            <p className="muted">
              Open any session of {subject.title} and use <strong>Exam questions</strong> to write the questions you expect,
              with their answers. Then come back here to test yourself.
            </p>
            <Link to={`/subjects/${subject.slug}`} className="btn">
              Go to sessions <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        )}

        {questions && all.length > 0 && phase === 'setup' && (
          <section className="card practice-setup">
            <h2>What do you want to practise?</h2>
            <div className="mode-options" role="radiogroup" aria-label="Questions">
              {MODES.map((m) => {
                const n = pool.filter(inMode(m.value)).length;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.value}
                    className={`mode-option${mode === m.value ? ' active' : ''}`}
                    onClick={() => setMode(m.value)}
                    disabled={n === 0 && mode !== m.value}
                  >
                    <strong>{n}</strong>
                    <span>{m.label}</span>
                    <span className="muted small">{m.hint}</span>
                  </button>
                );
              })}
            </div>

            {sessionNumbers.length > 1 && (
              <div className="practice-sessions">
                <span className="muted small">Sessions</span>
                <div className="filter-row">
                  {sessionNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`session-chip${excluded.has(n) ? '' : ' on'}`}
                      aria-pressed={!excluded.has(n)}
                      onClick={() => toggleSession(n)}
                      title={all.find((q) => q.sessionNumber === n)?.sessionTopic || `Session ${n}`}
                    >
                      S{n} <span>{all.filter((q) => q.sessionNumber === n).length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="practice-start">
              <span className="muted small">Questions come in a random order. Your results are saved.</span>
              <button className="btn" onClick={() => start(selected)} disabled={selected.length === 0}>
                <Icon name="shuffle" size={16} />
                {selected.length === 0 ? 'Nothing to practise' : `Start · ${plural(selected.length, 'question')}`}
              </button>
            </div>
          </section>
        )}

        {phase === 'run' && current && (
          <section className="practice-run">
            <div className="practice-progress">
              <span className="practice-count">
                {index + 1} <span className="muted">/ {deck.length}</span>
              </span>
              <span className="practice-bar" aria-hidden>
                <span style={{ width: `${(index / deck.length) * 100}%` }} />
              </span>
              <button className="link-btn" onClick={() => setPhase(answered.length ? 'done' : 'setup')}>
                End
              </button>
            </div>

            <article className="card flashcard">
              <span className="flashcard-session">
                Session {current.sessionNumber}
                {current.sessionTopic && ` · ${current.sessionTopic}`}
              </span>
              <p className="flashcard-question">{current.question}</p>

              {showAnswer ? (
                <>
                  <div className="flashcard-answer">
                    <span className="eyebrow">Answer</span>
                    <p className={current.answer ? undefined : 'muted'}>{current.answer || 'No answer written yet.'}</p>
                  </div>
                  <div className="flashcard-actions">
                    <button className="btn btn-ghost grade wrong" onClick={() => answer('wrong')}>
                      <Icon name="x" size={16} /> Missed it <kbd className="hide-mobile">1</kbd>
                    </button>
                    <button className="btn grade right" onClick={() => answer('right')}>
                      <Icon name="check" size={16} /> Got it <kbd className="hide-mobile">2</kbd>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flashcard-actions">
                  <button className="btn btn-block" onClick={() => setShowAnswer(true)} autoFocus>
                    Show answer <kbd className="hide-mobile">Space</kbd>
                  </button>
                </div>
              )}
            </article>
            <p className="muted small center hide-mobile">Answer in your head (or on paper) first, then check.</p>
          </section>
        )}

        {phase === 'done' && (
          <section className="card practice-done">
            <div className="score">
              <strong>
                {right} <span>/ {answered.length}</span>
              </strong>
              <p>
                {answered.length === 0
                  ? 'No questions answered.'
                  : right === answered.length
                    ? 'Perfect — every answer right.'
                    : `${Math.round((right / answered.length) * 100)}% right · ${plural(missed.length, 'question')} to go over again`}
              </p>
            </div>

            {missed.length > 0 && (
              <ol className="missed-list">
                {missed.map((q) => (
                  <li key={q.id}>
                    <span className="muted small">Session {q.sessionNumber}</span>
                    <strong>{q.question}</strong>
                    <p className={q.answer ? undefined : 'muted'}>{q.answer || 'No answer written yet.'}</p>
                  </li>
                ))}
              </ol>
            )}

            <div className="practice-start">
              <Link to={`/subjects/${subject.slug}`} className="btn btn-ghost">
                Back to subject
              </Link>
              <button className="btn btn-ghost" onClick={() => setPhase('setup')}>
                <Icon name="refresh" size={16} /> New round
              </button>
              {missed.length > 0 && (
                <button className="btn" onClick={() => start(missed)}>
                  <Icon name="shuffle" size={16} /> Practise the {plural(missed.length, 'missed one')}
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
