import { beforeEach, describe, expect, it } from 'vitest'
import { listTemplates, removeTemplate, toggleTemplate, type Template } from './templates'

function template(productId: number): Omit<Template, 'savedAt'> {
  return {
    productId,
    productName: 'WhatsApp Indonesia',
    price: 15000,
    available: 42,
    serviceId: 1,
    serviceName: 'WhatsApp',
    serviceCode: 'wa',
    countryId: 6,
    countryName: 'Indonesia',
    countryCode: 'ID',
    countryDialCode: '62',
    countryEmoji: '🇮🇩',
    operatorId: null,
    operatorName: 'Any',
  }
}

beforeEach(() => localStorage.clear())

describe('templates', () => {
  it('toggle add → remove', () => {
    expect(toggleTemplate(template(1))).toBe('added')
    expect(listTemplates()).toHaveLength(1)
    expect(toggleTemplate(template(1))).toBe('removed')
    expect(listTemplates()).toHaveLength(0)
  })

  it('menolak bila sudah 8', () => {
    for (let i = 1; i <= 8; i++) expect(toggleTemplate(template(i))).toBe('added')
    expect(toggleTemplate(template(9))).toBe('full')
  })

  it('removeTemplate menghapus satu', () => {
    toggleTemplate(template(1))
    toggleTemplate(template(2))
    removeTemplate(1)
    expect(listTemplates().map((t) => t.productId)).toEqual([2])
  })
})
