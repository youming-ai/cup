import { useT } from '../i18n';
import ThemeSwitcher from './ThemeSwitcher';
export default function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 py-4 border-t border-overlay/5 text-center space-y-1.5 shrink-0">
      <div className="flex items-center justify-center gap-2">
        <p className="font-display text-label text-chalkdim/80">
          {t('footer.copyright', { year: String(year) })}
        </p>
        <ThemeSwitcher />
      </div>
      <p className="font-body text-caption leading-relaxed text-chalkdim/60 max-w-xl mx-auto px-page-x">
        {t('footer.disclaimer')}
      </p>
    </footer>
  );
}
