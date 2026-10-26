import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SUBJECTS, findSubject } from '../subjects';
import { listAllSessions, updateSession, type DashboardSession } from '../lib/api';
import { weekStart } from '../lib/time';
import AuthLink from '../components/AuthLink';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => new Date(`${k}T00:00:00`);
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const parseMonth = (s: string | null) => {
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  return m ? new Date(+m[1], +m[2] - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const subjectOrder = (s: DashboardSession) => findSubject(s.subjectSlug)?.number ?? '99';
const bySubject = (a: DashboardSession, b: DashboardSession) =>
  subjectOrder(a).localeCompare(subjectOrder(b)) || a.number - b.number;

export default function CalendarPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [sessions, setSessions] = useState<DashboardSession[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = 'Calendar · My lecture notes';
    listAllSessions()
      .then(setSessions)
      .catch((e) => toast(e.message, 'error'));
    return () => {
      document.title = 'My lecture notes';
    };
  }, [toast]);

  const todayKey = toKey(new Date());
  const month = parseMonth(params.get('month'));
  const selectedKey =
    params.get('day') ?? (todayKey.startsWith(monthKey(month)) ? todayKey : toKey(month));

  const go = (next: { month?: Date; day?: string }) => {
    const m = next.month ?? (next.day ? fromKey(next.day) : month);
    const p: Record<string, string> = { month: monthKey(m) };
    if (next.day) p.day = next.day;
    setParams(p, { replace: true });
  };
  const shiftMonth = (delta: number) => go({ month: new Date(month.getFullYear(), month.getMonth() + delta, 1) });

  const visible = useMemo(
    () => (sessions ?? []).filter((s) => !hidden.has(s.subjectSlug)),
    [sessions, hidden],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, DashboardSession[]>();
    for (const s of visible) {
      if (!s.lectureDate) continue;
      map.set(s.lectureDate, [...(map.get(s.lectureDate) ?? []), s]);
    }
    for (const list of map.values()) list.sort(bySubject);
    return map;
  }, [visible]);

  // 5 or 6 week rows, starting on the Monday on/before the 1st.
  const gridStart = weekStart(month);
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const spanDays = Math.round((lastOfMonth.getTime() - gridStart.getTime()) / 86_400_000);
  const weeks = Math.ceil((spanDays + 1) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const thisMonth = monthKey(month);
  const monthCount = visible.filter((s) => s.lectureDate?.startsWith(thisMonth)).length;
  const upcoming = visible
    .filter((s) => s.lectureDate && s.lectureDate >= todayKey)
    .sort((a, b) => a.lectureDate!.localeCompare(b.lectureDate!) || bySubject(a, b))
    .slice(0, 6);
  const unscheduled = (sessions ?? []).filter((s) => !s.lectureDate).length;

  const setDate = async (session: DashboardSession, date: string | null) => {
    try {
      await updateSession(session.id, { lecture_date: date });
      setSessions((list) => list?.map((s) => (s.id === session.id ? { ...s, lectureDate: date } : s)) ?? null);
      const subject = findSubject(session.subjectSlug);
      toast(
        date
          ? `${subject?.number} · Session ${session.number} scheduled for ${fromKey(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
          : `Date removed from ${subject?.number} · Session ${session.number}`,
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const toggleSubject = (slug: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const selectedSessions = byDay.get(selectedKey) ?? [];

  return (
    <div className="calendar-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="btn btn-ghost btn-sm back" aria-label="Dashboard">
            <Icon name="arrowLeft" size={16} />
            <span className="hide-mobile">Dashboard</span>
          </Link>
          <div className="topbar-title">
            <span className="badge calendar-badge">
              <Icon name="calendarDays" size={22} />
            </span>
            <div className="topbar-text">
              <h1>Calendar</h1>
              <p className="muted small">
                {sessions
                  ? `${sessions.length - unscheduled} scheduled · ${unscheduled} without a date`
                  : 'Loading sessions…'}
              </p>
            </div>
          </div>
          <AuthLink />
        </div>
      </header>

      <div className="page calendar-body">
        <div className="subject-filter" role="group" aria-label="Show subjects">
          {SUBJECTS.map((s) => {
            const off = hidden.has(s.slug);
            return (
              <button
                key={s.slug}
                className={`filter-chip${off ? ' off' : ''}`}
                onClick={() => toggleSubject(s.slug)}
                aria-pressed={!off}
                title={`${off ? 'Show' : 'Hide'} ${s.title}`}
                style={{ '--accent': s.color } as CSSProperties}
              >
                <span className="chip-swatch" />
                <span className="chip-number">{s.number}</span>
                <span className="chip-title">{s.title}</span>
              </button>
            );
          })}
          {hidden.size > 0 && (
            <button className="filter-reset" onClick={() => setHidden(new Set())}>
              Show all
            </button>
          )}
        </div>

        <div className="calendar-layout">
          <section className="card month-card">
            <div className="month-head">
              <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
              <span className="muted small hide-mobile">
                {monthCount} {monthCount === 1 ? 'lecture' : 'lectures'}
              </span>
              <div className="month-nav">
                <button className="btn btn-ghost btn-sm" onClick={() => go({ day: todayKey })}>
                  Today
                </button>
                <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  <Icon name="chevronLeft" />
                </button>
                <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                  <Icon name="chevronRight" />
                </button>
              </div>
            </div>

            <div className="month-grid" role="grid" aria-label="Lectures by day">
              {WEEKDAYS.map((d) => (
                <div key={d} className="weekday" role="columnheader">
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const key = toKey(d);
                const list = byDay.get(key) ?? [];
                const outside = d.getMonth() !== month.getMonth();
                const classes = [
                  'day',
                  outside && 'outside',
                  key === todayKey && 'today',
                  key === selectedKey && 'selected',
                  list.length > 0 && 'has-lectures',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={key}
                    className={classes}
                    onClick={() => go({ day: key })}
                    role="gridcell"
                    aria-selected={key === selectedKey}
                    aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${list.length} ${list.length === 1 ? 'lecture' : 'lectures'}`}
                  >
                    <span className="day-number">{d.getDate()}</span>
                    {sessions === null && !outside && d.getDate() % 5 === 0 && <span className="skeleton day-skeleton" />}
                    <span className="day-chips">
                      {list.slice(0, 3).map((s) => {
                        const subject = findSubject(s.subjectSlug)!;
                        return (
                          <span
                            key={s.id}
                            className="day-chip"
                            style={{ '--accent': subject.color } as CSSProperties}
                            title={`${subject.title} · Session ${s.number}${s.topic ? ` — ${s.topic}` : ''}`}
                          >
                            <strong>{subject.number}</strong>
                            <span>S{s.number}{s.topic ? ` · ${s.topic}` : ''}</span>
                          </span>
                        );
                      })}
                      {list.length > 3 && <span className="day-more">+{list.length - 3} more</span>}
                    </span>
                    <span className="day-dots" aria-hidden>
                      {list.slice(0, 4).map((s) => (
                        <span key={s.id} style={{ background: findSubject(s.subjectSlug)?.color }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="calendar-side">
            <section className="card">
              <div className="side-head">
                <span className="eyebrow">{selectedKey === todayKey ? 'Today' : 'Selected day'}</span>
                <h2>
                  {fromKey(selectedKey).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
              </div>

              {selectedSessions.length === 0 ? (
                <p className="empty-line">No lectures on this day.</p>
              ) : (
                <ul className="agenda">
                  {selectedSessions.map((s) => (
                    <AgendaItem key={s.id} session={s} onRemoveDate={() => setDate(s, null)} />
                  ))}
                </ul>
              )}

              {sessions && (
                <ScheduleForm
                  key={selectedKey}
                  sessions={sessions}
                  dayKey={selectedKey}
                  onSchedule={(s) => setDate(s, selectedKey)}
                />
              )}
            </section>

            <section className="card">
              <div className="side-head">
                <span className="eyebrow">
                  <Icon name="clock" size={13} /> Coming up
                </span>
              </div>
              {sessions === null ? (
                <div className="skeleton-block recent-skeleton" />
              ) : upcoming.length === 0 ? (
                <p className="empty-line">No upcoming lectures. Add dates to your sessions to see them here.</p>
              ) : (
                <ul className="agenda">
                  {upcoming.map((s) => (
                    <AgendaItem key={s.id} session={s} showDate onSelectDay={() => go({ day: s.lectureDate! })} />
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function AgendaItem({
  session,
  showDate,
  onRemoveDate,
  onSelectDay,
}: {
  session: DashboardSession;
  showDate?: boolean;
  onRemoveDate?: () => void;
  onSelectDay?: () => void;
}) {
  const subject = findSubject(session.subjectSlug)!;
  const date = session.lectureDate ? fromKey(session.lectureDate) : null;
  return (
    <li className="agenda-item" style={{ '--accent': subject.color } as CSSProperties}>
      {showDate && date ? (
        <button className="agenda-date" onClick={onSelectDay} title="Show this day">
          <span>{date.toLocaleDateString(undefined, { month: 'short' })}</span>
          <strong>{date.getDate()}</strong>
        </button>
      ) : (
        <span className="mini-badge" style={{ background: subject.color }}>
          {subject.number}
        </span>
      )}
      <Link to={`/subjects/${subject.slug}?session=${session.number}`} className="agenda-text">
        <span className="agenda-title">{subject.title}</span>
        <span className="agenda-sub">
          Session {session.number}
          {session.topic ? ` · ${session.topic}` : ''}
        </span>
      </Link>
      {onRemoveDate ? (
        <button className="icon-btn danger" onClick={onRemoveDate} aria-label="Remove date" title="Remove date">
          <Icon name="x" size={15} />
        </button>
      ) : (
        <Link
          to={`/subjects/${subject.slug}?session=${session.number}`}
          className="icon-btn"
          aria-label="Open session"
        >
          <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </li>
  );
}

function ScheduleForm({
  sessions,
  dayKey,
  onSchedule,
}: {
  sessions: DashboardSession[];
  dayKey: string;
  onSchedule: (s: DashboardSession) => Promise<void>;
}) {
  const [subjectSlug, setSubjectSlug] = useState(SUBJECTS[0].slug);
  const options = sessions.filter((s) => s.subjectSlug === subjectSlug).sort((a, b) => a.number - b.number);
  const firstFree = options.find((s) => !s.lectureDate) ?? options[0];
  const [sessionId, setSessionId] = useState<string | undefined>(firstFree?.id);
  const [busy, setBusy] = useState(false);

  const selected = options.find((s) => s.id === sessionId) ?? firstFree;
  const label = fromKey(dayKey).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const short = (d: string) => fromKey(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <form
      className="schedule-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!selected) return;
        setBusy(true);
        await onSchedule(selected);
        setBusy(false);
      }}
    >
      <span className="schedule-title">
        <Icon name="plus" size={14} /> Schedule a session on {label}
      </span>
      <select
        value={subjectSlug}
        onChange={(e) => {
          setSubjectSlug(e.target.value);
          setSessionId(undefined);
        }}
        aria-label="Subject"
      >
        {SUBJECTS.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.number} · {s.title}
          </option>
        ))}
      </select>
      <div className="schedule-row">
        <select value={selected?.id ?? ''} onChange={(e) => setSessionId(e.target.value)} aria-label="Session">
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              Session {s.number}
              {s.lectureDate ? ` (now ${short(s.lectureDate)})` : ''}
            </option>
          ))}
        </select>
        <button className="btn" disabled={busy || !selected || selected.lectureDate === dayKey}>
          {selected?.lectureDate === dayKey ? 'Scheduled' : busy ? 'Saving…' : 'Schedule'}
        </button>
      </div>
    </form>
  );
}
