    -- Study assistant (AI): one row per request to the study-assistant Edge Function, used for the
    -- per-user daily limit and to see token spend. Only the Edge Function writes here (with the
    -- service role), so users can't delete rows to reset their limit; they can read their own.
    -- Run once in the Supabase SQL editor (after migrations-010-custom-subjects.sql), before deploying.

    create table if not exists public.ai_usage (
      id            bigint generated always as identity primary key,
      user_id       uuid not null references auth.users (id) on delete cascade,
      action        text not null check (action in ('summary', 'questions')),
      session_id    uuid references public.sessions (id) on delete set null,
      model         text not null default '',
      input_tokens  int  not null default 0,
      output_tokens int  not null default 0,
      ok            boolean not null default true,
      created_at    timestamptz not null default now()
    );

    create index if not exists ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

    alter table public.ai_usage enable row level security;

    drop policy if exists "read own ai usage" on public.ai_usage;
    create policy "read own ai usage" on public.ai_usage for select to authenticated
      using (user_id = (select auth.uid()));
    -- No insert/update/delete policies: only the service role (the Edge Function) writes.
