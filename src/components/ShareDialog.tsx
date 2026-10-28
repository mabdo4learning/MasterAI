import { useEffect, useState, type FormEvent } from 'react';
import type { Subject } from '../subjects';
import { listDocuments, listImages, listNotes, type LectureDocument, type LectureImage, type Note } from '../lib/api';
import {
  createShare,
  deleteShare,
  listMyShares,
  listRecipients,
  removeRecipient,
  setLinkEnabled,
  shareUrl,
  shareWithEmail,
  type Recipient,
  type Share,
} from '../lib/sharing';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import Icon from './Icon';
import Sheet from './Sheet';
import { useToast } from './Toast';

type SessionRef = { id: string; number: number; topic: string };
type Props = { subject: Subject; session?: SessionRef; onClose: () => void };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const peopleCount = (n: number) => (n === 1 ? '1 person' : `${n} people`);

const sessionTitle = (s: SessionRef) => `Session ${s.number}${s.topic ? ` · ${s.topic}` : ''}`;

export const shareSummary = (s: Share) =>
  s.kind === 'subject'
    ? 'Whole subject'
    : s.kind === 'session'
      ? 'Whole session'
      : [
          s.noteIds.length && plural(s.noteIds.length, 'note'),
          s.imageIds.length && plural(s.imageIds.length, 'image'),
          s.documentIds.length && plural(s.documentIds.length, 'file'),
        ]
          .filter(Boolean)
          .join(', ');

