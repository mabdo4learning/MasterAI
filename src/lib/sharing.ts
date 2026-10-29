import { BUCKET, supabase } from './supabase';
import {
  addSession,
  detailsToRow,
  getSubjectDetails,
  signedUrls,
  toDetails,
  type LectureDocument,
  type LectureImage,
  type SubjectDetails,
} from './api';
import { extOf } from './files';

export type ShareKind = 'subject' | 'session' | 'items';

/** A share the signed-in user owns. */
export type Share = {
  id: string;
  kind: ShareKind;
  subjectSlug: string;
  sessionId: string | null;
  noteIds: string[];
  imageIds: string[];
  documentIds: string[];
  token: string;
  linkEnabled: boolean;
  title: string;
  createdAt: string;
  recipientCount: number;
};

type ShareRow = {
  id: string;
  kind: ShareKind;
  subject_slug: string;
  session_id: string | null;
  note_ids: string[];
  image_ids: string[];
  document_ids: string[];
  token: string;
  link_enabled: boolean;
  title: string;
  created_at: string;
  share_recipients: { count: number }[];
};

const SHARE_COLUMNS =
  'id, kind, subject_slug, session_id, note_ids, image_ids, document_ids, token, link_enabled, title, created_at, share_recipients(count)';

const toShare = (r: ShareRow): Share => ({
  id: r.id,
  kind: r.kind,
  subjectSlug: r.subject_slug,
  sessionId: r.session_id,
  noteIds: r.note_ids,
  imageIds: r.image_ids,
  documentIds: r.document_ids,
  token: r.token,
  linkEnabled: r.link_enabled,
  title: r.title,
  createdAt: r.created_at,
  recipientCount: r.share_recipients[0]?.count ?? 0,
});

export const shareUrl = (token: string) => `${window.location.origin}/share/${token}`;

/** The caller's shares, optionally only those for one subject (and its sessions). */
export async function listMyShares(subjectSlug?: string): Promise<Share[]> {
  let query = supabase.from('shares').select(SHARE_COLUMNS).order('created_at', { ascending: false });
  if (subjectSlug) query = query.eq('subject_slug', subjectSlug);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as ShareRow[]).map(toShare);
}

export type NewShare = {
  kind: ShareKind;
  subjectSlug: string;
  sessionId?: string;
  noteIds?: string[];
  imageIds?: string[];
  documentIds?: string[];
  title: string;
  ownerName: string;
};

export async function createShare(s: NewShare): Promise<Share> {
  const { data, error } = await supabase
    .from('shares')
    .insert({
      kind: s.kind,
      subject_slug: s.subjectSlug,
      session_id: s.sessionId ?? null,
      note_ids: s.noteIds ?? [],
      image_ids: s.imageIds ?? [],
      document_ids: s.documentIds ?? [],
      title: s.title,
      owner_name: s.ownerName,
    })
    .select(SHARE_COLUMNS)
    .single();
  if (error) throw error;
  return toShare(data as unknown as ShareRow);
}

export async function setLinkEnabled(id: string, enabled: boolean) {
  const { error } = await supabase.from('shares').update({ link_enabled: enabled }).eq('id', id);
  if (error) throw error;
}

export async function deleteShare(id: string) {
  const { error } = await supabase.from('shares').delete().eq('id', id);
  if (error) throw error;
}

export type Recipient = { userId: string; email: string; name: string; via: 'link' | 'email'; addedAt: string };

export async function listRecipients(shareId: string): Promise<Recipient[]> {
  const { data, error } = await supabase.rpc('share_recipients_of', { p_share: shareId });
  if (error) throw error;
  return (data as { user_id: string; email: string; name: string; via: 'link' | 'email'; added_at: string }[]).map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    via: r.via,
    addedAt: r.added_at,
  }));
}

export async function shareWithEmail(shareId: string, email: string) {
  const { error } = await supabase.rpc('share_with_email', { p_share: shareId, p_email: email });
  if (error) throw error;
}

/** Owner removes someone, or a recipient removes themselves (pass their own id). */
export async function removeRecipient(shareId: string, userId: string) {
  const { error } = await supabase.from('share_recipients').delete().eq('share_id', shareId).eq('user_id', userId);
  if (error) throw error;
}

/** Opens a share link: adds the signed-in user as a recipient and returns the share id. */
export async function joinShare(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_share', { p_token: token });
  if (error) throw error;
  return data as string;
}

