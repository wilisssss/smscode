// Tombol salin ke clipboard dengan feedback dan fallback multi-jalur.
import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { clsx } from 'clsx'

import { copyText } from '../lib/clipboard'

export function CopyButton({
  text,
  label,
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    if (!text) {
      toast.error('Tidak ada teks untuk disalin')
      return
    }
    const ok = await copyText(text)
    if (!ok) {
      toast.error('Gagal menyalin ke clipboard')
      return
    }
    setCopied(true)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      onClick={copy}
      aria-label={label ?? `Salin ${text}`}
      title={label ?? 'Salin ke clipboard'}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 h-8 w-8 rounded-lg text-muted',
        'hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors',
        className,
      )}
    >
      {copied ? (
        <Check size={15} className="text-emerald-400" aria-hidden />
      ) : (
        <Copy size={15} aria-hidden />
      )}
    </button>
  )
}
