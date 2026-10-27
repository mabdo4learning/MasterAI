import { BUCKET, supabase } from './supabase';
import { shrinkImage } from './resize';
import { docType, extOf } from './files';

export type LectureSession = {
  id: string;
  number: number;
  topic: string;
  lectureDate: string | null;
  attended: boolean;
  reviewed: boolean;
  noteCount: number;
  imageCount: number;
  documentCount: number;
};

export type Note = { id: string; body: string; createdAt: string; updatedAt: string | null };

const NOTE_COLUMNS = 'id, body, created_at, updated_at';
type NoteRow = { id: string; body: string; created_at: string; updated_at: string | null };
const toNote = (r: NoteRow): Note => ({ id: r.id, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at });

export type LectureImage = { id: string; path: string; fileName: string; url: string };

export type LectureDocument = {
  id: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type SessionRow = {
  id: string;
  number: number;
  topic: string;
  lecture_date: string | null;
  attended: boolean;
  reviewed: boolean;
  notes: { count: number }[];
  images: { count: number }[];
  documents: { count: number }[];
};

const toSession = (r: SessionRow): LectureSession => ({
  id: r.id,
  number: r.number,
  topic: r.topic,
  lectureDate: r.lecture_date,
  attended: r.attended,
  reviewed: r.reviewed,
  noteCount: r.notes[0]?.count ?? 0,
  imageCount: r.images[0]?.count ?? 0,
  documentCount: r.documents[0]?.count ?? 0,
});

const SESSION_COLUMNS =
  'id, number, topic, lecture_date, attended, reviewed, notes(count), images(count), documents(count)';

export async function listSessions(subjectSlug: string): Promise<LectureSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('subject_slug', subjectSlug)
    .order('number');
  if (error) throw error;
  return (data as unknown as SessionRow[]).map(toSession);
}

export async function addSession(subjectSlug: string, number: number): Promise<LectureSession> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ subject_slug: subjectSlug, number })
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw error;
  return toSession(data as unknown as SessionRow);
}

export async function updateSession(
  id: string,
  patch: { topic?: string; lecture_date?: string | null; attended?: boolean; reviewed?: boolean },
) {
  const { error } = await supabase.from('sessions').update(patch).eq('id', id);
  if (error) throw error;
}

export async function listNotes(sessionId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as NoteRow[]).map(toNote);
}

export async function addNote(sessionId: string, body: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ session_id: sessionId, body })
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw error;
  return toNote(data as NoteRow);
}

export async function updateNote(id: string, body: string): Promise<Note> {
  const { data, error } = await supabase.from('notes').update({ body }).eq('id', id).select(NOTE_COLUMNS).single();
  if (error) throw error;
  return toNote(data as NoteRow);
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}

// The bucket is private, so images are shown through short-lived signed URLs.
const SIGNED_URL_TTL = 60 * 60 * 6;

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) throw error;
  return Object.fromEntries(data.filter((d) => d.path && d.signedUrl).map((d) => [d.path!, d.signedUrl!]));
}

export async function listImages(sessionId: string): Promise<LectureImage[]> {
  const { data, error } = await supabase
    .from('images')
    .select('id, path, file_name')
    .eq('session_id', sessionId)
    .order('created_at');
  if (error) throw error;
  const urls = await signedUrls(data.map((r) => r.path));
  return data.map((r) => ({ id: r.id, path: r.path, fileName: r.file_name, url: urls[r.path] ?? '' }));
}

export async function uploadImage(subjectSlug: string, sessionId: string, file: File): Promise<LectureImage> {
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'img').toLowerCase();
  // Storage rules only allow uploads inside the signed-in user's own folder.
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error('You need to be signed in to upload images');
  const path = `${userId}/${subjectSlug}/${sessionId}/${crypto.randomUUID()}.${ext}`;

  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || file.type });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from('images')
    .insert({ session_id: sessionId, path, file_name: file.name })
    .select('id, path, file_name')
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  const urls = await signedUrls([data.path]);
  return { id: data.id, path: data.path, fileName: data.file_name, url: urls[data.path] ?? '' };
}

export async function deleteImage(image: LectureImage) {
  // Remove the file first: for images uploaded before per-user folders, the storage
  // rule checks the images row, so it has to still exist at this point.
  await supabase.storage.from(BUCKET).remove([image.path]);
  const { error } = await supabase.from('images').delete().eq('id', image.id);
  if (error) throw error;
}

export type ActivityItem = {
  kind: 'note' | 'image' | 'document';
  id: string;
  createdAt: string;
  subjectSlug: string;
  sessionNumber: number;
  text: string;
  url?: string;
};

export type DashboardSession = LectureSession & { subjectSlug: string };

