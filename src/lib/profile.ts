import { SITE } from '../config';
import { useAuth } from './auth';

export type Profile = { name: string; programme: string; university: string; academicYear: string };

/**
 * Banner details for the signed-in user. Accounts created through the sign-up page store
 * them in user_metadata; older accounts (the original owner) fall back to src/config.ts.
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
