// Template favorit — simpan kombinasi layanan+negara+operator+tier (product_id)
// ke localStorage untuk order cepat dari beranda. Maks 8 entri.
export interface Template {
  /** Tier PERSIS yang dipesan (order via product_id). */
  productId: number
  productName: string
  /** Harga & stok saat disimpan (referensi saja — order pakai harga tier saat itu). */
  price: number
  available: number
  serviceId: number
  serviceName: string
  serviceCode: string
  countryId: number
  countryName: string
  countryCode: string
  countryDialCode: string
  countryEmoji: string | null
  /** null = operator "Any". */
  operatorId: number | null
  operatorName: string
  savedAt: string
}

import { STORAGE_KEYS, readJson, writeJson } from './storage'

const STORAGE_KEY = STORAGE_KEYS.templates
const MAX_TEMPLATES = 8

export function listTemplates(): Template[] {
  const parsed = readJson<Template[]>(STORAGE_KEY, [])
  return Array.isArray(parsed) ? parsed : []
}

export function isTemplateSaved(productId: number): boolean {
  return listTemplates().some((t) => t.productId === productId)
}

export type ToggleResult = 'added' | 'removed' | 'full'

/** Toggle simpan/hapus. Bila penuh dan belum ada entri, mengembalikan 'full'. */
export function toggleTemplate(template: Omit<Template, 'savedAt'>): ToggleResult {
  const current = listTemplates()
  const existing = current.findIndex((t) => t.productId === template.productId)
  if (existing >= 0) {
    current.splice(existing, 1)
    persist(current)
    return 'removed'
  }
  if (current.length >= MAX_TEMPLATES) return 'full'
  persist([...current, { ...template, savedAt: new Date().toISOString() }])
  return 'added'
}

export function removeTemplate(productId: number): void {
  persist(listTemplates().filter((t) => t.productId !== productId))
}

function persist(templates: Template[]): void {
  writeJson(STORAGE_KEY, templates)
}
