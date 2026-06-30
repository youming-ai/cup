import { Bell } from 'lucide-react';
import { googleCalUrl, icsDataUri } from '../utils/calendar';

type T = (k: string) => string;

export function ReminderMenu({ title, start, t }: { title: string; start: Date; t: T }) {
  const event = { title, start };
  const itemCls =
    'block px-3 py-2 text-xs text-chalk hover:bg-overlay/5 whitespace-nowrap transition-colors';
  return (
    <details
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      <summary
        className="list-none cursor-pointer p-1.5 rounded-pill hover:bg-overlay/10 transition-colors"
        aria-label={t('card.reminder')}
        title={t('card.reminder')}
      >
        <Bell className="w-4 h-4" aria-hidden />
      </summary>
      <div className="absolute right-0 top-full z-10 mt-2 border border-line bg-panel shadow-float rounded-card overflow-hidden py-1">
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
