import { Marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Notes are stored as Markdown (written by the rich editor, see RichEditor.tsx). Notes from
 * before the editor are plain text, which reads as Markdown too: `breaks` keeps their single
 * line breaks. The editor parses with the same options, so what you edit is what you see.
 */
export const MARKED_OPTIONS = { gfm: true, breaks: true } as const;

const marked = new Marked(MARKED_OPTIONS);

// Links open in a new tab and can't reach back into the app.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
  // Checklist boxes are shown, not ticked, outside the editor.
  // (Only checklist boxes can appear: any other input becomes one too.)
  if (node.tagName === 'INPUT') {
    node.setAttribute('type', 'checkbox');
    node.setAttribute('disabled', '');
  }
});

const SANITIZE = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre', 'blockquote', 'hr',
    'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'input', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'type', 'checked', 'disabled', 'start', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
};

const cache = new Map<string, string>();

/** Safe HTML for a note. */
export function renderMarkdown(md: string): string {
  const hit = cache.get(md);
  if (hit !== undefined) return hit;
  const html = DOMPurify.sanitize(marked.parse(md, { async: false }), SANITIZE);
  if (cache.size > 500) cache.clear();
  cache.set(md, html);
  return html;
}

/** The note as plain text, for one-line previews and search results. */
export function plainText(md: string): string {
  const el = document.createElement('div');
  el.innerHTML = renderMarkdown(md).replace(/<\/(p|li|h\d|blockquote)>|<br\s*\/?>/g, '$& ');
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}
