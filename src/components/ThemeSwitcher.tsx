import { Moon, Sun } from 'lucide-react';
import { useT } from '../i18n';
import { type Theme, useTheme } from '../theme';

const CYCLE: Theme[] = ['dark', 'light'];

const ICONS = {
  dark: Moon,
  light: Sun,
} as const;

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const t = useT();
  const Icon = ICONS[theme];

  const cycle = () => {
    const idx = CYCLE.indexOf(theme);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={t(`theme.${theme}`)}
      title={t(`theme.${theme}`)}
      className="p-2 rounded-pill hover:bg-overlay/10 text-chalkdim hover:text-chalk transition-all duration-200"
    >
      <Icon className="w-5 h-5" aria-hidden />
    </button>
  );
}
