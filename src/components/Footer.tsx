import { useT } from '../i18n';

export default function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 py-6 border-t border-white/5 text-center space-y-2 shrink-0">
      <p className="font-display text-xs text-chalkdim/60">
        &copy; {year} StreamCup. All rights reserved.
      </p>
      <p className="font-body text-[10px] leading-relaxed text-chalkdim/40 max-w-xl mx-auto px-4">
        {t('footer.disclaimer')}
      </p>
    </footer>
  );
}
