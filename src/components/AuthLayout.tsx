import type { ReactNode } from 'react';
import { SUBJECTS } from '../subjects';
import Icon from './Icon';

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
          <div className="brand">
            <span className="brand-mark">
              <Icon name="note" size={20} />
            </span>
            My lecture notes
          </div>

          <div className="showcase-copy">
            <h1>
              Every lecture,
              <br />
              in one place.
            </h1>
            <p>Your Master's notes and lecture images, organised by subject and session.</p>
          </div>

          <div className="subject-mosaic" aria-label={`${SUBJECTS.length} subjects`}>
            {SUBJECTS.map((s, i) => (
              <span key={s.slug} title={s.title} style={{ background: s.color, animationDelay: `${i * 45}ms` }}>
                {s.number}
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
          {SUBJECTS.map((s) => (
            <span key={s.slug} style={{ background: s.color }} />
          ))}
        </div>
      </aside>

      <main className="auth-main">{children}</main>
    </div>
  );
}
