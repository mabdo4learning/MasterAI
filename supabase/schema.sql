-- Lecture notes schema. Run once in Supabase → SQL Editor.
-- 1) Replace YOUR_EMAIL@example.com below with the email you will log in with.

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  subject_slug text not null,
  number       int  not null,
  topic        text not null default '',
  lecture_date date,
  created_at   timestamptz not null default now(),
  unique (subject_slug, number)
);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists notes_session_idx on public.notes (session_id, created_at desc);

create table if not exists public.images (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  path       text not null,
  file_name  text not null,
  created_at timestamptz not null default now()
);
create index if not exists images_session_idx on public.images (session_id, created_at);

-- Only this account may write. Change the email here.
create or replace function public.is_owner()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'YOUR_EMAIL@example.com'
$$;

-- Row level security: only the owner can read or write (the policies below are FOR ALL).
alter table public.sessions enable row level security;
alter table public.notes    enable row level security;
alter table public.images   enable row level security;

drop policy if exists "read sessions" on public.sessions;
drop policy if exists "owner writes sessions" on public.sessions;
drop policy if exists "read notes" on public.notes;
drop policy if exists "owner writes notes" on public.notes;
drop policy if exists "read images" on public.images;
drop policy if exists "owner writes images" on public.images;

create policy "owner writes sessions" on public.sessions for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "owner writes notes" on public.notes for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "owner writes images" on public.images for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Private image bucket: the app shows images through signed URLs.
insert into storage.buckets (id, name, public)
values ('lecture-images', 'lecture-images', false)
on conflict (id) do update set public = false;

drop policy if exists "owner reads lecture images" on storage.objects;
drop policy if exists "owner uploads lecture images" on storage.objects;
drop policy if exists "owner deletes lecture images" on storage.objects;

create policy "owner reads lecture images" on storage.objects for select to authenticated
  using (bucket_id = 'lecture-images' and public.is_owner());
create policy "owner uploads lecture images" on storage.objects for insert to authenticated
  with check (bucket_id = 'lecture-images' and public.is_owner());
create policy "owner deletes lecture images" on storage.objects for delete to authenticated
  using (bucket_id = 'lecture-images' and public.is_owner());

-- Seed 8 sessions for each of the 10 subjects.
insert into public.sessions (subject_slug, number)
select s.slug, n
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
on conflict (subject_slug, number) do nothing;
