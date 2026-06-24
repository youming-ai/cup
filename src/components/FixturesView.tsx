import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import MatchCard from './MatchCard';
import StandingsView from './StandingsView';
import type { WCGroup, WCMatch } from '../types';

const KNOWN_STAGES = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

export default function FixturesView({ matches, groups }: { matches: WCMatch[]; groups: WCGroup[] }) {
  const t = useT();
  const [tab, setTab] = useState<'schedule' | 'standings'>('schedule');
  const [stage, setStage] = useState<string>('all');

  const stages = useMemo(() => {
    const present = new Set(matches.map((m) => m.stage));
    return ['all', ...KNOWN_STAGES.filter((s) => present.has(s))];
  }, [matches]);

  const byDay = useMemo(() => {
    const filtered = stage === 'all' ? matches : matches.filter((m) => m.stage === stage);
    const map = new Map<number, WCMatch[]>();
    [...filtered]
      .sort((a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0))
      .forEach((m) => {
        const arr = map.get(m.matchday) || [];
        arr.push(m);
        map.set(m.matchday, arr);
      });
    // 比赛日正序：从第 1 个比赛日开始
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches, stage]);

  return (
    <div className="space-y-6">
      {/* 赛程 | 积分 子切换 */}
      <div className="flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/5 w-fit">
        {(['schedule', 'standings'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`px-4 py-1.5 rounded-full font-display font-semibold text-sm transition-colors ${
              tab === k ? 'bg-pitch text-night' : 'text-chalkdim hover:text-chalk'
            }`}
          >
            {t(`fixtures.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'standings' ? (
        <StandingsView groups={groups} />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                aria-pressed={stage === s}
                className={`shrink-0 px-3 py-1 font-mono text-xs uppercase tracking-wider border-b-2 transition-colors ${
                  stage === s ? 'border-pitch text-chalk' : 'border-transparent text-chalkdim hover:text-chalk'
                }`}
              >
                {s === 'all' ? t('filter.all') : t(`stage.${s}`)}
              </button>
            ))}
          </div>

          {byDay.length === 0 ? (
            <p className="font-mono text-xs tracking-wider text-chalkdim">{t('common.empty')}</p>
          ) : (
            byDay.map(([day, list]) => (
              <section key={day} className="space-y-3">
                <h3 className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase">
                  {t('common.matchday', { n: day })}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((m) => (
                    <MatchCard key={m.id} {...m} />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