export type Dashboard = {
  sessions: DashboardSession[];
  recent: ActivityItem[];
  /** Creation times of notes and images from the last ~9 weeks, for the activity chart. */
  activity: { kind: 'note' | 'image'; createdAt: string }[];
};

type JoinedSession = { subject_slug: string; number: number } | null;

export async function getDashboard(): Promise<Dashboard> {
  const since = new Date(Date.now() - 63 * 86_400_000).toISOString();
  const [sessions, notes, images, documents, noteTimes, imageTimes] = await Promise.all([
    supabase.from('sessions').select(`subject_slug, ${SESSION_COLUMNS}`).order('number'),
    supabase
      .from('notes')
      .select('id, body, created_at, session:sessions(subject_slug, number)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('images')
      .select('id, path, file_name, created_at, session:sessions(subject_slug, number)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('documents')
      .select('id, file_name, created_at, session:sessions(subject_slug, number)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('notes').select('created_at').gte('created_at', since),
    supabase.from('images').select('created_at').gte('created_at', since),
  ]);
  for (const r of [sessions, notes, images, documents, noteTimes, imageTimes]) if (r.error) throw r.error;

  type ImageRow = { id: string; path: string; file_name: string; created_at: string; session: JoinedSession };
  const imageRows = images.data as unknown as ImageRow[];
  const urls = await signedUrls(imageRows.map((i) => i.path));

  const recent: ActivityItem[] = [
    ...(notes.data as unknown as { id: string; body: string; created_at: string; session: JoinedSession }[]).map(
      (n) => ({
        kind: 'note' as const,
        id: n.id,
        createdAt: n.created_at,
        subjectSlug: n.session?.subject_slug ?? '',
        sessionNumber: n.session?.number ?? 0,
        text: n.body,
      }),
    ),
    ...imageRows.map((i) => ({
      kind: 'image' as const,
      id: i.id,
      createdAt: i.created_at,
      subjectSlug: i.session?.subject_slug ?? '',
      sessionNumber: i.session?.number ?? 0,
      text: i.file_name,
      url: urls[i.path],
    })),
    ...(documents.data as unknown as { id: string; file_name: string; created_at: string; session: JoinedSession }[]).map(
      (d) => ({
        kind: 'document' as const,
        id: d.id,
        createdAt: d.created_at,
        subjectSlug: d.session?.subject_slug ?? '',
        sessionNumber: d.session?.number ?? 0,
        text: d.file_name,
      }),
    ),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return {
    sessions: (sessions.data as unknown as (SessionRow & { subject_slug: string })[]).map((r) => ({
      ...toSession(r),
      subjectSlug: r.subject_slug,
    })),
    recent,
    activity: [
      ...noteTimes.data!.map((r) => ({ kind: 'note' as const, createdAt: r.created_at })),
      ...imageTimes.data!.map((r) => ({ kind: 'image' as const, createdAt: r.created_at })),
    ],
  };
}

/** Every session across all subjects, for the calendar. */
export async function listAllSessions(): Promise<DashboardSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(`subject_slug, ${SESSION_COLUMNS}`)
    .order('subject_slug')
    .order('number');
  if (error) throw error;
  return (data as unknown as (SessionRow & { subject_slug: string })[]).map((r) => ({
    ...toSession(r),
    subjectSlug: r.subject_slug,
  }));
}

const DOCUMENT_COLUMNS = 'id, path, file_name, mime_type, size_bytes, created_at';

type DocumentRow = {
  id: string;
  path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

const toDocument = (r: DocumentRow): LectureDocument => ({
  id: r.id,
  path: r.path,
  fileName: r.file_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  createdAt: r.created_at,
});

export async function listDocuments(sessionId: string): Promise<LectureDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at');
  if (error) throw error;
  return (data as DocumentRow[]).map(toDocument);
}

export async function uploadDocument(subjectSlug: string, sessionId: string, file: File): Promise<LectureDocument> {
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error('You need to be signed in to upload files');
  // Some systems report Office files with an empty MIME type, so fall back to the extension.
  const contentType = file.type || docType(file.name).mime;
  const path = `${userId}/${subjectSlug}/${sessionId}/docs/${crypto.randomUUID()}.${extOf(file.name) || 'bin'}`;

  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from('documents')
    .insert({ session_id: sessionId, path, file_name: file.name, mime_type: contentType, size_bytes: file.size })
    .select(DOCUMENT_COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return toDocument(data as DocumentRow);
}

export async function deleteDocument(doc: LectureDocument) {
  await supabase.storage.from(BUCKET).remove([doc.path]);
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  if (error) throw error;
}

/** A fresh signed link to a document; with `download`, the browser saves it under the original file name. */
export async function documentUrl(doc: LectureDocument, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.path, SIGNED_URL_TTL, download ? { download: doc.fileName } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export type ExportSession = {
  id: string;
  number: number;
  topic: string;
  lectureDate: string | null;
  notes: Note[];
  images: LectureImage[];
  documents: { id: string; fileName: string }[];
};

/** Everything in one subject, oldest note first, for the printable export. */
export async function getSubjectExport(subjectSlug: string): Promise<ExportSession[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(
      `id, number, topic, lecture_date, notes(${NOTE_COLUMNS}), images(id, path, file_name, created_at), documents(id, file_name, created_at)`,
    )
    .eq('subject_slug', subjectSlug)
    .order('number')
    .order('created_at', { referencedTable: 'notes' })
    .order('created_at', { referencedTable: 'images' })
    .order('created_at', { referencedTable: 'documents' });
  if (error) throw error;

  type Row = {
    id: string;
    number: number;
    topic: string;
    lecture_date: string | null;
    notes: NoteRow[];
    images: { id: string; path: string; file_name: string }[];
    documents: { id: string; file_name: string }[];
  };
  const rows = data as unknown as Row[];
  const urls = await signedUrls(rows.flatMap((r) => r.images.map((i) => i.path)));
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    topic: r.topic,
    lectureDate: r.lecture_date,
    notes: r.notes.map(toNote),
    images: r.images.map((i) => ({ id: i.id, path: i.path, fileName: i.file_name, url: urls[i.path] ?? '' })),
    documents: r.documents.map((d) => ({ id: d.id, fileName: d.file_name })),
  }));
}

export type SearchHit = {
  kind: 'session' | 'note' | 'image' | 'document';
  id: string;
  subjectSlug: string;
  sessionNumber: number;
  /** Topic for sessions, body for notes, file name for images and documents. */
  text: string;
  createdAt?: string;
  lectureDate?: string | null;
  url?: string;
};

const SEARCH_LIMIT = 40;

// `%`, `_` and `\` are wildcards in ILIKE, so a search for "50%" must not match everything.
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Sessions, notes, images and documents containing every term (case-insensitive). */
export async function search(terms: string[]): Promise<SearchHit[]> {
  if (terms.length === 0) return [];
  const where = <Q extends { ilike: (column: string, pattern: string) => Q }>(q: Q, column: string) =>
    terms.reduce((acc, t) => acc.ilike(column, likePattern(t)), q);

  const [sessions, notes, images, documents] = await Promise.all([
    where(supabase.from('sessions').select('id, subject_slug, number, topic, lecture_date'), 'topic')
      .order('subject_slug')
      .order('number')
      .limit(SEARCH_LIMIT),
    where(supabase.from('notes').select('id, body, created_at, session:sessions(subject_slug, number)'), 'body')
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT),
    where(
      supabase.from('images').select('id, path, file_name, created_at, session:sessions(subject_slug, number)'),
      'file_name',
    )
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT),
    where(supabase.from('documents').select('id, file_name, created_at, session:sessions(subject_slug, number)'), 'file_name')
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT),
  ]);
  for (const r of [sessions, notes, images, documents]) if (r.error) throw r.error;

  type SessionHitRow = { id: string; subject_slug: string; number: number; topic: string; lecture_date: string | null };
  type NoteHitRow = { id: string; body: string; created_at: string; session: JoinedSession };
  type FileHitRow = { id: string; path?: string; file_name: string; created_at: string; session: JoinedSession };

  const imageRows = images.data as unknown as FileHitRow[];
  const urls = await signedUrls(imageRows.map((i) => i.path!));
  const fromFile =
    (kind: 'image' | 'document') =>
    (r: FileHitRow): SearchHit => ({
      kind,
      id: r.id,
      subjectSlug: r.session?.subject_slug ?? '',
      sessionNumber: r.session?.number ?? 0,
      text: r.file_name,
      createdAt: r.created_at,
      url: r.path ? urls[r.path] : undefined,
    });

  return [
    ...(sessions.data as unknown as SessionHitRow[]).map(
      (s): SearchHit => ({
        kind: 'session',
        id: s.id,
        subjectSlug: s.subject_slug,
        sessionNumber: s.number,
        text: s.topic,
        lectureDate: s.lecture_date,
      }),
    ),
    ...(notes.data as unknown as NoteHitRow[]).map(
      (n): SearchHit => ({
        kind: 'note',
        id: n.id,
        subjectSlug: n.session?.subject_slug ?? '',
        sessionNumber: n.session?.number ?? 0,
        text: n.body,
        createdAt: n.created_at,
      }),
    ),
    ...imageRows.map(fromFile('image')),
    ...(documents.data as unknown as FileHitRow[]).map(fromFile('document')),
  ];
}
