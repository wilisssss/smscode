import { beforeEach, describe, expect, it } from 'vitest'
import { readJson, writeJson } from './storage'

beforeEach(() => localStorage.clear())

describe('storage helper', () => {
  it('round-trip JSON', () => {
    writeJson('k', { a: 1 })
    expect(readJson('k', null)).toEqual({ a: 1 })
  })

  it('kembali ke fallback untuk key kosong / JSON rusak', () => {
    expect(readJson('missing', 42)).toBe(42)
    localStorage.setItem('broken', '{oops')
    expect(readJson('broken', 0)).toBe(0)
  })
})
