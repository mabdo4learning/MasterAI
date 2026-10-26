import { strength } from '../lib/password';

export default function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const pw = strength(password);
  return (
    <span className={`strength s${pw.score}`}>
      <span className="strength-bar" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      {pw.label}
    </span>
  );
}
