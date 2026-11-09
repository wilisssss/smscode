// Command palette (Ctrl/Cmd+K): navigasi halaman + pencarian layanan → langsung ke langkah Negara.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Inbox,
  type LucideIcon,
  Search,
  Settings,
  Zap,
} from 'lucide-react'
import { clsx } from 'clsx'

import { listServices } from '../lib/api'

interface PaletteItem {
  id: string
  title: string
  hint: string
  icon: LucideIcon
  run: () => void
}

const NAV_ITEMS: Array<Omit<PaletteItem, 'run'> & { path: string }> = [
  { id: 'nav-home', title: 'Order Baru', hint: 'Ctrl+1', icon: Zap, path: '/' },
  { id: 'nav-active', title: 'Order Aktif', hint: 'Ctrl+2', icon: Inbox, path: '/aktif' },
  { id: 'nav-history', title: 'Riwayat', hint: 'Ctrl+3', icon: History, path: '/riwayat' },
  { id: 'nav-settings', title: 'Pengaturan', hint: 'Ctrl+4', icon: Settings, path: '/pengaturan' },
]

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const servicesQuery = useQuery({
    queryKey: ['catalog-services'],
    queryFn: () => listServices(),
    staleTime: 5 * 60_000,
  })

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const navs = NAV_ITEMS.filter(
      (item) => !q || item.title.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q),
    ).map((item) => ({ ...item, run: () => navigate(item.path) }))
    if (!q) return navs
    const svc = (servicesQuery.data ?? [])
      .filter((s) => s.active !== false && (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((s) => ({
        id: `svc-${s.id}`,
        title: `Order ${s.name}`,
        hint: s.code.toUpperCase(),
        icon: Zap,
        run: () => navigate('/', { state: { focusServiceId: s.id } }),
      }))
    return [...navs, ...svc]
  }, [navigate, query, servicesQuery.data])

  // Reset seleksi saat hasil berubah; fokus input saat dibuka.
  useEffect(() => {
    setIndex(0)
  }, [query])
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Gulir item terpilih ke dalam view
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const run = (item: PaletteItem | undefined) => {
    if (!item) return
    item.run()
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(items[index])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]" aria-label="Tutup palette" onClick={onClose} />
      <div className="relative card w-full max-w-lg overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={16} className="text-muted shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cari halaman atau layanan…"
            aria-label="Cari halaman atau layanan"
            aria-activedescendant={items[index]?.id}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="text-xs text-muted border border-line rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted px-3 py-6 text-center">Tidak ada yang cocok.</p>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                id={item.id}
                role="option"
                aria-selected={idx === index}
                data-active={idx === index}
                onMouseEnter={() => setIndex(idx)}
                onClick={() => run(item)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 h-10 rounded-lg text-left text-sm transition-colors',
                  idx === index ? 'bg-indigo-500/15 text-indigo-300' : 'text-[var(--color-text)]',
                )}
              >
                <item.icon size={16} className="shrink-0 text-muted" aria-hidden />
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-xs uppercase tracking-wider text-muted shrink-0">{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
