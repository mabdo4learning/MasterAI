-- Sharing between accounts: share a subject, a session, or chosen notes and files from a session,
-- with a link and/or straight to another account's email. Recipients get a live, read-only view
-- and can copy it into their own notebook.
--
-- Shared content is only ever read through the security-definer functions below, never by widening
-- the policies on sessions/notes/images/documents/questions, so the owner's own pages keep seeing
-- only their own rows. Run once in the Supabase SQL editor.

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
