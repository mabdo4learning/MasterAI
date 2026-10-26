import Icon from './Icon';

export default function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <span className="brand-mark">
        <Icon name="note" size={22} />
      </span>
      <span className="splash-bar" />
    </div>
  );
}
