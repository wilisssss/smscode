import { Badge } from './ui'
import type { OrderStatus } from '../lib/types'

const mapping: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'brand' }> = {
  ACTIVE: { label: 'Menunggu SMS', tone: 'warn' },
  OTP_RECEIVED: { label: 'OTP Diterima', tone: 'ok' },
  COMPLETED: { label: 'Selesai', tone: 'ok' },
  CANCELED: { label: 'Dibatalkan', tone: 'neutral' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'danger' },
}

export function StatusBadge({ status }: { status: OrderStatus | string }) {
  const item = mapping[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <Badge tone={item.tone}>
      {(status === 'ACTIVE' || status === 'OTP_RECEIVED') && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
      )}
      {item.label}
    </Badge>
  )
}
