import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BRAND, LEGAL } from '../brand';
import { PRICING } from '../lib/billing';
import Logo from '../components/Logo';
import Icon from '../components/Icon';

/*
 * The Privacy Policy and Terms. They describe how this app actually works (Supabase, Vercel,
 * Google Gemini, Paddle, Google Fonts; no analytics or ads). If you add a service that touches
 * user data — analytics, error tracking, an email provider — add it to PROCESSORS and update
 * LEGAL.lastUpdated in src/brand.ts. This is a starting point, not legal advice.
 */

type Section = { id: string; title: string; body: ReactNode };

const Mail = () => <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;

function LegalLayout({ title, intro, sections }: { title: string; intro: ReactNode; sections: Section[] }) {
  const { hash } = useLocation();
  useEffect(() => {
    // Open at the linked section (e.g. /terms#pro), or at the top.
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [title, hash]);

  useEffect(() => {
    document.title = `${title} · ${BRAND.name}`;
    return () => {
      document.title = BRAND.name;
    };
  }, [title]);

  return (
    <div className="lp legal">
      <header className="lp-nav scrolled">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" aria-label={`${BRAND.name} home`}>
            <Logo size={30} />
          </Link>
          <nav className="lp-nav-actions" aria-label="Legal">
            <Link to="/privacy" className="btn btn-ghost btn-sm">
              Privacy
            </Link>
            <Link to="/terms" className="btn btn-ghost btn-sm">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="lp-wrap legal-wrap">
        <aside className="legal-toc" aria-label="Contents">
          <span className="lp-kicker">Contents</span>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="legal-doc">
          <span className="lp-kicker">Last updated {LEGAL.lastUpdated}</span>
          <h1>{title}</h1>
          <div className="legal-intro">{intro}</div>
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="prose">
              <h2>
                <span className="legal-num">{String(i + 1).padStart(2, '0')}</span> {s.title}
              </h2>
              {s.body}
            </section>
          ))}
          <p className="legal-back">
            <Link to="/" className="btn btn-ghost">
              <Icon name="arrowLeft" size={16} /> Back to {BRAND.name}
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- Privacy Policy

const PROCESSORS: { name: string; role: string; link: string }[] = [
  {
    name: 'Supabase',
    role: 'Hosts the database, sign-in and file storage, so it stores your account and everything in your notebook.',
    link: 'https://supabase.com/privacy',
  },
  {
    name: 'Vercel',
    role: 'Serves the website. Like any web host, it sees your IP address and browser details when pages load.',
    link: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'Google (Gemini API)',
    role: 'Runs the AI behind the study assistant. It receives a session’s notes only when you ask the assistant to work on them.',
    link: 'https://ai.google.dev/gemini-api/terms',
  },
  {
    name: 'Paddle',
    role: 'Sells Pro subscriptions as our reseller and merchant of record, and handles your payment details, tax and invoices.',
    link: 'https://www.paddle.com/legal/privacy',
  },
  {
    name: 'Google Fonts',
    role: 'Delivers the typefaces. Your browser fetches them from Google, which sees your IP address.',
    link: 'https://policies.google.com/privacy',
  },
];

