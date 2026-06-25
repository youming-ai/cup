import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { messages, LANGS, type Lang } from './messages';

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = messages[lang]?.[key] ?? messages.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

function detectLang(): Lang {
  // an explicit choice (from the switcher) always wins
  const stored = localStorage.getItem('lang');
  if (stored && (LANGS as string[]).includes(stored)) return stored as Lang;
  // otherwise default to the first system/browser language we support, else English
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const pref of prefs) {
    const code = pref.slice(0, 2).toLowerCase();
    if ((LANGS as string[]).includes(code)) return code as Lang;
  }
  return 'en';
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
    try { localStorage.setItem('lang', l); } catch { /* private/full */ }
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
