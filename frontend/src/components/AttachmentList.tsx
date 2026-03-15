import { useRef } from 'react'
import { useAttachments, useUploadAttachment, useDeleteAttachment, type Attachment } from '@/api/attachments'
import { useAuthStore } from '@/store/authStore'

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return '🖼'
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜'
  if (mime.startsWith('video/')) return '🎬'
  return '📎'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Props = {
  taskId: string
  commentId?: string | null
}

export default function AttachmentList({ taskId, commentId = null }: Props) {
  const currentUser = useAuthStore((s) => s.user)
  const { data: attachments = [] } = useAttachments(taskId, commentId)
  const upload = useUploadAttachment(taskId)
  const remove = useDeleteAttachment(taskId)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach((file) => {
      upload.mutate({ file, commentId })
    })
  }

  return (
    <div className="mt-2">
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att) => (
            <AttachmentChip
              key={att.id}
              att={att}
              canDelete={att.uploaded_by === currentUser?.id}
              onDelete={() => remove.mutate({ attachmentId: att.id, commentId })}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-50"
      >
        <span className="text-base leading-none">⊕</span>
        {upload.isPending ? 'Uploading…' : 'Attach file'}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}

function AttachmentChip({
  att,
  canDelete,
  onDelete,
}: {
  att: Attachment
  canDelete: boolean
  onDelete: () => void
}) {
  const isImage = att.mime_type.startsWith('image/')

  return (
    <li className="group flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 max-w-[220px]">
      {isImage ? (
        <a href={att.url} target="_blank" rel="noopener noreferrer">
          <img
            src={att.url}
            alt={att.filename}
            className="w-8 h-8 object-cover rounded shrink-0"
          />
        </a>
      ) : (
        <span className="text-base shrink-0">{fileIcon(att.mime_type)}</span>
      )}

      <div className="flex-1 min-w-0">
        <a
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate font-medium hover:text-violet-600 transition-colors"
          title={att.filename}
        >
          {att.filename}
        </a>
        <span className="text-slate-400">{formatBytes(att.size)}</span>
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Remove"
        >
          ✕
        </button>
      )}
    </li>
  )
}
