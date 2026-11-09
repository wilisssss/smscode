// Navigasi bawah khusus layar kecil (Android/HP). Di desktop sidebar tetap dipakai.
import { History, Inbox, Settings, Zap } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const items = [
  { to: '/', label: 'Order', icon: Zap, end: true },
  { to: '/aktif', label: 'Aktif', icon: Inbox, end: false, badge: true },
  { to: '/riwayat', label: 'Riwayat', icon: History, end: false },
  { to: '/pengaturan', label: 'Setelan', icon: Settings, end: false },
]

export function MobileNav({ activeCount }: { activeCount: number }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-line bg-[var(--color-panel)]"
      // Hormati gesture bar / safe area Android.
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navigasi utama"
    >
      <div className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-indigo-300'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
              )
            }
          >
            <span className="relative">
              <Icon size={20} aria-hidden />
              {badge && activeCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold leading-4 text-center">
                  {activeCount}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
