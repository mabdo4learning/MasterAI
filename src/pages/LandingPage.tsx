import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../brand';
import { PALETTE } from '../subjects';
import Logo, { LogoMark } from '../components/Logo';
import Icon, { type IconName } from '../components/Icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'note', title: 'Notes for every session', text: 'A calm page for each lecture: write as you listen, edit later, find it again in seconds.' },
  { icon: 'image', title: 'Slides, photos & documents', text: 'Drop in slides, snap the whiteboard, attach PDFs, PowerPoint, Word or Excel — all in the session they belong to.' },
  { icon: 'help', title: 'Question bank & practice', text: 'Turn each session into exam-style questions, then practise them in a focused, shuffled run.' },
  { icon: 'calendarDays', title: 'Calendar & exam countdown', text: 'See lectures by date, mark your exams, and watch the countdown on your dashboard.' },
  { icon: 'check', title: 'Weekly review', text: 'Tick attended, notes, slides and reviewed. The dashboard shows exactly what still needs you.' },
  { icon: 'users', title: 'Share with classmates', text: 'Share a subject, a session or a few chosen notes. They see it live, read-only, or copy it into their own notebook.' },
  { icon: 'search', title: 'Search everything', text: 'One search across notes, topics, images and documents — press / from anywhere.' },
  { icon: 'printer', title: 'Export & backup', text: 'Print a subject as a clean PDF, or download a full backup of your notebook whenever you like.' },
];

const STEPS = [
  { title: 'Set up your programme', text: 'Add your modules, pick a colour for each and choose how many sessions they have. Two minutes, once.' },
  { title: 'Capture every lecture', text: 'Notes, slides and whiteboard photos land in the right session, on your laptop or your phone.' },
  { title: 'Revise with confidence', text: 'Practise your questions, follow your weekly review and walk into every exam prepared.' },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Who is it for?',
    a: `Master’s students — and anyone studying a programme of modules and lectures — who want their notes, slides and revision in one beautiful place.`,
  },
  {
    q: 'Is my notebook private?',
    a: 'Yes. Every page requires signing in, the database only ever returns your own rows, and your images and files live in a private storage bucket shown through short-lived signed links. Nothing is shared unless you share it.',
  },
  {
    q: 'Does it work on my phone?',
    a: `Yes. ${BRAND.name} works in any modern browser and can be installed as an app on your phone or laptop, with a camera button for quick whiteboard photos.`,
  },
  {
    q: 'Can I take my notes with me?',
    a: 'Always. Export any subject as a PDF, or download a complete backup of your notes and files from Settings.',
  },
  {
    q: 'What does it cost?',
    a: `${BRAND.name} is free while in early access. If paid plans arrive later, you’ll hear about them well in advance — and your notes stay yours either way.`,
  },
];

/** Fades sections in as they scroll into view (skipped when the visitor prefers less motion). */
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const items = root.current?.querySelectorAll<HTMLElement>('.reveal');
    if (!items?.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((el) => el.classList.add('shown'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('shown');
            io.unobserve(e.target);
          }
        }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return root;
}

