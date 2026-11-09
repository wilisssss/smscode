import { memo } from 'react'
import { History, Inbox, Settings, Zap } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import pkg from '../../package.json'

const items = [
  { to: '/', label: 'Order Baru', icon: Zap, end: true },
  { to: '/aktif', label: 'Order Aktif', icon: Inbox, end: false },
  { to: '/riwayat', label: 'Riwayat', icon: History, end: false },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings, end: false },
]

function LogoMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" role="img" aria-label="SMSCode Desktop">
      <defs>
        <linearGradient id="side-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#312e81" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="15" fill="url(#side-bg)" />
      <path
        fill="#eef2ff"
        d="M32 13c-12 0-21.5 7.4-21.5 16.6 0 5.2 3.1 9.8 7.8 12.8-.6 3.1-2.4 6.2-4.7 8.3-.9.8.1 2.6 1.2 2.2 5.3-1.7 9.8-4.2 13.2-6.6 1.2.2 2.6.3 4 .3 12 0 21.5-7.4 21.5-16.6S44 13 32 13Z"
      />
      <circle cx="24.5" cy="30" r="2.8" fill="#4f46e5" />
      <circle cx="32" cy="30" r="2.8" fill="#4f46e5" />
      <circle cx="39.5" cy="30" r="2.8" fill="#4f46e5" />
    </svg>
  )
}

export const Sidebar = memo(function Sidebar({ activeCount }: { activeCount: number }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 h-full flex-col border-r border-line bg-[var(--color-panel)]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <LogoMark />
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight">SMSCode</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Desktop</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 flex flex-col gap-1" aria-label="Navigasi utama">
        {items.map(({ to, label, icon: Icon, end }, idx) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={`${label} (Ctrl+${idx + 1})`}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  aria-hidden
                  className={clsx(isActive ? 'text-indigo-300' : 'text-[var(--color-muted)] group-hover:text-[var(--color-text)]')}
                />
                <span className="flex-1">{label}</span>
                {to === '/aktif' && activeCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-500 text-white text-xs font-bold inline-flex items-center justify-center">
                    {activeCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-5 pb-5 pt-6">
        <div className="rounded-xl border border-line bg-[var(--color-panel-2)]/50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Koneksi</p>
          <p className="text-xs mt-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" aria-hidden />
            api.smscode.gg · v1
          </p>
        </div>
        <p className="mt-3 text-xs text-muted/70 px-1">v{pkg.version} · MIT · dibuat untuk Arch Linux</p>
      </div>
    </aside>
  )
})
