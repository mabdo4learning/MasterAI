-- Question bank: exam-style questions with answers, written per session and practised per subject.
-- Run once in Supabase → SQL Editor BEFORE deploying the app version that uses it. Safe to run again.

create table if not exists public.questions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id   uuid not null references public.sessions (id) on delete cascade,
  question     text not null,
  answer       text not null default '',
  last_result  text check (last_result in ('right', 'wrong')),
  practiced_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists questions_user_idx    on public.questions (user_id);
create index if not exists questions_session_idx on public.questions (session_id, created_at);

alter table public.questions enable row level security;

drop policy if exists "own questions" on public.questions;
create policy "own questions" on public.questions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
