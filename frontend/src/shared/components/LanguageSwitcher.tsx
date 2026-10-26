import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

type LanguageSwitcherProps = {
  className?: string
  compact?: boolean
}

export function LanguageSwitcher({ className = '', compact = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const currentLang = i18n.resolvedLanguage?.startsWith('pt') ? 'pt-BR' : 'en-US'

  const changeLanguage = (lng: 'pt-BR' | 'en-US') => {
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
      <button
        type="button"
        onClick={() => changeLanguage('pt-BR')}
        aria-pressed={currentLang === 'pt-BR'}
        title={t('language.ptLong', 'Português')}
        className={`rounded-full px-2 py-1 transition-all ${
          currentLang === 'pt-BR'
            ? 'bg-[#C8102E] text-white shadow-sm'
            : 'text-[var(--text-muted)] hover:text-white'
        }`}
      >
        PT
      </button>
      <button
        type="button"
        onClick={() => changeLanguage('en-US')}
        aria-pressed={currentLang === 'en-US'}
        title={t('language.enLong', 'Inglês')}
        className={`rounded-full px-2 py-1 transition-all ${
          currentLang === 'en-US'
            ? 'bg-[#C8102E] text-white shadow-sm'
            : 'text-[var(--text-muted)] hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  )
}
