import { describe, expect, it } from 'vitest'
import { formatCountdown, formatIDR, formatNumber, maskPhone, msUntil } from './format'

describe('format', () => {
  it('formatIDR tanpa desimal', () => {
    expect(formatIDR(15000)).toContain('15.000')
    expect(formatIDR(15000)).toContain('Rp')
    expect(formatIDR(0)).toContain('0')
  })

  it('formatNumber memakai pemisah ribuan id-ID', () => {
    expect(formatNumber(1000000)).toBe('1.000.000')
  })

  it('maskPhone menyensor bagian tengah', () => {
    expect(maskPhone('+6281234567890')).toBe('+6281•••90')
    expect(maskPhone('1234567')).toBe('1234567') // pendek tidak disensor
  })

  it('msUntil = 0 untuk lampau', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(msUntil(past)).toBe(0)
    expect(msUntil(null)).toBe(0)
  })

  it('formatCountdown mm:ss / h:mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(65_000)).toBe('01:05')
    expect(formatCountdown(3_723_000)).toBe('1:02:03')
  })
})
