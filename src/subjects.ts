export type Subject = {
  number: string;
  slug: string;
  title: string;
  color: string;
};

const LIST: [title: string, color: string][] = [
  ['Strategic Human Resource Management', '#2E4F7F'],
  ['Organizational Behavior', '#6A4577'],
  ['Personal Development for Leadership and Strategic Management', '#1F6E68'],
  ['Finance for Strategic Managers', '#2D6A45'],
  ['Strategic Marketing', '#A4533A'],
  ['Strategic Planning', '#A07A2E'],
  ['International Business Environment', '#2A6478'],
  ['Research for Strategic Development', '#454E86'],
  ['The Foundations of Artificial Intelligence', '#8E3452'],
  ['Sustainable Artificial Intelligence and Ethics', '#4F6B3D'],
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
