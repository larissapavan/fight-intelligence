import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ptBR from './locales/pt-BR.json'
import enUS from './locales/en-US.json'

export const LANGUAGE_STORAGE_KEY = 'ufc-predictor:language'

export const resources = {
  'pt-BR': {
    translation: ptBR,
  },
  'en-US': {
    translation: enUS,
  },
} as const

const isTest = import.meta.env?.MODE === 'test'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    lng: isTest
      ? 'en-US'
      : (typeof window !== 'undefined' && window.localStorage?.getItem(LANGUAGE_STORAGE_KEY)) || 'pt-BR',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already protects against XSS
    },
  })

export default i18n
