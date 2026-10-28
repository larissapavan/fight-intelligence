export type UiLang = 'pt' | 'en' | 'fr'

export function uiLang(language: string | boolean | null | undefined): UiLang {
  if (language === true) return 'pt'
  if (language === false || language == null) return 'en'
  if (language.startsWith('pt')) return 'pt'
  if (language.startsWith('fr')) return 'fr'
  return 'en'
}

export function localeTag(language: string | boolean | null | undefined): 'pt-BR' | 'en-US' | 'fr-FR' {
  const lang = uiLang(language)
  if (lang === 'pt') return 'pt-BR'
  if (lang === 'fr') return 'fr-FR'
  return 'en-US'
}

/** The string for the active language. Omit `fr` only when the English text should stay as-is. */
export function L(language: string | boolean | null | undefined, pt: string, en: string, fr?: string): string {
  const lang = uiLang(language)
  if (lang === 'pt') return pt
  if (lang === 'fr') return fr ?? en
  return en
}
