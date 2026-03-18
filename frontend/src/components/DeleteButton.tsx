import { useState, useEffect, useRef } from 'react'

type Variant = 'icon' | 'text' | 'button'

export default function DeleteButton({
  onConfirm,
  message = 'This action cannot be undone.',
  label = 'Delete',
  variant = 'text',
  title,
}: {
  onConfirm: () => void
  message?: string
  label?: string
  variant?: Variant
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Move focus into dialog when it opens; restore on close
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus()
    }
  }, [open])

  function handleClose() {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  // Focus trap: keep Tab/Shift+Tab inside the dialog; Escape closes
  function handleDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      handleClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const TrashIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )

  return (
    <>
      {variant === 'icon' && (
        <button
          ref={triggerRef}
          onClick={() => setOpen(true)}
          title={title ?? 'Delete'}
          aria-label={title ?? 'Delete'}
          className="p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          <TrashIcon size={14} />
        </button>
      )}

      {variant === 'text' && (
        <button
          ref={triggerRef}
          onClick={() => setOpen(true)}
          className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
        >
          {label}
        </button>
      )}

      {variant === 'button' && (
        <button
          ref={triggerRef}
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-800 px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          <TrashIcon size={13} />
          {label}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onKeyDown={handleDialogKeyDown}
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 id="delete-dialog-title" className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Confirm Delete
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                ref={cancelRef}
                onClick={handleClose}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => { onConfirm(); handleClose() }}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium flex items-center gap-1.5"
              >
                <TrashIcon size={13} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
