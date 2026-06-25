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
    // 悬浮：脱离顶边留出 night 背景；左右内边距与下方内容容器(p-4/md:p-6)一致
    <div className="bg-night px-4 md:px-6 pt-4">
      <header className="max-w-6xl mx-auto bg-panel/85 backdrop-blur-md border border-line shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] ring-1 ring-pitch/10">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-5 h-14">
          <h1 className="flex items-center shrink-0 m-0 leading-none">
            <img
              src="/logo-full.png"
              alt={`STREAMCUP — ${t('brand.subtitle')}`}
              className="h-10 w-auto object-contain"
            />
          </h1>

          <nav
            role="tablist"
            aria-label={t('nav.mainLabel')}
            className={`hidden sm:flex items-center gap-1 p-1 border border-line bg-night`}
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

        {/* 移动端导航：胶囊内第二行，占满宽度的分段控件，每段 ~50%、py-2.5 触控友好 */}
        <nav
          role="tablist"
          aria-label={t('nav.mainLabel')}
          className="sm:hidden px-3 pb-3"
        >
          <div className={`flex gap-1 p-1 border border-line bg-night`}>
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
    </div>
  );
}
