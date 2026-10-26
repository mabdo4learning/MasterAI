export type Subject = {
  number: string;
  slug: string;
  title: string;
  color: string;
};

const LIST: [title: string, color: string][] = [
  ['Strategic Human Resource Management', '#1D4ED8'],
  ['Organizational Behavior', '#7C3AED'],
  ['Personal Development for Leadership and Strategic Management', '#0F766E'],
  ['Finance for Strategic Managers', '#15803D'],
  ['Strategic Marketing', '#C2410C'],
  ['Strategic Planning', '#B45309'],
  ['International Business Environment', '#0E7490'],
  ['Research for Strategic Development', '#4338CA'],
  ['The Foundations of Artificial Intelligence', '#BE185D'],
  ['Sustainable Artificial Intelligence and Ethics', '#047857'],
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const SUBJECTS: Subject[] = LIST.map(([title, color], i) => ({
  number: String(i + 1).padStart(2, '0'),
  slug: slugify(title),
  title,
  color,
}));

export const findSubject = (slug: string | undefined) =>
  SUBJECTS.find((s) => s.slug === slug);
