import { LogoMark } from './Logo';

export default function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <LogoMark size={56} className="splash-mark" />
      <span className="splash-bar" />
    </div>
  );
}
