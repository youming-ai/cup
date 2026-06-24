import { useState, useEffect, useRef } from 'react';
import { Globe } from '@phosphor-icons/react';
import { useLang } from '../i18n';
import type { Lang } from '../i18n/messages';

const OPTS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中' },
  { code: 'ja', label: '日' },
  { code: 'ko', label: '한' },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="p-2 rounded-full hover:bg-white/10 text-chalkdim hover:text-chalk transition-all"
        title="Change language"
      >
        <Globe className="w-5 h-5" aria-hidden />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-1 w-20 rounded-xl border border-white/10 bg-panel shadow-lg py-1 z-50 focus:outline-none"
        >
          {OPTS.map((o) => (
            <button
              key={o.code}
              role="option"
              aria-selected={lang === o.code}
              onClick={() => {
                setLang(o.code);
                setIsOpen(false);
              }}
              className={`w-full text-center py-2 text-xs font-semibold transition-colors ${
                lang === o.code
                  ? 'bg-pitch text-night'
                  : 'text-chalkdim hover:text-chalk hover:bg-white/5'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

