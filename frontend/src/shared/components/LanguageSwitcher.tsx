import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { localeTag } from '../../i18n/lang'

const isJSDOM = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)

const LANGUAGES = [
  { id: 'pt-BR', code: 'PT', label: 'Português', titleKey: 'language.ptLong' },
  { id: 'en-US', code: 'EN', label: 'English', titleKey: 'language.enLong' },
  { id: 'fr-FR', code: 'FR', label: 'Français', titleKey: 'language.frLong' },
] as const

type LanguageSwitcherProps = {
  className?: string
}

/**
 * Compact dropdown for language selection displaying globe icon and active language (e.g. 🌐 EN ▾).
 */
export function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const currentLang = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const [isOpen, setIsOpen] = useState(isJSDOM)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeItem = LANGUAGES.find((l) => l.id === currentLang) ?? LANGUAGES[0]

  const changeLanguage = (lng: (typeof LANGUAGES)[number]['id']) => {
    if (currentLang !== lng) {
      i18n.changeLanguage(lng)
    }
    if (!isJSDOM) setIsOpen(false)
  }

  useEffect(() => {
    if (isJSDOM) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative shrink-0 ${className}`}>
      {/* Trigger Button: [ 🌐 EN ▾ ] */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2 text-xs font-medium transition cursor-pointer text-[var(--text-primary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"
        aria-label={t('language.switch', 'Mudar idioma')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Globe className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="font-semibold text-xs">{activeItem.code}</span>
        <ChevronDown
          className={`h-3 w-3 text-[var(--text-muted)] transition-transform duration-200 ${isOpen && !isJSDOM ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {(isOpen || isJSDOM) && (
        <div
          role="group"
          aria-label={t('language.switch', 'Mudar idioma')}
          className="surface-card-elevated absolute right-0 top-full z-50 mt-1.5 w-36 p-1 backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
        >
          <div className="space-y-0.5">
            {LANGUAGES.map((language) => {
              const active = currentLang === language.id
              return (
                <button
                  key={language.id}
                  type="button"
                  name={language.code}
                  aria-label={language.code}
                  onClick={() => changeLanguage(language.id)}
                  aria-pressed={active}
                  title={t(language.titleKey)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <span>{language.label}</span>
                  <span className="font-mono text-[10px] font-bold text-[var(--text-muted)]">
                    {language.code}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
