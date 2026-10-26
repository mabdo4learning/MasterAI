import { BUCKET, supabase } from './supabase';
import { shrinkImage } from './resize';

export type LectureSession = {
  id: string;
  number: number;
  topic: string;
  lectureDate: string | null;
  noteCount: number;
  imageCount: number;
};

export type Note = { id: string; body: string; createdAt: string };

export type LectureImage = { id: string; path: string; fileName: string; url: string };

type SessionRow = {
  id: string;
  number: number;
  topic: string;
  lecture_date: string | null;
  notes: { count: number }[];
  images: { count: number }[];
};

const toSession = (r: SessionRow): LectureSession => ({
  id: r.id,
  number: r.number,
  topic: r.topic,
  lectureDate: r.lecture_date,
  noteCount: r.notes[0]?.count ?? 0,
  imageCount: r.images[0]?.count ?? 0,
});

const SESSION_COLUMNS = 'id, number, topic, lecture_date, notes(count), images(count)';

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

export async function updateSession(id: string, patch: { topic?: string; lecture_date?: string | null }) {
  const { error } = await supabase.from('sessions').update(patch).eq('id', id);
  if (error) throw error;
}

export async function listNotes(sessionId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, body, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at }));
}

export async function addNote(sessionId: string, body: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ session_id: sessionId, body })
    .select('id, body, created_at')
    .single();
  if (error) throw error;
  return { id: data.id, body: data.body, createdAt: data.created_at };
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
  const path = `${subjectSlug}/${sessionId}/${crypto.randomUUID()}.${ext}`;

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
  const { error } = await supabase.from('images').delete().eq('id', image.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([image.path]);
}

export type ActivityItem = {
  kind: 'note' | 'image';
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
  const [sessions, notes, images, noteTimes, imageTimes] = await Promise.all([
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
    supabase.from('notes').select('created_at').gte('created_at', since),
    supabase.from('images').select('created_at').gte('created_at', since),
  ]);
  for (const r of [sessions, notes, images, noteTimes, imageTimes]) if (r.error) throw r.error;

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
