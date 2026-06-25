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
    // 悬浮：脱离顶边留出 night 背景。下方内容容器是滚动区，用 scrollbar-gutter
    // stable both-edges 预留两侧各一个滚动条宽度；这里在 p-4/md:p-6 基础上各加
    // 同一个 --sb-w(单一来源，见 index.css)，让胶囊与下方卡片左右对齐。
    <div className="bg-night pt-4 px-[calc(1rem_+_var(--sb-w))] md:px-[calc(1.5rem_+_var(--sb-w))]">
      <header className="max-w-6xl mx-auto bg-panel border border-line">
        {/* 单行：logo · 导航 · 语言。移动端缩小内边距让两个 tab 与 logo、语言挤进一行 */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 h-14">
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
            role="tablist"
            aria-label={t('nav.mainLabel')}
            className={`flex items-center gap-1 p-1 border border-line bg-night`}
          >
            {VIEWS.map(({ key, Icon }) => (
              <button
                key={key}
                role="tab"
                onClick={() => setView(key)}
                aria-selected={view === key}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 font-display font-semibold tracking-wide text-sm whitespace-nowrap transition-colors ${
                  view === key ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
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