export type IncomingShare = {
  id: string;
  kind: ShareKind;
  subjectSlug: string;
  title: string;
  ownerName: string;
  via: 'link' | 'email';
  addedAt: string;
};

export async function sharedWithMe(): Promise<IncomingShare[]> {
  const { data, error } = await supabase.rpc('shared_with_me');
  if (error) throw error;
  return (
    data as { id: string; kind: ShareKind; subject_slug: string; title: string; owner_name: string; via: 'link' | 'email'; added_at: string }[]
  ).map((r) => ({
    id: r.id,
    kind: r.kind,
    subjectSlug: r.subject_slug,
    title: r.title,
    ownerName: r.owner_name,
    via: r.via,
    addedAt: r.added_at,
  }));
}

export type SharedNote = { id: string; body: string; createdAt: string; updatedAt: string | null };
export type SharedQuestion = { id: string; question: string; answer: string };
export type SharedSession = {
  id: string;
  number: number;
  topic: string;
  lectureDate: string | null;
  notes: SharedNote[];
  images: (LectureImage & { createdAt: string })[];
  documents: LectureDocument[];
  questions: SharedQuestion[];
};
export type SharedContent = {
  id: string;
  kind: ShareKind;
  subjectSlug: string;
  title: string;
  ownerName: string;
  isOwner: boolean;
  createdAt: string;
  sessions: SharedSession[];
  /** Whole-subject shares only: the subject's course info and attachments. */
  details: SubjectDetails | null;
  subjectImages: LectureImage[];
  subjectDocuments: LectureDocument[];
};

type SharedContentJson = Omit<SharedContent, 'details' | 'subjectImages' | 'subjectDocuments'> & {
  details: Parameters<typeof toDetails>[0];
  files?: (LectureDocument & { kind: 'image' | 'document' })[];
};

/** The live content of a share, with signed links for its images. */
export async function getSharedContent(shareId: string): Promise<SharedContent> {
  const { data, error } = await supabase.rpc('shared_content', { p_share: shareId });
  if (error) throw error;
  const { files = [], details, ...content } = data as SharedContentJson;
  const images = files.filter((f) => f.kind === 'image');
  const urls = await signedUrls([...content.sessions.flatMap((s) => s.images.map((i) => i.path)), ...images.map((f) => f.path)]);
  for (const s of content.sessions) for (const i of s.images) i.url = urls[i.path] ?? '';
  return {
    ...content,
    details: details ? toDetails(details) : null,
    subjectImages: images.map((f) => ({ id: f.id, path: f.path, fileName: f.fileName, url: urls[f.path] ?? '' })),
    subjectDocuments: files.filter((f) => f.kind === 'document'),
  };
}

export const sessionIsEmpty = (s: SharedSession) =>
  !s.topic && !s.lectureDate && !s.notes.length && !s.images.length && !s.documents.length && !s.questions.length;

export type CopyTarget = { from: SharedSession; subjectSlug: string; number: number };
export type CopyProgress = { done: number; total: number };
export type CopyResult = { notes: number; files: number; questions: number; details: boolean; failedFiles: string[] };
/** A whole subject's own course info and attachments, copied along with its sessions. */
export type SubjectExtras = { subjectSlug: string; details: SubjectDetails | null; images: LectureImage[]; documents: LectureDocument[] };

/**
 * Copies shared sessions into the signed-in user's own notebook. Notes, questions and files are
 * added next to whatever the target session already has; topic and date only fill empty fields.
 * With `extras`, the subject's course info fills empty fields of the user's own and its attachments are added.
 */
