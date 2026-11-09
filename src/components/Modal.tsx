// Modal sederhana: backdrop blur, Escape untuk tutup, fokus ke panel.
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="Tutup"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] cursor-default"
        onClick={onClose}
      />
      <div className={clsx('relative card w-full p-0 overflow-hidden', width)}>
        <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-5 pb-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold tracking-wide">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-lg text-muted hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-5 max-h-[62vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-4 sm:px-6 py-4 border-t border-line flex flex-wrap items-center justify-end gap-2 bg-[var(--color-panel-2)]/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
