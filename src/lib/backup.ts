import { zipSync, strToU8, type Zippable } from 'fflate';
import { SUBJECTS } from '../subjects';
import { BUCKET, supabase } from './supabase';

export type BackupProgress = { step: 'data' | 'files' | 'zip'; done: number; total: number };

type Row = Record<string, unknown>;
type SessionRow = { id: string; subject_slug: string; number: number; topic: string; lecture_date: string | null; attended: boolean; reviewed: boolean; created_at: string };
type NoteRow = { session_id: string; body: string; created_at: string; updated_at: string | null };
type FileRow = { session_id: string; path: string; file_name: string; created_at: string; mime_type?: string; size_bytes?: number };
type QuestionRow = { session_id: string; question: string; answer: string; last_result: string | null; practiced_at: string | null; created_at: string };
type SubjectFileRow = FileRow & { subject_slug: string; kind: 'image' | 'document' };
type DetailsRow = Record<string, string> & { subject_slug: string };

const DETAIL_FIELDS: [column: string, key: string, label: string][] = [
  ['lecturer', 'lecturer', 'Lecturer'],
  ['lecturer_email', 'lecturerEmail', 'Lecturer email'],
  ['schedule', 'schedule', 'When'],
  ['room', 'room', 'Where'],
  ['office_hours', 'officeHours', 'Office hours'],
  ['credits', 'credits', 'Credits'],
  ['assessment', 'assessment', 'Assessment'],
  ['overview', 'overview', 'Overview'],
];

const PAGE = 1000;
const PARALLEL = 4;

/** Every row of a table (RLS limits it to the signed-in user), fetched in pages so large accounts aren't cut off at 1000. */
async function all<T extends Row>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('created_at')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as unknown as T[]));
    if (data.length < PAGE) return rows;
  }
}

const safe = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'file';

