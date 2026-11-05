-- Session checklist: the two ticks the user sets by hand ("notes written" and
-- "slides/files uploaded" are worked out from the session's notes, images and documents).
-- Run once in Supabase → SQL Editor BEFORE deploying the app version that uses it. Safe to run again.
-- The existing "own sessions" policy (for all) already lets users update their own sessions.

alter table public.sessions add column if not exists attended boolean not null default false;
alter table public.sessions add column if not exists reviewed boolean not null default false;
