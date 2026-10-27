import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { findSubject } from '../../subjects';
import { getQuestionStats, updateSession, type DashboardSession, type QuestionStats } from '../../lib/api';
import { examDate, todayKey } from '../../lib/exams';
import Icon from '../Icon';
import { useToast } from '../Toast';

type Props = {
  sessions: DashboardSession[] | null;
  onPatch: (id: string, patch: Partial<DashboardSession>) => void;
};

const WINDOW_DAYS = 7;
const BACKLOG_PREVIEW = 3;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Lectures from the last 7 days that still need going over, plus older ones never marked
 * reviewed and questions missed in practice. Built for a quick Sunday catch-up.
 */
export default function WeeklyReview({ sessions, onPatch }: Props) {
  const toast = useToast();
  const [stats, setStats] = useState<QuestionStats | null>(null);
  const [showBacklog, setShowBacklog] = useState(false);

  useEffect(() => {
    // Optional extra: without the questions table the rest of the card still works.
    getQuestionStats()
      .then(setStats)
      .catch(() => setStats({}));
  }, []);

  const today = todayKey();
  const from = daysAgo(WINDOW_DAYS - 1);
  const dated = (sessions ?? []).filter((s) => s.lectureDate && findSubject(s.subjectSlug));
  const week = dated
    .filter((s) => s.lectureDate! >= from && s.lectureDate! <= today)
    .sort((a, b) => a.lectureDate!.localeCompare(b.lectureDate!));
  const backlog = dated
    .filter((s) => s.lectureDate! < from && !s.reviewed)
    .sort((a, b) => a.lectureDate!.localeCompare(b.lectureDate!));
  const reviewed = week.filter((s) => s.reviewed).length;
  const missed = Object.entries(stats ?? {})
    .filter(([slug, s]) => s.missed > 0 && findSubject(slug))
    .sort(([a], [b]) => findSubject(a)!.number.localeCompare(findSubject(b)!.number));

  const toggle = async (s: DashboardSession) => {
    const value = !s.reviewed;
    onPatch(s.id, { reviewed: value });
    try {
      await updateSession(s.id, { reviewed: value });
      if (value) toast(`Session ${s.number} marked reviewed`);
    } catch (e) {
      onPatch(s.id, { reviewed: !value });
      toast((e as Error).message, 'error');
    }
  };

  const row = (s: DashboardSession) => {
    const subject = findSubject(s.subjectSlug)!;
    const link = `/subjects/${subject.slug}?session=${s.number}`;
    return (
      <li key={s.id} className={`review-item${s.reviewed ? ' done' : ''}`} style={{ '--accent': subject.color } as CSSProperties}>
        <span className="mini-badge" style={{ background: subject.color }}>
          {subject.number}
        </span>
        <Link to={link} className="review-text">
          <span className="review-title">
            Session {s.number}
            {s.topic ? ` · ${s.topic}` : ` · ${subject.title}`}
          </span>
          <span className="review-sub">
            {examDate(s.lectureDate!)}
            {s.noteCount === 0 ? (
              <span className="review-warn"> · no notes yet</span>
            ) : (
              ` · ${plural(s.noteCount, 'note')}`
            )}
          </span>
        </Link>
        <button
          type="button"
          className={`review-check${s.reviewed ? ' on' : ''}`}
          aria-pressed={s.reviewed}
          onClick={() => toggle(s)}
          title={s.reviewed ? 'Mark as not reviewed' : 'Mark as reviewed'}
        >
          <span className="check-box">{s.reviewed && <Icon name="check" size={12} />}</span>
          <span className="hide-mobile">{s.reviewed ? 'Reviewed' : 'Mark reviewed'}</span>
        </button>
      </li>
    );
  };

  const caughtUp = week.length > 0 && reviewed === week.length && backlog.length === 0;

  return (
    <section className="card weekly-card">
      <div className="chart-head">
        <div>
          <h2>Weekly review</h2>
          <p className="muted small">
            Lectures from {examDate(from)} to today — go over each one and tick it off
          </p>
        </div>
        {sessions && week.length > 0 && (
          <div className="weekly-progress" aria-label={`${reviewed} of ${week.length} reviewed`}>
            <strong>
              {reviewed}
              <span>/{week.length}</span>
            </strong>
            <span className="weekly-bar">
              <span style={{ width: `${(reviewed / week.length) * 100}%` }} />
            </span>
            <span className="muted small">reviewed</span>
          </div>
        )}
      </div>

      {sessions === null ? (
        <div className="skeleton-block note-skeleton" />
      ) : week.length === 0 && backlog.length === 0 ? (
        <div className="recent-empty">
          <Icon name="calendarDays" size={22} />
          <p>
            {dated.length === 0
              ? 'Add a date to your sessions and the lectures of the past week will show up here to review.'
              : 'No lectures in the last 7 days, and nothing older left to review.'}
          </p>
        </div>
      ) : (
        <>
          {week.length > 0 ? (
            <ul className="review-list">{week.map(row)}</ul>
          ) : (
            <p className="empty-line">No lectures in the last 7 days.</p>
          )}

          {caughtUp && (
            <p className="weekly-done">
              <Icon name="check" size={15} /> All caught up for this week
            </p>
          )}

          {backlog.length > 0 && (
            <div className="backlog">
              <h3>
                Still to review from earlier <span className="count">{backlog.length}</span>
              </h3>
              <ul className="review-list">{(showBacklog ? backlog : backlog.slice(0, BACKLOG_PREVIEW)).map(row)}</ul>
              {backlog.length > BACKLOG_PREVIEW && (
                <button type="button" className="link-btn" onClick={() => setShowBacklog(!showBacklog)}>
                  {showBacklog ? 'Show fewer' : `Show all ${backlog.length}`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {missed.length > 0 && (
        <div className="weekly-questions">
          <span className="muted small">
            <Icon name="help" size={14} /> Questions missed last time:
          </span>
          <span className="gap-chips">
            {missed.map(([slug, s]) => {
              const subject = findSubject(slug)!;
              return (
                <Link
                  key={slug}
                  to={`/subjects/${slug}/practice?mode=missed`}
                  className="gap-chip"
                  style={{ '--accent': subject.color } as CSSProperties}
                  title={`Practise the ${plural(s.missed, 'missed question')} in ${subject.title}`}
                >
                  {subject.number} · {s.missed}
                </Link>
              );
            })}
          </span>
        </div>
      )}
    </section>
  );
}
