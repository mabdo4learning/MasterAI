-- Editable notes: remember when a note's text was last changed, to show "edited".
-- Run once in Supabase → SQL Editor BEFORE deploying the app version that uses it. Safe to run again.
-- The existing "own notes" policy (for all) already lets users update their own notes.

alter table public.notes add column if not exists updated_at timestamptz;

-- Set by the database, so the time is right even if a device clock is off.
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
