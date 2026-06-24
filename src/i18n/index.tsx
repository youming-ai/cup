import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { messages, LANGS, type Lang } from './messages';

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = messages[lang]?.[key] ?? messages.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

function detectLang(): Lang {
  const stored = localStorage.getItem('lang');
  if (stored && (LANGS as string[]).includes(stored)) return stored as Lang;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  return (LANGS as string[]).includes(nav) ? (nav as Lang) : 'en';
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    localStorage.setItem('lang', l);
    setLangState(l);
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

export function useT() {
  const { lang } = useContext(Ctx);
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
