import { renderMarkdown } from '../lib/markdown';

/** A saved note, rendered from its Markdown (sanitised in renderMarkdown). */
export default function NoteContent({ markdown, className = '' }: { markdown: string; className?: string }) {
  return <div className={`note-body prose ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />;
}
