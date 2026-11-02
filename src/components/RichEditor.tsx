import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Markdown } from '@tiptap/markdown';
import { MARKED_OPTIONS } from '../lib/markdown';
import Icon, { type IconName } from './Icon';

type Props = {
  /** Markdown to start with. Read once; remount (change `key`) to load different content. */
  initial?: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** ⌘/Ctrl + Enter. */
  onSubmit?: () => void;
  /** Escape. */
  onCancel?: () => void;
  disabled?: boolean;
  label?: string;
};

/**
 * The note editor: formatting with a toolbar, keyboard shortcuts (⌘B, ⌘I…) or Markdown as you
 * type ("# ", "- ", "1. ", "[ ] ", "> ", **bold**). Saves Markdown.
 */
export default function RichEditor({ initial = '', onChange, placeholder, autoFocus, onSubmit, onCancel, disabled, label }: Props) {
  // The editor is created once; keep the latest callbacks in refs.
  const handlers = useRef({ onChange, onSubmit, onCancel });
  handlers.current = { onChange, onSubmit, onCancel };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write a note…' }),
      Markdown.configure({ markedOptions: MARKED_OPTIONS }),
    ],
    content: initial,
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    editable: !disabled,
    editorProps: {
      attributes: { class: 'prose', 'aria-label': label ?? 'Note', 'aria-multiline': 'true', role: 'textbox' },
      handleKeyDown: (_view, e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && handlers.current.onSubmit) {
          e.preventDefault();
          handlers.current.onSubmit();
          return true;
        }
        if (e.key === 'Escape' && handlers.current.onCancel) {
          handlers.current.onCancel();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => handlers.current.onChange(editor.isEmpty ? '' : editor.getMarkdown().trim()),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className={`rich-editor${disabled ? ' disabled' : ''}`}>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="rich-content" />
    </div>
  );
}

type Tool = { icon: IconName | 'h2' | 'h3'; label: string; keys?: string; active: boolean; run: () => void };

function Toolbar({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false);

  // Re-render the toolbar only when the formatting at the cursor changes.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const groups: Tool[][] = [
    [
      { icon: 'bold', label: 'Bold', keys: '⌘B', active: s.bold, run: () => chain().toggleBold().run() },
      { icon: 'italic', label: 'Italic', keys: '⌘I', active: s.italic, run: () => chain().toggleItalic().run() },
      { icon: 'underline', label: 'Underline', keys: '⌘U', active: s.underline, run: () => chain().toggleUnderline().run() },
      { icon: 'strike', label: 'Strikethrough', keys: '⌘⇧S', active: s.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { icon: 'h2', label: 'Heading', keys: '## ', active: s.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { icon: 'h3', label: 'Subheading', keys: '### ', active: s.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { icon: 'list', label: 'Bulleted list', keys: '- ', active: s.bullet, run: () => chain().toggleBulletList().run() },
      { icon: 'listOrdered', label: 'Numbered list', keys: '1. ', active: s.ordered, run: () => chain().toggleOrderedList().run() },
      { icon: 'taskList', label: 'Checklist', keys: '[ ] ', active: s.task, run: () => chain().toggleTaskList().run() },
    ],
    [
      { icon: 'quote', label: 'Quote', keys: '> ', active: s.quote, run: () => chain().toggleBlockquote().run() },
      { icon: 'code', label: 'Code', keys: '`code`', active: s.code, run: () => chain().toggleCode().run() },
      { icon: 'link', label: 'Link', keys: '⌘K', active: s.link || linking, run: () => setLinking((l) => !l) },
    ],
  ];

  // ⌘K opens the link field.
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLinking(true);
      }
    };
    dom.addEventListener('keydown', onKey);
    return () => dom.removeEventListener('keydown', onKey);
  }, [editor]);

  return (
    <div className="rich-toolbar" role="toolbar" aria-label="Formatting">
      {groups.map((g, i) => (
        <div key={i} className="rich-group">
          {g.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`rich-btn${t.active ? ' active' : ''}`}
              aria-label={t.label}
              aria-pressed={t.active}
              title={t.keys ? `${t.label}  ${t.keys}` : t.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
            >
              {t.icon === 'h2' || t.icon === 'h3' ? <span className="rich-h">{t.icon.toUpperCase()}</span> : <Icon name={t.icon} size={16} />}
            </button>
          ))}
        </div>
      ))}
      <div className="rich-group rich-history">
        <button type="button" className="rich-btn" aria-label="Undo" title="Undo  ⌘Z" disabled={!s.canUndo} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().undo().run()}>
          <Icon name="undo" size={16} />
        </button>
        <button type="button" className="rich-btn" aria-label="Redo" title="Redo  ⌘⇧Z" disabled={!s.canRedo} onMouseDown={(e) => e.preventDefault()} onClick={() => chain().redo().run()}>
          <Icon name="redo" size={16} />
        </button>
      </div>
      {linking && <LinkField editor={editor} onDone={() => setLinking(false)} />}
    </div>
  );
}

function LinkField({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [href, setHref] = useState<string>(() => editor.getAttributes('link').href ?? '');

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const value = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!value) chain.unsetLink().run();
    else {
      const url = /^(https?:|mailto:|tel:)/i.test(value) ? value : `https://${value}`;
      if (editor.state.selection.empty && !editor.isActive('link')) {
        // No text selected: insert the address itself as the link text.
        chain.insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href: url } }] }).run();
      } else chain.setLink({ href: url }).run();
    }
    onDone();
  };

  return (
    <form className="rich-link" onSubmit={apply}>
      <Icon name="link" size={15} />
      <input
        type="text"
        inputMode="url"
        autoFocus
        value={href}
        placeholder="Paste a link and press Enter"
        aria-label="Link address"
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onDone();
            editor.commands.focus();
          }
        }}
      />
      {editor.isActive('link') && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => (editor.chain().focus().extendMarkRange('link').unsetLink().run(), onDone())}>
          Remove
        </button>
      )}
      <button className="btn btn-sm">Apply</button>
    </form>
  );
}
