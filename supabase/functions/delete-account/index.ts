// Permanently deletes the signed-in user's account: cancels a live Paddle subscription, removes
// their files from storage, then deletes the auth user — every table references auth.users with
// `on delete cascade`, so their subjects, sessions, notes, questions, shares, usage and plan go too.
//   supabase functions deploy delete-account
// Needs PADDLE_API_KEY with the subscription.write permission when Pro is in use.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const BUCKET = 'lecture-images';
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());
const PADDLE_API =
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

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const db = createClient(url, anonKey, { ...opts, global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user?.email) return json(req, 401, { error: 'Please sign in again.' });

  let password = '';
  try {
    password = String((await req.json())?.password ?? '');
  } catch {
    // handled below
  }
  if (!password) return json(req, 400, { error: 'Enter your password to confirm.' });

  // A stolen session alone can't delete an account: the password is checked again here.
  const check = createClient(url, anonKey, opts);
  const { error: wrong } = await check.auth.signInWithPassword({ email: user.email, password });
  if (wrong) return json(req, 403, { error: 'That password isn’t right.' });
  await check.auth.signOut().catch(() => {});

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, opts);

  // 1. Stop billing first. If this fails, nothing is deleted.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('source, status, paddle_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (sub?.source === 'paddle' && sub.paddle_subscription_id && sub.status !== 'canceled') {
    const apiKey = Deno.env.get('PADDLE_API_KEY');
    if (!apiKey) {
      return json(req, 503, { error: 'Your subscription couldn’t be cancelled automatically. Cancel it in Settings → Plan first, then try again.' });
    }
    const endpoint = `${PADDLE_API}/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}`;
    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    const res = await fetch(`${endpoint}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ effective_from: 'immediately' }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    // If the cancel was refused, it may already be cancelled at Paddle (e.g. a missed webhook).
    let canceled = res?.ok === true || body?.data?.status === 'canceled';
    if (!canceled) {
      const current = await fetch(endpoint, { headers }).then((r) => r.json()).catch(() => null);
      canceled = current?.data?.status === 'canceled';
    }
    if (!canceled) {
      console.error('paddle cancel failed', res?.status, body?.error ?? body);
      return json(req, 502, {
        error: 'Your subscription couldn’t be cancelled automatically. Cancel it in Settings → Plan first, then try again.',
      });
    }
  }

  // 2. Files in storage (rows only point at them, so they're removed by path).
  const paths: string[] = [];
  for (const table of ['images', 'documents', 'subject_files'] as const) {
    const { data, error } = await admin.from(table).select('path').eq('user_id', user.id);
    if (error) {
      console.error(`list ${table} failed`, error);
      return json(req, 500, { error: 'Couldn’t delete your account right now. Nothing was removed — please try again.' });
    }
    paths.push(...(data ?? []).map((r: { path: string }) => r.path));
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.error('storage remove failed', error);
  }

  // 3. The account. Every table cascades from auth.users.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('deleteUser failed', deleteError);
    return json(req, 500, { error: 'Your files were removed but the account couldn’t be deleted. Please try again or email us.' });
  }
  return json(req, 200, { deleted: true, files: paths.length });
});
