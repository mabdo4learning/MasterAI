import { useAuth } from './auth';
import { supabase } from './supabase';

/** Exam date (YYYY-MM-DD) per subject slug, stored in the user's user_metadata like the profile. */
export type Exams = Record<string, string>;

export function useExams(): Exams {
  const exams = useAuth().session?.user.user_metadata?.exams;
  return exams && typeof exams === 'object' ? (exams as Exams) : {};
}

export async function saveExam(current: Exams, slug: string, date: string | null) {
  const next = { ...current };
  if (date) next[slug] = date;
  else delete next[slug];
  // Supabase merges top-level metadata keys, so this leaves the profile fields alone.
  const { error } = await supabase.auth.updateUser({ data: { exams: next } });
  if (error) throw error;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Whole days from today to the exam (negative once it has passed). */
export function daysUntil(date: string): number {
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayKey()}T00:00:00`).getTime()) / 86_400_000);
}

export function countdown(date: string): string {
  const d = daysUntil(date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d > 1) return `${d} days left`;
  return d === -1 ? 'Yesterday' : `${-d} days ago`;
}

export const examDate = (date: string, long = false) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(
    undefined,
    long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' },
  );
