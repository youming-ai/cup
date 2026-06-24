import { Globe } from 'lucide-react';
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
  return (
    <div className="flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/5">
      <Globe className="w-3.5 h-3.5 text-chalkdim ml-1" aria-hidden />
      {OPTS.map((o) => (
        <button
          key={o.code}
          onClick={() => setLang(o.code)}
          aria-pressed={lang === o.code}
          className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
            lang === o.code ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
