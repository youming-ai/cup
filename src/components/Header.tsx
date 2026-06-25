import { Radio, CalendarDays, type LucideIcon } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useT } from '../i18n';

export type View = 'live' | 'schedule';

const VIEWS: { key: View; Icon: LucideIcon }[] = [
  { key: 'live', Icon: Radio },
  { key: 'schedule', Icon: CalendarDays },
];

export default function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const t = useT();
  return (
    <header className="bg-panel border-b border-line">
      <div className="flex items-center justify-between gap-4 px-5 h-16">
        <div className="flex items-center gap-3 shrink-0">
          <img src="/logo-mark.png" alt="" aria-hidden className="w-9 h-9 object-contain" />
          <div className="leading-none">
            <h1 className="font-display font-bold text-xl tracking-[0.18em] text-chalk">STREAMCUP</h1>
            <div className="font-mono text-[10px] tracking-[0.3em] text-chalkdim mt-1">
              {t('brand.subtitle')}
            </div>
          </div>
        </div>

        <nav
          role="tablist"
          aria-label={t('nav.mainLabel')}
          className="hidden sm:flex items-center gap-1 p-1 border border-line bg-night"
        >
          {VIEWS.map(({ key, Icon }) => (
            <button
              key={key}
              role="tab"
              onClick={() => setView(key)}
              aria-selected={view === key}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 font-display font-semibold tracking-wide text-sm whitespace-nowrap transition-colors ${
                view === key ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden />
              {t(`nav.${key}`)}
            </button>
          ))}
        </nav>

        <LanguageSwitcher />
      </div>

      {/* 移动端导航：占满宽度的分段控件，每段 ~50%、py-2.5 触控友好 */}
      <nav
        role="tablist"
        aria-label={t('nav.mainLabel')}
        className="sm:hidden px-4 pb-3"
      >
        <div className="flex gap-1 p-1 border border-line bg-night">
          {VIEWS.map(({ key, Icon }) => (
            <button
              key={key}
              role="tab"
              onClick={() => setView(key)}
              aria-selected={view === key}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 font-display font-semibold tracking-wide text-sm transition-colors ${
                view === key ? 'bg-pitch text-night' : 'text-chalkdim'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden />
              {t(`nav.${key}`)}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
