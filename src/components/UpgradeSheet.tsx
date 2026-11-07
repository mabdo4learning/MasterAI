import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { PRICING, billingConfigured, openCheckout, type Plan } from '../lib/billing';
import { BRAND } from '../brand';
import Icon from './Icon';
import Sheet from './Sheet';
import { useToast } from './Toast';

const PRO_FEATURES = [
  'Study assistant: revision summaries from your notes',
  'Practice questions with model answers, straight into your question bank',
  'Up to 40 assistant requests a day',
  'Everything in the free plan, unlimited',
];

/** Choose monthly or yearly, then continue to Paddle's checkout. */
export default function UpgradeSheet({ onClose, reason }: { onClose: () => void; reason?: string }) {
  const { session } = useAuth();
  const toast = useToast();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [opening, setOpening] = useState(false);

  const checkout = async () => {
    if (!session) return;
    setOpening(true);
    try {
      await openCheckout(plan, { id: session.user.id, email: session.user.email }, () => toast(`Welcome to ${BRAND.name} Pro`));
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Sheet title={`${BRAND.name} Pro`} onClose={onClose}>
      <div className="upgrade">
        <div className="upgrade-hero">
          <span className="upgrade-mark">
            <Icon name="sparkle" size={22} />
          </span>
          <p>{reason ?? 'Turn your notes into revision, in seconds.'}</p>
        </div>

        <div className="plan-toggle" role="radiogroup" aria-label="Billing period">
          {(['monthly', 'yearly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={plan === p}
              className={plan === p ? 'selected' : ''}
              onClick={() => setPlan(p)}
            >
              <span className="plan-name">{p === 'monthly' ? 'Monthly' : 'Yearly'}</span>
              <span className="plan-price">
                <strong>{PRICING[p].amount}</strong> / {PRICING[p].per}
              </span>
              <span className="plan-note">{PRICING[p].note}</span>
              {p === 'yearly' && <span className="plan-badge">Best value</span>}
            </button>
          ))}
        </div>

        <ul className="lp-ticks upgrade-features">
          {PRO_FEATURES.map((f) => (
            <li key={f}>
              <Icon name="check" size={16} /> {f}
            </li>
          ))}
        </ul>

        {billingConfigured ? (
          <>
            <button className="btn btn-lg upgrade-cta" onClick={checkout} disabled={opening || !session}>
              {opening ? 'Opening checkout…' : `Continue — ${PRICING[plan].amount} / ${PRICING[plan].per}`}
              {!opening && <Icon name="arrowRight" size={16} />}
            </button>
            <p className="muted small center">
              Secure checkout by Paddle, our reseller. Prices may show in your currency, with tax included where it
              applies. Cancel any time from Settings. By continuing you agree to the <Link to="/terms#pro">Terms</Link> (including
              the 14-day refund policy) and the <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </>
        ) : (
          <p className="muted small center">Pro is coming soon. Your free account will be able to upgrade as soon as it’s ready.</p>
        )}
      </div>
    </Sheet>
  );
}
