import { Bell, Star } from 'lucide-react';
import { googleCalUrl, icsDataUri } from '../utils/calendar';

type T = (k: string) => string;

export function FavoriteButton({
  active,
  onToggle,
  t,
  className = '',
}: {
  active?: boolean;
  onToggle: () => void;
  t: T;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={!!active}
      aria-label={t('card.favorite')}
      title={t('card.favorite')}
      className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${active ? 'text-pitch' : 'text-chalkdim hover:text-chalk'} ${className}`}
    >
      <Star className="w-4 h-4" fill={active ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}

export function ReminderMenu({ title, start, t }: { title: string; start: Date; t: T }) {
  const event = { title, start };
  const itemCls =
    'block px-3 py-2 text-xs text-chalk hover:bg-white/5 whitespace-nowrap transition-colors';
  return (
    <details
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      <summary
        className="list-none cursor-pointer p-1.5 rounded-full hover:bg-white/10 transition-colors"
        aria-label={t('card.reminder')}
        title={t('card.reminder')}
      >
        <Bell className="w-4 h-4" aria-hidden />
      </summary>
      <div className="absolute right-0 top-full z-10 mt-2 border border-line bg-panel shadow-2xl rounded-xl overflow-hidden py-1">
        {/* .ics opens the OS/system calendar; download attr names the file */}
        <a href={icsDataUri(event)} download={`${title}.ics`} className={itemCls}>
          {t('cal.system')}
        </a>
        <a href={googleCalUrl(event)} target="_blank" rel="noopener noreferrer" className={itemCls}>
          {t('cal.google')}
        </a>
      </div>
    </details>
  );
}
