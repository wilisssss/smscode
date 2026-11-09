import { beforeEach, describe, expect, it } from 'vitest'
import { appendOtpLog, clearOtpLog, loadOtpLog, otpLogFor, type OtpLogEntry } from './otpLog'

function entry(orderId: number, revision: number, code: string | null): OtpLogEntry {
  return {
    id: `${orderId}:${revision}`,
    orderId,
    phone: '+6281234567890',
    smsRevision: revision,
    code,
    message: null,
    at: new Date().toISOString(),
  }
}

beforeEach(() => clearOtpLog())

describe('otpLog', () => {
  it('t menambah entri lalu membaca kembali', () => {
    appendOtpLog([entry(1, 1, '123456')])
    const log = loadOtpLog()
    expect(log).toHaveLength(1)
    expect(log[0].code).toBe('123456')
  })

  it('dedupe berdasarkan id (revision sama tidak ganda)', () => {
    appendOtpLog([entry(1, 1, '123456')])
    appendOtpLog([entry(1, 1, '123456')])
    expect(loadOtpLog()).toHaveLength(1)
  })

  it('otpLogFor mengurutkan revision tertinggi dulu', () => {
    appendOtpLog([entry(1, 1, '111111'), entry(1, 2, '222222'), entry(2, 1, '333333')])
    const perOrder = otpLogFor(1)
    expect(perOrder.map((e) => e.smsRevision)).toEqual([2, 1])
    expect(otpLogFor(2)).toHaveLength(1)
  })

  it('clearOtpLog mengosongkan storage', () => {
    appendOtpLog([entry(1, 1, '123456')])
    clearOtpLog()
    expect(loadOtpLog()).toEqual([])
  })
})