const PRIVACY: Section[] = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <p>
        {BRAND.name} is operated by {LEGAL.operator} (“we”, “us”). We are responsible for the personal data described in
        this policy. For any privacy question or request, email <Mail />.
      </p>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <ul>
          <li>
            <strong>Account details:</strong> your email address and password (stored only as a secure hash by our
            sign-in provider), and the name, programme, university and academic year you choose to add.
          </li>
          <li>
            <strong>Your notebook:</strong> the subjects, sessions, notes, images, documents, practice questions,
            checklists, exam dates and course details you add.
          </li>
          <li>
            <strong>Sharing:</strong> who you share notes with (their account or email address), and share links you
            create.
          </li>
          <li>
            <strong>Pro subscriptions:</strong> your Paddle customer and subscription ids, your plan and its status and
            renewal dates. We never see or store your card details — Paddle does.
          </li>
          <li>
            <strong>Study assistant usage:</strong> when you use it, a record of the request (time, type, which session, and
            how much text was processed), used for daily limits and cost control.
          </li>
          <li>
            <strong>Technical data:</strong> the IP address, browser and device details that our hosting providers see when
            you use the site, kept in their logs.
          </li>
        </ul>
        <p>
          We don’t use analytics, advertising or tracking cookies, and we don’t sell or rent your data to anyone.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <>
        <p>We use your data only to run {BRAND.name}:</p>
        <ul>
          <li>to provide your notebook, keep it in sync across your devices, and keep it private to you;</li>
          <li>to show what you’ve chosen to share to the people you shared it with;</li>
          <li>to run the study assistant when you ask it to;</li>
          <li>to manage your Pro subscription;</li>
          <li>to send account emails, such as confirming your address or resetting your password;</li>
          <li>to keep the service secure, prevent abuse, and fix problems.</li>
        </ul>
        <p>
          Where the law asks for a legal basis, we rely on <em>performing our contract with you</em> (providing the service
          you signed up for), our <em>legitimate interests</em> in keeping it secure and working, and{' '}
          <em>legal obligations</em> such as tax records for payments.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    title: 'The study assistant (AI)',
    body: (
      <>
        <p>
          The study assistant is optional. Only when you press <em>Summarise notes</em> or <em>Suggest questions</em>, the
          notes of that one session — with its topic, subject name and your programme name — are sent to Google’s
          Gemini API to produce the result. Nothing is sent otherwise.
        </p>
        <p>
          We use Google’s free tier of the Gemini API. Under Google’s terms for that tier, Google may use what is sent to it,
          and its responses, to provide and improve its products and models, and trained human reviewers may read it. So
          don’t use the assistant on notes that contain anything you want kept private, such as personal or confidential
          details. Summaries and questions are shown only to you, and saved only if you choose to save them.
        </p>
        <p>AI output can be wrong. Check it against your lecture materials before relying on it.</p>
      </>
    ),
  },
  {
    id: 'share',
    title: 'Who we share it with',
    body: (
      <>
        <p>We use these providers to run the service. Each only gets what it needs for its job:</p>
        <ul className="legal-processors">
          {PROCESSORS.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> — {p.role}{' '}
              <a href={p.link} target="_blank" rel="noopener noreferrer">
                Their privacy policy
              </a>
              .
            </li>
          ))}
        </ul>
        <p>
          Paddle is the seller of your Pro subscription, so for payments it acts as an independent controller under its own
          privacy policy. Apart from these providers, we share data only with people you share notes with, or when the law
          requires it.
        </p>
        <p>
          These providers may process data outside your country, including in the United States and the European Union. We
          rely on their contractual and security commitments to protect it.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and local storage',
    body: (
      <>
        <p>
          We don’t use tracking cookies. Your browser stores a few things on your device so the site works: your sign-in
          session, your light or dark theme choice, a share link you opened before signing in, and when you last downloaded a
          backup. Clearing your browser’s site data removes them and signs you out.
        </p>
        <p>Paddle’s checkout may set its own cookies when you open it, to process your payment securely.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <p>
        Everything travels over encrypted connections. The database only ever returns your own rows to your account, your
        images and files sit in private storage shown through short-lived links, and the study assistant reads your notes
        with your own sign-in. No system is perfectly secure, but we work to keep yours safe and will tell you without undue
        delay if a breach affects your data.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <p>
        We keep your account and notebook for as long as you have an account. When you delete your account in Settings, it
        is removed straight away with all its notes, files and shares, and a Pro subscription is cancelled; copies in our
        providers’ backups disappear as those backups expire. If you ask us by email instead, we do the same within 30 days.
        Assistant usage records are kept for up to 12 months. Paddle keeps payment and tax records for as long as the law
        requires.
      </p>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>Depending on where you live, you can ask us to:</p>
        <ul>
          <li>
            <strong>access or export</strong> your data — you can download a full backup of your notes and files any time
            from Settings;
          </li>
          <li>
            <strong>correct</strong> it — you can edit your profile and notebook yourself;
          </li>
          <li>
            <strong>delete</strong> it — delete anything in your notebook yourself, or your whole account from{' '}
            <em>Settings → Delete account</em>;
          </li>
          <li>
            <strong>restrict or object</strong> to some uses, or withdraw consent you gave.
          </li>
        </ul>
        <p>
          Email <Mail /> and we’ll reply within 30 days. You can also complain to the data protection authority where you
          live.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        {BRAND.name} is for students aged {LEGAL.minimumAge} and over. We don’t knowingly collect data from younger children;
        if you think a child has an account, email us and we’ll delete it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change how we handle your data, we’ll update this page and the date at the top, and tell you by email or in the
        app before important changes take effect.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={
        <p>
          Your notebook is yours. This policy explains, in plain language, what {BRAND.name} collects, why, who helps us run
          it, and the choices you have.
        </p>
      }
      sections={PRIVACY}
    />
  );
}

// ---------------------------------------------------------------- Terms of Service

