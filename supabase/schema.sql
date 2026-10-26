-- Lecture notes schema: one private notebook per user.
-- New project: run this once in Supabase → SQL Editor.
-- Existing project from before multi-user support: run migrations-002-private.sql and
-- migrations-003-multi-user.sql instead.

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_slug text not null,
  number       int  not null,
  topic        text not null default '',
  lecture_date date,
  created_at   timestamptz not null default now(),
  constraint sessions_user_subject_number_key unique (user_id, subject_slug, number)
);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.images (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  path       text not null,
  file_name  text not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx    on public.sessions (user_id);
create index if not exists notes_user_idx       on public.notes (user_id);
create index if not exists notes_session_idx    on public.notes (session_id, created_at desc);
create index if not exists images_user_idx      on public.images (user_id);
create index if not exists images_session_idx   on public.images (session_id, created_at);

alter table public.sessions enable row level security;
alter table public.notes    enable row level security;
alter table public.images   enable row level security;

-- Row level security: each user reads and writes only their own rows.
drop policy if exists "owner writes sessions" on public.sessions;
drop policy if exists "owner writes notes"    on public.notes;
drop policy if exists "owner writes images"   on public.images;
drop policy if exists "own sessions" on public.sessions;
drop policy if exists "own notes"    on public.notes;
drop policy if exists "own images"   on public.images;

create policy "own sessions" on public.sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own notes" on public.notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

create policy "own images" on public.images for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

-- Private image bucket: the app shows images through signed URLs.
insert into storage.buckets (id, name, public)
values ('lecture-images', 'lecture-images', false)
on conflict (id) do update set public = false;

-- Storage: new uploads go to "<user id>/..."; files uploaded before this change stay
--    readable/deletable by whoever owns the matching images row.
drop policy if exists "owner reads lecture images"   on storage.objects;
drop policy if exists "owner uploads lecture images" on storage.objects;
drop policy if exists "owner deletes lecture images" on storage.objects;
drop policy if exists "users read own lecture images"   on storage.objects;
drop policy if exists "users upload own lecture images" on storage.objects;
drop policy if exists "users delete own lecture images" on storage.objects;

create policy "users read own lecture images" on storage.objects for select to authenticated
  using (
    bucket_id = 'lecture-images' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.images i where i.path = name and i.user_id = (select auth.uid()))
    )
  );
create policy "users upload own lecture images" on storage.objects for insert to authenticated
  with check (bucket_id = 'lecture-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete own lecture images" on storage.objects for delete to authenticated
  using (
    bucket_id = 'lecture-images' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.images i where i.path = name and i.user_id = (select auth.uid()))
    )
  );

-- New accounts start with 8 sessions for each of the 10 subjects.
create or replace function public.create_default_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sessions (user_id, subject_slug, number)
  select new.id, s.slug, n
  from unnest(array[
    'strategic-human-resource-management',
    'organizational-behavior',
    'personal-development-for-leadership-and-strategic-management',
    'finance-for-strategic-managers',
    'strategic-marketing',
    'strategic-planning',
    'international-business-environment',
    'research-for-strategic-development',
    'the-foundations-of-artificial-intelligence',
    'sustainable-artificial-intelligence-and-ethics'
  ]) as s(slug)
  cross join generate_series(1, 8) as n
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sessions on auth.users;
create trigger on_auth_user_created_sessions
  after insert on auth.users
  for each row execute function public.create_default_sessions();
