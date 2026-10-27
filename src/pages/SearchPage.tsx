import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SUBJECTS, findSubject } from '../subjects';
import { search, type SearchHit } from '../lib/api';
import { timeAgo } from '../lib/time';
import { docType } from '../lib/files';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';

type Kind = SearchHit['kind'] | 'subject';

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'subject', label: 'Subjects' },
  { kind: 'session', label: 'Sessions' },
  { kind: 'note', label: 'Notes' },
  { kind: 'image', label: 'Images' },
  { kind: 'document', label: 'Documents' },
];

/** Words of the query, so "ai ethics" finds notes containing both words in any order. */
const termsOf = (q: string) => [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 6);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}</>;
}

/** A window of the note around the first match, so long notes still show why they matched. */
function snippet(body: string, terms: string[], radius = 90): string {
  const text = body.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  if (!Number.isFinite(at) || text.length <= radius * 2) return text;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

const sessionLink = (h: { subjectSlug: string; sessionNumber: number }) =>
  `/subjects/${h.subjectSlug}?session=${h.sessionNumber}`;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(() => termsOf(q), [q]);

  useEffect(() => {
    document.title = 'Search · My lecture notes';
    inputRef.current?.focus();
    return () => {
      document.title = 'My lecture notes';
    };
  }, []);

  // Keep the URL in step with typing (debounced), so results can be bookmarked and reloaded.
  useEffect(() => {
    if (input.trim() === q.trim()) return;
    const id = setTimeout(() => setParams(input.trim() ? { q: input } : {}, { replace: true }), 250);
    return () => clearTimeout(id);
  }, [input, q, setParams]);

  useEffect(() => {
    setKind('all');
    if (terms.length === 0) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setHits(null);
    setError(null);
    search(terms)
      .then((r) => !cancelled && setHits(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [terms]);

  const subjects = useMemo(
    () => (terms.length ? SUBJECTS.filter((s) => terms.every((t) => s.title.toLowerCase().includes(t))) : []),
    [terms],
  );

  const counts: Record<Kind, number> = { subject: subjects.length, session: 0, note: 0, image: 0, document: 0 };
  for (const h of hits ?? []) counts[h.kind]++;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const of = (k: SearchHit['kind']) => (hits ?? []).filter((h) => h.kind === k);

  const group = (k: Kind, children: ReactNode) =>
    (kind === 'all' || kind === k) &&
    counts[k] > 0 && (
      <section className="search-group">
        <h2>
          {KINDS.find((x) => x.kind === k)!.label}
          <span className="muted">{counts[k]}</span>
        </h2>
        {children}
      </section>
    );

  const meta = (h: SearchHit, extra?: string) => {
    const subject = findSubject(h.subjectSlug);
    return (
      <span className="recent-meta">
        <span className="dot" style={{ background: subject?.color }} />
        {subject ? `${subject.number} · Session ${h.sessionNumber}` : `Session ${h.sessionNumber}`}
        {extra && (
          <>
            <span className="sep">·</span>
            {extra}
          </>
        )}
      </span>
    );
  };

  const fileRow = (h: SearchHit) => (
    <li key={h.id}>
      <Link to={sessionLink(h)} className="recent-item">
        {h.kind === 'image' ? (
          <img className="recent-thumb" src={h.url} alt="" loading="lazy" />
        ) : h.kind === 'document' ? (
          <span className="recent-icon recent-doc" style={{ background: docType(h.text).color }}>
            {docType(h.text).label}
          </span>
        ) : (
          <span className="recent-icon">
            <Icon name={h.kind === 'note' ? 'note' : 'calendar'} size={18} />
          </span>
        )}
        <span className="recent-text">
          <span className={h.kind === 'note' ? 'search-note' : 'recent-file'}>
            <Highlight text={h.kind === 'note' ? snippet(h.text, terms) : h.text} terms={terms} />
          </span>
          {meta(
            h,
            h.kind === 'session'
              ? h.lectureDate
                ? new Date(`${h.lectureDate}T00:00:00`).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : undefined
              : h.createdAt && timeAgo(h.createdAt),
          )}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="search-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="btn btn-ghost btn-sm back" aria-label="Dashboard">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Dashboard</span>
          </Link>
          <form
            className="search-box"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              inputRef.current?.blur();
              setParams(input.trim() ? { q: input } : {}, { replace: true });
            }}
          >
            <Icon name="search" size={18} />
            <input
              ref={inputRef}
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search your notes…"
              aria-label="Search your lecture notes"
              enterKeyHint="search"
            />
            {input && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setInput('');
                  inputRef.current?.focus();
                }}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </form>
          <AuthLink />
        </div>
      </header>

      <div className="page search-body">
        {terms.length > 0 && !error && (
          <div className="search-filters" role="group" aria-label="Filter results">
            <button className={`search-tab${kind === 'all' ? ' active' : ''}`} onClick={() => setKind('all')}>
              All <span>{hits ? total : '…'}</span>
            </button>
            {KINDS.map((k) => (
              <button
                key={k.kind}
                className={`search-tab${kind === k.kind ? ' active' : ''}`}
                onClick={() => setKind(k.kind)}
                disabled={hits !== null && counts[k.kind] === 0}
              >
                {k.label} <span>{hits ? counts[k.kind] : '…'}</span>
              </button>
            ))}
          </div>
        )}

        {terms.length === 0 ? (
          <div className="search-empty">
            <span className="search-empty-icon">
              <Icon name="search" size={26} />
            </span>
            <h2>Search everything</h2>
            <p className="muted">Find words in your notes, session topics, image names and documents across all subjects.</p>
            <p className="muted small hide-mobile">
              Tip: press <kbd>/</kbd> on any page to search.
            </p>
          </div>
        ) : error ? (
          <p className="error">Search failed: {error}</p>
        ) : hits === null ? (
          <div className="search-results">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-block search-skeleton" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="search-empty">
            <span className="search-empty-icon">
              <Icon name="search" size={26} />
            </span>
            <h2>No results for “{q.trim()}”</h2>
            <p className="muted">Try fewer or different words. Every word must appear in a result.</p>
          </div>
        ) : (
          <div className="search-results">
            {group(
              'subject',
              <div className="search-subjects">
                {subjects.map((s) => (
                  <Link
                    key={s.slug}
                    to={`/subjects/${s.slug}`}
                    className="card search-subject"
                    style={{ '--accent': s.color } as CSSProperties}
                  >
                    <span className="badge">{s.number}</span>
                    <span className="search-subject-title">
                      <Highlight text={s.title} terms={terms} />
                    </span>
                    <Icon name="arrowRight" size={16} />
                  </Link>
                ))}
              </div>,
            )}
            {group('session', <ul className="card recent-list search-list">{of('session').map(fileRow)}</ul>)}
            {group('note', <ul className="card recent-list search-list">{of('note').map(fileRow)}</ul>)}
            {group('image', <ul className="card recent-list search-list">{of('image').map(fileRow)}</ul>)}
            {group('document', <ul className="card recent-list search-list">{of('document').map(fileRow)}</ul>)}
          </div>
        )}
      </div>
    </div>
  );
}
