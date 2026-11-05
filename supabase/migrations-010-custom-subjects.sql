    -- Subjects you set up yourself: each account keeps its own list of subjects (title, colour,
    -- order) instead of the fixed list that used to live in src/subjects.ts. New accounts start empty
    -- and pick their subjects in the onboarding wizard. Run once in the Supabase SQL editor
    -- (after migrations-009-subject-details.sql), before deploying.

    create table if not exists public.subjects (
      user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
      slug       text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
      title      text not null check (length(trim(title)) between 1 and 200),
      color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
      position   int  not null default 0,
      created_at timestamptz not null default now(),
      primary key (user_id, slug)
    );

    alter table public.subjects enable row level security;

    drop policy if exists "own subjects" on public.subjects;
    create policy "own subjects" on public.subjects for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));

    -- Existing accounts keep the ten subjects they were given, in the same order and colours.
    insert into public.subjects (user_id, slug, title, color, position)
    select distinct se.user_id, l.slug, l.title, l.color, l.position
    from public.sessions se
    join (values
      ('strategic-human-resource-management', 'Strategic Human Resource Management', '#2E4F7F', 1),
      ('organizational-behavior', 'Organizational Behavior', '#6A4577', 2),
      ('personal-development-for-leadership-and-strategic-management', 'Personal Development for Leadership and Strategic Management', '#1F6E68', 3),
      ('finance-for-strategic-managers', 'Finance for Strategic Managers', '#2D6A45', 4),
      ('strategic-marketing', 'Strategic Marketing', '#A4533A', 5),
      ('strategic-planning', 'Strategic Planning', '#A07A2E', 6),
      ('international-business-environment', 'International Business Environment', '#2A6478', 7),
      ('research-for-strategic-development', 'Research for Strategic Development', '#454E86', 8),
      ('the-foundations-of-artificial-intelligence', 'The Foundations of Artificial Intelligence', '#8E3452', 9),
      ('sustainable-artificial-intelligence-and-ethics', 'Sustainable Artificial Intelligence and Ethics', '#4F6B3D', 10)
    ) as l(slug, title, color, position) on l.slug = se.subject_slug
    on conflict do nothing;

    -- New accounts no longer get the fixed sessions: onboarding creates their subjects and sessions.
    drop trigger if exists on_auth_user_created_sessions on auth.users;
    drop function if exists public.create_default_sessions();

    -- Removes a subject with everything in it and returns the storage paths of its files, so the
    -- app can delete them from the bucket. Runs as the caller: row level security still applies.
    create or replace function public.delete_subject(p_slug text)
    returns text[]
    language plpgsql
    set search_path = ''
    as $$
    declare
      paths text[];
    begin
      select coalesce(array_agg(p), '{}') into paths from (
        select i.path as p from public.images i
          join public.sessions se on se.id = i.session_id
          where se.user_id = auth.uid() and se.subject_slug = p_slug
        union all
        select d.path from public.documents d
          join public.sessions se on se.id = d.session_id
          where se.user_id = auth.uid() and se.subject_slug = p_slug
        union all
        select f.path from public.subject_files f
          where f.user_id = auth.uid() and f.subject_slug = p_slug
      ) x;

      delete from public.shares where owner_id = auth.uid() and subject_slug = p_slug;
      -- Notes, images, documents and questions go with their sessions (on delete cascade).
      delete from public.sessions where user_id = auth.uid() and subject_slug = p_slug;
      delete from public.subject_files where user_id = auth.uid() and subject_slug = p_slug;
      delete from public.subject_details where user_id = auth.uid() and subject_slug = p_slug;
      delete from public.subjects where user_id = auth.uid() and slug = p_slug;
      return paths;
    end;
    $$;

    -- Recipients don't have the owner's subjects, so shares carry the subject's title and colour.
    drop function if exists public.shared_with_me();
    create function public.shared_with_me()
    returns table (
      id uuid, kind text, subject_slug text, title text, owner_name text, via text, added_at timestamptz,
      subject_title text, subject_color text
    )
    language sql
    stable
    security definer
    set search_path = ''
    as $$
      select s.id, s.kind, s.subject_slug, s.title, s.owner_name, r.via, r.added_at, sub.title, sub.color
      from public.share_recipients r
      join public.shares s on s.id = r.share_id
      left join public.subjects sub on sub.user_id = s.owner_id and sub.slug = s.subject_slug
      where r.user_id = auth.uid()
      order by r.added_at desc;
    $$;

    create or replace function public.shared_subject(p_share uuid)
    returns jsonb
    language sql
    stable
    security definer
    set search_path = ''
    as $$
      select jsonb_build_object('title', sub.title, 'color', sub.color)
      from public.shares s
      join public.subjects sub on sub.user_id = s.owner_id and sub.slug = s.subject_slug
      where s.id = p_share and (
        s.owner_id = auth.uid()
        or exists (select 1 from public.share_recipients r where r.share_id = s.id and r.user_id = auth.uid())
      );
    $$;
