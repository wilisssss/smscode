import { describe, expect, it } from 'vitest'
import { isQuietHoursNow, setQuietHours } from './sound'

describe('jam tenang', () => {
  it('rentang normal 08:00→17:00', () => {
    setQuietHours({ enabled: true, start: '08:00', end: '17:00' })
    expect(isQuietHoursNow(new Date(2026, 0, 1, 7, 59))).toBe(false)
    expect(isQuietHoursNow(new Date(2026, 0, 1, 8, 0))).toBe(true)
    expect(isQuietHoursNow(new Date(2026, 0, 1, 12, 30))).toBe(true)
    expect(isQuietHoursNow(new Date(2026, 0, 1, 17, 0))).toBe(false)
  })

  it('tengah malam 22:00→07:00 mencakup lewat tengah malam', () => {
    setQuietHours({ enabled: true, start: '22:00', end: '07:00' })
    expect(isQuietHoursNow(new Date(2026, 0, 1, 23, 0))).toBe(true)
    expect(isQuietHoursNow(new Date(2026, 0, 2, 3, 0))).toBe(true)
    expect(isQuietHoursNow(new Date(2026, 0, 2, 6, 59))).toBe(true)
    expect(isQuietHoursNow(new Date(2026, 0, 2, 7, 0))).toBe(false)
    expect(isQuietHoursNow(new Date(2026, 0, 2, 12, 0))).toBe(false)
  })

  it('dimatikan → selalu false', () => {
    setQuietHours({ enabled: false, start: '00:00', end: '23:59' })
    expect(isQuietHoursNow(new Date(2026, 0, 1, 12, 0))).toBe(false)
  })
})
