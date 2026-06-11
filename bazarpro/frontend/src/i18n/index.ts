import { ru } from './ru'
import { uz } from './uz'
import { create } from 'zustand'

type Lang = 'ru' | 'uz'
interface LangStore { lang: Lang; t: typeof ru; setLang: (l: Lang) => void }

export const useLang = create<LangStore>((set) => ({
  lang: (localStorage.getItem('lang') as Lang) || 'ru',
  t: (localStorage.getItem('lang') === 'uz' ? uz : ru) as typeof ru,
  setLang: (lang) => {
    localStorage.setItem('lang', lang)
    set({ lang, t: (lang === 'uz' ? uz : ru) as typeof ru })
  },
}))
