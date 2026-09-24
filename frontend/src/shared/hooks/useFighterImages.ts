import { useEffect, useState } from 'react'

const OCTAGON_FIGHTERS_URL = 'https://api.octagon-api.com/fighters'
const IMAGE_CACHE_KEY = 'ufc-predictor:fighter-images:v1'
const IMAGE_CACHE_TTL = 1000 * 60 * 60 * 24

export type FighterImageRecord = {
  imgUrl: string | null
}

type CachePayload = {
  timestamp: number
  entries: Array<[string, FighterImageRecord]>
}

export function useFighterImages() {
  const [imageByName, setImageByName] = useState<Map<string, FighterImageRecord>>(() => readImageCache())
  const [loading, setLoading] = useState(imageByName.size === 0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadImages() {
      try {
        const cached = readImageCache()
        if (cached.size) {
          setImageByName(cached)
          setLoading(false)
        }

        const response = await fetch(OCTAGON_FIGHTERS_URL, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('Image API request failed.')

        const payload = await response.json()
        const fighters = getFighterCollection(payload)
        const next = new Map<string, FighterImageRecord>()

        for (const fighter of fighters) {
          if (!fighter || typeof fighter !== 'object') continue
          const record = fighter as Record<string, unknown>
          const name = getString(record.name) ?? getString(record.fullName) ?? getString(record.fighterName)
          const imgUrl = getString(record.imgUrl) ?? getString(record.imageUrl) ?? getString(record.image_url)
          if (!name || !imgUrl) continue
          next.set(normalizeFighterName(name), { imgUrl })
        }

        if (next.size) {
          setImageByName(next)
          writeImageCache(next)
        }
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') {
          setError('Fighter images are temporarily unavailable.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadImages()

    return () => controller.abort()
  }, [])

  return { imageByName, loading, error }
}

export function getFighterImageUrl(fighterName: string, imageByName: Map<string, FighterImageRecord>, localImageUrl?: string | null) {
  return localImageUrl || imageByName.get(normalizeFighterName(fighterName))?.imgUrl || null
}

// Characters that don't decompose via NFD (unlike \u00e9, \u00f1, \u00e7, ...) and would
// otherwise be dropped as punctuation, breaking name matching (e.g. B\u0142achowicz).
const NON_DECOMPOSING_LETTERS: Record<string, string> = {
  \u0142: 'l',
  \u0141: 'l',
  \u0111: 'd',
  \u0110: 'd',
  \u00f8: 'o',
  \u00d8: 'o',
  \u00df: 'ss',
  \u00e6: 'ae',
  \u00c6: 'ae',
  \u0153: 'oe',
  \u0152: 'oe',
}

export function normalizeFighterName(value: string) {
  const withMappedLetters = value.replace(
    /[\u0142\u0141\u0111\u0110\u00f8\u00d8\u00df\u00e6\u00c6\u0153\u0152]/g,
    (char) => NON_DECOMPOSING_LETTERS[char] ?? char,
  )

  return withMappedLetters
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function readImageCache() {
  try {
    const raw = window.localStorage.getItem(IMAGE_CACHE_KEY)
    if (!raw) return new Map<string, FighterImageRecord>()
    const parsed = JSON.parse(raw) as CachePayload
    if (!parsed.timestamp || Date.now() - parsed.timestamp > IMAGE_CACHE_TTL || !Array.isArray(parsed.entries)) {
      return new Map<string, FighterImageRecord>()
    }
    return new Map(parsed.entries)
  } catch {
    return new Map<string, FighterImageRecord>()
  }
}

function writeImageCache(entries: Map<string, FighterImageRecord>) {
  try {
    const payload: CachePayload = {
      timestamp: Date.now(),
      entries: Array.from(entries.entries()),
    }
    window.localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Image caching is a performance enhancement only.
  }
}

function getFighterCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  if (Array.isArray(record.fighters)) return record.fighters
  return Object.values(record)
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
