import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COMPETITIONS } from '../competitions';
import { useT } from '../i18n';
import { navigate, pathFor, useRouter } from '../utils/router';

export default function CompetitionSwitcher() {
  const t = useT();
  const { route } = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const comps = Object.values(COMPETITIONS);
  const current = COMPETITIONS[route.comp];

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

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const select = useCallback(
    (key: string) => {
      navigate(pathFor({ kind: 'section', comp: key, section: 'matches' }));
      close();
    },
    [close],
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
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('common.changeCompetition')}
        className="flex items-center gap-1 px-2 py-1.5 rounded-pill hover:bg-overlay/10 text-chalk transition-all duration-200"
      >
        <span className="font-display font-semibold text-sm whitespace-nowrap">
          {current ? t(current.label) : ''}
        </span>
        <ChevronDown className="w-4 h-4 text-chalkdim" aria-hidden />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={t('common.changeCompetition')}
          className="absolute left-0 mt-2 min-w-[10rem] border border-line bg-panel shadow-float rounded-card overflow-hidden py-1 z-50 focus:outline-none"
          onKeyDown={handleKeyDown}
        >
          {comps.map((c) => (
            <div
              key={c.key}
              role="option"
              aria-selected={route.comp === c.key}
              tabIndex={0}
              onClick={() => select(c.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select(c.key);
                }
              }}
              className={`px-4 py-2 text-sm font-display transition-colors cursor-pointer ${
                route.comp === c.key
                  ? 'bg-overlay/10 text-chalk font-bold'
                  : 'text-chalkdim hover:text-chalk hover:bg-overlay/5'
              }`}
            >
              {t(c.label)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
