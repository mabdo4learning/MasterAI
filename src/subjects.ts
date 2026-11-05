import { useSyncExternalStore } from 'react';
import { BUCKET, supabase } from './lib/supabase';

/**
 * Each account keeps its own subjects in the `subjects` table. They are loaded once after
 * sign-in (see RequireAuth) and kept in this small store, so any page can look a subject
 * up by slug with findSubject(); components that list subjects use useSubjects() to re-render
 * when the list changes.
 */
export type Subject = {
  /** "01", "02"… from the subject's place in the list. */
  number: string;
  slug: string;
  title: string;
  color: string;
};

/** Jewel tones that sit well on the ivory and charcoal themes, offered when picking a colour. */
export const PALETTE = [
  '#2E4F7F', '#6A4577', '#1F6E68', '#2D6A45', '#A4533A',
  '#A07A2E', '#2A6478', '#454E86', '#8E3452', '#4F6B3D',
  '#7A4A2B', '#3B5F5A',
];

export const MAX_SESSIONS = 40;

type State = {
  userId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  list: Subject[];
};

let state: State = { userId: null, status: 'idle', error: null, list: [] };
const listeners = new Set<() => void>();

const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const pad = (n: number) => String(n).padStart(2, '0');
const toList = (rows: { slug: string; title: string; color: string }[]): Subject[] =>
  rows.map((r, i) => ({ number: pad(i + 1), slug: r.slug, title: r.title, color: r.color }));

export const getSubjects = () => state.list;
export const findSubject = (slug: string | undefined) => state.list.find((s) => s.slug === slug);

/** The signed-in user's subjects, in order. */
export function useSubjects(): Subject[] {
  return useSyncExternalStore(subscribe, () => state.list);
}

/** Load status for the gate in RequireAuth. */
export function useSubjectsState(): State {
  return useSyncExternalStore(subscribe, () => state);
}

async function fetchList(): Promise<Subject[]> {
  const { data, error } = await supabase.from('subjects').select('slug, title, color').order('position').order('created_at');
  if (error) {
    throw new Error(
      /schema cache|does not exist/.test(error.message)
        ? 'Subjects are not set up yet: run supabase/migrations-010-custom-subjects.sql in Supabase.'
        : error.message,
    );
  }
  return toList(data);
}

export async function loadSubjects(userId: string) {
  set({ userId, status: 'loading', error: null, list: state.userId === userId ? state.list : [] });
  try {
    set({ list: await fetchList(), status: 'ready' });
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
  }
}

const refresh = async () => set({ list: await fetchList() });

export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/, '') || 'subject';

/** A slug for `title` that isn't used yet (by an existing subject or one in `taken`). */
function uniqueSlug(title: string, taken: Set<string>) {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  taken.add(slug);
  return slug;
}

export type NewSubject = { title: string; color: string; sessions: number; slug?: string };

/** Adds subjects at the end of the list, each with sessions 1…n. Returns their slugs. */
export async function createSubjects(items: NewSubject[]): Promise<string[]> {
  const taken = new Set(state.list.map((s) => s.slug));
  const start = state.list.length;
  const rows = items.map((it, i) => ({
    slug: it.slug && !taken.has(it.slug) ? (taken.add(it.slug), it.slug) : uniqueSlug(it.title, taken),
    title: it.title.trim(),
    color: it.color,
    position: start + i + 1,
  }));
  const { error } = await supabase.from('subjects').insert(rows);
  if (error) throw error;

  const sessions = rows.flatMap((r, i) =>
    Array.from({ length: Math.min(MAX_SESSIONS, Math.max(0, items[i].sessions)) }, (_, n) => ({
      subject_slug: r.slug,
      number: n + 1,
    })),
  );
  if (sessions.length) {
    const { error: sessionError } = await supabase
      .from('sessions')
      .upsert(sessions, { onConflict: 'user_id,subject_slug,number', ignoreDuplicates: true });
    if (sessionError) throw sessionError;
  }
  await refresh();
  return rows.map((r) => r.slug);
}

export async function updateSubject(slug: string, patch: { title?: string; color?: string }) {
  const { error } = await supabase
    .from('subjects')
    .update({ ...patch, ...(patch.title !== undefined && { title: patch.title.trim() }) })
    .eq('slug', slug);
  if (error) throw error;
  await refresh();
}

/** Saves a new order (all slugs, first to last). */
export async function reorderSubjects(slugs: string[]) {
  const byslug = new Map(state.list.map((s) => [s.slug, s]));
  // Show the new order straight away; the saved order follows.
  set({ list: toList(slugs.map((s) => byslug.get(s)!).filter(Boolean)) });
  const results = await Promise.all(
    slugs.map((slug, i) => supabase.from('subjects').update({ position: i + 1 }).eq('slug', slug)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    await refresh();
    throw failed.error;
  }
}

/** Deletes a subject with all its sessions, notes, files, questions and shares. */
export async function deleteSubject(slug: string) {
  const { data, error } = await supabase.rpc('delete_subject', { p_slug: slug });
  if (error) throw error;
  const paths = (data as string[] | null) ?? [];
  // Files are removed after their rows, in batches; a file left behind is invisible and harmless.
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
  await refresh();
}
