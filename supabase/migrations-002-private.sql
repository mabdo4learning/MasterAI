-- Make the lecture notes private: only the owner (see public.is_owner()) can read anything.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- The "owner writes ..." policies are FOR ALL, so they already let the owner read.
-- Dropping the public read policies is all that's needed for the tables.
drop policy if exists "read sessions" on public.sessions;
drop policy if exists "read notes"    on public.notes;
drop policy if exists "read images"   on public.images;

-- Private bucket: images are only reachable through signed URLs created by the owner.
update storage.buckets set public = false where id = 'lecture-images';
