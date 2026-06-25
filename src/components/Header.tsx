import LanguageSwitcher from './LanguageSwitcher';
import { useT } from '../i18n';

export type View = 'live' | 'schedule';

const VIEWS: { key: View; icon: string }[] = [
  { key: 'live', icon: '🔴' },
  { key: 'schedule', icon: '📅' },
];

export default function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const t = useT();
  return (
    <header className="bg-panel border-b border-line">
      <div className="flex items-center justify-between gap-4 px-5 h-16">
        <div className="flex items-center gap-3 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-pitch shadow-[0_0_12px_rgba(43,217,107,0.8)]" />
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
          className="hidden sm:flex items-center gap-1 p-1 rounded-full border border-line bg-night"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              onClick={() => setView(v.key)}
              aria-selected={view === v.key}
              className={`px-4 py-1.5 rounded-full font-display font-semibold tracking-wide text-sm whitespace-nowrap transition-colors ${
                view === v.key ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
              }`}
            >
              <span className="mr-1">{v.icon}</span>
              {t(`nav.${v.key}`)}
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
        <div className="flex gap-1 p-1 rounded-full border border-line bg-night">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              onClick={() => setView(v.key)}
              aria-selected={view === v.key}
              className={`flex-1 py-2.5 rounded-full font-display font-semibold tracking-wide text-sm transition-colors ${
                view === v.key ? 'bg-pitch text-night' : 'text-chalkdim'
              }`}
            >
              <span className="mr-1">{v.icon}</span>
              {t(`nav.${v.key}`)}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
