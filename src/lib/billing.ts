import { useEffect, useSyncExternalStore } from 'react';
import type { Paddle } from '@paddle/paddle-js';
import { supabase } from './supabase';

/**
 * Lecturefolio Pro, sold through Paddle Billing. The browser opens Paddle's checkout overlay; Paddle
 * tells the paddle-webhook Edge Function, which writes public.subscriptions; the app reads that row.
 * Set these in .env (see .env.example): the client-side token and the two price ids from Paddle.
 */
const env = import.meta.env;
const TOKEN = env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const ENVIRONMENT = (env.VITE_PADDLE_ENV as string | undefined) === 'sandbox' ? 'sandbox' : 'production';
const PRICE_IDS = {
  monthly: env.VITE_PADDLE_PRICE_MONTHLY as string | undefined,
  yearly: env.VITE_PADDLE_PRICE_YEARLY as string | undefined,
};

export type Plan = 'monthly' | 'yearly';

/** Shown in the app. The amount actually charged is set on the prices in Paddle — keep them in step. */
export const PRICING = {
  monthly: { amount: '$5', per: 'month', note: 'Billed monthly' },
  yearly: { amount: '$40', per: 'year', note: 'Billed yearly — save a third' },
} as const;

export const billingConfigured = !!(TOKEN && PRICE_IDS.monthly && PRICE_IDS.yearly);

export type Subscription = {
  source: 'paddle' | 'comp';
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled';
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
};

type State = { userId: string | null; loading: boolean; subscription: Subscription | null };
let state: State = { userId: null, loading: false, subscription: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);
export const isProStatus = (s: Subscription | null) => !!s && PRO_STATUSES.has(s.status);
export const planOf = (s: Subscription | null): Plan | null =>
  !s?.priceId ? null : s.priceId === PRICE_IDS.yearly ? 'yearly' : s.priceId === PRICE_IDS.monthly ? 'monthly' : null;

async function fetchSubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('source, status, price_id, current_period_end, cancel_at')
    .maybeSingle();
  // Before migrations-012 runs there's no table: everyone is on the free plan.
  if (error || !data) return null;
  return {
    source: data.source,
    status: data.status,
    priceId: data.price_id,
    currentPeriodEnd: data.current_period_end,
    cancelAt: data.cancel_at,
  };
}

export async function refreshSubscription(userId: string) {
  if (state.userId !== userId) set({ userId, subscription: null });
  set({ loading: true });
  const subscription = await fetchSubscription();
  set({ subscription, loading: false });
  return subscription;
}

/** The signed-in user's plan. Loads it the first time it's asked for. */
export function useSubscription(userId: string | undefined) {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (userId && state.userId !== userId) void refreshSubscription(userId);
  }, [userId]);
  const current = snap.userId === userId ? snap.subscription : null;
  return {
    subscription: current,
    isPro: isProStatus(current),
    loading: !userId || snap.userId !== userId || snap.loading,
  };
}

let paddle: Promise<Paddle | undefined> | null = null;
let onCompleted: (() => void) | null = null;

function getPaddle() {
  if (!TOKEN) return Promise.resolve(undefined);
  // Paddle.js is only downloaded when someone opens the checkout.
  paddle ??= import('@paddle/paddle-js').then(({ initializePaddle }) =>
    initializePaddle({
      environment: ENVIRONMENT,
      token: TOKEN,
      eventCallback: (event) => {
        if (event.name === 'checkout.completed') onCompleted?.();
      },
    }),
  );
  return paddle;
}

/** Opens Paddle's checkout overlay. Resolves once the subscription shows up (or after ~40s). */
export async function openCheckout(plan: Plan, user: { id: string; email?: string }, onPro?: () => void) {
  const priceId = PRICE_IDS[plan];
  const instance = await getPaddle();
  if (!instance || !priceId) throw new Error('Payments aren’t set up yet.');

  onCompleted = () => {
    onCompleted = null;
    // The webhook usually lands within a few seconds; check until it does.
    let tries = 0;
    const tick = async () => {
      const sub = await refreshSubscription(user.id);
      if (isProStatus(sub)) onPro?.();
      else if (++tries < 20) window.setTimeout(tick, 2000);
    };
    void tick();
  };

  const dark = document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  instance.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(user.email ? { customer: { email: user.email } } : {}),
    // Copied by Paddle onto the subscription, so the webhook knows whose it is.
    customData: { user_id: user.id },
    settings: { displayMode: 'overlay', theme: dark ? 'dark' : 'light', allowLogout: false },
  });
}

/** Opens Paddle's customer portal: change plan, update the card, cancel, download invoices. */
export async function openBillingPortal() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const res = await fetch(`${env.VITE_SUPABASE_URL as string}/functions/v1/billing-portal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: env.VITE_SUPABASE_KEY as string, 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => {
    throw new Error('Couldn’t reach billing. Check your connection and try again.');
  });
  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? (res.status === 404 ? 'Billing isn’t deployed yet (see README).' : 'Couldn’t open billing.'));
  }
  // Paddle asks for the portal not to be embedded, so it opens as its own page.
  window.location.assign(body.url);
}
