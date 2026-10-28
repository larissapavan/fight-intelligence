import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

import { localeTag } from '../../i18n/lang'

const LANGUAGES = [
  { id: 'pt-BR', label: 'PT', titleKey: 'language.ptLong' },
  { id: 'en-US', label: 'EN', titleKey: 'language.enLong' },
  { id: 'fr-FR', label: 'FR', titleKey: 'language.frLong' },
] as const

type LanguageSwitcherProps = {
  className?: string
  compact?: boolean
}

export function LanguageSwitcher({ className = '', compact = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const currentLang = localeTag(i18n.resolvedLanguage ?? i18n.language)

  const changeLanguage = (lng: (typeof LANGUAGES)[number]['id']) => {
    if (currentLang !== lng) {
      i18n.changeLanguage(lng)
    }
  }

  return (
    <div
      role="group"
      aria-label={t('language.switch', 'Mudar idioma')}
      className={`inline-flex shrink-0 items-center rounded-full border border-white/14 bg-white/[0.04] p-0.5 text-xs font-semibold uppercase tracking-[0.1em] ${className}`}
    >
      {!compact && (
        <span className="hidden xs:inline-flex pl-2 pr-1 text-[var(--text-muted)]" aria-hidden="true">
          <Languages className="h-3.5 w-3.5" />
        </span>
      )}
      {LANGUAGES.map((language) => (
        <button
          key={language.id}
          type="button"
          onClick={() => changeLanguage(language.id)}
          aria-pressed={currentLang === language.id}
          title={t(language.titleKey)}
          className={`rounded-full px-2 py-1 transition-all ${
            currentLang === language.id
              ? 'bg-[#C8102E] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          {language.label}
        </button>
      ))}
    </div>
  )
}
