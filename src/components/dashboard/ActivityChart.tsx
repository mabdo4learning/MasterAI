import { useState } from 'react';
import { weekStart } from '../../lib/time';

type Props = { activity: { kind: 'note' | 'image'; createdAt: string }[] | null };

const WEEKS = 8;
const DAY = 86_400_000;

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function ActivityChart({ activity }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const current = weekStart(new Date());
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(current.getTime() - (WEEKS - 1 - i) * 7 * DAY);
    return { start, notes: 0, images: 0 };
  });
  for (const a of activity ?? []) {
    const idx = Math.round((weekStart(new Date(a.createdAt)).getTime() - weeks[0].start.getTime()) / (7 * DAY));
    if (idx >= 0 && idx < WEEKS) weeks[idx][a.kind === 'note' ? 'notes' : 'images'] += 1;
  }
  const totals = weeks.map((w) => w.notes + w.images);
  const max = Math.max(4, ...totals);
  const thisWeek = totals[WEEKS - 1];

  return (
    <section className="card chart-card">
      <div className="chart-head">
        <div>
          <h2>Weekly activity</h2>
          <p className="muted small">Notes and images added per week</p>
        </div>
        <div className="chart-headline">
          <strong>{activity ? thisWeek : '–'}</strong>
          <span className="muted small">this week</span>
        </div>
      </div>

      {activity === null ? (
        <div className="skeleton-block chart-skeleton" />
      ) : (
        <>
          <div className="columns" onMouseLeave={() => setHover(null)}>
            <div className="gridline" style={{ bottom: '100%' }}>
              <span>{max}</span>
            </div>
            <div className="gridline" style={{ bottom: '50%' }}>
              <span>{Math.round(max / 2)}</span>
            </div>
            {weeks.map((w, i) => {
              const total = totals[i];
              return (
                <div
                  key={i}
                  className={`column${hover === i ? ' hovered' : ''}`}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(hover === i ? null : i)}
                >
                  {hover === i && (
                    <div className={`chart-tooltip${i > WEEKS - 3 ? ' align-right' : ''}`} role="status">
                      <strong>{i === WEEKS - 1 ? 'This week' : `Week of ${fmt(w.start)}`}</strong>
                      <span>
                        {w.notes} {w.notes === 1 ? 'note' : 'notes'} · {w.images} {w.images === 1 ? 'image' : 'images'}
                      </span>
                    </div>
                  )}
                  <div className="bar" style={{ height: total ? `${(total / max) * 100}%` : 0 }} />
                </div>
              );
            })}
          </div>
          <div className="column-labels" aria-hidden>
            {weeks.map((w, i) => (
              <span key={i} className={(WEEKS - 1 - i) % 2 ? 'alt' : ''}>
                {i === WEEKS - 1 ? 'This wk' : fmt(w.start)}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>Notes and images added per week</caption>
            <thead>
              <tr>
                <th>Week of</th>
                <th>Notes</th>
                <th>Images</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={i}>
                  <td>{fmt(w.start)}</td>
                  <td>{w.notes}</td>
                  <td>{w.images}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
