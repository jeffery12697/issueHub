import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Image } from '@tiptap/extension-image'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { useEffect, useRef, useState } from 'react'

// Custom FontSize extension built on TextStyle
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize || null,
          renderHTML: (attrs) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any
  },
})

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']
const TEXT_COLORS = [
  '#18181b', '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#64748b',
]
const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bae6fd', '#e9d5ff', '#fecaca',
  '#fed7aa', '#fbcfe8', '#e2e8f0',
]

interface Props {
  value: string | null
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Add a description…',
  editable = true,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Link.configure({ openOnClick: !editable, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
    ],
    content: value ?? '',
    editable,
    onBlur({ editor }) {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[120px] px-4 py-3 text-slate-700',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = value ?? ''
    if (current !== incoming) editor.commands.setContent(incoming)
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent transition-colors bg-white dark:bg-slate-900">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">

      {/* Font size */}
      <FontSizePicker editor={editor} />

      <Divider />

      {/* Text style */}
      <ToolGroup>
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <em>I</em>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <span className="line-through">S</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <span className="font-mono text-[11px]">`c`</span>
        </ToolBtn>
      </ToolGroup>

      <Divider />

      {/* Text color */}
      <ColorPicker
        title="Text color"
        colors={TEXT_COLORS}
        active={(c) => editor.isActive('textStyle', { color: c })}
        onPick={(c) => editor.chain().focus().setColor(c).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
        indicator={(c) => (
          <span style={{ borderBottom: `3px solid ${c}` }} className="font-bold text-xs px-0.5">A</span>
        )}
      />

      {/* Highlight */}
      <ColorPicker
        title="Highlight"
        colors={HIGHLIGHT_COLORS}
        active={(c) => editor.isActive('highlight', { color: c })}
        onPick={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
        indicator={(c) => (
          <span style={{ background: c }} className="text-xs px-1 font-bold rounded-sm">H</span>
        )}
      />

      <Divider />

      {/* Headings */}
      <ToolGroup>
        {([1, 2, 3] as const).map((level) => (
          <ToolBtn
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            active={editor.isActive('heading', { level })}
            title={`Heading ${level}`}
          >
            H{level}
          </ToolBtn>
        ))}
      </ToolGroup>

      <Divider />

      {/* Lists */}
      <ToolGroup>
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <ListBulletIcon />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrderedIcon />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task list">
          <ChecklistIcon />
        </ToolBtn>
      </ToolGroup>

      <Divider />

      {/* Block */}
      <ToolGroup>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <QuoteIcon />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          <CodeIcon />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal rule">
          <HrIcon />
        </ToolBtn>
      </ToolGroup>

      <Divider />

      {/* Table */}
      <TableMenu editor={editor} />

      <Divider />

      {/* Image */}
      <ImageInsert editor={editor} />

      <Divider />

      {/* Undo / Redo */}
      <ToolGroup>
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} active={false} title="Undo">
          <UndoIcon />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} active={false} title="Redo">
          <RedoIcon />
        </ToolBtn>
      </ToolGroup>
    </div>
  )
}

// ── Font size picker ───────────────────────────────────────────────────────────

function FontSizePicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const current =
    (editor?.getAttributes('textStyle')?.fontSize as string | undefined) ?? ''

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value
        if (v) (editor?.chain().focus() as any).setFontSize(v).run()
        else (editor?.chain().focus() as any).unsetFontSize().run()
      }}
      className="h-7 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-1 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer"
      title="Font size"
    >
      <option value="">Size</option>
      {FONT_SIZES.map((s) => (
        <option key={s} value={s}>{s.replace('px', '')}</option>
      ))}
    </select>
  )
}

// ── Color / Highlight picker ───────────────────────────────────────────────────

function ColorPicker({
  title, colors, active, onPick, onClear, indicator,
}: {
  title: string
  colors: string[]
  active: (c: string) => boolean
  onPick: (c: string) => void
  onClear: () => void
  indicator: (activeColor: string) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeColor = colors.find(active) ?? colors[0]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v) }}
        title={title}
        className="w-7 h-7 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        {indicator(activeColor)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1 w-[120px]">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onPick(c); setOpen(false) }}
                  style={{ background: c, border: active(c) ? '2px solid #7c3aed' : '2px solid transparent' }}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                  title={c}
                />
              ))}
            </div>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onClear(); setOpen(false) }}
              className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-left"
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Table menu ─────────────────────────────────────────────────────────────────

function TableMenu({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const inTable = editor.isActive('table')

  const items = inTable
    ? [
        { label: 'Add column before', fn: () => editor.chain().focus().addColumnBefore().run() },
        { label: 'Add column after', fn: () => editor.chain().focus().addColumnAfter().run() },
        { label: 'Delete column', fn: () => editor.chain().focus().deleteColumn().run() },
        { label: 'Add row before', fn: () => editor.chain().focus().addRowBefore().run() },
        { label: 'Add row after', fn: () => editor.chain().focus().addRowAfter().run() },
        { label: 'Delete row', fn: () => editor.chain().focus().deleteRow().run() },
        { label: 'Merge / split cells', fn: () => editor.chain().focus().mergeOrSplit().run() },
        { label: 'Delete table', fn: () => editor.chain().focus().deleteTable().run(), danger: true },
      ]
    : [
        { label: 'Insert 3×3 table', fn: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      ]

  return (
    <div className="relative">
      <ToolBtn
        onClick={() => setOpen((v) => !v)}
        active={inTable}
        title="Table"
      >
        <TableIcon />
      </ToolBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[180px]">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); item.fn(); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${(item as any).danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Image insert ───────────────────────────────────────────────────────────────

function ImageInsert({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result as string }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      <ToolBtn onClick={() => inputRef.current?.click()} active={false} title="Insert image">
        <ImageIcon />
      </ToolBtn>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </>
  )
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function Divider() {
  return <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
}

function ToolBtn({ onClick, active, title, children }: {
  onClick: () => void; active: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition-colors ${
        active ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const ListBulletIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
    <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)
const ListOrderedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
    <path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </svg>
)
const ChecklistIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="6" height="6" rx="1" /><polyline points="4 8 6 10 8 7" />
    <line x1="13" y1="8" x2="21" y2="8" /><rect x="3" y="14" width="6" height="6" rx="1" />
    <line x1="13" y1="17" x2="21" y2="17" />
  </svg>
)
const QuoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </svg>
)
const CodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
)
const HrIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="2" y1="12" x2="22" y2="12" />
  </svg>
)
const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
  </svg>
)
const RedoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
  </svg>
)
const TableIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
)
const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)
