import { useTranslation } from 'react-i18next'

import { localeTag } from '../../i18n/lang'

const LANGUAGES = [
  { id: 'pt-BR', label: 'PT', titleKey: 'language.ptLong' },
  { id: 'en-US', label: 'EN', titleKey: 'language.enLong' },
  { id: 'fr-FR', label: 'FR', titleKey: 'language.frLong' },
] as const

type LanguageSwitcherProps = {
  className?: string
}

export function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
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
      className={`type-tech inline-flex h-8 shrink-0 items-center border border-[var(--line-soft)] bg-[var(--surface-3)] p-0.5 text-[11px] font-bold uppercase tracking-[0.08em] ${className}`}
    >
      {LANGUAGES.map((language) => {
        const active = currentLang === language.id
        return (
          <button
            key={language.id}
            type="button"
            onClick={() => changeLanguage(language.id)}
            aria-pressed={active}
            title={t(language.titleKey)}
            className={`inline-flex h-full items-center px-2 transition cursor-pointer ${
              active
                ? 'bg-[var(--rule)] text-[var(--card-bg)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--action-hover-bg)] hover:text-[var(--text-main)]'
            }`}
          >
            {language.label}
          </button>
        )
      })}
    </div>
  )
}