/** Share a subject or a session (all of it, or chosen notes and files) with a link or by email. */
export default function ShareDialog({ subject, session, onClose }: Props) {
  const toast = useToast();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [open, setOpen] = useState<string | 'new' | null>(null);

  useEffect(() => {
    listMyShares(subject.slug)
      .then((all) => {
        const mine = all.filter((s) => (session ? s.sessionId === session.id : s.kind === 'subject'));
        setShares(mine);
        // One share and nothing else to choose from: go straight to it.
        setOpen(mine.length === 0 ? 'new' : mine.length === 1 && (!session || mine[0].kind === 'session') ? mine[0].id : null);
      })
      .catch((e) => {
        toast(/schema cache|does not exist/.test(e.message) ? 'Sharing is not set up yet: run migrations-008-sharing.sql in Supabase.' : e.message, 'error');
        onClose();
      });
    // Keyed on the ids only: callers pass fresh objects and callbacks on every render.
  }, [subject.slug, session?.id]);

  const title = session ? `Share ${sessionTitle(session)}` : `Share ${subject.title}`;
  const current = shares?.find((s) => s.id === open);
  const hasWhole = !!shares?.some((s) => s.kind !== 'items');

  return (
    <Sheet title={title} onClose={onClose}>
      {shares === null ? (
        <div className="skeleton-block note-skeleton" />
      ) : current ? (
        <ShareManager
          share={current}
          onBack={shares.length > 1 || session ? () => setOpen(null) : undefined}
          onChange={(next) => setShares(shares.map((s) => (s.id === next.id ? next : s)))}
          onDeleted={() => {
            const rest = shares.filter((s) => s.id !== current.id);
            setShares(rest);
            setOpen(rest.length ? null : 'new');
          }}
        />
      ) : open === 'new' ? (
        <CreateShare
          subject={subject}
          session={session}
          wholeTaken={hasWhole}
          onCancel={shares.length ? () => setOpen(null) : undefined}
          onCreated={(s) => {
            setShares([s, ...shares]);
            setOpen(s.id);
          }}
        />
      ) : (
        <div className="share-list">
          <p className="muted small">Already shared from here. Open one to copy its link or see who has access.</p>
          <ul>
            {shares.map((s) => (
              <li key={s.id}>
                <button className="share-row" onClick={() => setOpen(s.id)}>
                  <span className="share-row-icon">
                    <Icon name={s.kind === 'items' ? 'note' : 'share'} size={16} />
                  </span>
                  <span className="share-row-text">
                    <strong>{shareSummary(s)}</strong>
                    <span className="muted small">
                      {peopleCount(s.recipientCount)}
                      {' · '}
                      {s.linkEnabled ? 'link on' : 'link off'}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-outline" onClick={() => setOpen('new')}>
            <Icon name="plus" size={16} /> New share
          </button>
        </div>
      )}
    </Sheet>
  );
}

function CreateShare({
  subject,
  session,
  wholeTaken,
  onCancel,
  onCreated,
}: {
  subject: Subject;
  session?: SessionRef;
  wholeTaken: boolean;
  onCancel?: () => void;
  onCreated: (s: Share) => void;
}) {
  const toast = useToast();
  const profile = useProfile();
  const email = useAuth().session?.user.email ?? '';
  const [mode, setMode] = useState<'whole' | 'items'>(wholeTaken ? 'items' : 'whole');
  const [items, setItems] = useState<{ notes: Note[]; images: LectureImage[]; documents: LectureDocument[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session || mode !== 'items' || items) return;
    Promise.all([listNotes(session.id), listImages(session.id), listDocuments(session.id)])
      .then(([notes, images, documents]) => setItems({ notes, images, documents }))
      .catch((e) => toast(e.message, 'error'));
  }, [session, mode, items, toast]);

  const toggle = (id: string) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async () => {
    setBusy(true);
    const ownerName = profile.name || email;
    try {
      let share: Share;
      if (!session) {
        share = await createShare({ kind: 'subject', subjectSlug: subject.slug, title: subject.title, ownerName });
      } else if (mode === 'whole') {
        share = await createShare({ kind: 'session', subjectSlug: subject.slug, sessionId: session.id, title: sessionTitle(session), ownerName });
      } else {
        const noteIds = items!.notes.filter((n) => picked.has(n.id)).map((n) => n.id);
        const imageIds = items!.images.filter((i) => picked.has(i.id)).map((i) => i.id);
        const documentIds = items!.documents.filter((d) => picked.has(d.id)).map((d) => d.id);
        const what = [
          noteIds.length && plural(noteIds.length, 'note'),
          imageIds.length && plural(imageIds.length, 'image'),
          documentIds.length && plural(documentIds.length, 'file'),
        ]
          .filter(Boolean)
          .join(', ');
        share = await createShare({
          kind: 'items',
          subjectSlug: subject.slug,
          sessionId: session.id,
          noteIds,
          imageIds,
          documentIds,
          title: `${what} from ${sessionTitle(session)}`,
          ownerName,
        });
      }
      onCreated(share);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const nothingPicked = mode === 'items' && picked.size === 0;
  const total = items ? items.notes.length + items.images.length + items.documents.length : 0;

  return (
    <div className="share-create">
      <p className="muted">
        {session
          ? 'People you share with see it read-only, always up to date, and can copy it into their own notebook.'
          : `People you share with see every session of ${subject.title} read-only, always up to date, and can copy it into their own notebook.`}
      </p>

      {session && (
        <div className="mode-options share-modes" role="radiogroup" aria-label="What to share">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'whole'}
            className={`mode-option${mode === 'whole' ? ' active' : ''}`}
            onClick={() => setMode('whole')}
            disabled={wholeTaken}
          >
            <span>Whole session</span>
            <span className="muted small">{wholeTaken ? 'Already shared' : 'Notes, images, files and exam questions'}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'items'}
            className={`mode-option${mode === 'items' ? ' active' : ''}`}
            onClick={() => setMode('items')}
          >
            <span>Choose items</span>
            <span className="muted small">Only the notes and files you tick</span>
          </button>
        </div>
      )}

      {session && mode === 'items' && (
        <div className="pick-list">
          {items === null ? (
            <div className="skeleton-block note-skeleton" />
          ) : total === 0 ? (
            <p className="empty-line">This session has no notes or files yet.</p>
          ) : (
            <>
              <div className="pick-head">
                <span className="muted small">{picked.size} selected</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() =>
                    setPicked(
                      picked.size === total
                        ? new Set()
                        : new Set([...items.notes, ...items.images, ...items.documents].map((x) => x.id)),
                    )
                  }
                >
                  {picked.size === total ? 'Select none' : 'Select all'}
                </button>
              </div>
              <ul>
                {items.notes.map((n) => (
                  <li key={n.id}>
                    <label className="pick">
                      <input type="checkbox" checked={picked.has(n.id)} onChange={() => toggle(n.id)} />
                      <Icon name="note" size={15} />
                      <span className="pick-text">{n.body}</span>
                    </label>
                  </li>
                ))}
                {items.images.map((i) => (
                  <li key={i.id}>
                    <label className="pick">
                      <input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
                      <img src={i.url} alt="" className="pick-thumb" />
                      <span className="pick-text">{i.fileName}</span>
                    </label>
                  </li>
                ))}
                {items.documents.map((d) => (
                  <li key={d.id}>
                    <label className="pick">
                      <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} />
                      <Icon name="file" size={15} />
                      <span className="pick-text">{d.fileName}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="compose-actions">
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Back
          </button>
        )}
        <button className="btn" onClick={create} disabled={busy || nothingPicked}>
          <Icon name="link" size={16} />
          {busy ? 'Creating…' : 'Create share link'}
        </button>
      </div>
    </div>
  );
}

/** The link, the on/off switch, adding people by email and the list of who has access. */
export function ShareManager({
  share,
  onBack,
  onChange,
  onDeleted,
}: {
  share: Share;
  onBack?: () => void;
  onChange: (s: Share) => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [people, setPeople] = useState<Recipient[] | null>(null);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const url = shareUrl(share.token);

  useEffect(() => {
    listRecipients(share.id)
      .then(setPeople)
      .catch((e) => toast(e.message, 'error'));
  }, [share.id, toast]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      (document.getElementById(`share-link-${share.id}`) as HTMLInputElement | null)?.select();
      toast('Select the link and copy it', 'error');
    }
  };

  const nativeShare = () =>
    navigator.share({ title: share.title, text: `My lecture notes: ${share.title}`, url }).catch(() => {});

  const toggleLink = async () => {
    const next = !share.linkEnabled;
    onChange({ ...share, linkEnabled: next });
    try {
      await setLinkEnabled(share.id, next);
      toast(next ? 'Link turned on' : 'Link turned off — people who already opened it keep access');
    } catch (e) {
      onChange({ ...share, linkEnabled: !next });
      toast((e as Error).message, 'error');
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setAdding(true);
    try {
      await shareWithEmail(share.id, value);
      const list = await listRecipients(share.id);
      setPeople(list);
      onChange({ ...share, recipientCount: list.length });
      setEmail('');
      toast(`Shared with ${value}`);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (r: Recipient) => {
    try {
      await removeRecipient(share.id, r.userId);
      const list = (people ?? []).filter((p) => p.userId !== r.userId);
      setPeople(list);
      onChange({ ...share, recipientCount: list.length });
      toast(`${r.name || r.email} no longer has access`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const stop = async () => {
    try {
      await deleteShare(share.id);
      toast('Stopped sharing');
      onDeleted();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="share-manage">
      <div className="share-what">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="arrowLeft" size={16} />
          </button>
        )}
        <div>
          <strong>{share.title}</strong>
          <span className="muted small">{shareSummary(share)} · read-only, always up to date</span>
        </div>
      </div>

      <section className="share-block">
        <div className="share-block-head">
          <h3>
            <Icon name="link" size={15} /> Link
          </h3>
          <label className="switch">
            <input type="checkbox" checked={share.linkEnabled} onChange={toggleLink} />
            <span className="switch-track" aria-hidden />
            <span className="sr-only">Link on</span>
          </label>
        </div>
        {share.linkEnabled ? (
          <>
            <div className="share-link">
              <input id={`share-link-${share.id}`} type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
              <button className="btn btn-sm" onClick={copy}>
                <Icon name="copy" size={15} /> Copy
              </button>
              {'share' in navigator && (
                <button className="btn btn-outline btn-sm" onClick={nativeShare} aria-label="Send link">
                  <Icon name="share" size={15} />
                  <span className="hide-mobile">Send</span>
                </button>
              )}
            </div>
            <p className="muted small">Anyone with a free account who opens this link can view it. Turn it off at any time.</p>
          </>
        ) : (
          <p className="muted small">The link is off. Nobody new can open it; people below keep access.</p>
        )}
      </section>

      <section className="share-block">
        <h3>
          <Icon name="mail" size={15} /> Add by email
        </h3>
        <form className="share-email" onSubmit={add}>
          <input
            type="email"
            value={email}
            placeholder="classmate@example.com"
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Their account email"
          />
          <button className="btn btn-sm" disabled={adding || !email.trim()}>
            {adding ? 'Adding…' : 'Share'}
          </button>
        </form>
        <p className="muted small">They need an account here. It shows up under “Shared with you” on their dashboard.</p>
      </section>

      <section className="share-block">
        <h3>
          <Icon name="users" size={15} /> People with access {people && people.length > 0 && <span className="count">{people.length}</span>}
        </h3>
        {people === null ? (
          <div className="skeleton-block note-skeleton" />
        ) : people.length === 0 ? (
          <p className="empty-line">Nobody yet. Send the link or add someone by email.</p>
        ) : (
          <ul className="people">
            {people.map((p) => (
              <li key={p.userId}>
                <span className="avatar" aria-hidden>
                  {(p.name || p.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="people-text">
                  <strong>{p.name || p.email}</strong>
                  <span className="muted small">
                    {p.name ? `${p.email} · ` : ''}
                    {p.via === 'email' ? 'added by email' : 'opened the link'}
                  </span>
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(p)} aria-label={`Remove ${p.name || p.email}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="share-stop">
        {confirmStop ? (
          <>
            <span className="muted small">Everyone loses access and the link stops working.</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmStop(false)}>
              Cancel
            </button>
            <button className="btn btn-sm danger-fill" onClick={stop}>
              Stop sharing
            </button>
          </>
        ) : (
          <button className="btn btn-outline btn-sm danger-outline" onClick={() => setConfirmStop(true)}>
            <Icon name="trash" size={15} /> Stop sharing
          </button>
        )}
      </div>
    </div>
  );
}