/** Gives each file a unique name inside its folder, adding " (2)" before the extension when needed. */
function uniqueName(taken: Set<string>, folder: string, name: string): string {
  const dot = name.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let candidate = `${folder}/${name}`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${folder}/${base} (${i})${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

const stamp = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Builds a .zip of everything in the account: backup.json (complete, machine-readable),
 * notes.md (readable) and, optionally, the original images and documents in folders per session.
 */
export async function createBackup(includeFiles: boolean, onProgress: (p: BackupProgress) => void): Promise<Blob> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('You need to be signed in to download a backup');

  onProgress({ step: 'data', done: 0, total: 7 });
  let fetched = 0;
  const track = <T,>(p: Promise<T>) => p.then((r) => (onProgress({ step: 'data', done: ++fetched, total: 7 }), r));
  const [sessions, notes, images, documents, questions, detailRows, subjectFiles] = await Promise.all([
    track(all<SessionRow>('sessions', 'id, subject_slug, number, topic, lecture_date, attended, reviewed, created_at')),
    track(all<NoteRow>('notes', 'id, session_id, body, created_at, updated_at')),
    track(all<FileRow>('images', 'id, session_id, path, file_name, created_at')),
    track(all<FileRow>('documents', 'id, session_id, path, file_name, mime_type, size_bytes, created_at')),
    // The questions table arrived later; an account without it still gets a backup.
    track(all<QuestionRow>('questions', 'id, session_id, question, answer, last_result, practiced_at, created_at').catch(() => [])),
    // Subject details came later still; one row per subject, so no paging needed.
    track(
      Promise.resolve(supabase.from('subject_details').select('*')).then(({ data, error }) => (error ? [] : (data as DetailsRow[]))),
    ),
    track(all<SubjectFileRow>('subject_files', 'id, subject_slug, kind, path, file_name, mime_type, size_bytes, created_at').catch(() => [])),
  ]);

  const bySession = <T extends { session_id: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows) map.set(r.session_id, [...(map.get(r.session_id) ?? []), r]);
    return map;
  };
  const notesBy = bySession(notes);
  const imagesBy = bySession(images);
  const docsBy = bySession(documents);
  const questionsBy = bySession(questions);

  const zip: Zippable = {};
  const taken = new Set<string>();
  const downloads: { path: string; zipPath: string }[] = [];

  const meta = user.user_metadata ?? {};
  const known = new Set(SUBJECTS.map((s) => s.slug));
  const subjects = [
    ...SUBJECTS.map((s) => ({ slug: s.slug, number: s.number, title: s.title })),
    // Sessions saved under a subject that has since been renamed or removed are kept too.
    ...[...new Set(sessions.map((s) => s.subject_slug))]
      .filter((slug) => !known.has(slug))
      .map((slug) => ({ slug, number: '', title: slug })),
  ];

  const fileEntry = (f: FileRow, sessionFolder: string) => {
    const entry: Row = { fileName: f.file_name, uploadedAt: f.created_at };
    if (f.mime_type !== undefined) Object.assign(entry, { type: f.mime_type, sizeBytes: f.size_bytes });
    if (includeFiles) {
      const zipPath = uniqueName(taken, `files/${sessionFolder}`, safe(f.file_name));
      downloads.push({ path: f.path, zipPath });
      entry.file = zipPath;
    }
    return entry;
  };

  const data = subjects.map((subject) => {
    const own = sessions.filter((s) => s.subject_slug === subject.slug).sort((a, b) => a.number - b.number);
    return {
      ...subject,
      examDate: (meta.exams as Record<string, string> | undefined)?.[subject.slug] ?? null,
      details: (() => {
        const row = detailRows.find((d) => d.subject_slug === subject.slug);
        return row ? Object.fromEntries(DETAIL_FIELDS.map(([column, key]) => [key, row[column] ?? ''])) : null;
      })(),
      attachments: subjectFiles
        .filter((f) => f.subject_slug === subject.slug)
        .map((f) => ({ kind: f.kind, ...fileEntry(f, `${safe(`${subject.number} ${subject.title}`.trim())}/Subject`) })),
      sessions: own.map((s) => {
        const folder = `${safe(`${subject.number} ${subject.title}`.trim())}/Session ${s.number}`;
        return {
          number: s.number,
          topic: s.topic,
          lectureDate: s.lecture_date,
          attended: s.attended,
          reviewed: s.reviewed,
          notes: (notesBy.get(s.id) ?? []).map((n) => ({ body: n.body, createdAt: n.created_at, editedAt: n.updated_at })),
          questions: (questionsBy.get(s.id) ?? []).map((q) => ({
            question: q.question,
            answer: q.answer,
            lastResult: q.last_result,
            practicedAt: q.practiced_at,
            createdAt: q.created_at,
          })),
          images: (imagesBy.get(s.id) ?? []).map((f) => fileEntry(f, folder)),
          documents: (docsBy.get(s.id) ?? []).map((f) => fileEntry(f, folder)),
        };
      }),
    };
  });

  const exportedAt = new Date().toISOString();
  const backup = {
    app: 'My lecture notes',
    format: 1,
    exportedAt,
    account: {
      email: user.email,
      name: meta.full_name ?? '',
      programme: meta.programme ?? '',
      university: meta.university ?? '',
      academicYear: meta.academic_year ?? '',
    },
    totals: {
      sessions: sessions.length,
      notes: notes.length,
      questions: questions.length,
      images: images.length,
      documents: documents.length,
      subjectFiles: subjectFiles.length,
    },
    subjects: data,
  };
  zip['backup.json'] = strToU8(JSON.stringify(backup, null, 2));
  zip['notes.md'] = strToU8(markdown(backup));

  if (downloads.length > 0) {
    let done = 0;
    const missing: string[] = [];
    onProgress({ step: 'files', done, total: downloads.length });
    const queue = [...downloads];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { data: blob, error } = await supabase.storage.from(BUCKET).download(job.path);
        // Images and PDFs are already compressed, so they are stored as-is (level 0) to keep zipping fast.
        if (blob && !error) zip[job.zipPath] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
        else missing.push(job.zipPath);
        onProgress({ step: 'files', done: ++done, total: downloads.length });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    if (missing.length) zip['missing-files.txt'] = strToU8(`These files could not be downloaded:\n\n${missing.join('\n')}\n`);
  }

  onProgress({ step: 'zip', done: 0, total: 1 });
  const bytes = zipSync(zip, { level: 6 });
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

type Backup = {
  exportedAt: string;
  account: { email?: string; name: string; programme: string; university: string; academicYear: string };
  subjects: {
    number: string;
    title: string;
    examDate: string | null;
    details: Record<string, string> | null;
    attachments: Row[];
    sessions: {
      number: number;
      topic: string;
      lectureDate: string | null;
      notes: { body: string; createdAt: string }[];
      questions: { question: string; answer: string }[];
      images: Row[];
      documents: Row[];
    }[];
  }[];
};

/** The same content as plain readable text, so the backup is useful without any app. */
function markdown(b: Backup): string {
  const out: string[] = ['# My lecture notes', ''];
  const who = [b.account.name, b.account.programme, b.account.university, b.account.academicYear].filter(Boolean);
  if (who.length) out.push(who.join(' · '), '');
  out.push(`Backup from ${stamp(b.exportedAt)}`, '');

  for (const subject of b.subjects) {
    const used = subject.sessions.filter(
      (s) => s.topic || s.lectureDate || s.notes.length || s.questions.length || s.images.length || s.documents.length,
    );
    const info = DETAIL_FIELDS.filter(([, key]) => subject.details?.[key]);
    if (used.length === 0 && !subject.examDate && info.length === 0 && subject.attachments.length === 0) continue;
    out.push(`## ${[subject.number, subject.title].filter(Boolean).join(' ')}`, '');
    if (subject.examDate) out.push(`Exam: ${subject.examDate}`, '');
    for (const [, key, label] of info) {
      if (key === 'overview') out.push('', '**Overview**', '', subject.details![key], '');
      else out.push(`**${label}:** ${subject.details![key]}  `);
    }
    if (info.length && info[info.length - 1][1] !== 'overview') out.push('');
    if (subject.attachments.length) out.push(`**Subject attachments:** ${subject.attachments.map((f) => f.fileName).join(', ')}`, '');

    for (const s of used) {
      out.push(`### Session ${s.number}${s.topic ? ` — ${s.topic}` : ''}`, '');
      if (s.lectureDate) out.push(`Date: ${s.lectureDate}`, '');
      for (const n of s.notes) out.push(`_${stamp(n.createdAt)}_`, '', n.body, '');
      if (s.questions.length) {
        out.push('**Exam questions**', '');
        s.questions.forEach((q, i) => out.push(`${i + 1}. ${q.question}`, ...(q.answer ? [`   - ${q.answer.replace(/\n/g, '\n     ')}`] : [])));
        out.push('');
      }
      const files = [...s.images, ...s.documents];
      if (files.length) out.push(`**Files:** ${files.map((f) => f.fileName).join(', ')}`, '');
    }
  }
  return out.join('\n');
}
