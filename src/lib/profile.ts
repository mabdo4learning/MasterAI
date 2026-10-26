import { SITE } from '../config';
import { useAuth } from './auth';

export type Profile = { name: string; programme: string; university: string; academicYear: string };

/**
 * Details for the signed-in user, edited on the Settings page and stored in user_metadata.
 * Accounts that never saved them fall back to src/config.ts.
 */
export function useProfile(): Profile {
  const meta = (useAuth().session?.user.user_metadata ?? {}) as Partial<Record<string, string>>;
  return {
    name: meta.full_name ?? '',
    programme: meta.programme ?? SITE.programme,
    university: meta.university ?? SITE.university,
    academicYear: meta.academic_year ?? SITE.academicYear,
  };
}

/** Up to two initials from the name, or the first letter of the email. */
export function initials(name: string, email = ''): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return (email[0] ?? '?').toUpperCase();
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
