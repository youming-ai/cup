import { useT } from '../i18n';
import { navigate, pathFor, type Section } from '../utils/router';
import LanguageSwitcher from './LanguageSwitcher';

const SECTION_TABS: { section: Section; labelKey: string }[] = [
  { section: 'matches', labelKey: 'fixtures.schedule' },
  { section: 'standings', labelKey: 'fixtures.standings' },
  { section: 'scorers', labelKey: 'fixtures.scorers' },
  { section: 'bracket', labelKey: 'fixtures.bracket' },
];

// `section` is the active schedule section, or undefined on match/team/player
// pages — the tabs still navigate (jump back to a section) but none is marked
// active there.
export default function Header({ section }: { section?: Section }) {
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

          <nav
            aria-label={t('nav.mainLabel')}
            className="ds-segmented min-w-0 overflow-x-auto no-scrollbar"
          >
            {SECTION_TABS.map(({ section: s, labelKey }) => (
              <button
                key={s}
                type="button"
                onClick={() => navigate(pathFor({ kind: 'section', section: s }))}
                aria-pressed={section === s}
                className={`whitespace-nowrap ds-seg-tab ${
                  section === s ? 'ds-seg-tab-active' : 'ds-seg-tab-inactive'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 shrink-0">
            <LanguageSwitcher />
          </div>
        </div>
      </header>
    </div>
  );
}
