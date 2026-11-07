import { useId } from 'react';
import { BRAND } from '../brand';

/** The brand monogram: a gold "L" with a small spark, on an emerald tile. */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg
      className={`logo-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17705a" />
          <stop offset="1" stopColor="#0a2a20" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1d9a2" />
          <stop offset="1" stopColor="#c0974f" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}-bg)`} />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="#fff" strokeOpacity="0.12" />
      <path
        d="M15 11.5v16h11"
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M32 4.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#f1d9a2" />
    </svg>
  );
}

/** Mark + wordmark, e.g. in headers. */
export default function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark size={size} />
      <span className="logo-word">{BRAND.name}</span>
    </span>
  );
}