/** The public home page for visitors who aren't signed in. */
export default function LandingPage() {
  const root = useReveal();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.title = `${BRAND.name} — ${BRAND.tagline}`;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.title = BRAND.name;
    };
  }, []);

  return (
    <div className="lp" ref={root}>
      <header className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" aria-label={`${BRAND.name} home`}>
            <Logo size={32} />
          </Link>
          <nav className="lp-links hide-mobile" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-nav-actions">
            <Link to="/login" className="btn btn-ghost btn-sm">
              Sign in
            </Link>
            <Link to="/signup" className="btn btn-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-hero-glow" aria-hidden />
          <div className="lp-wrap lp-hero-inner">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">
                <Icon name="sparkle" size={14} /> The study notebook for your Master’s
              </span>
              <h1>
                Every lecture,
                <br />
                <em>beautifully</em> kept.
              </h1>
              <p className="lp-lede">
                {BRAND.name} gives every module and every session its own elegant page — notes, slides, photos and
                practice questions, organised the moment you add them.
              </p>
              <div className="lp-cta-row">
                <Link to="/signup" className="btn btn-lg">
                  Start your notebook <Icon name="arrowRight" size={16} />
                </Link>
                <a href="#features" className="btn btn-ghost btn-lg">
                  See what’s inside
                </a>
              </div>
              <ul className="lp-assurances">
                <li>
                  <Icon name="check" size={15} /> Free in early access
                </li>
                <li>
                  <Icon name="shield" size={15} /> Private by default
                </li>
                <li>
                  <Icon name="devices" size={15} /> Laptop & phone
                </li>
              </ul>
            </div>

            <HeroMock />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-head reveal">
              <span className="lp-kicker">Everything in its place</span>
              <h2>
                A notebook that <em>thinks</em> in modules and sessions.
              </h2>
              <p>Built around how a Master’s actually runs — so nothing gets lost between the lecture and the exam.</p>
            </div>
            <div className="lp-features">
              {FEATURES.map((f, i) => (
                <article key={f.title} className="lp-feature reveal" style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
                  <span className="lp-feature-icon">
                    <Icon name={f.icon} size={20} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Practice showcase */}
        <section className="lp-section lp-split-section">
          <div className="lp-wrap lp-split">
            <div className="lp-split-copy reveal">
              <span className="lp-kicker">Revision, built in</span>
              <h2>
                From notes to <em>exam-ready</em>.
              </h2>
              <p>
                Add questions as you study each session. When exams approach, practise a whole subject in a shuffled run,
                mark what you got right, and come back to what you missed.
              </p>
              <ul className="lp-ticks">
                <li>
                  <Icon name="check" size={16} /> Question bank for every session
                </li>
                <li>
                  <Icon name="check" size={16} /> Practice mode with your results remembered
                </li>
                <li>
                  <Icon name="check" size={16} /> Exam countdown and a weekly review
                </li>
              </ul>
            </div>
            <div className="lp-practice reveal" aria-hidden>
              <div className="lp-q-card">
                <div className="lp-q-top">
                  <span className="mini-badge" style={{ background: PALETTE[3] }}>
                    04
                  </span>
                  <span className="muted small">Finance · Session 5</span>
                  <span className="lp-q-count">3 / 12</span>
                </div>
                <p className="lp-q">What distinguishes the weighted average cost of capital from the cost of equity?</p>
                <div className="lp-q-answer">
                  WACC blends the cost of equity and the after-tax cost of debt, weighted by how the firm is financed.
                </div>
                <div className="lp-q-actions">
                  <span className="lp-grade wrong">
                    <Icon name="x" size={14} /> Missed it
                  </span>
                  <span className="lp-grade right">
                    <Icon name="check" size={14} /> Got it
                  </span>
                </div>
              </div>
              <div className="lp-q-progress">
                <span style={{ width: '25%' }} />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-head reveal">
              <span className="lp-kicker">How it works</span>
              <h2>Ready before your next lecture.</h2>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy */}
        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-privacy reveal">
              <span className="lp-privacy-icon">
                <Icon name="shield" size={26} />
              </span>
              <div>
                <h2>Private by design.</h2>
                <p>
                  Your notebook is yours alone. Every request is checked against your account, files sit in a private bucket
                  behind short-lived links, and sharing only ever happens when you choose it — read-only, and revocable at any
                  time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-head reveal">
              <span className="lp-kicker">Pricing</span>
              <h2>
                Free while we’re in <em>early access</em>.
              </h2>
            </div>
            <div className="lp-price reveal">
              <div className="lp-price-top">
                <span className="lp-price-name">Early access</span>
                <span className="lp-price-amount">
                  <strong>Free</strong>
                </span>
                <p className="muted">Everything in {BRAND.name}, for your whole programme.</p>
              </div>
              <ul className="lp-ticks">
                <li>
                  <Icon name="check" size={16} /> Unlimited subjects and sessions
                </li>
                <li>
                  <Icon name="check" size={16} /> Notes, images and documents
                </li>
                <li>
                  <Icon name="check" size={16} /> Question bank and practice mode
                </li>
                <li>
                  <Icon name="check" size={16} /> Sharing, PDF export and full backups
                </li>
              </ul>
              <Link to="/signup" className="btn btn-lg">
                Create your free account <Icon name="arrowRight" size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="lp-section">
          <div className="lp-wrap lp-faq-wrap">
            <div className="lp-head reveal">
              <span className="lp-kicker">Questions</span>
              <h2>Good to know.</h2>
            </div>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q} className="reveal">
                  <summary>
                    {f.q}
                    <Icon name="plus" size={18} />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-final reveal">
              <div className="banner-glow" aria-hidden />
              <LogoMark size={52} />
              <h2>
                Give your Master’s the notebook <em>it deserves</em>.
              </h2>
              <Link to="/signup" className="btn btn-lg lp-gold-btn">
                Start free <Icon name="arrowRight" size={16} />
              </Link>
              <span className="lp-final-note">Takes two minutes. No card needed.</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <Logo size={26} />
          <span className="muted small">
            © {new Date().getFullYear()} {BRAND.name}. {BRAND.tagline}
          </span>
          <div className="lp-footer-links">
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** A small, static picture of the app for the hero (not a screenshot, so it follows the theme). */
function HeroMock() {
  const subjects = [
    { n: '01', t: 'Corporate Finance', c: PALETTE[0], p: 0.75 },
    { n: '02', t: 'Strategic Marketing', c: PALETTE[4], p: 0.5 },
    { n: '03', t: 'Leadership', c: PALETTE[2], p: 0.38 },
  ];
  return (
    <div className="lp-mock" aria-hidden>
      <div className="lp-window">
        <div className="lp-window-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="lp-mock-banner">
          <div>
            <span className="lp-mock-eyebrow">Your study notebook</span>
            <strong>
              Good morning, <em>Sara</em>.
            </strong>
            <span className="lp-mock-cta">
              <span className="mini-badge" style={{ background: PALETTE[0] }}>
                01
              </span>
              Continue · Session 6
            </span>
          </div>
          <svg viewBox="0 0 80 80" width="76" height="76" className="lp-mock-ring">
            <circle cx="40" cy="40" r="32" />
            <circle cx="40" cy="40" r="32" strokeDasharray="201" strokeDashoffset="84" />
          </svg>
        </div>
        <div className="lp-mock-cards">
          {subjects.map((s) => (
            <div key={s.n} className="lp-mock-card" style={{ '--accent': s.c } as CSSProperties}>
              <span className="mini-badge" style={{ background: s.c }}>
                {s.n}
              </span>
              <strong>{s.t}</strong>
              <span className="lp-mock-bar">
                <span style={{ width: `${s.p * 100}%`, background: s.c }} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-float lp-float-note">
        <span className="lp-float-label">
          <Icon name="note" size={13} /> Session 6 · Notes
        </span>
        <p>Porter’s five forces — rivalry is highest when exit barriers are high and growth is slow…</p>
      </div>
      <div className="lp-float lp-float-exam">
        <Icon name="calendarDays" size={16} />
        <span>
          <strong>Finance exam</strong>
          <span>in 12 days</span>
        </span>
      </div>
    </div>
  );
}
