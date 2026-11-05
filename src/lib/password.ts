export const MIN_PASSWORD = 8;

export function strength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < MIN_PASSWORD) return { score: 0, label: `At least ${MIN_PASSWORD} characters` };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12 && variety >= 3) return { score: 3, label: 'Strong password' };
  if (variety >= 2) return { score: 2, label: 'Good password' };
  return { score: 1, label: 'Weak — mix in numbers or symbols' };
}
