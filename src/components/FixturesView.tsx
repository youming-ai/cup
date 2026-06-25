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

  // 按具体日期（开球当天）分组，日期正序；组内按开球时间正序；无时间的排末尾
  const byDate = useMemo(() => {
    const filtered = stage === 'all' ? matches : matches.filter((m) => m.stage === stage);
    const map = new Map<string, WCMatch[]>();
    for (const m of filtered) {
      const k = m.kickoff;
      const key = k
        ? `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, '0')}-${String(k.getDate()).padStart(2, '0')}`
        : 'zzzz-tbd';
      const arr = map.get(key) || [];
      arr.push(m);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [matches, stage]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 赛程 | 积分 子切换 */}
      <div className="flex items-center gap-1 p-1 border border-line bg-panel w-fit">
        {(['schedule', 'standings'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`px-4 py-2 font-display font-semibold text-sm transition-colors ${
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
                className={`shrink-0 px-3 py-2 font-mono text-xs uppercase tracking-wider border-b-2 transition-colors ${
                  stage === s ? 'border-pitch text-chalk' : 'border-transparent text-chalkdim hover:text-chalk'
                }`}
              >
                {s === 'all' ? t('filter.all') : t(`stage.${s}`)}
              </button>
            ))}
          </div>

          {byDate.length === 0 ? (
            <p className="font-mono text-xs tracking-wider text-chalkdim">{t('common.empty')}</p>
          ) : (
            byDate.map(([key, list]) => (
              <section key={key} className="space-y-3">
                <h3 className="font-mono text-xs tracking-[0.2em] text-chalkdim uppercase">
                  {list[0].kickoff
                    ? list[0].kickoff.toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : t('common.tbd')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((m) => (
                    <MatchCard
                      key={m.id}
                      homeName={m.homeName}
                      awayName={m.awayName}
                      homeFlag={m.homeFlag}
                      awayFlag={m.awayFlag}
                      homeScore={m.homeScore}
                      awayScore={m.awayScore}
                      status={m.status}
                      kickoff={m.kickoff}
                      stage={m.stage}
                      group={m.group}
                    />
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
