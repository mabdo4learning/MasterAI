-- Subject-level details and attachments: course info (lecturer, schedule, assessment…), an
-- overview text and files for the whole subject, separate from its sessions. A shared subject
-- includes them. Run once in the Supabase SQL editor (after migrations-008-sharing.sql).

create table if not exists public.subject_details (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_slug   text not null,
  lecturer       text not null default '',
  lecturer_email text not null default '',
  schedule       text not null default '',
  room           text not null default '',
  office_hours   text not null default '',
  credits        text not null default '',
  assessment     text not null default '',
  overview       text not null default '',
  updated_at     timestamptz not null default now(),
  primary key (user_id, subject_slug)
);

create table if not exists public.subject_files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_slug text not null,
  kind         text not null check (kind in ('image', 'document')),
  path         text not null,
  file_name    text not null,
  mime_type    text not null default '',
  size_bytes   bigint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists subject_files_owner_idx on public.subject_files (user_id, subject_slug, created_at);

alter table public.subject_details enable row level security;
alter table public.subject_files enable row level security;

drop policy if exists "own subject details" on public.subject_details;
create policy "own subject details" on public.subject_details for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own subject files" on public.subject_files;
create policy "own subject files" on public.subject_files for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.touch_subject_details()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subject_details_touch on public.subject_details;
create trigger subject_details_touch
  before update on public.subject_details
  for each row execute function public.touch_subject_details();

-- The current content of a share, for its owner or a recipient. Always read live, so edits show up.
-- Whole-subject shares now also carry the subject details and files.
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
    'details', case when s.kind = 'subject' then (
      select to_jsonb(d) - 'user_id' - 'subject_slug'
      from public.subject_details d
      where d.user_id = s.owner_id and d.subject_slug = s.subject_slug
    ) end,
    'files', case when s.kind = 'subject' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id, 'kind', f.kind, 'path', f.path, 'fileName', f.file_name, 'mimeType', f.mime_type,
        'sizeBytes', f.size_bytes, 'createdAt', f.created_at
      ) order by f.created_at), '[]'::jsonb)
      from public.subject_files f
      where f.user_id = s.owner_id and f.subject_slug = s.subject_slug
    ) else '[]'::jsonb end,
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
  ) or exists (
    select 1
    from public.share_recipients r
    join public.shares s on s.id = r.share_id
    join public.subject_files f on f.path = p_path and f.user_id = s.owner_id and f.subject_slug = s.subject_slug
    where r.user_id = (select auth.uid()) and s.kind = 'subject'
  );
$$;
