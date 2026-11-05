-- Documents (PDF, PowerPoint, Word, Excel, …) attached to sessions.
-- Run once in Supabase → SQL Editor BEFORE deploying the app version that uses it. Safe to run again.
-- Files are stored in the existing private "lecture-images" bucket under "<user id>/…",
-- so the storage policies from migrations-003-multi-user.sql already cover them.

create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  path       text not null,
  file_name  text not null,
  mime_type  text not null default '',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_idx    on public.documents (user_id);
create index if not exists documents_session_idx on public.documents (session_id, created_at);

alter table public.documents enable row level security;

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
