import { useMemo } from 'react';
import { useT } from '../i18n';
import type { WCGroup } from '../types';

export default function StandingsView({ groups }: { groups: WCGroup[] }) {
  const t = useT();

  // WC2026 出线：每组前 2 名 + 跨组 8 个成绩最好的第三名 → 32 强。
  // 这里按 pts→gd→gf 给所有第三名排序，取前 8 个标记为"最佳第三名"出线。
  const bestThirdIds = useMemo(() => {
    const thirds = groups.map((g) => g.standings[2]).filter(Boolean);
    thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    return new Set(thirds.slice(0, 8).map((tm) => tm.teamId));
  }, [groups]);

  if (groups.length === 0) {
    return <p className="font-mono text-xs tracking-wider text-chalkdim">{t('standings.empty')}</p>;
  }

  return (
    <div className="space-y-5">
      {/* 出线图例 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-wider text-chalkdim">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-3 rounded-full bg-pitch" />
          {t('standings.advanceTop2')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-3 rounded-full bg-pitch/40" />
          {t('standings.advanceThird')}
        </span>
      </div>

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
                  <th className="px-1 font-medium hidden sm:table-cell">{t('st.w')}</th>
                  <th className="px-1 font-medium hidden sm:table-cell">{t('st.d')}</th>
                  <th className="px-1 font-medium hidden sm:table-cell">{t('st.l')}</th>
                  <th className="px-1 font-medium">{t('st.gd')}</th>
                  <th className="px-2 font-medium">{t('st.pts')}</th>
                </tr>
              </thead>
              <tbody>
                {g.standings.map((s, i) => {
                  const qual =
                    i < 2 ? 'direct' : i === 2 && bestThirdIds.has(s.teamId) ? 'third' : 'none';
                  return (
                    <tr
                      key={s.teamId}
                      className={`border-t border-white/5 ${
                        qual === 'direct'
                          ? 'bg-pitch/[0.06]'
                          : qual === 'third'
                            ? 'bg-pitch/[0.03]'
                            : ''
                      }`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1 h-4 rounded-full ${
                              qual === 'direct'
                                ? 'bg-pitch'
                                : qual === 'third'
                                  ? 'bg-pitch/40'
                                  : 'bg-transparent'
                            }`}
                          />
                          {s.flag ? (
                            <img src={s.flag} alt={s.name} className="w-5 h-3.5 object-cover rounded-sm" />
                          ) : (
                            <span className="w-5" />
                          )}
                          <span className="font-display font-semibold text-chalk truncate">{s.name}</span>
                        </div>
                      </td>
                      <td className="text-center text-chalkdim tabular-nums">{s.mp}</td>
                      <td className="text-center text-chalkdim tabular-nums hidden sm:table-cell">{s.w}</td>
                      <td className="text-center text-chalkdim tabular-nums hidden sm:table-cell">{s.d}</td>
                      <td className="text-center text-chalkdim tabular-nums hidden sm:table-cell">{s.l}</td>
                      <td className="text-center text-chalkdim tabular-nums">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                      <td className="text-center font-bold text-chalk tabular-nums">{s.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
