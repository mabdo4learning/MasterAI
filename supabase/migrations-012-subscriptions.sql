-- Lecturefolio Pro (Paddle Billing): one row per user with their current subscription. Written only by
-- the paddle-webhook Edge Function (service role); users can read their own row. The study
-- assistant checks public.is_pro() before running. Run once in the Supabase SQL editor
-- (after migrations-011-ai-usage.sql), before deploying.

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  -- 'paddle' for paid subscriptions; 'comp' for complimentary Pro you grant by hand (see README).
  source                 text not null default 'paddle' check (source in ('paddle', 'comp')),
  paddle_subscription_id text unique,
  paddle_customer_id     text,
  status                 text not null check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled')),
  price_id               text,
  current_period_end     timestamptz,
  -- Set when the subscription is scheduled to cancel at the end of the period.
  cancel_at              timestamptz,
  -- occurred_at of the Paddle event this row reflects, so older events arriving late are ignored.
  last_event_at          timestamptz,
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on public.subscriptions (paddle_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert/update/delete policies: only the service role (the webhook) writes.

-- Pro while the subscription is active, trialing or in Paddle's payment-retry window (past_due).
-- A canceled or paused subscription is not Pro.
create or replace function public.is_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user and s.status in ('active', 'trialing', 'past_due')
  );
$$;

revoke all on function public.is_pro(uuid) from public, anon, authenticated;
grant execute on function public.is_pro(uuid) to service_role;
