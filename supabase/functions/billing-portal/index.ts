// Opens Paddle's customer portal (change plan, update card, cancel, invoices) for the signed-in user.
// Paddle's API blocks browsers, so the short-lived portal link is created here:
//   supabase secrets set PADDLE_API_KEY=pdl_live_apikey_...   (pdl_sdbx_apikey_... for sandbox)
//   supabase functions deploy billing-portal
// Optional: PADDLE_ENV=sandbox, or PADDLE_API_BASE to override the API address.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());
const API_BASE =
  Deno.env.get('PADDLE_API_BASE') ??
  (Deno.env.get('PADDLE_ENV') === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com');

const cors = (req: Request): Record<string, string> => {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' });

  const apiKey = Deno.env.get('PADDLE_API_KEY');
  if (!apiKey) return json(req, 503, { error: 'Billing isn’t set up yet (missing PADDLE_API_KEY).' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json(req, 401, { error: 'Please sign in again.' });

  // Read with the user's own login: row level security returns only their row.
  const { data: sub } = await db
    .from('subscriptions')
    .select('paddle_customer_id, paddle_subscription_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!sub?.paddle_customer_id) return json(req, 404, { error: 'There’s no paid subscription on this account.' });

  try {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(sub.paddle_customer_id)}/portal-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.paddle_subscription_id ? { subscription_ids: [sub.paddle_subscription_id] } : {}),
    });
    const body = await res.json().catch(() => null);
    const url = body?.data?.urls?.general?.overview;
    if (!res.ok || typeof url !== 'string') {
      console.error('portal session failed', res.status, body?.error ?? body);
      return json(req, 502, { error: 'Couldn’t open billing right now. Please try again.' });
    }
    return json(req, 200, { url });
  } catch (e) {
    console.error('portal session failed', e);
    return json(req, 502, { error: 'Couldn’t reach Paddle. Please try again.' });
  }
});
