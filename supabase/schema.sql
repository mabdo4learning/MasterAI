-- Lecture notes schema: one private notebook per user.
-- New project: run this once in Supabase → SQL Editor.
-- Existing project from before multi-user support: run migrations-002-private.sql and
-- migrations-003-multi-user.sql, migrations-004-documents.sql, migrations-005-note-edits.sql,
-- migrations-006-session-checklist.sql, migrations-007-questions.sql and migrations-008-sharing.sql instead.

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_slug text not null,
  number       int  not null,
  topic        text not null default '',
  lecture_date date,
  attended     boolean not null default false,
  reviewed     boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint sessions_user_subject_number_key unique (user_id, subject_slug, number)
);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
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

-- Documents (PDF, PowerPoint, Word, Excel, …) attached to sessions.
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

-- Notes can be edited; the database records when the text last changed.
create or replace function public.touch_note_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.body is distinct from old.body then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_note_updated_at();

-- Question bank: exam-style questions with answers, practised per subject.
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

-- ---------- Sharing between accounts (same as migrations-008-sharing.sql) ----------

create table if not exists public.shares (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('subject', 'session', 'items')),
  subject_slug text not null,
  session_id   uuid references public.sessions (id) on delete cascade,
  note_ids     uuid[] not null default '{}',
  image_ids    uuid[] not null default '{}',
  document_ids uuid[] not null default '{}',
  -- 64 random hex characters (two v4 UUIDs), so links can't be guessed.
  token        text not null unique
               default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  link_enabled boolean not null default true,
  owner_name   text not null default '',
  title        text not null default '',
  created_at   timestamptz not null default now(),
  constraint shares_session_matches_kind check ((kind = 'subject') = (session_id is null))
);

create index if not exists shares_owner_idx on public.shares (owner_id);
create index if not exists shares_session_idx on public.shares (session_id);
-- One whole-subject and one whole-session share each; the dialog reuses it instead of making duplicates.
create unique index if not exists shares_one_per_subject on public.shares (owner_id, subject_slug) where kind = 'subject';
create unique index if not exists shares_one_per_session on public.shares (session_id) where kind = 'session';

create table if not exists public.share_recipients (
  share_id uuid not null references public.shares (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  via      text not null default 'link' check (via in ('link', 'email')),
  added_at timestamptz not null default now(),
  primary key (share_id, user_id)
);

create index if not exists share_recipients_user_idx on public.share_recipients (user_id);

alter table public.shares enable row level security;
alter table public.share_recipients enable row level security;

drop policy if exists "own shares" on public.shares;
create policy "own shares" on public.shares for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (session_id is null or exists (
      select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid())
    ))
  );

-- Recipients are added only through join_share / share_with_email. The owner can see and remove
-- them; a recipient can see and remove (leave) their own row.
drop policy if exists "see share recipients" on public.share_recipients;
create policy "see share recipients" on public.share_recipients for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.shares s where s.id = share_id and s.owner_id = (select auth.uid()))
  );

drop policy if exists "remove share recipients" on public.share_recipients;
create policy "remove share recipients" on public.share_recipients for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.shares s where s.id = share_id and s.owner_id = (select auth.uid()))
  );

