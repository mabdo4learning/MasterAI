import Icon, { type IconName } from '../Icon';

export type Stat = { label: string; value: number | null; detail: string; icon: IconName };

export default function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-tiles">
      {stats.map((s) => (
        <div key={s.label} className="card stat-tile">
          <span className="stat-label">
            <Icon name={s.icon} size={15} />
            {s.label}
          </span>
          {s.value === null ? <span className="skeleton stat-skeleton" /> : <strong className="stat-value">{s.value}</strong>}
          <span className="stat-detail">{s.value === null ? ' ' : s.detail}</span>
        </div>
      ))}
    </div>
  );
}
