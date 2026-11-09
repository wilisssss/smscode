// Primitif UI kecil dan konsisten (bukan library besar).
import { Loader2, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

// ── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'ok' | 'danger' | 'ghost' | 'outline'
type ButtonSize = 'sm' | 'md'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-500 hover:bg-indigo-400 text-white border border-indigo-400/40 shadow-[0_8px_24px_rgba(99,102,241,0.35)]',
  ok: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 border border-emerald-400/40',
  danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40',
  outline:
    'bg-transparent hover:bg-[var(--color-panel-2)] text-[var(--color-text)] border border-[var(--color-line-strong)]',
  ghost: 'bg-transparent hover:bg-[var(--color-panel-2)] text-[var(--color-text)] border border-transparent',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium tracking-wide transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

// ── Input & Select ───────────────────────────────────────────────────────────
const fieldBase =
  'w-full h-10 px-3 rounded-xl bg-[var(--color-panel-2)] border border-[var(--color-line)] text-sm ' +
  'placeholder:text-[var(--color-muted)] transition-colors'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(fieldBase, className)} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx(fieldBase, 'appearance-none pr-8', className)}>
      {children}
    </select>
  )
}

// ── Badge ────────────────────────────────────────────────────────────────────
type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'brand'
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-panel-2)] text-[var(--color-muted)] border-[var(--color-line)]',
  ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warn: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  brand: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium tracking-wide',
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 size={26} className="animate-spin text-indigo-400" aria-hidden />
      {label && <p className="text-sm text-muted">{label}</p>}
      <span className="sr-only">Memuat…</span>
    </div>
  )
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center">
        <Icon size={26} className="text-[var(--color-muted)]" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ── Skeleton grid (loading placeholder) ─────────────────────────────────────
export function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton h-28" />
      ))}
    </div>
  )
}
