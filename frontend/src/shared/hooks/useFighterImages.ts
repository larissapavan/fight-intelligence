
export type FighterImageRecord = {
  imgUrl: string | null
}

// Photos come only from the locally bundled images; no remote image API is queried.
const EMPTY_IMAGES = new Map<string, FighterImageRecord>()

export function useFighterImages() {
  return { imageByName: EMPTY_IMAGES, loading: false, error: null as string | null }
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
