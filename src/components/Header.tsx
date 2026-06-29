import { CalendarDays, type LucideIcon, Radio } from 'lucide-react';
import { useT } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';

export type View = 'live' | 'schedule';

const VIEWS: { key: View; Icon: LucideIcon }[] = [
  { key: 'schedule', Icon: CalendarDays },
  { key: 'live', Icon: Radio },
];

export default function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const t = useT();
  return (
    // 吸顶。Header 与内容同处一个滚动容器(见 App.tsx)，共享同一条 scrollbar
    // gutter，内边距与下方内容一致(p-4/md:p-6)即左右对齐，无需补偿。
    <div className="sticky top-0 z-30 bg-night pt-4 px-4 md:px-6">
      <header className="max-w-6xl mx-auto bg-panel/85 border border-line/30 rounded-2xl md:rounded-[24px] shadow-lg backdrop-blur-md">
        {/* 单行：logo · 导航 · 语言。移动端缩小内边距让两个 tab 与 logo、语言挤进一行 */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-4 sm:px-6 h-14">
          <h1 className="flex items-center shrink-0 m-0 leading-none">
            <img
              src="/logo-full.png"
              alt={`STREAMCUP — ${t('brand.subtitle')}`}
              width={40}
              height={40}
              className="h-8 sm:h-10 w-auto object-contain"
            />
          </h1>

          <nav
            aria-label={t('nav.mainLabel')}
            className="flex items-center gap-1 p-1 bg-white/5 border border-white/5 rounded-full select-none"
          >
            {VIEWS.map(({ key, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                onClick={() => setView(key)}
                aria-selected={view === key}
                className={`inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-full font-display font-bold tracking-wide text-sm whitespace-nowrap transition-all duration-200 ${
                  view === key
                    ? 'bg-white/10 text-chalk shadow-sm'
                    : 'text-chalkdim hover:text-chalk'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {t(`nav.${key}`)}
              </button>
            ))}
          </nav>

          <LanguageSwitcher />
        </div>
      </header>
    </div>
  );
}
