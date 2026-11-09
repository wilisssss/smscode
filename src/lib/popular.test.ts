import { beforeEach, describe, expect, it } from 'vitest'
import { matchPopular } from './popular'
import type { Service } from './types'

const svc = (id: number, code: string, name: string, active = true): Service => ({
  id,
  code,
  name,
  active,
})

beforeEach(() => {})

describe('matchPopular', () => {
  it('mencocokkan dari daftar katalog yang aktif', () => {
    const catalog = [
      svc(1, 'whatsapp', 'WhatsApp'),
      svc(2, 'telegram', 'Telegram'),
      svc(3, 'google', 'Google'),
      svc(4, 'nonaktif', 'Tidak Aktif', false),
    ]
    const matches = matchPopular(catalog)
    expect(matches.map((m) => m.service.name)).toEqual(['WhatsApp', 'Telegram', 'Google'])
  })

  it('tidak memasukkan layanan nonaktif', () => {
    expect(matchPopular([svc(1, 'wa', 'WhatsApp', false)])).toEqual([])
  })

  it('yang tidak ada di katalog dilewati (tidak error)', () => {
    expect(matchPopular([])).toEqual([])
  })

  it('case-insensitive (code "WA" cocok dgn keyword "wa")', () => {
    const matches = matchPopular([svc(1, 'WA', 'WhatsApp')])
    expect(matches).toHaveLength(1)
  })
})
