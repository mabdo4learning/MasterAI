-- Turn the single-owner site into one private notebook per user.
-- Run once in Supabase → SQL Editor, BEFORE enabling sign-ups. Safe to run again.

-- 1. Every row belongs to a user.
alter table public.sessions add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.notes    add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.images   add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- 2. Existing rows go to the current (only) account.
do $$
declare
  owner_id uuid;
  user_count int;
begin
  if exists (select 1 from public.sessions where user_id is null)
     or exists (select 1 from public.notes where user_id is null)
     or exists (select 1 from public.images where user_id is null) then
    select count(*) into user_count from auth.users;
    if user_count <> 1 then
      raise exception 'Expected exactly 1 existing user to own the current notes, found %. Assign user_id manually.', user_count;
    end if;
    select id into owner_id from auth.users;
    update public.sessions set user_id = owner_id where user_id is null;
    update public.notes    set user_id = owner_id where user_id is null;
    update public.images   set user_id = owner_id where user_id is null;
  end if;
end $$;

alter table public.sessions alter column user_id set default auth.uid(), alter column user_id set not null;
alter table public.notes    alter column user_id set default auth.uid(), alter column user_id set not null;
alter table public.images   alter column user_id set default auth.uid(), alter column user_id set not null;

-- 3. Session numbers are unique per user, not globally.
alter table public.sessions drop constraint if exists sessions_subject_slug_number_key;
alter table public.sessions drop constraint if exists sessions_user_subject_number_key;
alter table public.sessions add constraint sessions_user_subject_number_key unique (user_id, subject_slug, number);

create index if not exists sessions_user_idx on public.sessions (user_id);
create index if not exists notes_user_idx    on public.notes (user_id);
create index if not exists images_user_idx   on public.images (user_id);

-- 4. Row level security: each user reads and writes only their own rows.
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

-- 5. Storage: new uploads go to "<user id>/..."; files uploaded before this change stay
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

drop function if exists public.is_owner();

-- 6. New accounts start with 8 sessions for each of the 10 subjects.
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