const TERMS: Section[] = [
  {
    id: 'agreement',
    title: 'Agreement',
    body: (
      <p>
        These terms are an agreement between you and {LEGAL.operator} (“we”, “us”), who runs {BRAND.name}. By creating an
        account or using {BRAND.name}, you agree to them and to our <Link to="/privacy">Privacy Policy</Link>. If you don’t
        agree, please don’t use the service.
      </p>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>You must be at least {LEGAL.minimumAge} years old.</li>
        <li>Give a real email address you can access, and keep your password private.</li>
        <li>You’re responsible for what happens in your account. Tell us straight away if you think someone else got in.</li>
      </ul>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <>
        <p>
          You own everything you put in {BRAND.name}: your notes, photos, documents and questions. You give us only the
          permission we need to store, process and display it to provide the service to you — and to the people you choose
          to share it with. That permission ends when you delete the content or your account, except for copies that take a
          short time to clear from backups.
        </p>
        <p>
          You’re responsible for having the right to upload what you add. Lecture slides and handouts usually belong to your
          lecturer or university: keep them for your own study, and only share them where you’re allowed to.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'Acceptable use',
    body: (
      <>
        <p>Please don’t use {BRAND.name} to:</p>
        <ul>
          <li>break the law, or upload content that infringes someone else’s rights;</li>
          <li>share anything harmful, hateful, harassing or sexually explicit;</li>
          <li>try to access other people’s accounts or data, or get around limits and security;</li>
          <li>overload, scrape, reverse-engineer or resell the service, or abuse the study assistant;</li>
          <li>break your university’s rules on academic integrity.</li>
        </ul>
        <p>We may remove content or suspend accounts that break these rules.</p>
      </>
    ),
  },
  {
    id: 'ai',
    title: 'The study assistant',
    body: (
      <p>
        The study assistant uses AI to summarise your notes and suggest practice questions. It can make mistakes or leave
        things out, so check its output against your lecture materials. It’s a study aid: you’re responsible for how you use
        it, including following your university’s rules on using AI in assessed work. Pro includes a fair-use daily limit,
        shown in the app.
      </p>
    ),
  },
  {
    id: 'pro',
    title: 'Pro subscriptions and payments',
    body: (
      <>
        <p>
          {BRAND.name} is free to use. {BRAND.name} Pro costs {PRICING.monthly.amount} per {PRICING.monthly.per} or{' '}
          {PRICING.yearly.amount} per {PRICING.yearly.per}, plus any taxes that apply where you live; prices may be shown in
          your local currency.
        </p>
        <p>
          Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the merchant of
          record for all our orders, and provides all customer service inquiries and handles returns. Paddle’s{' '}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
            buyer terms
          </a>{' '}
          apply to your purchase.
        </p>
        <ul>
          <li>Subscriptions renew automatically at the end of each month or year until you cancel.</li>
          <li>
            You can cancel any time from <em>Settings → Plan → Manage billing</em>. Pro stays on until the end of the period
            you’ve paid for.
          </li>
          <li>
            <strong>Refunds:</strong> if you’re not happy, ask within 14 days of your first payment and we’ll arrange a full
            refund through Paddle. After that, payments are non-refundable except where the law requires otherwise.
          </li>
          <li>If we change the price, we’ll tell you at least 30 days before your next renewal at the new price.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'service',
    title: 'The service',
    body: (
      <p>
        We work to keep {BRAND.name} available and your notes safe, but we can’t promise it will always be uninterrupted or
        error-free. Keep a backup of anything important — you can download one from Settings any time. We may change,
        add or remove features; if we ever close the service, we’ll give you reasonable notice and time to export your data.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your account',
    body: (
      <p>
        You can stop using {BRAND.name} at any time, and delete your account with everything in it from{' '}
        <em>Settings → Delete account</em> (or by emailing <Mail />). We may suspend
        or close accounts that seriously or repeatedly break these terms, and will tell you why unless the law prevents us.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <>
        <p>
          {BRAND.name} is provided “as is”. To the extent the law allows, we aren’t liable for indirect or consequential
          losses, lost data, or results in your studies or exams, and our total liability to you is limited to the amount you
          paid us in the 12 months before the claim.
        </p>
        <p>Nothing in these terms limits rights you have under consumer protection law that can’t be excluded.</p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Law and disputes',
    body: (
      <p>
        These terms are governed by {LEGAL.governingLaw}, and disputes go to {LEGAL.courts}. If you’re a consumer, you also
        keep the protection of the mandatory laws of the country where you live, and may be able to bring a claim there.
        Before going to court, please email us — most problems can be sorted out quickly.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms as {BRAND.name} grows. We’ll update the date at the top, and tell you by email or in the app
        before important changes take effect. If you keep using {BRAND.name} after that, the new terms apply.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these terms? Email <Mail />.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={
        <p>
          The rules for using {BRAND.name}, written to be read. The short version: your notes are yours, use the service
          fairly, and Pro can be cancelled any time.
        </p>
      }
      sections={TERMS}
    />
  );
}
