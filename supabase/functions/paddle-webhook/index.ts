// Paddle Billing webhook: keeps public.subscriptions in step with Paddle. Deploy without JWT
// verification (Paddle can't send a Supabase login) — every request is checked against the
// Paddle-Signature header instead:
//   supabase functions deploy paddle-webhook --no-verify-jwt
//   supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
// In Paddle → Developer tools → Notifications, point a destination at
// https://<project-ref>.supabase.co/functions/v1/paddle-webhook with the subscription.* events.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

// Paddle's SDKs allow 5 seconds; a little more absorbs clock skew. Late replays of old events are
// harmless anyway: rows only move forward by occurred_at.
const TOLERANCE_SECONDS = 60;
const PRO = new Set(['active', 'trialing', 'past_due']);
const STATUSES = new Set(['active', 'trialing', 'past_due', 'paused', 'canceled']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two strings without leaking where they differ. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Paddle-Signature: ts=<unix seconds>;h1=<hex HMAC-SHA256 of "<ts>:<raw body>">. During secret
 * rotation there can be more than one h1; any match is accepted.
 */
async function verify(header: string, rawBody: string, secret: string): Promise<boolean> {
  let ts = '';
  const signatures: string[] = [];
  for (const part of header.split(';')) {
    const [k, v] = part.split('=', 2).map((s) => s?.trim() ?? '');
    if (k === 'ts') ts = v;
    else if (k === 'h1' && v) signatures.push(v);
  }
  const tsNum = Number(ts);
  if (!ts || !Number.isFinite(tsNum) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(secret, `${ts}:${rawBody}`);
  return signatures.some((s) => safeEqual(s, expected));
}

type PaddleSubscription = {
  id: string;
  status: string;
  customer_id: string;
  custom_data?: Record<string, unknown> | null;
  items?: { price?: { id?: string } }[];
  current_billing_period?: { starts_at: string; ends_at: string } | null;
  scheduled_change?: { action: string; effective_at: string } | null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!secret) {
    console.error('PADDLE_WEBHOOK_SECRET is not set');
    return new Response('Not configured', { status: 500 });
  }

  const raw = await req.text();
  if (!(await verify(req.headers.get('Paddle-Signature') ?? '', raw, secret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let event: { event_id?: string; event_type?: string; occurred_at?: string; data?: PaddleSubscription };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  // Only subscription events change access; acknowledge everything else.
  if (!event.event_type?.startsWith('subscription.') || !event.data?.id) return new Response('ok');
  const sub = event.data;
  if (!STATUSES.has(sub.status)) {
    console.warn('unknown subscription status', sub.status, event.event_id);
    return new Response('ok');
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // custom_data.user_id is set at checkout and copied onto the subscription by Paddle.
  let userId = typeof sub.custom_data?.user_id === 'string' && UUID.test(sub.custom_data.user_id) ? sub.custom_data.user_id : null;
  if (!userId) {
    const { data } = await admin.from('subscriptions').select('user_id').eq('paddle_subscription_id', sub.id).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) {
    console.warn('subscription without a MasterAI user', sub.id, event.event_id);
    return new Response('ok');
  }

  const occurredAt = event.occurred_at ?? new Date().toISOString();
  const { data: current, error: readError } = await admin
    .from('subscriptions')
    .select('paddle_subscription_id, status, last_event_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) {
    console.error('read failed', readError);
    return new Response('Retry', { status: 500 });
  }

  if (current) {
    const sameSubscription = current.paddle_subscription_id === sub.id;
    // An older event for this subscription arriving late.
    if (sameSubscription && current.last_event_at && new Date(current.last_event_at) > new Date(occurredAt)) {
      return new Response('ok');
    }
    // A different, older subscription ending shouldn't remove Pro from a newer one that's live.
    if (!sameSubscription && PRO.has(current.status) && !PRO.has(sub.status)) return new Response('ok');
  }

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      source: 'paddle',
      paddle_subscription_id: sub.id,
      paddle_customer_id: sub.customer_id,
      status: sub.status,
      price_id: sub.items?.[0]?.price?.id ?? null,
      current_period_end: sub.current_billing_period?.ends_at ?? null,
      cancel_at: sub.scheduled_change?.action === 'cancel' ? sub.scheduled_change.effective_at : null,
      last_event_at: occurredAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.error('upsert failed', error);
    // A 5xx makes Paddle retry the delivery.
    return new Response('Retry', { status: 500 });
  }
  return new Response('ok');
});
