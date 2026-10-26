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

const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export async function listImages(sessionId: string): Promise<LectureImage[]> {
  const { data, error } = await supabase
    .from('images')
    .select('id, path, file_name')
    .eq('session_id', sessionId)
    .order('created_at');
  if (error) throw error;
  return data.map((r) => ({ id: r.id, path: r.path, fileName: r.file_name, url: publicUrl(r.path) }));
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
  return { id: data.id, path: data.path, fileName: data.file_name, url: publicUrl(data.path) };
}

export async function deleteImage(image: LectureImage) {
  const { error } = await supabase.from('images').delete().eq('id', image.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([image.path]);
}

export type SubjectStats = { sessions: number; started: number; notes: number; images: number };

/** Per-subject totals for the home page. A session counts as started once it has a topic, note or image. */
export async function listSubjectStats(): Promise<Record<string, SubjectStats>> {
  const { data, error } = await supabase.from('sessions').select('subject_slug, topic, notes(count), images(count)');
  if (error) throw error;
  const stats: Record<string, SubjectStats> = {};
  for (const r of data as unknown as (SessionRow & { subject_slug: string })[]) {
    const s = (stats[r.subject_slug] ??= { sessions: 0, started: 0, notes: 0, images: 0 });
    const notes = r.notes[0]?.count ?? 0;
    const images = r.images[0]?.count ?? 0;
    s.sessions += 1;
    s.notes += notes;
    s.images += images;
    if (r.topic.trim() || notes || images) s.started += 1;
  }
  return stats;
}
