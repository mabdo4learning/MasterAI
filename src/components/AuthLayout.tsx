import type { ReactNode } from 'react';
import { PALETTE } from '../subjects';

const TILES = PALETTE.slice(0, 10);
import Icon from './Icon';
import Logo from './Logo';

const FEATURES = [
  { icon: 'note', title: 'Notes for every session', text: 'Write during the lecture, find it again in seconds.' },
  { icon: 'image', title: 'Slides & whiteboard photos', text: 'Upload, drag in or paste screenshots.' },
  { icon: 'devices', title: 'Private & synced', text: 'Only you can see your notes — on your laptop and phone.' },
] as const;

/** Two-column frame shared by the sign-in and sign-up pages. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-showcase">
        <div className="banner-glow" aria-hidden />
        <div className="showcase-inner">
          <Logo size={36} className="logo-on-ink" />

          <div className="showcase-copy">
            <h1>
              Every lecture,
              <br />
              <em>beautifully</em> kept.
            </h1>
            <p>Your Master's notes and lecture images, organised by subject and session.</p>
          </div>

          <div className="subject-mosaic" aria-hidden>
            {TILES.map((c, i) => (
              <span key={c} style={{ background: c, animationDelay: `${i * 45}ms` }}>
                {String(i + 1).padStart(2, '0')}
              </span>
            ))}
          </div>

          <ul className="feature-list">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="feature-icon">
                  <Icon name={f.icon} size={18} />
                </span>
                <span>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="banner-stripe" aria-hidden>
          {TILES.map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </div>
      </aside>

      <main className="auth-main">{children}</main>
    </div>
  );
}
