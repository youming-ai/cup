import { useT } from '../i18n';
import type { WCGroup } from '../types';

export default function StandingsView({ groups }: { groups: WCGroup[] }) {
  const t = useT();

  if (groups.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim">{t('common.empty')}</p>;
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <div
          key={g.name}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/10">
            <span className="font-display font-bold text-lg text-chalk">
              {t('common.group')} {g.name}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-chalkdim font-mono text-[10px] uppercase">
                <th className="text-left font-medium px-4 py-2">{t('st.team')}</th>
                <th className="px-1 font-medium">{t('st.mp')}</th>
                <th className="px-1 font-medium">{t('st.w')}</th>
                <th className="px-1 font-medium">{t('st.d')}</th>
                <th className="px-1 font-medium">{t('st.l')}</th>
                <th className="px-1 font-medium">{t('st.gd')}</th>
                <th className="px-2 font-medium">{t('st.pts')}</th>
              </tr>
            </thead>
            <tbody>
              {g.standings.map((s, i) => (
                <tr key={s.teamId} className={`border-t border-white/5 ${i < 2 ? 'bg-pitch/[0.06]' : ''}`}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1 h-4 rounded-full ${i < 2 ? 'bg-pitch' : 'bg-transparent'}`} />
                      {s.flag ? (
                        <img src={s.flag} alt={s.name} className="w-5 h-3.5 object-cover rounded-sm" />
                      ) : (
                        <span className="w-5" />
                      )}
                      <span className="font-display font-semibold text-chalk truncate">{s.name}</span>
                    </div>
                  </td>
                  <td className="text-center text-chalkdim tabular-nums">{s.mp}</td>
                  <td className="text-center text-chalkdim tabular-nums">{s.w}</td>
                  <td className="text-center text-chalkdim tabular-nums">{s.d}</td>
                  <td className="text-center text-chalkdim tabular-nums">{s.l}</td>
                  <td className="text-center text-chalkdim tabular-nums">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="text-center font-bold text-chalk tabular-nums">{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
