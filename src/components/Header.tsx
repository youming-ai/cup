import { CalendarDays, type LucideIcon, Radio } from 'lucide-react';
import { useT } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

export type View = 'live' | 'schedule';

const VIEWS: { key: View; Icon: LucideIcon }[] = [
  { key: 'schedule', Icon: CalendarDays },
  { key: 'live', Icon: Radio },
];

export default function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const t = useT();
  return (
    // 吸顶。Header 与内容同处一个滚动容器(见 App.tsx)，共享同一条 scrollbar
    // gutter，内边距与下方内容一致(ds-page)即左右对齐，无需补偿。
    <div className="sticky top-0 z-30 bg-night pt-page-y px-page-x md:px-page-x-md">
      <header className="max-w-6xl mx-auto ds-glass md:rounded-panel shadow-panel">
        <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 h-12">
          <h1 className="flex items-center shrink-0 m-0 leading-none">
            <img
              src="/logo-full.png"
              alt={`STREAMCUP — ${t('brand.subtitle')}`}
              width={40}
              height={40}
              className="h-7 sm:h-9 w-auto object-contain"
            />
          </h1>

          <nav aria-label={t('nav.mainLabel')} className="ds-segmented">
            {VIEWS.map(({ key, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                onClick={() => setView(key)}
                aria-selected={view === key}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 rounded-pill font-display font-bold tracking-wide text-sm whitespace-nowrap transition-all duration-200 ${
                  view === key ? 'ds-seg-tab-active' : 'ds-seg-tab-inactive'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {t(`nav.${key}`)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 shrink-0">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>
    </div>
  );
}
