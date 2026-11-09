// API SMSCode tidak mengekspos "layanan populer", jadi daftar ini dikurasi di
// sisi klien dan di-match ke `GET /catalog/services` (case-insensitive,
// berdasarkan `code` atau substring `name`). Layanan yang tidak tersedia di
// katalog otomatis disembunyikan.
import {
  Bot,
  Briefcase,
  Camera,
  CirclePlay,
  Globe,
  Hash,
  MessageCircle,
  MessagesSquare,
  Send,
  Share2,
  type LucideIcon,
} from 'lucide-react'
import type { Service } from './types'

export interface PopularEntry {
  key: string
  /** Cocokkan ke `code` (exact, lowercase) atau substring pada `name`. */
  keywords: string[]
  icon: LucideIcon
  blurb: string
}

export const POPULAR_SERVICES: PopularEntry[] = [
  { key: 'whatsapp', keywords: ['whatsapp', 'wa'], icon: MessageCircle, blurb: 'Verifikasi akun' },
  { key: 'telegram', keywords: ['telegram', 'tg'], icon: Send, blurb: 'Kode login' },
  { key: 'google', keywords: ['google'], icon: Globe, blurb: 'Akun & Gmail' },
  { key: 'instagram', keywords: ['instagram', 'ig'], icon: Camera, blurb: 'Masuk & pemulihan' },
  { key: 'facebook', keywords: ['facebook', 'fb'], icon: Share2, blurb: 'Verifikasi akun' },
  { key: 'tiktok', keywords: ['tiktok'], icon: CirclePlay, blurb: 'Login & daftar' },
  { key: 'discord', keywords: ['discord'], icon: MessagesSquare, blurb: 'Kode verifikasi' },
  { key: 'x', keywords: ['x', 'twitter', 'tw'], icon: Hash, blurb: 'Masuk & keamanan' },
  { key: 'microsoft', keywords: ['microsoft'], icon: Briefcase, blurb: 'Outlook & akun' },
  { key: 'openai', keywords: ['openai', 'chatgpt', 'gpt'], icon: Bot, blurb: 'Kode OTP' },
]

export interface PopularMatch {
  entry: PopularEntry
  service: Service
}

/** Cocokkan kurasi populer dengan katalog aktif; urutan mengikuti kurasi. */
export function matchPopular(services: Service[]): PopularMatch[] {
  const active = services.filter((s) => s.active !== false)
  const used = new Set<number>()
  const matches: PopularMatch[] = []

  for (const entry of POPULAR_SERVICES) {
    const found = active.find((service) => {
      const code = service.code.toLowerCase()
      const name = service.name.toLowerCase()
      return entry.keywords.some((kw) => code === kw || name.includes(kw))
    })
    if (found && !used.has(found.id)) {
      used.add(found.id)
      matches.push({ entry, service: found })
    }
  }
  return matches
}