export async function copyToNotebook(
  targets: CopyTarget[],
  onProgress: (p: CopyProgress) => void,
  extras?: SubjectExtras,
): Promise<CopyResult> {
  const userId = (await supabase.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error('You need to be signed in to copy notes');

  const extraFiles = extras ? extras.images.length + extras.documents.length + 1 : 0;
  const total = targets.reduce((n, t) => n + 1 + t.from.images.length + t.from.documents.length, 0) + extraFiles;
  let done = 0;
  const step = () => onProgress({ done: ++done, total });
  onProgress({ done, total });
  const result: CopyResult = { notes: 0, files: 0, questions: 0, details: false, failedFiles: [] };

  if (extras) {
    if (extras.details) {
      const mine = await getSubjectDetails(extras.subjectSlug);
      const fill: Partial<SubjectDetails> = {};
      for (const key of Object.keys(extras.details) as (keyof SubjectDetails)[]) {
        const value = extras.details[key];
        if (key !== 'updatedAt' && value && !mine[key]) fill[key] = value;
      }
      if (Object.keys(fill).length) {
        const { error } = await supabase
          .from('subject_details')
          .upsert({ subject_slug: extras.subjectSlug, ...detailsToRow(fill) }, { onConflict: 'user_id,subject_slug' });
        if (error) throw error;
        result.details = true;
      }
    }
    step();

    const files = [
      ...extras.images.map((f) => ({ kind: 'image' as const, path: f.path, fileName: f.fileName, mimeType: '', sizeBytes: 0 })),
      ...extras.documents.map((f) => ({ kind: 'document' as const, ...f })),
    ];
    for (const f of files) {
      const to = `${userId}/${extras.subjectSlug}/subject/${crypto.randomUUID()}.${extOf(f.path) || 'bin'}`;
      try {
        await copyFile(f.path, to);
        const { error } = await supabase.from('subject_files').insert({
          subject_slug: extras.subjectSlug,
          kind: f.kind,
          path: to,
          file_name: f.fileName,
          mime_type: f.mimeType,
          size_bytes: f.sizeBytes,
        });
        if (error) {
          await supabase.storage.from(BUCKET).remove([to]);
          throw error;
        }
        result.files++;
      } catch {
        result.failedFiles.push(f.fileName);
      }
      step();
    }
  }

  for (const { from, subjectSlug, number } of targets) {
    const { data: found, error } = await supabase
      .from('sessions')
      .select('id, topic, lecture_date')
      .eq('user_id', userId)
      .eq('subject_slug', subjectSlug)
      .eq('number', number)
      .maybeSingle();
    if (error) throw error;
    const target: { id: string; topic: string; lecture_date: string | null } =
      found ?? (await addSession(subjectSlug, number).then((s) => ({ id: s.id, topic: s.topic, lecture_date: s.lectureDate })));

    const patch: Record<string, string> = {};
    if (!target.topic && from.topic) patch.topic = from.topic;
    if (!target.lecture_date && from.lectureDate) patch.lecture_date = from.lectureDate;
    if (Object.keys(patch).length) {
      const { error: e } = await supabase.from('sessions').update(patch).eq('id', target.id);
      if (e) throw e;
    }

    if (from.notes.length) {
      // Oldest first, so the copied notes keep their original order (the list shows newest first).
      const rows = [...from.notes].reverse().map((n) => ({ session_id: target.id, body: n.body }));
      const { error: e } = await supabase.from('notes').insert(rows);
      if (e) throw e;
      result.notes += rows.length;
    }
    if (from.questions.length) {
      const rows = from.questions.map((q) => ({ session_id: target.id, question: q.question, answer: q.answer }));
      const { error: e } = await supabase.from('questions').insert(rows);
      if (e) throw e;
      result.questions += rows.length;
    }
    step();

    const files = [
      ...from.images.map((f) => ({ table: 'images' as const, folder: '', path: f.path, row: { file_name: f.fileName } })),
      ...from.documents.map((f) => ({
        table: 'documents' as const,
        folder: 'docs/',
        path: f.path,
        row: { file_name: f.fileName, mime_type: f.mimeType, size_bytes: f.sizeBytes },
      })),
    ];
    for (const f of files) {
      const to = `${userId}/${subjectSlug}/${target.id}/${f.folder}${crypto.randomUUID()}.${extOf(f.path) || 'bin'}`;
      try {
        await copyFile(f.path, to);
        const { error: e } = await supabase.from(f.table).insert({ session_id: target.id, path: to, ...f.row });
        if (e) {
          await supabase.storage.from(BUCKET).remove([to]);
          throw e;
        }
        result.files++;
      } catch {
        result.failedFiles.push(f.row.file_name);
      }
      step();
    }
  }
  return result;
}

/** Server-side copy when storage allows it; otherwise download and re-upload through the browser. */
async function copyFile(from: string, to: string) {
  const copied = await supabase.storage.from(BUCKET).copy(from, to);
  if (!copied.error) return;
  const { data, error } = await supabase.storage.from(BUCKET).download(from);
  if (error || !data) throw error ?? new Error('Download failed');
  const up = await supabase.storage.from(BUCKET).upload(to, data, { contentType: data.type || undefined });
  if (up.error) throw up.error;
}
