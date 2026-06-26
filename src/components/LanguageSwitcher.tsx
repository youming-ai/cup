import { Languages } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang, useT } from '../i18n';
import type { Lang } from '../i18n/messages';

const OPTS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中' },
  { code: 'ja', label: '日' },
  { code: 'ko', label: '한' },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 仅在菜单打开时监听 mousedown，关闭后移除
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 打开时把焦点移到当前选中的选项
  useEffect(() => {
    if (isOpen) {
      const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      selected?.focus();
    }
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const select = useCallback(
    (code: Lang) => {
      setLang(code);
      close();
    },
    [setLang, close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      const items = Array.from(
        listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
      );
      const idx = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          items[(idx + 1) % items.length]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length]?.focus();
          break;
        case 'Home':
          e.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
      }
    },
    [isOpen, close],
  );

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={!isOpen ? handleKeyDown : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('common.changeLanguage')}
        className="p-2 hover:bg-panel2 text-chalkdim hover:text-chalk transition-colors"
      >
        <Languages className="w-5 h-5" aria-hidden />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={t('common.changeLanguage')}
          aria-activedescendant={`lang-opt-${lang}`}
          className="absolute right-0 mt-1 w-20 border border-line bg-panel/100 shadow-lg py-1 z-50 focus:outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {OPTS.map((o) => (
            <div
              key={o.code}
              id={`lang-opt-${o.code}`}
              role="option"
              aria-selected={lang === o.code}
              tabIndex={0}
              onClick={() => select(o.code)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select(o.code);
                }
              }}
              className={`w-full text-center py-2 text-xs font-semibold transition-colors cursor-pointer bg-panel ${
                lang === o.code
                  ? 'bg-pitch text-night'
                  : 'text-chalkdim hover:text-chalk hover:bg-panel2'
              }`}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
