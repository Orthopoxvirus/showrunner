import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './de.json'
import en from './en.json'

const stored = localStorage.getItem('showrunner.lang')
const browser = navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: stored ?? browser,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: 'de' | 'en'): void {
  localStorage.setItem('showrunner.lang', lang)
  void i18n.changeLanguage(lang)
}

export default i18n