-- Opening a link adds the signed-in user as a recipient.
create or replace function public.join_share(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.shares;
begin
  if auth.uid() is null then
    raise exception 'Sign in to open shared notes' using errcode = '28000';
  end if;
  select * into s from public.shares where token = p_token and link_enabled;
  if not found then
    raise exception 'This link is not active any more. Ask for a new one.' using errcode = 'P0002';
  end if;
  if s.owner_id <> auth.uid() then
    insert into public.share_recipients (share_id, user_id, via)
    values (s.id, auth.uid(), 'link')
    on conflict do nothing;
  end if;
  return s.id;
end;
$$;

-- The owner adds another account by its email address.
create or replace function public.share_with_email(p_share uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not exists (select 1 from public.shares where id = p_share and owner_id = auth.uid()) then
    raise exception 'Share not found' using errcode = 'P0002';
  end if;
  select id into target from auth.users where lower(email) = lower(trim(p_email));
  if target is null then
    raise exception 'No account uses that email. Send them the link instead, they can sign up first.' using errcode = 'P0002';
  end if;
  if target = auth.uid() then
    raise exception 'That is your own email' using errcode = '22023';
  end if;
  insert into public.share_recipients (share_id, user_id, via)
  values (p_share, target, 'email')
  on conflict (share_id, user_id) do nothing;
end;
$$;

-- Who has access to one of the caller's shares.
create or replace function public.share_recipients_of(p_share uuid)
returns table (user_id uuid, email text, name text, via text, added_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, u.email::text, coalesce(u.raw_user_meta_data ->> 'full_name', ''), r.via, r.added_at
  from public.share_recipients r
  join public.shares s on s.id = r.share_id
  join auth.users u on u.id = r.user_id
  where r.share_id = p_share and s.owner_id = auth.uid()
  order by r.added_at;
$$;

-- Everything shared with the caller.
create or replace function public.shared_with_me()
returns table (id uuid, kind text, subject_slug text, title text, owner_name text, via text, added_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.kind, s.subject_slug, s.title, s.owner_name, r.via, r.added_at
  from public.share_recipients r
  join public.shares s on s.id = r.share_id
  where r.user_id = auth.uid()
  order by r.added_at desc;
$$;

-- The current content of a share, for its owner or a recipient. Always read live, so edits show up.
create or replace function public.shared_content(p_share uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
  content jsonb;
begin
  select * into s from public.shares where id = p_share;
  if not found or not (
    s.owner_id = auth.uid()
    or exists (select 1 from public.share_recipients r where r.share_id = s.id and r.user_id = auth.uid())
  ) then
    raise exception 'This share is not available any more' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', se.id,
    'number', se.number,
    'topic', se.topic,
    'lectureDate', se.lecture_date,
    'notes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'body', n.body, 'createdAt', n.created_at, 'updatedAt', n.updated_at
      ) order by n.created_at desc), '[]'::jsonb)
      from public.notes n
      where n.session_id = se.id and n.user_id = s.owner_id and (s.kind <> 'items' or n.id = any (s.note_ids))
    ),
    'images', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'path', i.path, 'fileName', i.file_name, 'createdAt', i.created_at
      ) order by i.created_at), '[]'::jsonb)
      from public.images i
      where i.session_id = se.id and i.user_id = s.owner_id and (s.kind <> 'items' or i.id = any (s.image_ids))
    ),
    'documents', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'path', d.path, 'fileName', d.file_name, 'mimeType', d.mime_type,
        'sizeBytes', d.size_bytes, 'createdAt', d.created_at
      ) order by d.created_at), '[]'::jsonb)
      from public.documents d
      where d.session_id = se.id and d.user_id = s.owner_id and (s.kind <> 'items' or d.id = any (s.document_ids))
    ),
    'questions', case when s.kind = 'items' then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'question', q.question, 'answer', q.answer
      ) order by q.created_at), '[]'::jsonb)
      from public.questions q
      where q.session_id = se.id and q.user_id = s.owner_id
    ) end
  ) order by se.number), '[]'::jsonb)
  into content
  from public.sessions se
  where se.user_id = s.owner_id
    and se.subject_slug = s.subject_slug
    and (s.kind = 'subject' or se.id = s.session_id);

  return jsonb_build_object(
    'id', s.id,
    'kind', s.kind,
    'subjectSlug', s.subject_slug,
    'title', s.title,
    'ownerName', s.owner_name,
    'isOwner', s.owner_id = auth.uid(),
    'createdAt', s.created_at,
    'sessions', content
  );
end;
$$;

-- Lets a recipient read (view, sign, download, copy) a file that is part of something shared with them.
create or replace function public.can_read_shared_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.share_recipients r
    join public.shares s on s.id = r.share_id
    join public.images i on i.path = p_path and i.user_id = s.owner_id
    join public.sessions se on se.id = i.session_id
    where r.user_id = (select auth.uid())
      and se.subject_slug = s.subject_slug
      and (s.kind = 'subject' or se.id = s.session_id)
      and (s.kind <> 'items' or i.id = any (s.image_ids))
  ) or exists (
    select 1
    from public.share_recipients r
    join public.shares s on s.id = r.share_id
    join public.documents d on d.path = p_path and d.user_id = s.owner_id
    join public.sessions se on se.id = d.session_id
    where r.user_id = (select auth.uid())
      and se.subject_slug = s.subject_slug
      and (s.kind = 'subject' or se.id = s.session_id)
      and (s.kind <> 'items' or d.id = any (s.document_ids))
  );
$$;

revoke execute on function public.join_share(text) from public, anon;
revoke execute on function public.share_with_email(uuid, text) from public, anon;
revoke execute on function public.share_recipients_of(uuid) from public, anon;
revoke execute on function public.shared_with_me() from public, anon;
revoke execute on function public.shared_content(uuid) from public, anon;
revoke execute on function public.can_read_shared_file(text) from public, anon;
grant execute on function public.join_share(text) to authenticated;
grant execute on function public.share_with_email(uuid, text) to authenticated;
grant execute on function public.share_recipients_of(uuid) to authenticated;
grant execute on function public.shared_with_me() to authenticated;
grant execute on function public.shared_content(uuid) to authenticated;
grant execute on function public.can_read_shared_file(text) to authenticated;

drop policy if exists "read shared files" on storage.objects;
create policy "read shared files" on storage.objects for select to authenticated
  using (bucket_id = 'lecture-images' and public.can_read_shared_file(name));
